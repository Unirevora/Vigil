import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubClient,normalizeRepoConfig,normalizePath,decodeGithubBase64,encodeGithubBase64,isMarkdownPath} from '../src/github/api.js';

test('可解析仓库 URL、目录、分支并拒绝越界路径',()=>{
  assert.deepEqual(normalizeRepoConfig({
    repoUrl:'https://github.com/octocat/Hello-World',branch:'feature/my-notes',folder:'notes/2026'
  }),{owner:'octocat',repo:'Hello-World',branch:'feature/my-notes',folder:'notes/2026'});
  assert.throws(()=>normalizePath('../private'),/相对路径/);
  assert.equal(isMarkdownPath('notes/日记.md'),true);
  assert.equal(isMarkdownPath('assets/private.txt'),false);
});
test('Unicode Markdown 通过 Base64 往返，包含 emoji',()=>{
  const source='# 中文标题\n\n一段手记 🍃';
  assert.equal(decodeGithubBase64(encodeGithubBase64(source)),source);
});
test('公开仓库可匿名读取目录、文件与 UTF-8 正文',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    const response=url.includes('/contents/notes/%E6%89%8B%E8%AE%B0.md')
      ?{type:'file',path:'notes/手记.md',sha:'oldsha',encoding:'base64',
        content:encodeGithubBase64('# 今天\n\n文字'),html_url:'https://github.com/octocat/Hello-World/blob/main/notes/note.md'}
      :[{type:'file',name:'手记.md',path:'notes/手记.md',sha:'oldsha'},
         {type:'file',name:'photo.jpg',path:'notes/photo.jpg'},
         {type:'dir',name:'diary',path:'notes/diary'}];
    return {ok:true,status:200,json:async()=>response};
  };
  const api=new GithubClient(fetcher);
  api.setConfig({owner:'octocat',repo:'Hello-World',branch:'main',folder:'notes'});
  const files=await api.listFolder('notes');
  assert.equal(files.length,2);
  const note=await api.readNote('notes/手记.md');
  assert.equal(note.content,'# 今天\n\n文字');
  assert.equal(calls.every(c=>!('Authorization' in c.options.headers)),true);
});
test('提交必须明确令牌、携带原 SHA 防止盲目覆盖',async()=>{
  let sent;
  const api=new GithubClient(async(url,options)=>{
    if(url.includes('.gitattributes'))return {ok:false,status:404,json:async()=>({message:'Not found'})};
    sent={url,options};
    return {ok:true,status:200,json:async()=>({content:{sha:'newsha'},commit:{sha:'commit'}})};
  });
  api.setConfig({owner:'octocat',repo:'diary'});
  await assert.rejects(()=>api.saveNote({path:'notes/a.md',content:'测试'}),/令牌/);
  api.setToken('secret-dont-store-me');
  const saved=await api.saveNote({path:'notes/a.md',content:'# 新内容',sha:'oldsha'});
  const payload=JSON.parse(sent.options.body);
  assert.equal(sent.options.headers.Authorization,'Bearer secret-dont-store-me');
  assert.equal(payload.sha,'oldsha');
  assert.equal(decodeGithubBase64(payload.content),'# 新内容');
  assert.equal(saved.sha,'newsha');
  api.forgetToken();
  assert.equal(api.canWrite,false);
});
test('GitHub 409 冲突不允许误报保存成功',async()=>{
  const api=new GithubClient(async(url)=>url.includes('.gitattributes')?{ok:false,status:404,json:async()=>({})}:{ok:false,status:409,json:async()=>({message:'Conflict'})});
  api.setConfig({owner:'octocat',repo:'diary'});
  api.setToken('token');
  await assert.rejects(()=>api.saveNote({path:'a.md',content:'内容',sha:'badsha'}),/版本冲突/);
});

test('新建远端 Markdown 文件时省略旧 SHA，并使用指定分支',async()=>{
  let request;
  const api=new GithubClient(async(url,options)=>{
    if(url.includes('.gitattributes'))return {ok:false,status:404,json:async()=>({message:'Not found'})};
    request={url,options};
    return {ok:true,status:201,json:async()=>({content:{sha:'new-file-sha'}})};
  });
  api.setConfig({owner:'octocat',repo:'diary',branch:'writing'});
  api.setToken('temporary-token');
  const result=await api.saveNote({path:'notes/new.md',content:'# 第一篇'});
  const payload=JSON.parse(request.options.body);
  assert.equal('sha' in payload,false);
  assert.equal(payload.branch,'writing');
  assert.equal(decodeGithubBase64(payload.content),'# 第一篇');
  assert.equal(result.sha,'new-file-sha');
});
