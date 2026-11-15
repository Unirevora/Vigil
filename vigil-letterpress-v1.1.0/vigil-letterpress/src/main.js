import {LocalEntryRepository} from './storage/repository.js';
import {DraftRepository,NEW_DRAFT_ID} from './storage/drafts.js';
import {BackupRepository} from './storage/backups.js';
import {readImportFile,downloadJson} from './storage/transfer.js';
import {buildEntry,filterEntries} from './core/entries.js';
import {todayISO,charCount} from './core/format.js';
import {icon} from './ui/icons.js';
import {entriesCards} from './ui/views/entry-cards.js';
import {VIEWS,VIEW_TITLES} from './ui/views/index.js';
import {showToast,confirmDialog} from './ui/feedback.js';

const $=selector=>document.querySelector(selector);
const storage=(()=> {
  try {return window.localStorage;}
  catch{return {
    getItem(){throw new Error('浏览器拒绝读取本地数据');},
    setItem(){throw new Error('浏览器拒绝写入本地数据');}
  };}
})();

const entryRepo=new LocalEntryRepository(storage);
const draftRepo=new DraftRepository(storage);
const backupRepo=new BackupRepository(storage);
const state={
  entries:[],drafts:[],backups:[],
  view:'home',selectedId:null,editingId:null,draftKey:null,
  draft:null,originalDraft:null,draftSavedSignature:null,draftStatus:'',
  query:'',order:'desc',
  storageError:'',draftError:'',backupError:'',backupUnsafe:false,
  corruptStorage:false,migrated:false
};

let draftTimer=null;
const loaded=entryRepo.load();
state.entries=loaded.entries;
state.storageError=loaded.error||'';
state.corruptStorage=entryRepo.readOnly;
state.migrated=loaded.migrated;

function refreshDrafts() {
  try {
    state.drafts=draftRepo.list();
    state.draftError='';
    return true;
  } catch(error) {
    state.draftError=error.message||'草稿无法读取';
    state.drafts=[];
    return false;
  }
}
function refreshBackups() {
  try{
    state.backups=backupRepo.list();
    state.backupUnsafe=false;
    state.backupError='';
    return true;
  }catch(error){
    state.backupUnsafe=true;
    state.backupError=error.message||'备份存储无法读取';
    state.backups=[];
    return false;
  }
}
refreshDrafts();
refreshBackups();

document.querySelectorAll('[data-icon]').forEach(element=>{
  element.innerHTML=icon(element.dataset.icon);
});
$('#topToday').textContent=new Intl.DateTimeFormat('zh-CN',{
  month:'long',day:'numeric',weekday:'long'
}).format(new Date());

