# 部署到服务器

不眠手记在服务器上以子路径 **`/vigil/`** 运行：nginx 负责 HTTPS 与同源校验，项目自带的 Node 服务（`scripts/dev-server.mjs`）提供页面并充当 GitHub 同源中继。

```
浏览器 ──HTTPS:8443──▶ nginx  /vigil/      ──▶ 127.0.0.1:5173  Node（页面 + api/github 中继）──▶ api.github.com
          HTTP:80  ──▶ nginx  /vigil → 301 跳转到 https://<主机>:8443/vigil/
```

## 一键部署

Windows 下双击项目根目录的 **`deploy.cmd`**，或在命令行运行：

```bat
deploy.cmd                 :: 完整流程
deploy.cmd --skip-tests    :: 跳过本地与服务器端单元测试
deploy.cmd --no-nginx      :: 只更新程序与 systemd 服务，不改 nginx
```

其他系统：`npm run deploy` 或 `node scripts/deploy.mjs [同上参数]`。

需要：Node.js 18+；系统自带的 OpenSSH `ssh` 与 `tar`（Windows 10 1803+ 自带）；`~/.ssh/config` 中可免密登录的主机（默认 `pku-cloud`）；服务器上有 `node`、`nginx` 与免密 `sudo`。

脚本依次执行：

1. 本地：检查字体文件、构建 `assets/vigil.css`、运行单元测试；
2. 检查 SSH、`sudo`、`node`、`nginx`；
3. 打包上传到 `~/vigil-inkpress.incoming`（排除 `.git`、`node_modules`、日志），并在服务器上再跑一次测试；
4. 切换版本：当前版本 → `~/vigil-inkpress.prev`，新版本 → `~/vigil-inkpress`；
5. 写入 / 更新 `vigil.service`、nginx 片段与 include，`nginx -t` 通过后热重载；
6. 通过 nginx 做 9 项健康检查：页面、样式表、主程序、中继自检、跨站请求被拒（403）、代理设置已锁定（409）、HTTP→HTTPS 跳转（301）、页面带有中继标记、服务器可访问 GitHub API（仅提示，不阻断）。

**任何一项失败都会自动回滚**到上一版本；nginx 配置检查失败时同时恢复原有 nginx 文件。服务器上始终只保留当前与上一版本，历史版本请以 GitHub 仓库的提交 / tag 为准。

### 可覆盖的环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VIGIL_DEPLOY_HOST` | `pku-cloud` | `~/.ssh/config` 中的主机名 |
| `VIGIL_PUBLIC_HOST` | `10.129.81.79` | 完成后打印的访问地址 |
| `VIGIL_REMOTE_DIR` | `vigil-inkpress` | `$HOME` 下的部署目录名 |
| `VIGIL_BASE_PATH` | `/vigil` | 子路径 |
| `VIGIL_PORT` | `5173` | Node 服务端口（仅监听 127.0.0.1） |
| `VIGIL_HTTPS_PORT` | `8443` | nginx HTTPS 端口 |
| `VIGIL_SERVICE` | `vigil` | systemd 服务名 |
| `VIGIL_NGINX_HTTP_SITE` / `VIGIL_NGINX_HTTPS_SITE` | `/etc/nginx/sites-enabled/yanyuanzhi-http(s).conf` | 需要加入 include 的站点文件 |

## 服务器上的文件

| 位置 | 内容 |
|---|---|
| `~/vigil-inkpress` | 当前版本 |
| `~/vigil-inkpress.prev` | 上一版本（回滚目标） |
| `/etc/systemd/system/vigil.service` | `node scripts/dev-server.mjs`，`PORT=5173`，`VIGIL_PROXY_LOCK=1`，崩溃自动重启 |
| `/etc/nginx/snippets/vigil-app.conf` | HTTPS 站点：`/vigil/` 反向代理；`/vigil/api/` 校验 `Origin`、丢弃 Cookie |
| `/etc/nginx/snippets/vigil-https-redirect.conf` | HTTP 站点：`/vigil` 跳转到 HTTPS |

## 为什么必须 HTTPS

口令加密备份、git-crypt 解密与「复制到剪贴板」依赖浏览器的安全上下文（Web Crypto / Clipboard API），普通 HTTP 的 IP 地址下不可用。服务器使用自签证书（SAN 为服务器 IP），首次访问时浏览器会提示不受信任：

- 点「继续访问」即可使用；
- 想去掉提示，可把 `/etc/ssl/certs/yanyuanzhi-selfsigned.crt` 导入本机并设为「始终信任」（macOS：钥匙串访问；Windows：受信任的根证书颁发机构）。

## 子路径与中继

- 页面、脚本、图片与 `api/...` 地址全部是**相对路径**，所以可以部署在任意子路径下；CSS 模块里的 `/assets/...` 由 `npm run build:css` 打包时换算为相对路径。
- 由 Node 服务提供的 `index.html` 会被注入 `<meta name="vigil-relay">`，页面因此在任何主机名下都走同源中继。
- 中继只信任回环地址的 `Host` / `Origin`，所以 nginx 在 `/vigil/api/` 上自行校验 `Origin` 必须等于 `$scheme://$http_host`，然后清空 `Origin` 与 `Cookie` 再转发。
- `VIGIL_PROXY_LOCK=1`：页面上的「本地网络与代理」指的是**服务器本机**的代理，访客电脑上的 Clash 对服务器无效，而这项设置又是所有访客共享的，所以服务器上禁止修改，GitHub 请求始终由服务器直连。详见 [GITHUB.md](GITHUB.md)。

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| 打开 `http://…/vigil` 跳到 `https://…:8443/vigil/` | 正常：加密与剪贴板需要 HTTPS |
| 浏览器提示证书不受信任 | 自签证书，见上文导入方法 |
| GitHub 报「本地代理端口拒绝连接」 | 代理被改成了不存在的端口；服务器部署已锁定为直连，刷新页面即可 |
| GitHub 匿名连接 404 | 仓库是私有的或名称有误；私有仓库需填写 Contents 读写权限的 PAT |
| 部署在健康检查阶段失败 | 已自动回滚；查看输出中的 `!!` 行与 `journalctl -u vigil -n 50` |
| 手动回滚 | 服务器上 `mv ~/vigil-inkpress ~/vigil-inkpress.bad && mv ~/vigil-inkpress.prev ~/vigil-inkpress && sudo systemctl restart vigil` |
