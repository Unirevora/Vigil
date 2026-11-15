import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {GithubClient} from '../src/github/api.js';
import {importGitCryptKeyFile,encryptGitCryptBytes,encodeGitCryptText,isGitCryptBlob} from '../src/security/git-crypt.js';
if(!globalThis.crypto?.subtle)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const w=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const aes=Buffer.alloc(32,1),hmac=Buffer.alloc(64,2);
const head=Buffer.alloc(16);head.set(Buffer.from('\0GITCRYPTKEY','binary'));head.writeUInt32BE(2,12);
const keyfile=Buffer.concat([head,w(0),w(1),w(4),w(0),w(3),w(32),aes,w(5),w(64),hmac,w(0)]);
const b64=value=>Buffer.from(value).toString('base64');
const entry=(path,bytes)=>({type:'file',path,sha:'sha-old',encoding:'base64',content:b64(bytes)});

test('GitHub 仓库经过 .gitattributes 保护时，只有密文可提交且带原 blob SHA',async()=>{
 const key=await importGitCryptKeyFile(keyfile);
 const raw=await encryptGitCryptBytes(encodeGitCryptText('# Secret\n'),key);
 let put=null;
 const api=new GithubClient(async(url,opt)=>{
   const path=new URL(url).pathname;
   if(path.endsWith('/.gitattributes'))return {ok:true,status:200,json:async()=>entry('.gitattributes','secret/** filter=git-crypt diff=git-crypt')};
   if(path.endsWith('/secret/.gitattributes'))return {ok:false,status:404,json:async()=>({})};
   if(opt.method==='PUT'){
     put=JSON.parse(opt.body);
     return {ok:true,status:200,json:async()=>({content:{sha:'sha-new'},commit:{sha:'c'}})};
   }
   if(path.endsWith('/secret/note.md'))return {ok:true,status:200,json:async()=>entry('secret/note.md',raw)};
   return {ok:false,status:404,json:async()=>({})};
 });
 api.setConfig({owner:'demo',repo:'private-notes',branch:'main'});
 const locked=await api.readNote('secret/note.md');
 assert.equal(locked.locked,true);assert.equal(locked.content,'');
 const unlocked=await api.readNote('secret/note.md',{key});
 assert.equal(unlocked.encrypted,true);assert.equal(unlocked.content,'# Secret\n');
 api.setToken('temporary');
 await assert.rejects(api.saveNote({path:'secret/note.md',sha:'sha-old',content:'cannot leak',encrypted:false}),/明文/);
 assert.equal(put,null);
 const saved=await api.saveNote({path:'secret/note.md',sha:'sha-old',content:'# Updated\n',encrypted:true,key});
 assert.equal(saved.sha,'sha-new');
 assert.equal(put.sha,'sha-old');assert.equal(put.branch,'main');
 assert.ok(isGitCryptBlob(Buffer.from(put.content,'base64')));
 assert.equal(Buffer.from(put.content,'base64').includes(Buffer.from('# Updated')),false);
});
test('嵌套 .gitattributes 被检出，空 Key 绝不能误写明文',async()=>{
 const api=new GithubClient(async url=>{
   const pathname=new URL(url).pathname;
   if(pathname.endsWith('/secret/.gitattributes'))
     return {ok:true,status:200,json:async()=>entry('secret/.gitattributes','*.md filter=git-crypt diff=git-crypt')};
   return {ok:false,status:404,json:async()=>({})};
 });
 api.setConfig({owner:'demo',repo:'notes'});api.setToken('test');
 const rule=await api.getEncryptionRule('secret/diary.md');
 assert.equal(rule.encrypted,true);assert.equal(rule.keyName,'default');
 await assert.rejects(api.saveNote({path:'secret/diary.md',content:'plaintext'}),/明文/);
});
test('不同命名 git-crypt 密钥拒绝写入，保护仓库属性约束',async()=>{
 const key=await importGitCryptKeyFile(keyfile);
 const api=new GithubClient(async(url)=>{
   if(url.includes('.gitattributes'))return {ok:true,status:200,json:async()=>entry('.gitattributes','*.md filter=git-crypt-other diff=git-crypt-other')};
   return {ok:false,status:404,json:async()=>({})};
 });
 api.setConfig({owner:'demo',repo:'notes'});api.setToken('token');
 await assert.rejects(api.saveNote({path:'a.md',content:'hello',encrypted:true,key}),/密钥名/);
});
