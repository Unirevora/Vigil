import {LocalEntryRepository} from './storage/repository.js';
import {DraftRepository,NEW_DRAFT_ID} from './storage/drafts.js';
import {BackupRepository} from './storage/backups.js';
import {parseImportText,downloadJson} from './storage/transfer.js';
import {encryptEntries,decryptEntries,isEncryptedArchive,downloadEncryptedText,MAX_ENCRYPTED_FILE_BYTES} from './storage/encrypted-transfer.js';
import {buildEntry,filterEntries,sortEntries} from './core/entries.js';
import {todayISO,charCount} from './core/format.js';
import {shiftMonth} from './core/calendar.js';
import {addChinaDays} from './core/almanac.js';
import {renderMarkdown} from './core/markdown.js';
import {mountAlmanac} from './ui/almanac-controller.js';
import {GithubClient,GITHUB_CONFIG_KEY,normalizeRepoConfig,isMarkdownPath,normalizePath} from './github/api.js';
import {icon} from './ui/icons.js';
import {entriesCards} from './ui/views/entry-cards.js';
import {VIEWS,VIEW_TITLES} from './ui/views/index.js';
import {showToast,confirmDialog} from './ui/feedback.js';
import {requestPassphrase} from './ui/passphrase.js';
import {mountCommandPalette} from './ui/command-palette.js';
import {playEntranceMotion} from './ui/motion.js';

const $=selector=>document.querySelector(selector);
const storage=(()=>{try{return window.localStorage;}catch{return {
  getItem(){throw new Error('无法访问本地存储');},
  setItem(){throw new Error('无法写入本地存储');}
};}})();

const repo=new LocalEntryRepository(storage);
const drafts=new DraftRepository(storage);
const backups=new BackupRepository(storage);
const gitClient=new GithubClient();
const gh={
  config:null,connected:false,loading:false,error:'',hasToken:false,showSettings:false,
  defaultBranch:'',folder:'',files:[],note:null,editing:false,dirty:false,
  draftContent:'',newFileMode:false,newPath:''
};
try{const raw=storage.getItem(GITHUB_CONFIG_KEY);if(raw)gh.config=normalizeRepoConfig(JSON.parse(raw));}catch{}
const state={
  entries:[],drafts:[],backups:[],view:'home',selectedId:null,editingId:null,
  draftKey:null,draft:null,originalDraft:null,draftSavedSignature:null,draftStatus:'',
  query:'',order:'desc',filters:{},calendarMonth:todayISO().slice(0,7),
  calendarSelected:todayISO(),almanacDate:todayISO(),almanacPreview:false,
  editorFocus:false,theme:'paper',github:gh,
  storageError:'',draftError:'',backupError:'',backupUnsafe:false,corruptStorage:false,migrated:false
};
let draftTimer=null;
let previewFrame=null;
let almanacController=null;
let requireEncryptedImport=false;
const SIDEBAR_STORAGE_KEY='vigil-sidebar-collapsed-v1';
const MOBILE_NAV_KEY='vigil-mobile-nav-open-v1';
const mobileMedia=window.matchMedia('(max-width: 900px)');
let sidebarCollapsed=false;
let mobileNavOpen=true;
try {
  sidebarCollapsed=storage.getItem(SIDEBAR_STORAGE_KEY)==='1';
  mobileNavOpen=storage.getItem(MOBILE_NAV_KEY)!=='0';
} catch {}

const init=repo.load();
state.entries=init.entries;state.storageError=init.error||'';state.corruptStorage=repo.readOnly;state.migrated=init.migrated;
try{state.theme=storage.getItem('vigil-theme-v1')==='night'?'night':'paper';}catch{}

function refreshDrafts(){try{state.drafts=drafts.list();state.draftError='';return true;}
  catch(err){state.draftError=err.message;state.drafts=[];return false;}}
function refreshBackups(){try{state.backups=backups.list();state.backupError='';state.backupUnsafe=false;return true;}
  catch(err){state.backupError=err.message;state.backups=[];state.backupUnsafe=true;return false;}}
refreshDrafts();refreshBackups();

