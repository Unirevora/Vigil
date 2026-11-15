import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac,createCipheriv} from 'node:crypto';
import {
  readGitCryptKeyFile,importGitCryptKeyFile,encryptGitCryptBytes,
  decryptGitCryptBytes,encodeGitCryptText,decodeGitCryptText,isGitCryptBlob,gitCryptRuleMatches
} from '../src/security/git-crypt.js';
if(!globalThis.crypto?.subtle)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});

function fixture({name='',keyVersion=0}={}){
  const chunks=[];const w=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
  const aes=Buffer.from(Array.from({length:32},(_,i)=>i));
  const hmac=Buffer.from(Array.from({length:64},(_,i)=>(i*13+7)%256));
  const head=Buffer.alloc(16);head.set(Buffer.from('\0GITCRYPTKEY','binary'));head.writeUInt32BE(2,12);chunks.push(head);
  if(name){const data=Buffer.from(name);chunks.push(w(1),w(data.length),data);}
  chunks.push(w(0)); // end header
  chunks.push(w(1),w(4),w(keyVersion),w(3),w(32),aes,w(5),w(64),hmac,w(0));
  return {bytes:Buffer.concat(chunks),aes,hmac};
}
const plain='# 私人手记\n\n重要的内容 🍂\n';

test('解析 git-crypt export-key 标准 v2/TLV 结构',()=>{
  const {bytes,aes,hmac}=fixture({name:'my-vault'});
  const parsed=readGitCryptKeyFile(bytes);
  assert.equal(parsed.name,'my-vault');
  assert.deepEqual(Buffer.from(parsed.entries.get(0).aes),aes);
  assert.deepEqual(Buffer.from(parsed.entries.get(0).hmac),hmac);
});
test('加密与独立 Node OpenSSL 算法计算的 git-crypt 二进制结果完全一致',async()=>{
  const {bytes,aes,hmac}=fixture();
  const key=await importGitCryptKeyFile(bytes);
  const body=Buffer.from(plain,'utf8');
  const nonce=createHmac('sha1',hmac).update(body).digest().subarray(0,12);
  const cipher=createCipheriv('aes-256-ctr',aes,Buffer.concat([nonce,Buffer.alloc(4)]));
  const expected=Buffer.concat([Buffer.from('\0GITCRYPT\0','binary'),nonce,cipher.update(body),cipher.final()]);
  const actual=Buffer.from(await encryptGitCryptBytes(encodeGitCryptText(plain),key));
  assert.ok(isGitCryptBlob(actual));
  assert.deepEqual(actual,expected);
  assert.equal(decodeGitCryptText(await decryptGitCryptBytes(actual,key)),plain);
});
test('相同正文产生相同密文（与 git-crypt 的确定性加密一致）',async()=>{
  const key=await importGitCryptKeyFile(fixture().bytes);
  const a=await encryptGitCryptBytes(encodeGitCryptText(plain),key);
  const b=await encryptGitCryptBytes(encodeGitCryptText(plain),key);
  assert.deepEqual(a,b);
});
test('篡改密文或使用不正确密钥绝不可输出未认证明文',async()=>{
  const key=await importGitCryptKeyFile(fixture().bytes);
  const blob=await encryptGitCryptBytes(encodeGitCryptText(plain),key);
  const modified=blob.slice();modified[modified.length-1]^=1;
  await assert.rejects(decryptGitCryptBytes(modified,key),/密钥不匹配|篡改/);
  const bad=fixture();bad.bytes[bad.bytes.length-10]^=1;
  const wrong=await importGitCryptKeyFile(bad.bytes);
  await assert.rejects(decryptGitCryptBytes(blob,wrong),/密钥不匹配|篡改/);
});
test('未导入密钥不允许加密与解密、密钥格式和版本错误拒绝处理',async()=>{
  const blob=await encryptGitCryptBytes(encodeGitCryptText('测试'),await importGitCryptKeyFile(fixture().bytes));
  await assert.rejects(decryptGitCryptBytes(blob,null),/导入/);
  await assert.rejects(encryptGitCryptBytes(encodeGitCryptText('正文'),null),/导入/);
  const broken=fixture().bytes;broken[0]=78;
  assert.throws(()=>readGitCryptKeyFile(broken),/不是/);
  assert.throws(()=>readGitCryptKeyFile(fixture({keyVersion:1}).bytes),/版本 0/);
});
test('常用 .gitattributes 保护规则匹配，反规则覆盖',()=>{
  assert.equal(gitCryptRuleMatches('secret/** filter=git-crypt diff=git-crypt','secret/notes/a.md'),true);
  assert.equal(gitCryptRuleMatches('*.md filter=git-crypt','docs/family.md'),true);
  assert.equal(gitCryptRuleMatches('*.md filter=git-crypt\npublic.md -filter','public.md'),false);
  assert.equal(gitCryptRuleMatches('*.md filter=git-crypt','note.txt'),false);
  assert.equal(gitCryptRuleMatches('**/*.md filter=git-crypt','note.md'),true);
  assert.equal(gitCryptRuleMatches('**/*.md filter=git-crypt','notes/note.md'),true);
});