function currentDraftChanged() {
  return state.view==='editor' && !!state.draft &&
    JSON.stringify(state.draft)!==state.originalDraft;
}
function draftKey(){return state.draftKey||NEW_DRAFT_ID;}
function updateDraftStatus(text,invalid=false) {
  state.draftStatus=text;
  const node=$('#draftStatus');
  if(node)node.textContent=text;
  const led=$('.status-led');
  if(led)led.classList.toggle('status-led-warn',invalid);
}
function scheduleDraftSave(){
  clearTimeout(draftTimer);
  if(!currentDraftChanged()) {
    updateDraftStatus('当前内容与已存档版本一致');
    return;
  }
  updateDraftStatus('正在暂存未完成的文字…');
  draftTimer=setTimeout(()=>persistDraft(),650);
}
function persistDraft(){
  clearTimeout(draftTimer);
  draftTimer=null;
  if(state.view!=='editor'||!state.draft)return true;
  const signature=JSON.stringify(state.draft);
  if(signature===state.draftSavedSignature)return true;
  if(!currentDraftChanged())return true;
  try{
    const old=state.entries.find(e=>e.id===state.editingId);
    const saved=draftRepo.save(draftKey(),state.draft,old?.updatedAt||'');
    state.draftSavedSignature=signature;
    refreshDrafts();
    const time=new Intl.DateTimeFormat('zh-CN',{
      hour:'2-digit',minute:'2-digit',hour12:false
    }).format(new Date(saved.updatedAt));
    updateDraftStatus(`草稿已于 ${time} 自动暂存`);
    return true;
  }catch(error){
    state.draftError=`草稿暂存失败：${error?.message||'空间不足'}`;
    updateDraftStatus('草稿暂存失败，请勿直接关闭页面',true);
    return false;
  }
}
async function canLeaveEditor(){
  if(state.view!=='editor'||!currentDraftChanged())return true;
  if(persistDraft())return true;
  return confirmDialog({
    title:'草稿暂存失败',
    description:'当前修改尚未写入本机。离开将丢失这些内容。\n建议复制正文到其他安全位置后再离开。',
    confirmText:'仍要离开',danger:true
  });
}
function resetEditor(){
  clearTimeout(draftTimer);
  state.draft=null;state.originalDraft=null;state.draftSavedSignature=null;
  state.draftKey=null;state.editingId=null;state.draftStatus='';
}
function navigate(view){
  if(state.view==='editor' && view!=='editor')resetEditor();
  state.view=view;
  render();
  window.scrollTo(0,0);
}
async function leaveTo(view){
  if(!await canLeaveEditor())return;
  navigate(view);
}
async function startEditor(id=null,{resume=false}={}) {
  if(!await canLeaveEditor())return;
  const entry=state.entries.find(e=>e.id===id);
  const key=id||NEW_DRAFT_ID;
  const original=entry
    ? {title:entry.title,date:entry.date,content:entry.content}
    : {title:'',date:todayISO(),content:''};
  const saved=state.drafts.find(d=>d.key===key);
  let useDraft=resume;
  if(saved&&!resume) {
    const distinct=saved.title!==original.title||saved.date!==original.date||
      saved.content!==original.content;
    if(distinct) {
      const conflict=entry && saved.baseUpdatedAt &&
        saved.baseUpdatedAt!==entry.updatedAt;
      useDraft=await confirmDialog({
        title:conflict?'发现另一份未完成稿':'发现之前的自动草稿',
        description:conflict
          ? '正式手记已在草稿建立之后发生变化。你可以选择恢复未完成的草稿，或从最新正式版本继续编辑。草稿不会被自动删除。'
          : `上次留下的${saved.title?'「'+saved.title+'」':'未命名文字'}还在草稿夹，是否继续书写？`,
        confirmText:'恢复草稿'
      });
    }
  }
  const chosen=(saved&&useDraft)
    ? {title:saved.title,date:saved.date,content:saved.content}
    : original;
  resetEditor();
  state.editingId=entry?.id||null;
  state.draftKey=key;
  state.draft=chosen;
  state.originalDraft=JSON.stringify(original);
  state.draftSavedSignature=useDraft?JSON.stringify(chosen):null;
  state.view='editor';
  state.draftStatus=useDraft?'已恢复自动草稿，可继续书写':'输入后会自动存入本机草稿';
  render();
  window.scrollTo(0,0);
  $('#entryTitle')?.focus();
}
async function resumeDraft(key) {
  const saved=state.drafts.find(d=>d.key===key);
  if(!saved){
    showToast('这份草稿已不存在。',{error:true});return;
  }
  const id=key===NEW_DRAFT_ID?null:key;
  await startEditor(id,{resume:true});
}
async function readEntry(id) {
  if(!await canLeaveEditor())return;
  if(!state.entries.some(e=>e.id===id)){
    showToast('这篇手记已不存在。',{error:true});return;
  }
  state.selectedId=id;
  navigate('reader');
}