document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));
$('#topToday').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
function applyTheme(){
  document.documentElement.dataset.theme=state.theme;
  const node=$('.theme-button');
  if(node)node.innerHTML=icon(state.theme==='paper'?'moon':'sun');
}
applyTheme();

function updateSidebar(){
  const shell=$('.shell'),toggle=$('#sidebarToggle');
  if(!shell||!toggle)return;
  const mobile=mobileMedia.matches;
  shell.classList.toggle('sidebar-collapsed',!mobile && sidebarCollapsed);
  shell.classList.toggle('mobile-nav-closed',mobile && !mobileNavOpen);
  const expanded=mobile?mobileNavOpen:!sidebarCollapsed;
  toggle.setAttribute('aria-expanded',String(expanded));
  toggle.setAttribute('aria-label',mobile?(expanded?'收起导航':'展开导航'):(expanded?'折叠侧边栏':'展开侧边栏'));
  toggle.title=toggle.getAttribute('aria-label');
  toggle.innerHTML=icon(mobile?'menu':(expanded?'panel-left-close':'panel-left-open'));
  const sidebar=$('#appSidebar');
  if(sidebar)sidebar.setAttribute('data-collapsed',String(!expanded));
}
function toggleSidebar(){
  if(mobileMedia.matches){
    mobileNavOpen=!mobileNavOpen;
    try{storage.setItem(MOBILE_NAV_KEY,mobileNavOpen?'1':'0');}catch{}
  }else{
    sidebarCollapsed=!sidebarCollapsed;
    try{storage.setItem(SIDEBAR_STORAGE_KEY,sidebarCollapsed?'1':'0');}catch{}
  }
  updateSidebar();
}
mobileMedia.addEventListener?.('change',updateSidebar);
updateSidebar();

