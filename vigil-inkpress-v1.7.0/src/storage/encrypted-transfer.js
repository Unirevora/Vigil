import {exportJson,parseImportText} from './transfer.js';

/**
 * Encrypted archive *v1* for the rebuilt app. It is NOT a decryptor for
 * historical Vigil v2.8.2 encrypted files (their format is unverified).
 * Requires a secure context: HTTPS or localhost.
 */
export const ENCRYPTED_FORMAT='vigil-encrypted-json';
export const ENCRYPTED_VERSION=1;
export const ENCRYPTED_ITERATIONS=600000;
export const MAX_ENCRYPTED_FILE_BYTES=12*1024*1024;
const SALT_LENGTH=16;
const IV_LENGTH=12;
const HEADER_AAD='VIGIL/ENCRYPTED-JSON/V1/AES-256-GCM/PBKDF2-SHA256/600000';
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});

function webCrypto(){
  const c=globalThis.crypto;
  if(!c?.subtle||!c?.getRandomValues){
    throw new Error('加密需要 HTTPS 或 localhost 环境的 Web Crypto API。');
  }
  return c;
}
function toBase64(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192){
    binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  }
  return btoa(binary);
}
function fromBase64(str,length){
  if(typeof str!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(str)||str.length%4!==0){
    throw new Error('加密文件数据格式无效。');
  }
  let raw;
  try{raw=atob(str);}catch{throw new Error('加密文件 Base64 内容损坏。');}
  if(length!==null&&raw.length!==length)throw new Error('加密文件参数长度无效。');
  return Uint8Array.from(raw,x=>x.charCodeAt(0));
}
async function derive(passphrase,salt,usage){
  const crypto=webCrypto();
  const base=await crypto.subtle.importKey(
    'raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:ENCRYPTED_ITERATIONS,hash:'SHA-256'},
    base,{name:'AES-GCM',length:256},false,[usage]
  );
}
function checkPassphrase(passphrase,creating=false){
  if(typeof passphrase!=='string'||!passphrase)throw new Error('请输入备份口令。');
  if(creating&&[...passphrase].length<10)throw new Error('新备份口令至少需要 10 个字符。');
}
export function isEncryptedArchive(value){
  return value && typeof value==='object' && !Array.isArray(value) &&
     value.format===ENCRYPTED_FORMAT;
}
export async function encryptEntries(entries,passphrase){
  checkPassphrase(passphrase,true);
  const c=webCrypto();
  const salt=c.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv=c.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext=encoder.encode(exportJson(entries));
  if(plaintext.length>8*1024*1024)throw new Error('手记数据超过 8 MB 限制。');
  const key=await derive(passphrase,salt,'encrypt');
  const ciphertext=new Uint8Array(await c.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:encoder.encode(HEADER_AAD),tagLength:128},
    key,plaintext
  ));
  return JSON.stringify({
    format:ENCRYPTED_FORMAT,
    version:ENCRYPTED_VERSION,
    kdf:'PBKDF2-SHA256',
    iterations:ENCRYPTED_ITERATIONS,
    cipher:'AES-256-GCM',
    salt:toBase64(salt),
    iv:toBase64(iv),
    ciphertext:toBase64(ciphertext)
  },null,2);
}
export async function decryptEntries(value,passphrase){
  checkPassphrase(passphrase);
  let data=value;
  if(typeof data==='string'){
    if(new Blob([data]).size>MAX_ENCRYPTED_FILE_BYTES){
      throw new Error('加密备份超过 12 MB 限制。');
    }
    try{data=JSON.parse(data);}catch{throw new Error('加密 JSON 文件格式无效。');}
  }
  if(!isEncryptedArchive(data))throw new Error('不是 Vigil v1.4.1 加密备份文件。');
  if(data.version!==ENCRYPTED_VERSION||
     data.kdf!=='PBKDF2-SHA256'||data.iterations!==ENCRYPTED_ITERATIONS||
     data.cipher!=='AES-256-GCM'){
    throw new Error('不支持此加密文件版本或算法，无法安全解密。');
  }
  const salt=fromBase64(data.salt,SALT_LENGTH);
  const iv=fromBase64(data.iv,IV_LENGTH);
  const ciphertext=fromBase64(data.ciphertext,null);
  if(ciphertext.length<16||ciphertext.length>MAX_ENCRYPTED_FILE_BYTES){
    throw new Error('加密文件内容长度不合法。');
  }
  const key=await derive(passphrase,salt,'decrypt');
  let plaintext;
  try{
    plaintext=await webCrypto().subtle.decrypt(
      {name:'AES-GCM',iv,additionalData:encoder.encode(HEADER_AAD),tagLength:128},
      key,ciphertext
    );
  }catch{
    throw new Error('口令错误，或加密文件已损坏。当前手记未被修改。');
  }
  return parseImportText(decoder.decode(plaintext));
}
export function downloadEncryptedText(text,filename='vigil-private'){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`${filename}-${new Date().toISOString().slice(0,10)}.vigil.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
