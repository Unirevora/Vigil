import test from 'node:test';
import assert from 'node:assert/strict';
import {checkGithubBrowserPaths,PUBLIC_BROWSER_PROBES} from '../src/github/browser-diagnostics.js';

const reply=(data,status=200,relay=true)=>({
  ok:status>=200&&status<300,status,
  headers:{get:name=>name.toLowerCase()==='x-vigil-github-proxy'&&relay?'1':null},
  json:async()=>data
});

test('in-page browser diagnostics distinguish blocked primary from working alternate route',async()=>{
  const calls=[];
  const result=await checkGithubBrowserPaths(async (url,opts)=>{
    calls.push({url,opts});
    if(url==='/api/github/repos/octocat/Hello-World')throw Object.assign(new TypeError('blocked'),{code:'ERR_BLOCKED_BY_CLIENT'});
    if(url==='/api/github/diagnose')return reply({ok:true,bodyVerified:true,upstreamStatus:200});
    if(url.includes('/api/vigil-bridge/'))return reply({full_name:'octocat/Hello-World'});
    return reply({full_name:'octocat/Hello-World'},200,false);
  },{origin:'http://127.0.0.1:5173'});
  assert.equal(result.checks.length,4);
  assert.deepEqual(result.checks.map(x=>x.ok),[true,false,true,true]);
  assert.match(result.text,/FAIL\s+仓库主通道.*ERR_BLOCKED_BY_CLIENT/);
  assert.match(result.text,/PASS\s+仓库备用通道/);
  assert.ok(calls.every(({opts})=>opts.method==='GET'&&opts.credentials==='omit'&&opts.cache==='no-store'));
  assert.ok(calls.every(({opts})=>!Object.keys(opts.headers).some(x=>x.toLowerCase()==='authorization')));
  assert.deepEqual(calls.map(x=>x.url),PUBLIC_BROWSER_PROBES.map(x=>x.path));
});

test('browser diagnostics reject incomplete JSON as success even when status is HTTP 200',async()=>{
  const result=await checkGithubBrowserPaths(async()=>reply({status:'OK'}),{origin:'http://localhost:5173'});
  assert.equal(result.checks.every(item=>!item.ok),true);
  assert.match(result.text,/INVALID_RESPONSE/);
});