function writeEntries(next) {
  if(entryRepo.readOnly){
    showToast('手记数据库处于保护状态，未执行写入。',{error:true});
    return false;
  }
  try{
    state.entries=entryRepo.save(next);
    state.storageError='';
    return true;
  }catch(error){
    state.storageError=error?.message||'本地写入失败';
    updateStorageBadge();
    showToast(`保存失败：${state.storageError}。当前编辑内容未清除。`,{error:true});
    return false;
  }
}
function makeBackup(entries,reason,label) {
  if(state.backupUnsafe){
    showToast('备份记录损坏，为防止覆盖，已暂停备份操作。',{error:true});
    return false;
  }
  try{
    backupRepo.create(entries,reason,label);
    refreshBackups();
    return true;
  }catch(error){
    state.backupError=`本地备份失败：${error?.message||'存储空间不足'}`;
    showToast(state.backupError,{error:true});
    return false;
  }
}
function saveEntry() {
  if(state.view!=='editor'||!state.draft)return;
  let next,old,entry;
  try{
    old=state.entries.find(e=>e.id===state.editingId);
    entry=buildEntry(state.draft,old);
    next=old
      ? state.entries.map(e=>e.id===old.id?entry:e)
      : [...state.entries,entry];
  }catch(error){
    showToast(error?.message||'标题或日期不合法。',{error:true});return;
  }
  clearTimeout(draftTimer);
  if(!writeEntries(next)) {
    scheduleDraftSave();return;
  }
  const backedUp=makeBackup(state.entries,'autosave',old?'修改手记后自动备份':'新建手记后自动备份');
  try {
    draftRepo.remove(draftKey());
    refreshDrafts();
  }catch(error){
    state.draftError=`清理已存草稿失败：${error?.message||'未知错误'}`;
  }
  state.selectedId=entry.id;
  navigate('reader');
  showToast(backedUp?'手记已存档，自动备份已生成。':'手记已存档，但本地备份未成功，请导出 JSON。',{
    error:!backedUp
  });
}
async function deleteEntry(id) {
  const entry=state.entries.find(e=>e.id===id);
  if(!entry)return;
  const confirmed=await confirmDialog({
    title:'确定删去这页手记？',
    description:`「${entry.title||'未命名手记'}」将从正式文库中移除。删除前会先保留一份安全副本。`,
    confirmText:'删除此篇',danger:true
  });
  if(!confirmed)return;
  if(!makeBackup(state.entries,'before-delete',`删除「${entry.title||'未命名手记'}」前`)){
    showToast('未能建立删除前备份，删除已取消。',{error:true});return;
  }
  if(writeEntries(state.entries.filter(e=>e.id!==id))){
    state.selectedId=null;
    navigate('entries');
    showToast('手记已删除，删除前备份仍可恢复。');
  }
}
function exportAll(){
  if(entryRepo.readOnly){
    showToast('手记库读入异常，禁止导出不完整数据。',{error:true});return;
  }
  try{
    downloadJson(state.entries,'vigil-records');
    showToast(`已开始导出 ${state.entries.length} 篇正式手记。`);
  }catch(error){
    showToast(`导出失败：${error.message}`,{error:true});
  }
}
async function importFile(file){
  if(!file)return;
  if(entryRepo.readOnly){
    showToast('手记库处于只读保护，不能覆盖。',{error:true});return;
  }
  let incoming;
  try {incoming=await readImportFile(file);}
  catch(error){showToast(`导入失败：${error.message}`,{error:true});return;}
  const confirmed=await confirmDialog({
    title:'以这份文件替换文库？',
    description:`将导入 ${incoming.length} 篇正式手记，替换当前 ${state.entries.length} 篇。\n替换前会先建立本地安全快照。建议你另存一份 JSON 备份。`,
    confirmText:'备份并导入',danger:true
  });
  if(!confirmed)return;
  if(state.entries.length&&!makeBackup(state.entries,'before-import','导入 JSON 前安全副本')){
    showToast('导入前备份未成功，已取消覆盖。',{error:true});return;
  }
  if(writeEntries(incoming)){
    state.query='';
    navigate('entries');
    showToast(`成功导入 ${incoming.length} 篇手记。`);
  }
}
async function clearDemo(){
  const n=state.entries.filter(e=>e.demo).length;
  if(!n)return;
  const ok=await confirmDialog({
    title:'清除演示手记？',
    description:`只移除 ${n} 篇演示内容；你自己写的文章将保留。清除前会先备份当前文库。`,
    confirmText:'清除演示',danger:true
  });
  if(!ok)return;
  if(!makeBackup(state.entries,'before-delete','清除演示前安全副本'))return;
  if(writeEntries(state.entries.filter(e=>!e.demo))){
    render();showToast('演示手记已清除。');
  }
}
function createBackup(){
  if(entryRepo.readOnly)return showToast('存储保护模式下无法备份。',{error:true});
  if(makeBackup(state.entries,'manual','手动建立的手记副本')){
    render();showToast('已建立手动副本，最多保留最近 5 份。');
  }else render();
}
async function restoreBackup(id){
  const snapshot=state.backups.find(b=>b.id===id);
  if(!snapshot)return showToast('指定的备份已不可用。',{error:true});
  const ok=await confirmDialog({
    title:'将文库恢复到这份备份？',
    description:`该副本包含 ${snapshot.entries.length} 篇手记，创建于 ${new Date(snapshot.createdAt).toLocaleString('zh-CN')}。\n恢复将替换当前的正式文库。恢复前会额外创建当前数据的安全副本。`,
    confirmText:'恢复这份备份',danger:true
  });
  if(!ok)return;
  // Clone first: the ring may evict the selected oldest backup.
  const target=snapshot.entries.map(e=>({...e}));
  if(!makeBackup(state.entries,'before-restore','恢复备份前安全副本')){
    showToast('无法创建恢复前副本，恢复已取消。',{error:true});return;
  }
  if(writeEntries(target)){
    state.query='';
    navigate('entries');
    showToast(`已恢复 ${target.length} 篇手记，恢复前副本可用于撤销。`);
  }
}
async function deleteBackup(id){
  const found=state.backups.find(b=>b.id===id);
  if(!found)return;
  const ok=await confirmDialog({
    title:'删除这一份本地备份？',
    description:'这只会删除选中的历史副本，不会改动当前手记。但删除后将无法使用这份副本恢复。',
    confirmText:'删除副本',danger:true
  });
  if(!ok)return;
  try{
    backupRepo.remove(id);
    refreshBackups();
    render();showToast('这份历史副本已删除。');
  }catch(error){
    showToast(`删除副本失败：${error.message}`,{error:true});
  }
}
async function discardDraft(key){
  const found=state.drafts.find(d=>d.key===key);
  if(!found)return;
  const ok=await confirmDialog({
    title:'舍弃这份未完成稿？',
    description:`「${found.title||'未命名草稿'}」尚未正式存档。舍弃后将无法在草稿夹中恢复。`,
    confirmText:'舍弃草稿',danger:true
  });
  if(!ok)return;
  try{
    draftRepo.remove(key);
    refreshDrafts();
    render();
    showToast('草稿已舍弃，正式手记不受影响。');
  }catch(error){showToast(`舍弃失败：${error.message}`,{error:true});}
}

