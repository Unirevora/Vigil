/**
 * Browser implementation of git-crypt's documented binary file format.
 * Compatible with git-crypt 0.4–0.8 exported v2 symmetric keys, key version 0.
 * Original project: https://github.com/AGWA/git-crypt (GPL-3.0).
 * This is an independent interoperability implementation with Web Crypto.
 * It uses AES-256-CTR + HMAC-SHA1 synthetic nonce, NOT AES-GCM and NOT passwords.
 * Key material remains in non-extractable CryptoKey objects in page memory.
 */
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});
const keyMagic=new Uint8Array([0,71,73,84,67,82,89,80,84,75,69,89]); // \0GITCRYPTKEY
const blobMagic=new Uint8Array([0,71,73,84,67,82,89,80,84,0]); // \0GITCRYPT\0
export const GIT_CRYPT_BLOB_HEADER_BYTES=22;
export const MAX_GIT_CRYPT_NOTE_BYTES=900000;
const MAX_KEYFILE_BYTES=1024*1024;
function bytes(value){return value instanceof Uint8Array?value:new Uint8Array(value);}
function matches(a,b){return a.length<=b.length&&a.every((v,i)=>v===b[i]);}
function subtle(){if(!globalThis.crypto?.subtle)throw new Error('git-crypt 需要 HTTPS / localhost 的 Web Crypto 环境。');return globalThis.crypto.subtle;}
export function isGitCryptBlob(value){return matches(blobMagic,bytes(value));}
export function readGitCryptKeyFile(value){
  const b=bytes(value);
  if(b.length<24||b.length>MAX_KEYFILE_BYTES||!matches(keyMagic,b)){
    throw new Error('不是 git-crypt export-key 生成的二进制密钥文件。');
  }
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  const word=()=>{if(offset+4>b.length)throw new Error('git-crypt 密钥文件被截断。');const x=view.getUint32(offset);offset+=4;return x;};
  let offset=12;
  const version=word();
  if(version!==2)throw new Error('仅支持 git-crypt v2 导出的密钥文件。');
  let keyName='';
  while(true){
    const id=word();if(id===0)break;
    const len=word();if(len>1024||offset+len>b.length)throw new Error('密钥头部字段无效。');
    if(id===1){if(len>128)throw new Error('密钥名称太长。');keyName=decoder.decode(b.subarray(offset,offset+len));}
    else if(id%2===1)throw new Error('密钥文件包含不支持的必需字段。');
    offset+=len;
  }
  const entries=new Map();
  while(offset<b.length){
    let entryVersion=null,aes=null,hmac=null;
    while(true){
      const id=word();if(id===0)break;
      const len=word();if(len>1024||offset+len>b.length)throw new Error('密钥记录长度无效。');
      if(id===1){if(len!==4)throw new Error('密钥记录版本错误。');entryVersion=view.getUint32(offset);}
      else if(id===3){if(len!==32)throw new Error('AES 密钥长度错误。');aes=b.slice(offset,offset+len);}
      else if(id===5){if(len!==64)throw new Error('HMAC 密钥长度错误。');hmac=b.slice(offset,offset+len);}
      else if(id%2===1)throw new Error('密钥文件含不支持的必需字段。');
      offset+=len;
    }
    if(entryVersion===null||!aes||!hmac)throw new Error('密钥记录缺少必要字段。');
    if(entries.has(entryVersion))throw new Error('密钥文件包含重复记录。');
    entries.set(entryVersion,{aes,hmac});
  }
  if(!entries.has(0))throw new Error('密钥缺少版本 0，无法安全处理 git-crypt 文件。');
  return {name:keyName,entries};
}
export async function importGitCryptKeyFile(value){
  const parsed=readGitCryptKeyFile(value);
  const v=parsed.entries.get(0);
  try{
    const [aes,hmac]=await Promise.all([
      subtle().importKey('raw',v.aes,{name:'AES-CTR'},false,['encrypt','decrypt']),
      subtle().importKey('raw',v.hmac,{name:'HMAC',hash:'SHA-1'},false,['sign'])
    ]);
    return Object.freeze({name:parsed.name||'default',aes,hmac,format:'git-crypt-v2/version-0'});
  }finally{
    for(const item of parsed.entries.values()){item.aes.fill(0);item.hmac.fill(0);}
  }
}
function counterFor(nonce){
  const counter=new Uint8Array(16);counter.set(nonce,0);return counter;
}
async function syntheticNonce(content,key){
  const raw=new Uint8Array(await subtle().sign('HMAC',key.hmac,content));
  return raw.subarray(0,12);
}
export async function encryptGitCryptBytes(plaintext,key){
  if(!key?.aes||!key?.hmac)throw new Error('请先导入 git-crypt export-key 密钥文件。');
  const plain=bytes(plaintext);
  if(plain.length>MAX_GIT_CRYPT_NOTE_BYTES)throw new Error('单篇仓库笔记不得超过 900KB。');
  const nonce=await syntheticNonce(plain,key);
  const cipher=new Uint8Array(await subtle().encrypt({name:'AES-CTR',counter:counterFor(nonce),length:32},key.aes,plain));
  const result=new Uint8Array(blobMagic.length+nonce.length+cipher.length);
  result.set(blobMagic);result.set(nonce,10);result.set(cipher,22);
  return result;
}
export async function decryptGitCryptBytes(value,key){
  if(!key?.aes||!key?.hmac)throw new Error('这篇笔记由 git-crypt 加密，请先导入对应 export-key。');
  const ciphertext=bytes(value);
  if(!isGitCryptBlob(ciphertext)||ciphertext.length<22)throw new Error('不是有效的 git-crypt 加密文件。');
  if(ciphertext.length>MAX_GIT_CRYPT_NOTE_BYTES+22)throw new Error('加密文件过大。');
  const nonce=ciphertext.subarray(10,22);
  const plain=new Uint8Array(await subtle().decrypt({name:'AES-CTR',counter:counterFor(nonce),length:32},key.aes,ciphertext.subarray(22)));
  const check=await syntheticNonce(plain,key);
  let diff=0;
  for(let i=0;i<12;i++)diff|=nonce[i]^check[i];
  if(diff!==0){plain.fill(0);throw new Error('git-crypt 密钥不匹配或密文已被篡改。');}
  return plain;
}
export const encodeGitCryptText=text=>encoder.encode(String(text));
export const decodeGitCryptText=value=>decoder.decode(bytes(value));

