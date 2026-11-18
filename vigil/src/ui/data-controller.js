import {parseImportText,downloadJson} from '../storage/transfer.js';
import {encryptEntries,decryptEntries,isEncryptedArchive,downloadEncryptedText,MAX_ENCRYPTED_FILE_BYTES} from '../storage/encrypted-transfer.js';
import {filterEntries} from '../core/entries.js';
import {showToast,confirmDialog} from './feedback.js';
import {requestPassphrase} from './passphrase.js';
import {toggleTask} from '../insights/insights.js';

export function createDataController(context){
  const {state,repo,drafts,backups,$,render,navigate,canLeave,refreshDrafts,refreshBackups}=context;
  let requireEncryptedImport=false;

  function writeEntries(next){
    if(repo.readOnly){showToast('存储已保护，无法覆盖',{error:true});return false;}
    try{state.entries=repo.save(next);state.storageError='';return true;}
    catch(err){state.storageError=err.message;showToast(`写入失败：${err.message}`,{error:true});return false;}
  }
  function makeBackup(entries,reason,label){
    if(state.backupUnsafe){showToast('备份结构异常，已阻止覆盖',{error:true});return false;}
    try{backups.create(entries,reason,label);refreshBackups();return true;}
    catch(err){state.backupError=err.message;showToast(`备份失败：${err.message}`,{error:true});return false;}
  }
  async function favoriteEntry(id){
    const current=state.entries.find(e=>e.id===id);if(!current)return;
    const next=state.entries.map(e=>e.id===id?{...e,favorite:!e.favorite,updatedAt:new Date().toISOString()}:e);
    if(writeEntries(next)){render();showToast(current.favorite?'已取消收藏':'已加入收藏');}
  }
  async function deleteEntry(id){
    const entry=state.entries.find(e=>e.id===id);if(!entry)return;
    if(!await confirmDialog({title:'删除这篇手记？',description:`「${entry.title}」将从文库删除，删除前会创建备份。`,confirmText:'删除',danger:true}))return;
    if(!makeBackup(state.entries,'before-delete',`删除「${entry.title}」前`))return;
    if(writeEntries(state.entries.filter(e=>e.id!==id))){state.selectedId=null;navigate('entries');showToast('已删除，可从备份恢复');}
  }
  function exportAll(){
    if(repo.readOnly)return showToast('存储异常，禁止导出不完整数据',{error:true});
    try{downloadJson(state.entries,'vigil-notes');showToast('已开始下载 JSON 备份');}
    catch(err){showToast(err.message,{error:true});}
  }
  function exportFiltered(){
    if(repo.readOnly)return showToast('存储异常，禁止导出不完整数据',{error:true});
    const list=filterEntries(state.entries,state.query,state.order,state.filters);
    if(!list.length)return showToast('当前没有可导出的手记',{error:true});
    try{downloadJson(list,'vigil-selection');showToast(`已导出当前结果：${list.length} 篇手记`);}
    catch(err){showToast(err.message,{error:true});}
  }
  async function exportEncrypted(){
    if(repo.readOnly)return showToast('存储异常，不能导出不完整数据',{error:true});
    let password=await requestPassphrase({mode:'export'});
    if(password===null)return;
    try{
      const text=await encryptEntries(state.entries,password);
      downloadEncryptedText(text,'vigil-encrypted-notes');
      showToast('口令加密备份已生成。请妥善保管口令。');
    }catch(err){showToast(`加密导出失败：${err.message}`,{error:true});}
    finally{password='';}
  }
  async function importFile(file,requireEncrypted=false){
    if(!file||repo.readOnly)return;
    let incoming;
    try{
      if(file.size>MAX_ENCRYPTED_FILE_BYTES)throw new Error('文件不能超过 12 MB。');
      const text=await file.text();
      let decoded;
      try{decoded=JSON.parse(text);}catch{throw new Error('JSON 文件格式无效。');}
      if(isEncryptedArchive(decoded)){
        let password=await requestPassphrase({mode:'import'});
        if(password===null)return;
        try{incoming=await decryptEntries(decoded,password);}
        finally{password='';}
      }else{
        if(requireEncrypted)throw new Error('所选文件不是新版 Vigil 加密备份。');
        incoming=parseImportText(text);
      }
    }catch(err){showToast(`导入失败：${err.message}`,{error:true});return;}
    if(!await confirmDialog({
      title:'导入并替换当前手记？',
      description:`文件含 ${incoming.length} 篇，将替换目前的 ${state.entries.length} 篇。备份失败会取消导入。`,
      confirmText:'备份并导入',danger:true
    }))return;
    if(!await canLeave())return;
    if(state.entries.length&&!makeBackup(state.entries,'before-import','导入前备份'))return;
    if(writeEntries(incoming)){
      state.query='';state.filters={};navigate('entries');showToast('手记导入成功');
    }
  }
  async function clearDemo(){
    const count=state.entries.filter(e=>e.demo).length;if(!count)return;
    if(!await confirmDialog({title:'清除示例手记？',description:`仅清除 ${count} 篇示例内容。`,confirmText:'清除',danger:true}))return;
    const displayedId=state.view==='editor'&&state.editorOrigin==='local'?state.editingId:
      state.view==='reader'&&state.readerSource==='local'?state.selectedId:null;
    const removesDisplayedEntry=state.entries.some(e=>e.id===displayedId&&e.demo);
    if(removesDisplayedEntry&&!await canLeave())return;
    if(!makeBackup(state.entries,'before-delete','清除示例前'))return;
    if(writeEntries(state.entries.filter(e=>!e.demo))){
      if(removesDisplayedEntry)navigate('entries');
      else render();
      showToast('已清除示例');
    }
  }
  function createBackup(){
    if(repo.readOnly)return;
    if(makeBackup(state.entries,'manual','手动备份')){render();showToast('备份已创建');}
  }
  async function restoreBackup(id){
    const item=state.backups.find(b=>b.id===id);if(!item)return;
    if(!await confirmDialog({title:'恢复这份备份？',description:`将当前文库替换为 ${item.entries.length} 篇手记，恢复前也会先创建安全备份。`,confirmText:'恢复',danger:true}))return;
    if(!await canLeave())return;
    const target=item.entries.map(e=>({...e}));
    if(!makeBackup(state.entries,'before-restore','恢复前备份'))return;
    if(writeEntries(target)){state.filters={};navigate('entries');showToast('已恢复备份');}
  }
  async function deleteBackup(id){
    if(!await confirmDialog({title:'删除这份备份？',description:'当前手记不受影响，但此副本无法再恢复。',confirmText:'删除',danger:true}))return;
    try{backups.remove(id);refreshBackups();render();}catch(err){showToast(err.message,{error:true});}
  }
  async function discardDraft(id){
    if(!await confirmDialog({title:'舍弃这份草稿？',description:'未正式保存的修改将丢失。',confirmText:'舍弃',danger:true}))return;
    try{drafts.remove(id);refreshDrafts();render();}catch(err){showToast(err.message,{error:true});}
  }
  async function processImportFile(file){
    const encryptedOnly=requireEncryptedImport;requireEncryptedImport=false;
    await importFile(file,encryptedOnly);
  }

  const actions={
    'task-toggle':async button=>{
      const id=button.dataset.id,source=button.dataset.source,line=Number(button.dataset.line);
      try{
        const changed=toggleTask(state.entries,id,line,source);
        if(!makeBackup(state.entries,'before-task','修改任务前快照'))return;
        if(writeEntries(changed)){render();showToast('已同步更新原手记中的任务状态');}
      }catch(err){showToast(err.message,{error:true});}
    },
    'favorite':async button=>{await favoriteEntry(button.dataset.id);},
    'delete':async button=>{await deleteEntry(button.dataset.id);},
    'export-filtered':button=>{exportFiltered();},
    'export':button=>{exportAll();},
    'export-encrypted':async button=>{await exportEncrypted();},
    'import':button=>{requireEncryptedImport=false;$('#importFile').click();},
    'import-encrypted':button=>{requireEncryptedImport=true;$('#importFile').click();},
    'clear-demo':async button=>{await clearDemo();},
    'create-backup':button=>{createBackup();},
    'restore-backup':async button=>{await restoreBackup(button.dataset.id);},
    'delete-backup':async button=>{await deleteBackup(button.dataset.id);},
    'discard-draft':async button=>{await discardDraft(button.dataset.id);}
  };

  return {actions,writeEntries,makeBackup,processImportFile};
}
