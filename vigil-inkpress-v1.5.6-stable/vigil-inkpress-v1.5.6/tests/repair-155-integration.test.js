import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {GithubClient} from '../src/github/api.js';
import {normalizeAppearance,DEFAULT_APPEARANCE} from '../src/appearance/settings.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

// GitHub's published CORS preflight examples do not necessarily allow this
// custom request header. Pin the version at the local Node relay instead.
test('浏览器直连 GitHub 时不发送多余版本头，避免 CORS 预检失败',async()=>{
  let seen;
  const api=new GithubClient(async(url,options)=>{
    seen={url,headers:options.headers};
    return {ok:true,status:200,headers:{get:()=>null},json:async()=>({full_name:'octocat/Hello-World'})};
  });
  api.setConfig({owner:'octocat',repo:'Hello-World'});
  await api.getRepository();
  assert.equal(seen.url,'https://api.github.com/repos/octocat/Hello-World');
  assert.ok(!Object.hasOwn(seen.headers,'X-GitHub-Api-Version'));
  assert.equal(seen.headers.Accept,'application/vnd.github+json');
});

test('本地转发仍保留明确且支持的 GitHub API 版本',()=>{
  const src=read('scripts/github-proxy.mjs');
  assert.match(src,/2022-11-28/);
  assert.match(src,/api\.github\.com/);
  assert.match(src,/MAX_BODY=/);
  assert.match(src,/ORIGIN_DENIED/);
});

test('默认背景四张图片互不重复，图片与渲染采样保持一致',()=>{
  const main=read('src/main.js');
  const css=read('src/styles/vigil-155-repair.css');
  const images=[
    'wallpaper-dawn-1672.webp',
    'wallpaper-cloud-mist-2560.webp',
    'wallpaper-garden-1672.webp',
    'wallpaper-moonrise-1672.webp'
  ];
  assert.equal(new Set(images).size,4);
  for(const name of images){
    assert.ok(main.includes(name),name);
    assert.ok(css.includes(name),name);
    assert.ok(statSync(new URL(`../assets/${name}`,import.meta.url)).size>20_000,name);
  }
});

test('夜色背景强度不被历史规则压灭，纯色模式可真正清除镜片画面',()=>{
  const css=read('src/styles/vigil-155-repair.css');
  const main=read('src/main.js');
  assert.match(css,/opacity:var\(--wallpaper-alpha-night\)!important/);
  assert.match(css,/body\[data-wallpaper=none\]::before/);
  assert.match(main,/--wallpaper-alpha-night/);
  assert.match(main,/--glass-scene-url','none'/);
  assert.match(read('src/glass/liquid-glass.js'),/glass-scene-ready/);
});

test('侧栏真毛玻璃、视觉回退与用户可调参数',()=>{
  const css=read('src/styles/vigil-155-repair.css');
  assert.match(css,/backdrop-filter:blur\(var\(--sidebar-glass-blur/);
  assert.match(css,/prefers-reduced-transparency:reduce/);
  const appearance=normalizeAppearance({...DEFAULT_APPEARANCE,sidebarGlass:60,sidebarBlur:14});
  assert.equal(appearance.sidebarGlass,60);
  assert.equal(appearance.sidebarBlur,14);
});

test('连接诊断按钮与单一入口已接入 GitHub 页面与事件',()=>{
  assert.match(read('src/ui/views/github.js'),/data-action="github-test-network"/);
  assert.match(read('src/main.js'),/case 'github-test-network'/);
  assert.match(read('src/main.js'),/new GithubClient\(\)/);
});