/** A conservative subset of Git attributes syntax: no unsupported pattern is silently assumed. */
export function gitCryptRuleDetail(text,path){
  const normalized=String(path).replace(/^\/+/, '');
  let result={matched:false,encrypted:false,keyName:'default',unsupported:false};
  for(const line of String(text||'').split(/\r?\n/)){
    const trimmed=line.trim();if(!trimmed||trimmed.startsWith('#'))continue;
    const tokens=trimmed.split(/\s+/),pattern=tokens.shift();
    if(!pattern)continue;
    if(/[\[\]{}\\]/.test(pattern)){
      if(tokens.some(t=>t.includes('git-crypt')))result.unsupported=true;
      continue;
    }
    const regex='^'+pattern.replace(/[.+^${}()|]/g,'\\$&')
      .replace(/\*\*\//g,'\u0001').replace(/\*\*/g,'\u0000')
      .replace(/\*/g,'[^/]*').replace(/\?/g,'[^/]')
      .replace(/\u0001/g,'(?:.*/)?').replace(/\u0000/g,'.*')+'$';
    const hit=new RegExp(regex).test(normalized)||(!pattern.includes('/')&&new RegExp(regex).test(normalized.split('/').at(-1)));
    if(!hit)continue;
    const filter=tokens.find(t=>t.startsWith('filter='));
    if(filter){
      const f=filter.slice(7);
      result={matched:true,encrypted:f==='git-crypt'||f.startsWith('git-crypt-'),
        keyName:f.startsWith('git-crypt-')?f.slice(10):'default',unsupported:result.unsupported};
    }else if(tokens.some(t=>t==='-filter'||t==='!filter')){
      result={matched:true,encrypted:false,keyName:'default',unsupported:result.unsupported};
    }
  }
  return result;
}
export const gitCryptRuleMatches=(text,path)=>gitCryptRuleDetail(text,path).encrypted;
