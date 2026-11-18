import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDataController} from '../src/ui/data-controller.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source=read('src/ui/data-controller.js');
const main=read('src/main.js');

function functionSource(text,name){
  const start=text.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`missing function ${name}`);
  const opening=text.indexOf('{',start);
  let depth=0;
  for(let index=opening;index<text.length;index++){
    if(text[index]==='{')depth++;
    if(text[index]==='}'){
      depth--;
      if(depth===0)return text.slice(start,index+1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

function actionSection(text,start,end){
  const from=text.indexOf(start);
  const to=text.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`missing action section ${start}`);
  return text.slice(from,to);
}

const migratedFunctions=[
  'writeEntries','makeBackup','favoriteEntry','deleteEntry','exportAll','exportFiltered',
  'exportEncrypted','importFile','clearDemo','createBackup','restoreBackup','deleteBackup','discardDraft'
];
const expectedActions=[
  'task-toggle','favorite','delete','export-filtered','export','export-encrypted','import',
  'import-encrypted','clear-demo','create-backup','restore-backup','delete-backup','discard-draft'
];

const runtimeControlKey=Symbol.for('vigil.data-controller.runtime-test');
const runtimeStubSources={
  './feedback.js':`
    const control=()=>globalThis[Symbol.for('vigil.data-controller.runtime-test')];
    export function showToast(message,options){control().calls.toasts.push({message,options});}
    export function confirmDialog(options){return control().confirm(options);}
  `,
  './passphrase.js':`
    const control=()=>globalThis[Symbol.for('vigil.data-controller.runtime-test')];
    export function requestPassphrase(options){return control().requestPassphrase(options);}
  `,
  '../storage/encrypted-transfer.js':`
    const control=()=>globalThis[Symbol.for('vigil.data-controller.runtime-test')];
    export const MAX_ENCRYPTED_FILE_BYTES=12*1024*1024;
    export function isEncryptedArchive(value){
      return value&&typeof value==='object'&&!Array.isArray(value)&&value.format==='vigil-encrypted-json';
    }
    export function decryptEntries(value,password){return control().decryptEntries(value,password);}
    export function encryptEntries(entries,password){return control().encryptEntries(entries,password);}
    export function downloadEncryptedText(text,filename){control().calls.downloads.push({text,filename});}
  `
};
const dataModule=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const runtimeImports={
  '../storage/transfer.js':new URL('../src/storage/transfer.js',import.meta.url).href,
  '../core/entries.js':new URL('../src/core/entries.js',import.meta.url).href,
  '../insights/insights.js':new URL('../src/insights/insights.js',import.meta.url).href,
  ...Object.fromEntries(Object.entries(runtimeStubSources).map(([specifier,stub])=>[
    specifier,dataModule(stub)
  ]))
};
let runtimeSource=source;
for(const [specifier,url] of Object.entries(runtimeImports)){
  const original=`'${specifier}'`;
  assert.ok(runtimeSource.includes(original),`missing runtime import ${specifier}`);
  runtimeSource=runtimeSource.replace(original,`'${url}'`);
}
const {createDataController:createRuntimeDataController}=await import(dataModule(runtimeSource));
after(()=>{delete globalThis[runtimeControlKey];});

function makeEntry(id,overrides={}){
  return {
    id,title:`手记 ${id}`,content:'正文',date:'2026-11-16',
    createdAt:'2026-11-16T08:00:00.000Z',updatedAt:'2026-11-16T08:00:00.000Z',
    tags:[],mood:'',favorite:false,demo:false,...overrides
  };
}
function importFile(entries){
  const blob=new Blob([JSON.stringify({schemaVersion:1,entries})]);
  return {size:blob.size,text:()=>blob.text()};
}
function encryptedImportFile(){
  const blob=new Blob([JSON.stringify({
    format:'vigil-encrypted-json',version:1,kdf:'PBKDF2-SHA256',iterations:600000,
    cipher:'AES-256-GCM',salt:'AAAAAAAAAAAAAAAAAAAAAA==',iv:'AAAAAAAAAAAAAAAA',
    ciphertext:'AAAAAAAAAAAAAAAAAAAAAA=='
  })]);
  return {size:blob.size,text:()=>blob.text()};
}
function invalidImportFile(){
  const blob=new Blob(['{not valid json']);
  return {size:blob.size,text:()=>blob.text()};
}
function createRuntimeHarness({
  entries=[makeEntry('current')],backupItems=[],confirmation=true,password='test-passphrase',
  decryptedEntries=[makeEntry('decrypted')],repoReadOnly=false,saveError=null,backupError=null,decryptError=null,canLeave=true
}={}){
  const originalEntries=entries;
  const originalSnapshot=JSON.parse(JSON.stringify(entries));
  const state={
    entries,backups:backupItems,query:'',filters:{},selectedId:'current',
    storageError:'',backupError:'',backupUnsafe:false
  };
  const calls={
    saves:[],backups:[],confirms:[],passphrases:[],decrypts:[],toasts:[],downloads:[],
    clicks:0,refreshes:0,renders:0,navigations:[]
  };
  globalThis[runtimeControlKey]={
    calls,
    confirm:async options=>{calls.confirms.push(options);return confirmation;},
    requestPassphrase:async options=>{calls.passphrases.push(options);return password;},
    decryptEntries:async(value,passphrase)=>{
      calls.decrypts.push({value,passphrase});
      if(decryptError)throw decryptError;
      return decryptedEntries;
    },
    encryptEntries:async()=>{throw new Error('unexpected encryption');}
  };
  const controller=createRuntimeDataController({
    state,
    repo:{
      readOnly:repoReadOnly,
      save(next){calls.saves.push(next);if(saveError)throw saveError;return next;}
    },
    drafts:{},
    backups:{
      create(...args){calls.backups.push(args);if(backupError)throw backupError;return {id:'snapshot'};}
    },
    $(selector){
      assert.equal(selector,'#importFile');
      return {click(){calls.clicks++;}};
    },
    render(){calls.renders++;},
    navigate(page){calls.navigations.push(page);},
    canLeave(){return canLeave;},
    refreshDrafts(){},
    refreshBackups(){calls.refreshes++;}
  });
  return {controller,state,calls,originalEntries,originalSnapshot};
}
function assertEntriesUntouched(harness){
  assert.strictEqual(harness.state.entries,harness.originalEntries);
  assert.deepEqual(harness.state.entries,harness.originalSnapshot);
}
function assertImportLeftUntouched(harness){
  assert.equal(harness.calls.saves.length,0);
  assert.equal(harness.calls.backups.length,0);
  assertEntriesUntouched(harness);
}

test('设置浮层中的导入和恢复在拒绝离开当前稿纸时不覆盖手记',async()=>{
  const item={id:'saved',entries:[makeEntry('saved')]};
  const harness=createRuntimeHarness({canLeave:false,backupItems:[item]});
  await harness.controller.processImportFile(new Blob([JSON.stringify({schemaVersion:1,entries:item.entries})]));
  await harness.controller.actions['restore-backup']({dataset:{id:item.id}});
  assert.equal(harness.calls.confirms.length,2);
  assert.equal(harness.calls.navigations.length,0);
  assertImportLeftUntouched(harness);
});
async function assertBackupFailureBlocksSave(harness,operation){
  await operation();
  assert.equal(harness.calls.backups.length,1);
  assert.equal(harness.calls.saves.length,0);
  assertEntriesUntouched(harness);
  assert.equal(harness.calls.navigations.length,0);
  assert.equal(harness.calls.renders,0);
}

function createController(){
  const noop=()=>{};
  return createDataController({
    state:{entries:[],backups:[]},repo:{},drafts:{},backups:{},$:noop,
    render:noop,navigate:noop,refreshDrafts:noop,refreshBackups:noop
  });
}

test('数据控制器只暴露约定接口和 13 个动作，且不依赖 main.js',()=>{
  const controller=createController();
  assert.deepEqual(Object.keys(controller).sort(),[
    'actions','writeEntries','makeBackup','processImportFile'
  ].sort());
  assert.deepEqual(Object.keys(controller.actions).sort(),[...expectedActions].sort());
  for(const action of expectedActions)assert.equal(typeof controller.actions[action],'function',action);
  assert.match(source,/export function createDataController\(context\)/);
  assert.match(source,/const \{state,repo,drafts,backups,\$,render,navigate,canLeave,refreshDrafts,refreshBackups\}=context;/);
  assert.doesNotMatch(source,/(?:from\s*|import\s*\(\s*)['"][^'"]*main\.js['"]/);
});

test('13 个数据运维函数由 controller 持有，main 不再定义重复实现',()=>{
  for(const name of migratedFunctions){
    assert.ok(functionSource(source,name),name);
    assert.doesNotMatch(main,new RegExp(`(?:async\\s+)?function ${name}\\(`),name);
  }
});

test('只读保护与写入失败路径不会覆盖或导出不完整数据',()=>{
  const write=functionSource(source,'writeEntries');
  assert.ok(write.indexOf('if(repo.readOnly)')<write.indexOf('repo.save(next)'));
  assert.match(write,/try\{state\.entries=repo\.save\(next\);state\.storageError='';return true;\}/);
  assert.match(write,/catch\(err\)\{state\.storageError=err\.message;showToast\(`写入失败：\$\{err\.message\}`,\{error:true\}\);return false;\}/);
  for(const [name,operation] of [
    ['exportAll','downloadJson'],['exportFiltered','downloadJson'],['exportEncrypted','encryptEntries']
  ]){
    const body=functionSource(source,name);
    assert.ok(body.indexOf('if(repo.readOnly)')>=0,name);
    assert.ok(body.indexOf('if(repo.readOnly)')<body.indexOf(operation),name);
  }
});

test('删除、清除示例、恢复、导入和任务回写均先快照再写入',()=>{
  for(const name of ['deleteEntry','clearDemo','restoreBackup','importFile']){
    const body=functionSource(source,name);
    const backup=body.indexOf('makeBackup(');
    const write=body.indexOf('writeEntries(');
    assert.ok(backup>=0&&write>backup,`${name}: backup must precede write`);
  }
  const task=actionSection(source,"'task-toggle':","'favorite':");
  assert.match(task,/const id=button\.dataset\.id,source=button\.dataset\.source,line=Number\(button\.dataset\.line\);/);
  const toggled=task.indexOf('toggleTask(state.entries,id,line,source)');
  const backup=task.indexOf("makeBackup(state.entries,'before-task','修改任务前快照')");
  const write=task.indexOf('writeEntries(changed)');
  assert.ok(toggled>=0&&backup>toggled&&write>backup,'task snapshot must precede write');
});

test('导入先解析和确认，失败路径不写文库；文件标记在 await 前复位',()=>{
  const body=functionSource(source,'importFile');
  const parsed=body.indexOf('await file.text()');
  const confirmed=body.indexOf('await confirmDialog(');
  const backup=body.indexOf("makeBackup(state.entries,'before-import','导入前备份')");
  const write=body.indexOf('writeEntries(incoming)');
  assert.ok(parsed>=0&&confirmed>parsed&&backup>confirmed&&write>backup);
  assert.match(body,/if\(state\.entries\.length&&!makeBackup\(state\.entries,'before-import','导入前备份'\)\)return;/);
  assert.match(body,/catch\(err\)\{showToast\(`导入失败：\$\{err\.message\}`,\{error:true\}\);return;\}/);
  const process=functionSource(source,'processImportFile');
  const reset=process.indexOf('requireEncryptedImport=false');
  const awaiting=process.indexOf('await importFile(file,encryptedOnly)');
  assert.ok(reset>=0&&awaiting>reset,'encrypted-only flag must reset before await');
});

test('口令只在函数局部持有并在 finally 清空',()=>{
  for(const name of ['exportEncrypted','importFile']){
    const body=functionSource(source,name);
    assert.match(body,/let password=await requestPassphrase\(/,name);
    assert.match(body,/finally\{password='';\}/,name);
    assert.doesNotMatch(body,/state\.[A-Za-z]*password|localStorage|sessionStorage/i,name);
  }
});

test('动作处理器使用原始 button，并正确读取 dataset.id 与导入模式',()=>{
  const actions=actionSection(source,'const actions={','return {actions,writeEntries,makeBackup,processImportFile};');
  for(const [action,handler] of [
    ['favorite','async button=>{await favoriteEntry(button.dataset.id);}'],
    ['delete','async button=>{await deleteEntry(button.dataset.id);}'],
    ['export-filtered','button=>{exportFiltered();}'],
    ['export','button=>{exportAll();}'],
    ['export-encrypted','async button=>{await exportEncrypted();}'],
    ['import',"button=>{requireEncryptedImport=false;$('#importFile').click();}"],
    ['import-encrypted',"button=>{requireEncryptedImport=true;$('#importFile').click();}"],
    ['clear-demo','async button=>{await clearDemo();}'],
    ['create-backup','button=>{createBackup();}'],
    ['restore-backup','async button=>{await restoreBackup(button.dataset.id);}'],
    ['delete-backup','async button=>{await deleteBackup(button.dataset.id);}'],
    ['discard-draft','async button=>{await discardDraft(button.dataset.id);}']
  ])assert.ok(actions.includes(`'${action}':${handler}`),action);
});

test('运行时：只读与 repo.save 抛错均保留原 entries 引用',()=>{
  const readOnly=createRuntimeHarness({repoReadOnly:true});
  const replacement=[makeEntry('replacement')];
  assert.equal(readOnly.controller.writeEntries(replacement),false);
  assert.equal(readOnly.calls.saves.length,0);
  assertEntriesUntouched(readOnly);

  const failure=createRuntimeHarness({saveError:new Error('disk full')});
  assert.equal(failure.controller.writeEntries(replacement),false);
  assert.equal(failure.calls.saves.length,1);
  assertEntriesUntouched(failure);
  assert.equal(failure.state.storageError,'disk full');
});

const backupFailureCases=[
  ['删除',()=>{
    const harness=createRuntimeHarness({backupError:new Error('snapshot failed')});
    return [harness,()=>harness.controller.actions.delete({dataset:{id:'current'}})];
  }],
  ['清除示例',()=>{
    const harness=createRuntimeHarness({
      entries:[makeEntry('demo',{demo:true})],backupError:new Error('snapshot failed')
    });
    return [harness,()=>harness.controller.actions['clear-demo']({})];
  }],
  ['恢复备份',()=>{
    const harness=createRuntimeHarness({
      backupItems:[{
        id:'backup-1',createdAt:'2026-11-16T09:00:00.000Z',reason:'manual',label:'手动备份',
        entries:[makeEntry('restored')]
      }],
      backupError:new Error('snapshot failed')
    });
    return [harness,()=>harness.controller.actions['restore-backup']({dataset:{id:'backup-1'}})];
  }],
  ['导入',()=>{
    const harness=createRuntimeHarness({backupError:new Error('snapshot failed')});
    return [harness,()=>harness.controller.processImportFile(importFile([makeEntry('imported')]))];
  }],
  ['任务回写',()=>{
    const harness=createRuntimeHarness({
      entries:[makeEntry('current',{content:'- [ ] 待办'})],backupError:new Error('snapshot failed')
    });
    return [harness,()=>harness.controller.actions['task-toggle']({
      dataset:{id:'current',source:'- [ ] 待办',line:'0'}
    })];
  }]
];
for(const [name,setup] of backupFailureCases){
  test(`运行时：${name}在 backups.create 抛错时不调用 repo.save`,async()=>{
    const [harness,operation]=setup();
    await assertBackupFailureBlocksSave(harness,operation);
  });
}

test('运行时：JSON 解析失败时不确认、不快照、不保存且原数据不变',async()=>{
  const harness=createRuntimeHarness();
  await harness.controller.processImportFile(invalidImportFile());
  assert.equal(harness.calls.confirms.length,0);
  assertImportLeftUntouched(harness);
});

test('运行时：解密失败时不改原数据，且失败后加密导入标记复位',async()=>{
  const harness=createRuntimeHarness({decryptError:new Error('wrong passphrase')});
  harness.controller.actions['import-encrypted']({});
  await harness.controller.processImportFile(encryptedImportFile());
  assert.equal(harness.calls.passphrases.length,1);
  assert.equal(harness.calls.decrypts.length,1);
  assert.equal(harness.calls.confirms.length,0);
  assertImportLeftUntouched(harness);

  await harness.controller.processImportFile(importFile([makeEntry('after-decrypt-failure')]));
  assert.equal(harness.calls.saves.length,1);
  assert.equal(harness.state.entries[0].id,'after-decrypt-failure');
});

test('运行时：导入确认取消时不快照、不保存且原数据不变',async()=>{
  const harness=createRuntimeHarness({confirmation:false});
  await harness.controller.processImportFile(importFile([makeEntry('imported')]));
  assert.equal(harness.calls.confirms.length,1);
  assertImportLeftUntouched(harness);
});

test('运行时：加密导入成功后标记复位，后续普通文件可直接导入',async()=>{
  const decrypted=[makeEntry('from-encrypted')];
  const harness=createRuntimeHarness({decryptedEntries:decrypted});
  harness.controller.actions['import-encrypted']({});
  assert.equal(harness.calls.clicks,1);
  await harness.controller.processImportFile(encryptedImportFile());
  assert.equal(harness.calls.decrypts.length,1);
  assert.strictEqual(harness.state.entries,decrypted);
  assert.equal(harness.calls.saves.length,1);

  await harness.controller.processImportFile(importFile([makeEntry('plain-after-success')]));
  assert.equal(harness.calls.decrypts.length,1);
  assert.equal(harness.calls.saves.length,2);
  assert.equal(harness.state.entries[0].id,'plain-after-success');
});

test('运行时：加密导入失败后标记不粘滞，后续普通文件可导入',async()=>{
  const harness=createRuntimeHarness();
  harness.controller.actions['import-encrypted']({});
  await harness.controller.processImportFile(importFile([makeEntry('rejected-plain')]));
  assert.equal(harness.calls.confirms.length,0);
  assertImportLeftUntouched(harness);

  await harness.controller.processImportFile(importFile([makeEntry('plain-after-failure')]));
  assert.equal(harness.calls.confirms.length,1);
  assert.equal(harness.calls.saves.length,1);
  assert.equal(harness.state.entries[0].id,'plain-after-failure');
});

test('运行时：普通导入动作清除尚未消费的加密导入标记',async()=>{
  const harness=createRuntimeHarness();
  harness.controller.actions['import-encrypted']({});
  harness.controller.actions.import({});
  assert.equal(harness.calls.clicks,2);
  await harness.controller.processImportFile(importFile([makeEntry('plain-selected')]));
  assert.equal(harness.calls.decrypts.length,0);
  assert.equal(harness.calls.saves.length,1);
  assert.equal(harness.state.entries[0].id,'plain-selected');
});
