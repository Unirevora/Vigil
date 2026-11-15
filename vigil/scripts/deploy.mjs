#!/usr/bin/env node
/** One-command deployment of this folder to the server, served at https://<host>:8443/vigil/.
 *
 *   npm run deploy                 # build CSS, test, upload, install, health-check
 *   node scripts/deploy.mjs --skip-tests
 *   node scripts/deploy.mjs --no-nginx      # only update app files + service
 *
 * Needs: Node 18+, OpenSSH `ssh` and `tar` on PATH (both ship with Windows 10+),
 * an ~/.ssh/config host entry (default `pku-cloud`) and passwordless sudo on the server.
 * Override defaults with environment variables, e.g. VIGIL_DEPLOY_HOST=myserver.
 *
 * Server layout:
 *   ~/vigil-inkpress            current release (Node service on 127.0.0.1:PORT)
 *   ~/vigil-inkpress.prev       previous release (automatic rollback target)
 *   /etc/systemd/system/vigil.service
 *   /etc/nginx/snippets/vigil-app.conf            HTTPS site: /vigil/ -> Node service
 *   /etc/nginx/snippets/vigil-https-redirect.conf HTTP site: /vigil -> HTTPS (Web Crypto needs a secure context)
 */
import {spawn,spawnSync} from 'node:child_process';
import {readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const args=new Set(process.argv.slice(2));
const cfg={
  host:process.env.VIGIL_DEPLOY_HOST||'pku-cloud',
  publicHost:process.env.VIGIL_PUBLIC_HOST||'10.129.81.79',
  appDir:process.env.VIGIL_REMOTE_DIR||'vigil-inkpress',          // relative to the remote $HOME
  basePath:(process.env.VIGIL_BASE_PATH||'/vigil').replace(/\/+$/,''),
  port:Number(process.env.VIGIL_PORT||5173),
  httpsPort:Number(process.env.VIGIL_HTTPS_PORT||8443),
  service:process.env.VIGIL_SERVICE||'vigil',
  httpSite:process.env.VIGIL_NGINX_HTTP_SITE||'/etc/nginx/sites-enabled/yanyuanzhi-http.conf',
  httpsSite:process.env.VIGIL_NGINX_HTTPS_SITE||'/etc/nginx/sites-enabled/yanyuanzhi-https.conf',
  skipTests:args.has('--skip-tests'),
  nginx:!args.has('--no-nginx')
};
if(!/^\/[A-Za-z0-9_-]+$/.test(cfg.basePath))throw new Error(`VIGIL_BASE_PATH must look like /vigil, got ${cfg.basePath}`);
if(!/^[A-Za-z0-9_.-]+$/.test(cfg.appDir))throw new Error('VIGIL_REMOTE_DIR must be a simple directory name under $HOME');
if(!/^[A-Za-z0-9_.@-]+$/.test(cfg.service))throw new Error('VIGIL_SERVICE has invalid characters');
for(const k of ['port','httpsPort'])if(!(cfg[k]>0&&cfg[k]<65536))throw new Error(`invalid ${k}`);

const step=msg=>console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`);
const fail=msg=>{console.error(`\n\x1b[31m✖ ${msg}\x1b[0m`);process.exit(1);};
function run(cmd,argv,opts={}){
  const r=spawnSync(cmd,argv,{cwd:root,stdio:'inherit',...opts});
  if(r.error)fail(`${cmd} 无法运行：${r.error.message}`);
  return r.status;
}

// ---------------------------------------------------------------- local checks
step(`本地检查 · ${root}`);
const [major]=process.versions.node.split('.').map(Number);
if(major<18)fail(`需要 Node.js 18+，当前 ${process.version}`);
if(run(process.execPath,['scripts/version.mjs','--check'])!==0)fail('版本号不一致，已停止部署：运行 version.cmd 或 node scripts/version.mjs <版本号> 统一更新');
for(const f of ['fonts/titlefont.ttf','fonts/textfont.ttf'])
  if(!existsSync(join(root,f)))console.warn(`  ! 缺少 ${f}：网站将回退到系统字体（见 fonts/README.md）`);
if(run(process.execPath,['scripts/build-css.mjs'])!==0)fail('CSS 构建失败');
if(!cfg.skipTests){
  step('运行单元测试');
  const tests=readdirSync(join(root,'tests')).filter(f=>f.endsWith('.test.js')).map(f=>`tests/${f}`);
  if(run(process.execPath,['--test','--test-reporter=dot',...tests])!==0)fail('单元测试失败，已停止部署（可用 --skip-tests 跳过）');
}

step(`检查 SSH 连接 · ${cfg.host}`);
if(run('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10',cfg.host,'sudo -n true && command -v node >/dev/null && command -v nginx >/dev/null'])!==0)
  fail(`无法通过 SSH 登录 ${cfg.host}，或服务器缺少免密 sudo / node / nginx`);

// ---------------------------------------------------------------- upload
step('打包并上传');
const stage=`${cfg.appDir}.incoming`;
await new Promise((ok,ko)=>{
  const tar=spawn('tar',['-czf','-','--exclude=./.git','--exclude=./node_modules','--exclude=./coverage',
    '--exclude=*.log','--exclude=.DS_Store','.'],{cwd:root,stdio:['ignore','pipe','inherit']});
  const ssh=spawn('ssh',['-o','BatchMode=yes',cfg.host,
    `rm -rf ~/${stage} && mkdir -p ~/${stage} && tar -xzf - -C ~/${stage} && find ~/${stage} -type f | wc -l`],
    {stdio:['pipe','inherit','inherit']});
  tar.stdout.pipe(ssh.stdin);
  tar.on('error',e=>ko(new Error('tar 无法运行：'+e.message)));
  ssh.on('error',e=>ko(new Error('ssh 无法运行：'+e.message)));
  let tarCode=null;
  tar.on('close',c=>{tarCode=c;});
  ssh.on('close',c=>(c===0&&tarCode===0)?ok():ko(new Error(`上传失败（tar=${tarCode}, ssh=${c}）`)));
}).catch(e=>fail(e.message));

// ---------------------------------------------------------------- remote install
const B=cfg.basePath;
const appConf=`# Managed by scripts/deploy.mjs — Vigil Inkpress at ${B}/ -> Node service 127.0.0.1:${cfg.port}
location = ${B} { return 301 $scheme://$http_host${B}/; }

location ^~ ${B}/api/ {
    # The Node relay only trusts loopback Host/Origin; enforce same-origin here instead.
    set $vigil_origin_ok 0;
    if ($http_origin = "") { set $vigil_origin_ok 1; }
    if ($http_origin = "$scheme://$http_host") { set $vigil_origin_ok 1; }
    if ($vigil_origin_ok = 0) { return 403; }
    proxy_pass http://127.0.0.1:${cfg.port}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host 127.0.0.1:${cfg.port};
    proxy_set_header Origin "";
    proxy_set_header Cookie "";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_hide_header X-Content-Type-Options;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
    client_max_body_size 4m;
}

location ^~ ${B}/ {
    proxy_pass http://127.0.0.1:${cfg.port}/;
    proxy_http_version 1.1;
    proxy_set_header Host 127.0.0.1:${cfg.port};
    proxy_set_header Cookie "";
    proxy_hide_header X-Content-Type-Options;
    proxy_read_timeout 60s;
}
`;
const redirectConf=`# Managed by scripts/deploy.mjs — Vigil needs a secure context (Web Crypto / clipboard).
location = ${B} { return 301 https://$host:${cfg.httpsPort}${B}/; }
location ^~ ${B}/ { return 301 https://$host:${cfg.httpsPort}$request_uri; }
`;
const remote=String.raw`set -euo pipefail
APP="$HOME/__APP__"; STAGE="$HOME/__STAGE__"; PREV="$APP.prev"; SVC="__SVC__"
say(){ printf '  %s\n' "$*"; }
NODE_BIN=$(command -v node)
LOG=$(mktemp); trap 'rm -f "$LOG"' EXIT
say "服务器 Node $($NODE_BIN -v)"
cd "$STAGE"
$NODE_BIN --check scripts/dev-server.mjs && $NODE_BIN --check scripts/github-proxy.mjs
if [ "__SKIP_TESTS__" != 1 ]; then
  say "在服务器上运行测试…"
  $NODE_BIN --test --test-reporter=dot tests/*.test.js >"$LOG" 2>&1 || { tail -40 "$LOG"; echo "服务器端测试失败，未切换版本"; exit 1; }
fi

# --- swap releases
rm -rf "$PREV"
[ -d "$APP" ] && mv "$APP" "$PREV"
mv "$STAGE" "$APP"
say "已切换到新版本（上一版保留在 $PREV）"

rollback(){
  echo "!! 健康检查失败，回滚到上一版本"
  if [ -d "$PREV" ]; then rm -rf "$APP.failed"; mv "$APP" "$APP.failed"; mv "$PREV" "$APP"; sudo systemctl restart "$SVC"; fi
  exit 1
}

# --- systemd unit
UNIT=$(cat <<UNIT_EOF
[Unit]
Description=Vigil Inkpress (served at __BASE__/ via nginx; managed by scripts/deploy.mjs)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=$APP
ExecStart=$NODE_BIN scripts/dev-server.mjs
Environment=NODE_ENV=production
Environment=PORT=__PORT__
Environment=VIGIL_PROXY_LOCK=1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT_EOF
)
if ! printf '%s\n' "$UNIT" | sudo cmp -s - "/etc/systemd/system/$SVC.service"; then
  printf '%s\n' "$UNIT" | sudo tee "/etc/systemd/system/$SVC.service" >/dev/null
  sudo systemctl daemon-reload
  say "已更新 systemd 单元 $SVC.service"
fi
sudo systemctl enable "$SVC" >/dev/null 2>&1
sudo systemctl restart "$SVC"

# --- nginx
if [ "__NGINX__" = 1 ]; then
  TMPD=$(mktemp -d)
  cat > "$TMPD/vigil-app.conf" <<'NGINX_APP_EOF'
__APPCONF__NGINX_APP_EOF
  cat > "$TMPD/vigil-https-redirect.conf" <<'NGINX_REDIR_EOF'
__REDIRCONF__NGINX_REDIR_EOF
  BK=$(mktemp -d)
  for f in vigil-app.conf vigil-https-redirect.conf; do
    [ -f "/etc/nginx/snippets/$f" ] && sudo cp -a "/etc/nginx/snippets/$f" "$BK/$f"
    sudo install -m 644 "$TMPD/$f" "/etc/nginx/snippets/$f"
  done
  add_include(){ # $1 site file, $2 snippet
    local real; real=$(readlink -f "$1")
    [ -f "$real" ] || { echo "!! 找不到 nginx 站点文件 $1"; return 1; }
    if ! grep -q "snippets/$2;" "$real"; then
      sudo cp -a "$real" "$BK/$(basename "$real").site"
      printf '%s\n' "$real" > "$BK/$(basename "$real").path"
      # insert right after the first 'server_name' line of the server block
      sudo sed -i "0,/^\(\s*\)server_name .*;/s||&\n\1include /etc/nginx/snippets/$2;|" "$real"
      say "已在 $real 中加入 include $2"
    fi
  }
  add_include "__HTTPS_SITE__" vigil-app.conf
  add_include "__HTTP_SITE__" vigil-https-redirect.conf
  if sudo nginx -t >"$LOG" 2>&1; then
    sudo systemctl reload nginx; say "nginx 配置已生效"
  else
    cat "$LOG"
    echo "!! nginx 配置检查失败，恢复原配置"
    for f in vigil-app.conf vigil-https-redirect.conf; do
      if [ -f "$BK/$f" ]; then sudo cp -a "$BK/$f" "/etc/nginx/snippets/$f"; else sudo rm -f "/etc/nginx/snippets/$f"; fi
    done
    for s in "$BK"/*.site; do [ -e "$s" ] || continue; sudo cp -a "$s" "$(cat "$BK/$(basename "$s" .site).path")"; done
    rollback
  fi
  rm -rf "$TMPD"
fi

# --- health checks (through nginx, like a browser)
ok=0
for i in $(seq 1 20); do
  curl -fs -o /dev/null "http://127.0.0.1:__PORT__/" && { ok=1; break; }
  sleep 0.5
done
[ $ok = 1 ] || { journalctl -u "$SVC" -n 20 --no-pager; rollback; }
check(){ # $1 label, $2 expected code, rest: curl args
  local label=$1 want=$2; shift 2
  local got; got=$(curl -sk -o /dev/null -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then say "✔ $label ($got)"; else echo "!! $label: HTTP $got，期望 $want"; return 1; fi
}
H="https://127.0.0.1:__HTTPS_PORT____BASE__"
check "页面"            200 "$H/"                          || rollback
check "样式表"          200 "$H/assets/vigil.css"          || rollback
check "主程序"          200 "$H/src/main.js"               || rollback
check "中继自检"        200 "$H/api/github/health"         || rollback
check "跨站请求被拒绝"  403 -X POST -H "Origin: https://evil.example" "$H/api/github/proxy" || rollback
check "代理设置已锁定"  409 -X POST -H "Content-Type: application/json" -d '{"mode":"env"}' "$H/api/github/proxy" || rollback
if [ "__NGINX__" = 1 ]; then check "HTTP 跳转 HTTPS" 301 "http://127.0.0.1__BASE__" || rollback; fi
PAGE=$(curl -sk "$H/")   # not 'curl | grep -q': with pipefail, grep's early exit SIGPIPEs curl
if grep -q 'name="vigil-relay"' <<<"$PAGE"; then say "✔ 页面已启用同源 GitHub 中继"; else echo "!! 页面缺少 vigil-relay 标记"; rollback; fi
if [ "$(curl -sk -m 12 -o /dev/null -w '%{http_code}' "$H/api/github/diagnose")" = 200 ]; then say "✔ 服务器可访问 GitHub API"; else echo "  ! 服务器暂时无法访问 GitHub API（不影响本地手记）"; fi
rm -rf "$APP.failed"
`;
const fill=s=>s
  .replaceAll('__APPCONF__',appConf).replaceAll('__REDIRCONF__',redirectConf)
  .replaceAll('__APP__',cfg.appDir).replaceAll('__STAGE__',stage).replaceAll('__SVC__',cfg.service)
  .replaceAll('__BASE__',B).replaceAll('__HTTPS_PORT__',String(cfg.httpsPort)).replaceAll('__PORT__',String(cfg.port))
  .replaceAll('__HTTPS_SITE__',cfg.httpsSite).replaceAll('__HTTP_SITE__',cfg.httpSite)
  .replaceAll('__SKIP_TESTS__',cfg.skipTests?'1':'0').replaceAll('__NGINX__',cfg.nginx?'1':'0');

step('在服务器上安装、切换版本并检查');
if(run('ssh',['-o','BatchMode=yes',cfg.host,'bash -s'],{input:fill(remote),stdio:['pipe','inherit','inherit']})!==0)
  fail('服务器端部署失败（如已切换版本，脚本会自动回滚到上一版）');

console.log(`\n\x1b[32m✔ 部署完成\x1b[0m  https://${cfg.publicHost}:${cfg.httpsPort}${B}/`);
console.log(`  （http://${cfg.publicHost}${B} 会自动跳转到上面的 HTTPS 地址）`);