function updateStorageBadge(){
  const badge=$('#storageBadge');
  const problem=!!state.storageError;
  badge.innerHTML=`${icon(problem?'alert':'lock')} ${problem?'存储异常':'仅此设备'}`;
  badge.style.background=problem?'#ead2c5':'';
  badge.style.color=problem?'#813b2e':'';
}
function render(){
  const active=state.view==='reader'?'entries':state.view;
  document.querySelectorAll('[data-nav]').forEach(node=>{
    const checked=node.dataset.nav===active;
    node.classList.toggle('active',checked);
    if(checked)node.setAttribute('aria-current','page');
    else node.removeAttribute('aria-current');
  });
  updateStorageBadge();
  $('#mainContent').innerHTML=VIEWS[state.view](state);
  document.title=`${VIEW_TITLES[state.view]} · 不眠手记`;
  if(state.view==='entries'){
    $('#searchInput').addEventListener('input',event=>{
      state.query=event.target.value;
      const results=filterEntries(state.entries,state.query,state.order);
      $('#entryResults').innerHTML=entriesCards(results,state.query);
      $('#resultCount').textContent=`存档 ${results.length} 篇${state.query?' · 搜索结果':''}`;
    });
  }
  if(state.view==='editor'){
    const track=()=>{
      state.draft={
        title:$('#entryTitle').value,
        date:$('#entryDate').value,
        content:$('#entryContent').value
      };
      $('#editorWordCount').textContent=`${charCount(state.draft.content)} 字`;
      scheduleDraftSave();
    };
    ['entryTitle','entryDate','entryContent'].forEach(id=>{
      $('#'+id).addEventListener('input',track);
    });
  }
}

document.body.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const id=button.dataset.id;
  switch(button.dataset.action){
    case 'nav':await leaveTo(button.dataset.to);break;
    case 'new':await startEditor();break;
    case 'read':await readEntry(id);break;
    case 'edit':await startEditor(id);break;
    case 'resume-draft':await resumeDraft(id);break;
    case 'save':saveEntry();break;
    case 'leave-editor':await leaveTo('entries');break;
    case 'delete':await deleteEntry(id);break;
    case 'clear-search':state.query='';render();$('#searchInput')?.focus();break;
    case 'toggle-order':state.order=state.order==='desc'?'asc':'desc';render();break;
    case 'export':exportAll();break;
    case 'import':$('#importFile').click();break;
    case 'clear-demo':await clearDemo();break;
    case 'create-backup':createBackup();break;
    case 'restore-backup':await restoreBackup(id);break;
    case 'delete-backup':await deleteBackup(id);break;
    case 'discard-draft':await discardDraft(id);break;
  }
});
$('#importFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  event.target.value='';
  await importFile(file);
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&state.view==='editor'){
    event.preventDefault();
    saveEntry();
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')persistDraft();
});
window.addEventListener('pagehide',persistDraft);
window.addEventListener('beforeunload',event=>{
  if(state.view==='editor' && currentDraftChanged() && !persistDraft()) {
    event.preventDefault();event.returnValue='';
  }
});

render();
if(state.storageError)showToast(state.storageError,{error:true});
else if(state.migrated)showToast('已安全复制上一版原型的数据，旧存储未被删除。');
if(state.draftError)showToast(state.draftError,{error:true});
if(state.backupError)showToast(state.backupError,{error:true});