function changedDraft(){
  return state.view==='editor' && state.draft!==null &&
    JSON.stringify(state.draft)!==state.originalDraft;
}
function draftKey(){return state.draftKey||NEW_DRAFT_ID;}
function updateDraftStatus(message,invalid=false){
  state.draftStatus=message;
  if($('#draftStatus'))$('#draftStatus').textContent=message;
}
function trackDraftFromInputs(){
  if(!state.draft)return;
  state.draft={
    title:$('#entryTitle')?.value??state.draft.title,
    date:$('#entryDate')?.value??state.draft.date,
    content:$('#entryContent')?.value??state.draft.content,
    tags:($('#entryTags')?.value??state.draft.tags.join(',')).split(/[,，]/).map(x=>x.trim()).filter(Boolean).slice(0,8),
    mood:$('#entryMood')?.value??state.draft.mood
  };
  if($('#editorWordCount'))$('#editorWordCount').textContent=`${charCount(state.draft.content)} 字`;
  scheduleDraftSave();
  scheduleMarkdownPreview();
}
function scheduleDraftSave(){
  clearTimeout(draftTimer);
  if(!changedDraft()){updateDraftStatus('内容与已保存版本一致');return;}
  updateDraftStatus('正在保存草稿…');
  draftTimer=setTimeout(()=>saveDraftLocal(),650);
}
function saveDraftLocal(){
  clearTimeout(draftTimer);draftTimer=null;
  if(state.view!=='editor'||!state.draft)return true;
  const signature=JSON.stringify(state.draft);
  if(signature===state.draftSavedSignature||!changedDraft())return true;
  try{
    const old=state.entries.find(e=>e.id===state.editingId);
    drafts.save(draftKey(),state.draft,old?.updatedAt||'');
    state.draftSavedSignature=signature;
    refreshDrafts();
    updateDraftStatus('草稿已自动保存');
    return true;
  }catch(error){
    state.draftError=error.message;
    updateDraftStatus('草稿保存失败，请先复制内容');
    return false;
  }
}
async function canLeave(){
  if(state.view==='editor'&&changedDraft()&&!saveDraftLocal())
    return confirmDialog({title:'草稿保存失败',description:'离开后可能丢失未存的修改，请先手动备份文字。',confirmText:'仍要离开',danger:true});
  if(state.view==='github' && gh.editing && gh.dirty)
    return confirmDialog({title:'有尚未提交的仓库修改',description:'离开将放弃尚未提交到 GitHub 的改动。',confirmText:'放弃修改',danger:true});
  return true;
}
function resetDraft(){
  clearTimeout(draftTimer);state.draft=null;state.originalDraft=null;
  state.draftSavedSignature=null;state.draftKey=null;state.editingId=null;
  state.editorFocus=false;state.draftStatus='';
}
function navigate(view){
  if(state.view==='editor'&&view!=='editor')resetDraft();
  if(state.view==='github'&&view!=='github'){gh.editing=false;gh.dirty=false;}
  state.view=view;render();
  if(mobileMedia.matches&&mobileNavOpen){
    mobileNavOpen=false;
    try{storage.setItem(MOBILE_NAV_KEY,'0');}catch{}
    updateSidebar();
  }
  window.scrollTo(0,0);
}
async function leaveTo(view){if(await canLeave())navigate(view);}
async function startEditor(id=null,{resume=false,seed=null}={}){
  if(!await canLeave())return;
  const old=state.entries.find(e=>e.id===id);
  const original=old?{title:old.title,date:old.date,content:old.content,tags:old.tags||[],mood:old.mood||''}:
    {title:'',date:todayISO(),content:'',tags:[],mood:''};
  const key=id||NEW_DRAFT_ID;
  const saved=state.drafts.find(d=>d.key===key);
  let useSaved=resume;
  if(saved&&!resume && (
    saved.title!==original.title || saved.content!==original.content ||
    saved.date!==original.date || JSON.stringify(saved.tags||[])!==JSON.stringify(original.tags||[]) ||
    (saved.mood||'')!==(original.mood||'')
  )){
    useSaved=await confirmDialog({title:'找到未完成的草稿',description:'恢复上次未写完的内容？取消则使用正式保存的版本。',confirmText:'恢复草稿'});
  }
  const chosen=seed||((saved&&useSaved)?{
    title:saved.title,date:saved.date,content:saved.content,tags:saved.tags||[],mood:saved.mood||''
  }:original);
  resetDraft();
  state.editingId=old?.id||null;
  state.draftKey=key;
  state.draft={...chosen,tags:[...chosen.tags]};
  state.originalDraft=JSON.stringify(original);
  state.draftSavedSignature=useSaved?JSON.stringify(chosen):null;
  state.draftStatus=useSaved?'已恢复草稿，继续写吧':'输入后会自动保存草稿';
  state.view='editor';render();window.scrollTo(0,0);$('#entryTitle')?.focus();
}
async function resumeDraft(key){
  if(!state.drafts.some(x=>x.key===key)){showToast('草稿不存在',{error:true});return;}
  await startEditor(key===NEW_DRAFT_ID?null:key,{resume:true});
}
async function readEntry(id){
  if(!await canLeave())return;
  if(!state.entries.some(e=>e.id===id)){showToast('手记不存在',{error:true});return;}
  state.selectedId=id;navigate('reader');
}
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
function saveEntry(){
  if(!state.draft)return;
  // Catch active UI before saving when not in preview mode.
  if($('#entryContent'))trackDraftFromInputs();
  let entry,next,old;
  try{
    old=state.entries.find(e=>e.id===state.editingId);
    entry=buildEntry(state.draft,old);
    next=old?state.entries.map(e=>e.id===old.id?entry:e):[...state.entries,entry];
  }catch(err){showToast(err.message,{error:true});return;}
  if(!writeEntries(next)){scheduleDraftSave();return;}
  const ok=makeBackup(state.entries,'autosave','保存手记');
  try{drafts.remove(draftKey());refreshDrafts();}catch(err){state.draftError=err.message;}
  state.selectedId=entry.id;navigate('reader');
  showToast(ok?'手记已保存':'已保存手记，备份未成功，请导出 JSON',{error:!ok});
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
  if(state.entries.length&&!makeBackup(state.entries,'before-import','导入前备份'))return;
  if(writeEntries(incoming)){
    state.query='';state.filters={};navigate('entries');showToast('手记导入成功');
  }
}
async function clearDemo(){
  const count=state.entries.filter(e=>e.demo).length;if(!count)return;
  if(!await confirmDialog({title:'清除示例手记？',description:`仅清除 ${count} 篇示例内容。`,confirmText:'清除',danger:true}))return;
  if(!makeBackup(state.entries,'before-delete','清除示例前'))return;
  if(writeEntries(state.entries.filter(e=>!e.demo))){render();showToast('已清除示例');}
}
function createBackup(){
  if(repo.readOnly)return;
  if(makeBackup(state.entries,'manual','手动备份')){render();showToast('备份已创建');}
}
async function restoreBackup(id){
  const item=state.backups.find(b=>b.id===id);if(!item)return;
  if(!await confirmDialog({title:'恢复这份备份？',description:`将当前文库替换为 ${item.entries.length} 篇手记，恢复前也会先创建安全备份。`,confirmText:'恢复',danger:true}))return;
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
function scheduleMarkdownPreview(){
  if(previewFrame!==null)cancelAnimationFrame(previewFrame);
  previewFrame=requestAnimationFrame(()=>{
    previewFrame=null;
    const output=$('#livePreview');
    if(!output || !state.draft || state.view!=='editor')return;
    // Source textarea is never reconstructed as the preview updates.
    output.innerHTML=renderMarkdown(state.draft.content);
    const status=$('#previewStatus');
    if(status)status.textContent='实时更新';
  });
}
function toggleEditorFocus(){
  if($('#entryContent'))trackDraftFromInputs();
  state.editorFocus=!state.editorFocus;
  const grid=$('#editorLiveGrid');
  if(grid)grid.classList.toggle('is-focus',state.editorFocus);
  const button=document.querySelector('[data-action="toggle-editor-focus"]');
  if(button){
    button.innerHTML=`${icon(state.editorFocus?'eye':'edit')} ${state.editorFocus?'显示预览':'专注书写'}`;
    button.classList.toggle('active',state.editorFocus);
  }
}
function applyFormat(style){
  const field=$('#entryContent');
  if(!field)return;
  const start=field.selectionStart,end=field.selectionEnd,selected=field.value.slice(start,end);
  const opts={
    bold:['**','**','加粗文字'],italic:['*','*','斜体文字'],
    heading:['## ','','小标题'],list:['- ','','列表项'],quote:['> ','','引用内容'],
    code:['`','`','代码'],link:['[','](https://example.com)','链接文字']
  };
  const [before,after,placeholder]=opts[style]||opts.bold;
  const replacement=before+(selected||placeholder)+after;
  field.setRangeText(replacement,start,end,'select');
  field.focus();field.dispatchEvent(new Event('input',{bubbles:true}));
}
function refreshList(){
  const node=$('#entryResults');if(!node)return;
  const list=filterEntries(state.entries,state.query,state.order,state.filters);
  node.innerHTML=entriesCards(list,state.query);
  if($('#resultCount'))$('#resultCount').textContent=`${list.length} 篇`;
}
function filterTo(value){
  state.filters={...state.filters,...value};render();
}
function changeTheme(){
  state.theme=state.theme==='paper'?'night':'paper';applyTheme();
  try{storage.setItem('vigil-theme-v1',state.theme);}catch{}
}

// GitHub browsing and editing. Repository config is stored; the token NEVER is.
function ghError(err){
  gh.error=err?.message||'GitHub 请求失败';
  showToast(gh.error,{error:true});
}
async function ghConnect(){
  if(gh.connected && gh.editing && gh.dirty &&
     !await confirmDialog({title:'放弃尚未提交的修改？',description:'切换仓库连接会丢失当前编辑框内的改动。',confirmText:'继续连接',danger:true}))return;
  const values={
    repoUrl:$('#ghRepo')?.value,branch:$('#ghBranch')?.value,folder:$('#ghFolder')?.value
  };
  let next;
  try{next=normalizeRepoConfig(values);}catch(err){ghError(err);render();return;}
  const inputToken=$('#ghToken')?.value?.trim()||'';
  const priorConfig=gitClient.config,priorToken=gitClient.token;
  gitClient.setConfig(next);
  if(inputToken)gitClient.setToken(inputToken);
  gh.loading=true;gh.error='';render();
  try{
    const meta=await gitClient.getRepository();
    const files=await gitClient.listFolder(next.folder);
    gh.config=next;gh.connected=true;gh.hasToken=gitClient.canWrite;
    gh.defaultBranch=meta.default_branch||'main';
    gh.folder=next.folder;gh.files=files;gh.note=null;gh.editing=false;gh.dirty=false;
    gh.showSettings=false;
    try{storage.setItem(GITHUB_CONFIG_KEY,JSON.stringify(next));}catch{}
    showToast('仓库已连接');
  }catch(err){
    gitClient.config=priorConfig;gitClient.setToken(priorToken);
    ghError(err);
  }finally{gh.loading=false;render();}
}
async function ghList(folder){
  if(gh.editing&&gh.dirty&&!await confirmDialog({title:'放弃仓库修改？',description:'当前修改尚未提交到 GitHub。',confirmText:'放弃修改',danger:true}))return;
  gh.loading=true;gh.error='';render();
  try{gh.files=await gitClient.listFolder(folder);gh.folder=folder;gh.note=null;gh.editing=false;gh.dirty=false;}
  catch(err){ghError(err);}
  finally{gh.loading=false;render();}
}
async function ghOpen(path){
  if(gh.editing&&gh.dirty&&!await confirmDialog({title:'放弃仓库修改？',description:'当前修改尚未提交。',confirmText:'放弃修改',danger:true}))return;
  gh.loading=true;gh.error='';render();
  try{gh.note=await gitClient.readNote(path);gh.editing=false;gh.draftContent=gh.note.content;gh.dirty=false;}
  catch(err){ghError(err);}
  finally{gh.loading=false;render();}
}
async function ghParent(){
  const root=gh.config?.folder||'';
  if(!gh.folder||gh.folder===root)return;
  const parent=gh.folder.split('/').slice(0,-1).join('/');
  if(root&&!(parent===root||parent.startsWith(root+'/')))return;
  await ghList(parent);
}
async function ghSave(){
  if(!gh.note||!gh.editing)return;
  gh.loading=true;gh.error='';render(); // draftContent lives in state.
  try{
    const result=await gitClient.saveNote({path:gh.note.path,content:gh.draftContent,sha:gh.note.sha||null});
    gh.note={...gh.note,content:gh.draftContent,sha:result.sha,htmlUrl:result.htmlUrl||gh.note.htmlUrl};
    gh.editing=false;gh.dirty=false;
    gh.files=await gitClient.listFolder(gh.folder);
    showToast('已提交到 GitHub 仓库');
  }catch(err){ghError(err);}
  finally{gh.loading=false;render();}
}
async function ghNewConfirm(){
  const raw=$('#ghNewPath')?.value||'';
  let path;
  try{
    path=normalizePath(raw);
    if(!isMarkdownPath(path))throw new Error('请使用 .md 或 .markdown 文件名');
    const scope=gh.config?.folder||'';
    if(scope&&!(path.startsWith(scope+'/')))throw new Error('新笔记路径需位于设定的笔记文件夹内');
  }catch(err){ghError(err);render();return;}
  gh.note={path,sha:null,content:'',htmlUrl:''};
  gh.draftContent=`# ${path.split('/').at(-1).replace(/\.(md|markdown)$/i,'')}\n\n`;
  gh.editing=true;gh.dirty=true;gh.newFileMode=false;render();
}
async function ghDisconnect(){
  if(!await canLeave())return;
  gitClient.forgetToken();gh.hasToken=false;gh.connected=false;
  gh.note=null;gh.files=[];gh.error='';gh.editing=false;gh.dirty=false;gh.showSettings=false;
  render();
}

function render(){
  if(almanacController){almanacController.destroy();almanacController=null;}
  if(previewFrame!==null){cancelAnimationFrame(previewFrame);previewFrame=null;}
  const active=state.view==='reader'?'entries':state.view;
  document.querySelectorAll('[data-nav]').forEach(node=>{
    const selected=node.dataset.nav===active;
    node.classList.toggle('active',selected);
    if(selected)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
  });
  $('#pageBreadcrumb').textContent=VIEW_TITLES[state.view]||'不眠手记';
  $('#mainContent').innerHTML=VIEWS[state.view](state);
  document.title=`${VIEW_TITLES[state.view]} · 不眠手记`;
  playEntranceMotion($('#mainContent'));
  if(state.view==='entries'){
    $('#searchInput').addEventListener('input',e=>{state.query=e.target.value;refreshList();});
  }
  if(state.view==='editor'){
    ['entryTitle','entryDate','entryTags','entryMood','entryContent'].forEach(id=>{
      $('#'+id)?.addEventListener('input',trackDraftFromInputs);
      $('#'+id)?.addEventListener('change',trackDraftFromInputs);
    });
    const source=$('#entryContent');
    source?.addEventListener('scroll',()=>{
      const preview=$('#livePreview');
      if(!preview)return;
      const maxSource=Math.max(1,source.scrollHeight-source.clientHeight);
      const maxPreview=Math.max(0,preview.scrollHeight-preview.clientHeight);
      preview.scrollTop=source.scrollTop/maxSource*maxPreview;
    },{passive:true});
  }
  if(state.view==='almanac'){
    almanacController=mountAlmanac(state);
  }
  if(state.view==='github'&&gh.editing){
    $('#githubEditor')?.addEventListener('input',e=>{
      gh.draftContent=e.target.value;gh.dirty=gh.draftContent!==gh.note.content;
    });
  }
}
const palette=mountCommandPalette({
  getItems:()=>[
    {title:'写一篇手记',hint:'新建手记 · 自动草稿',icon:'pen',kind:'new',keywords:'new 新建'},
    ...[
      ['home','首页','回到卷首','home'],
      ['entries','全部手记','搜索与筛选','book'],
      ['calendar','日历归档','按日期查看手记','calendar'],
      ['almanac','节气风物','二十四节气与三候','spark'],
      ['github','GitHub 仓库','浏览与编辑 Markdown','github'],
      ['data','门与数据','备份、导入与导出','archive']
    ].map(([view,title,hint,svg])=>({title,hint,icon:svg,kind:'nav',view})),
    {title:'只看收藏',hint:'按收藏筛选手记',icon:'star',kind:'favorites'},
    ...state.drafts.slice(0,3).map(x=>({
      title:x.title||'未命名草稿',hint:'继续未完成的草稿',icon:'edit',
      kind:'resume',id:x.key,keywords:x.content.slice(0,150)
    })),
    ...sortEntries(state.entries).map(entry=>({
      title:entry.title||'未命名手记',
      hint:`手记 · ${entry.date}${entry.tags?.length?' · '+entry.tags.join('、'):''}`,
      icon:'file',kind:'read',id:entry.id,
      keywords:`${entry.content} ${(entry.tags||[]).join(' ')}`
    }))
  ],
  onSelect:async item=>{
    try{
      switch(item.kind){
        case 'nav':await leaveTo(item.view);break;
        case 'new':await startEditor();break;
        case 'read':await readEntry(item.id);break;
        case 'resume':await resumeDraft(item.id);break;
        case 'favorites':
          if(!await canLeave())return;
          state.filters={favorite:true};navigate('entries');break;
      }
    }catch(err){showToast(err.message||'命令执行失败',{error:true});}
  }
});
document.body.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-action]');if(!btn)return;
  const a=btn.dataset.action,id=btn.dataset.id;
  switch(a){
    case 'nav':await leaveTo(btn.dataset.to);break;
    case 'toggle-sidebar':toggleSidebar();break;
    case 'command-palette':palette.open();break;
    case 'theme':changeTheme();break;
    case 'new':await startEditor();break;
    case 'read':await readEntry(id);break;
    case 'edit':await startEditor(id);break;
    case 'favorite':await favoriteEntry(id);break;
    case 'resume-draft':await resumeDraft(id);break;
    case 'save':saveEntry();break;
    case 'leave-editor':await leaveTo('entries');break;
    case 'toggle-editor-focus':toggleEditorFocus();break;
    case 'format':applyFormat(btn.dataset.format);break;
    case 'clear-search':state.query='';state.filters={};render();break;
    case 'filter-all':filterTo({favorite:false});break;
    case 'filter-favorite':filterTo({favorite:true});break;
    case 'filter-tag':filterTo({tag:btn.dataset.tag||''});break;
    case 'clear-filter':state.filters={};render();break;
    case 'toggle-order':state.order=state.order==='desc'?'asc':'desc';render();break;
    case 'calendar-shift':
      state.calendarMonth=shiftMonth(state.calendarMonth,Number(btn.dataset.offset));
      state.calendarSelected=state.calendarMonth+'-01';render();break;
    case 'calendar-today':
      state.calendarMonth=todayISO().slice(0,7);state.calendarSelected=todayISO();render();break;
    case 'calendar-day':state.calendarSelected=btn.dataset.date;render();break;
    case 'calendar-month':state.filters={month:btn.dataset.month};navigate('entries');break;
    case 'calendar-date-list':state.filters={day:btn.dataset.date};navigate('entries');break;
    case 'calendar-open-term':state.almanacDate=btn.dataset.date;navigate('almanac');break;
    case 'almanac-reset':almanacController?.reset();break;
    case 'almanac-day':
      if(almanacController)almanacController.preview(addChinaDays(state.almanacDate,Number(btn.dataset.days)));break;
    case 'delete':await deleteEntry(id);break;
    case 'export':exportAll();break;
    case 'export-encrypted':await exportEncrypted();break;
    case 'import':requireEncryptedImport=false;$('#importFile').click();break;
    case 'import-encrypted':requireEncryptedImport=true;$('#importFile').click();break;
    case 'clear-demo':await clearDemo();break;
    case 'create-backup':createBackup();break;
    case 'restore-backup':await restoreBackup(id);break;
    case 'delete-backup':await deleteBackup(id);break;
    case 'discard-draft':await discardDraft(id);break;
    case 'github-connect':await ghConnect();break;
    case 'github-disconnect':await ghDisconnect();break;
    case 'github-settings':gh.showSettings=!gh.showSettings;render();break;
    case 'github-refresh':await ghList(gh.folder);break;
    case 'github-folder':await ghList(btn.dataset.path);break;
    case 'github-note':await ghOpen(btn.dataset.path);break;
    case 'github-parent':await ghParent();break;
    case 'github-edit':gh.editing=true;gh.draftContent=gh.note.content;gh.dirty=false;render();break;
    case 'github-cancel-edit':
      if(gh.dirty&&!await confirmDialog({title:'放弃修改？',description:'还没有提交到仓库。',confirmText:'放弃',danger:true}))break;
      gh.editing=false;gh.dirty=false;render();break;
    case 'github-save':await ghSave();break;
    case 'github-new':gh.newFileMode=true;render();break;
    case 'github-new-cancel':gh.newFileMode=false;render();break;
    case 'github-new-confirm':await ghNewConfirm();break;
  }
});
$('#importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  const encryptedOnly=requireEncryptedImport;requireEncryptedImport=false;
  await importFile(file,encryptedOnly);
});
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
    e.preventDefault();palette.open();return;
  }
  if(e.key==='Escape'&&mobileMedia.matches&&mobileNavOpen){
    mobileNavOpen=false;updateSidebar();
  }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){
    if(state.view==='editor'){e.preventDefault();saveEntry();}
    else if(state.view==='github'&&gh.editing){e.preventDefault();ghSave();}
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveDraftLocal();});
window.addEventListener('pagehide',saveDraftLocal);
window.addEventListener('beforeunload',e=>{
  if((state.view==='editor'&&changedDraft()&&!saveDraftLocal())||
     (state.view==='github'&&gh.editing&&gh.dirty)){e.preventDefault();e.returnValue='';}
});
render();
if(state.migrated)showToast('已从上一版原型保留原有手记');
if(state.storageError||state.draftError||state.backupError)
  showToast('本地存储存在异常，请进入数据管理查看',{error:true});
