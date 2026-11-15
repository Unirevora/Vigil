import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
  encryptEntries,decryptEntries,isEncryptedArchive,ENCRYPTED_FORMAT,
  ENCRYPTED_ITERATIONS
} from '../src/storage/encrypted-transfer.js';
import {validateDataset} from '../src/storage/schema.js';

if(!globalThis.crypto?.subtle)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});

const note={
 id:'private-1',title:'冬夜札记 🍂',date:'2026-11-14',
 content:'# 冬夜\n\n家书与月光。\n\n**密文**',favorite:true,
 tags:['私密','日常'],mood:'平静',
 createdAt:'2026-11-14T00:00:00Z',updatedAt:'2026-11-14T00:00:00Z'
};
const PASSWORD='测试长口令-test-2026';

test('AES-256-GCM 加密导出与解密完整往返中文、emoji 和手记元信息',async()=>{
 const encrypted=await encryptEntries([note],PASSWORD);
 const header=JSON.parse(encrypted);
 assert.equal(header.format,ENCRYPTED_FORMAT);
 assert.equal(header.iterations,ENCRYPTED_ITERATIONS);
 assert.equal(encrypted.includes(note.title),false);
 assert.equal(encrypted.includes(note.content),false);
 assert.deepEqual(await decryptEntries(encrypted,PASSWORD),validateDataset({schemaVersion:1,entries:[note]}));
});
test('同一口令重复加密使用随机 IV/salt',async()=>{
 const a=JSON.parse(await encryptEntries([note],PASSWORD));
 const b=JSON.parse(await encryptEntries([note],PASSWORD));
 assert.notEqual(a.iv,b.iv);
 assert.notEqual(a.salt,b.salt);
 assert.notEqual(a.ciphertext,b.ciphertext);
});
test('口令错误或密文篡改，绝不能返回空手记伪装解密成功',async()=>{
 const data=await encryptEntries([note],PASSWORD);
 await assert.rejects(decryptEntries(data,'wrong-passphrase'),/口令错误|损坏/);
 const tampered=JSON.parse(data);
 tampered.ciphertext=tampered.ciphertext.replace(/^./,tampered.ciphertext[0]==='A'?'B':'A');
 await assert.rejects(decryptEntries(tampered,PASSWORD),/口令错误|损坏/);
});
test('未知版本和算法严格拒绝，不误兼容原项目历史加密文件',async()=>{
 const data=JSON.parse(await encryptEntries([],PASSWORD));
 assert.equal(isEncryptedArchive(data),true);
 assert.equal(isEncryptedArchive({format:'some-legacy-encryption'}),false);
 data.iterations=1000;
 await assert.rejects(decryptEntries(data,PASSWORD),/不支持/);
});
test('新建口令强度下限，并拒绝无效 Base64',async()=>{
 await assert.rejects(encryptEntries([], 'weak'),/至少需要 10/);
 const data=JSON.parse(await encryptEntries([],PASSWORD));
 data.salt='not base64 ??';
 await assert.rejects(decryptEntries(data,PASSWORD),/格式无效/);
});
