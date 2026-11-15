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
import {importGitCryptKeyFile,encryptGitCryptBytes,decryptGitCryptBytes,isGitCryptBlob,encodeGitCryptText,decodeGitCryptText} from './security/git-crypt.js';
import {icon} from './ui/icons.js';
import {entriesCards} from './ui/views/entry-cards.js';
import {VIEWS,VIEW_TITLES} from './ui/views/index.js';
import {showToast,confirmDialog} from './ui/feedback.js';
import {requestPassphrase} from './ui/passphrase.js';
import {mountCommandPalette} from './ui/command-palette.js';
import {playEntranceMotion} from './ui/motion.js';
import {mountUnifiedEditor,readEditorMode,persistEditorMode} from './editor/unified-editor.js';
import {DEFAULT_APPEARANCE,readAppearance,writeAppearance,mixHex,contrastInk} from './appearance/settings.js';
import {preparePhoto,createVisualAssets} from './appearance/background.js';
import {initLiquidGlass} from './glass/liquid-glass.js';
import {tasksFromEntries,toggleTask} from './insights/insights.js';

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
  draftContent:'',newFileMode:false,newPath:'',cryptoKey:null,attributes:''
};
try{const raw=storage.getItem(GITHUB_CONFIG_KEY);if(raw)gh.config=normalizeRepoConfig(JSON.parse(raw));}catch{}
const state={
  entries:[],drafts:[],backups:[],view:'home',selectedId:null,editingId:null,
  draftKey:null,draft:null,originalDraft:null,draftSavedSignature:null,draftStatus:'',
  query:'',order:'desc',filters:{},calendarMonth:todayISO().slice(0,7),
  calendarSelected:todayISO(),almanacDate:todayISO(),almanacPreview:false,settingsTab:'appearance',
  editorFocus:false,editorOutlineOpen:false,zenMode:false,theme:'paper',editorMode:'live',appearance:null,github:gh,
  storageError:'',draftError:'',backupError:'',backupUnsafe:false,corruptStorage:false,migrated:false
};
let draftTimer=null;
let previewFrame=null;
let almanacController=null;
let unifiedEditor=null;
const visualAssets=createVisualAssets();
let requireEncryptedImport=false;
let gitCryptLocalMode='';
const SIDEBAR_STORAGE_KEY='vigil-sidebar-collapsed-v1';
const MOBILE_NAV_KEY='vigil-mobile-nav-open-v1';
const mobileMedia=window.matchMedia('(max-width: 900px)');
let sidebarCollapsed=false;
let mobileNavOpen=false;
try {
  sidebarCollapsed=storage.getItem(SIDEBAR_STORAGE_KEY)==='1';
  mobileNavOpen=storage.getItem(MOBILE_NAV_KEY)==='1';
} catch {}

const init=repo.load();
state.entries=init.entries;state.storageError=init.error||'';state.corruptStorage=repo.readOnly;state.migrated=init.migrated;
state.appearance=readAppearance(storage);
try{
  if(!storage.getItem('vigil-appearance-v142') && storage.getItem('vigil-theme-v1')==='night'){
    state.appearance={...state.appearance,theme:'night'};
  }
}catch{}
state.theme=state.appearance.theme;
state.editorMode=readEditorMode(storage);

function refreshDrafts(){try{state.drafts=drafts.list();state.draftError='';return true;}
  catch(err){state.draftError=err.message;state.drafts=[];return false;}}
function refreshBackups(){try{state.backups=backups.list();state.backupError='';state.backupUnsafe=false;return true;}
  catch(err){state.backupError=err.message;state.backups=[];state.backupUnsafe=true;return false;}}
refreshDrafts();refreshBackups();

document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));
$('#topToday').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
function applyTheme(){
  state.theme=state.appearance.theme;
  document.documentElement.dataset.theme=state.theme;
  const node=$('.theme-button');
  if(node){
    node.innerHTML=icon(state.theme==='paper'?'moon':'sun');
    node.setAttribute('aria-label',state.theme==='paper'?'切换至夜间主题':'切换至日间主题');
    node.title=state.theme==='paper'?'切换至夜间主题':'切换至日间主题';
  }
  applyAppearance();
}
function applyAppearance(){
  const a=state.appearance,r=document.documentElement.style;
  const primary=a.accent==='#a83f2a'?'#29483d':a.accent;
  r.setProperty('--appearance-accent',a.accent);
  r.setProperty('--accent',a.accent);
  r.setProperty('--appearance-accent-soft',mixHex(a.accent,state.theme==='night'?'#363d34':'#f7eedf',.80));
  r.setProperty('--accent-soft',mixHex(a.accent,state.theme==='night'?'#353c35':'#f7ecda',.79));
  r.setProperty('--user-primary-bg',primary);
  r.setProperty('--appearance-contrast',contrastInk(primary));
  r.setProperty('--wallpaper-alpha',String(a.backgroundOpacity/100));
  r.setProperty('--paper-opacity',a.surfaceOpacity+'%');
  r.setProperty('--reader-font-size',a.bodyFontSize+'px');
  r.setProperty('--reader-leading',String(a.lineHeight));
  r.setProperty('--workspace-max-width',a.contentWidth+'px');
  const fontFamilies={
    song:'"Songti SC","STSong","Noto Serif CJK SC",serif',
    sans:'"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    kai:'"KaiTi","Kaiti SC","STKaiti",serif'
  };
  if(a.fontFamily==='heritage'){
    for(const name of ['--font-body','--font-display','--title-font','--text-font'])r.removeProperty(name);
  }else{
    const font=fontFamilies[a.fontFamily];
    for(const name of ['--font-body','--font-display','--title-font','--text-font'])r.setProperty(name,font);
  }
  document.body.dataset.wallpaper=a.background;
  document.body.dataset.paperTexture=a.texture?'on':'off';
  const urls=visualAssets.urls();
  if(a.background==='custom'&&urls.backgroundURL){
    r.setProperty('--wallpaper-image',`url("${urls.backgroundURL}")`);
    r.setProperty('--glass-scene-url',`url("${urls.backgroundURL}")`);
  }else{
    r.removeProperty('--wallpaper-image');
    const scenes={
      paper:'/assets/wallpaper-paper.svg',
      mountains:'/assets/wallpaper-mist-3200.webp',
      sage:'/assets/wallpaper-sage.svg',
      sea:'/assets/wallpaper-moon-3200.webp',
      none:'/assets/wallpaper-paper.svg'
    };
    const image=state.theme==='night'&&a.background==='paper'
      ?'/assets/wallpaper-moon-3200.webp'
      :(scenes[a.background]||scenes.paper);
    r.setProperty('--glass-scene-url',`url("${image}")`);
  }
  const hero=$('.hero-scene img');
  if(hero){hero.src=a.heroMode==='custom'&&urls.heroURL?urls.heroURL:'/assets/typewriter-still-life.webp';}
}
function saveAppearance(patch){
  try{
    const next=writeAppearance(storage,state.appearance,patch);
    state.appearance=next;
    state.theme=next.theme;
    try{storage.setItem('vigil-theme-v1',next.theme);}catch{}
    applyTheme();
    return true;
  }catch(err){showToast('外观保存失败：'+err.message,{error:true});return false;}
}
async function loadVisualAssets(){
  try{await visualAssets.reload();applyAppearance();}
  catch(error){console.warn('Custom background unavailable:',error.message);}
}
applyTheme();loadVisualAssets();
const glass=initLiquidGlass();

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
    content:unifiedEditor?.getValue()??$('#entryContent')?.value??state.draft.content,
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
  clearTimeout(draftTimer);clearTimeout(outlineUpdateTimer);state.draft=null;state.originalDraft=null;
  state.draftSavedSignature=null;state.draftKey=null;state.editingId=null;
  state.editorFocus=false;state.editorOutlineOpen=false;state.zenMode=false;document.querySelector('.shell')?.classList.remove('zen-mode');state.draftStatus='';
}
function navigate(view){
  if(view==='data'){state.settingsTab='data';view='settings';}
  else if(view==='settings'&&state.view!=='settings')state.settingsTab='appearance';
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
  if(unifiedEditor||$('#entryContent'))trackDraftFromInputs();
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
function setSettingsTab(tab){
  state.settingsTab=tab==='data'?'data':'appearance';
  if(state.view!=='settings')state.view='settings';
  render();
}
function toggleOutlineSidebar(force){
  if(state.view!=='editor')return;
  state.editorOutlineOpen=typeof force==='boolean'?force:!state.editorOutlineOpen;
  const pane=$('#editorUnifiedPane');
  if(pane)pane.dataset.outlineOpen=String(state.editorOutlineOpen);
  pane?.classList.toggle('outline-open',state.editorOutlineOpen);
  const sidebar=$('#editorOutlineSidebar');
  if(sidebar)sidebar.classList.toggle('is-open',state.editorOutlineOpen);
  const button=$('.editor-outline-toggle');
  if(button){
    button.classList.toggle('active',state.editorOutlineOpen);
    button.setAttribute('aria-pressed',String(state.editorOutlineOpen));
    button.innerHTML=`${icon(state.editorOutlineOpen?'panel-right-close':'panel-right-open')} <span>${state.editorOutlineOpen?'收起大纲':'大纲'}</span>`;
  }
  if(state.editorOutlineOpen){
    updateEditorOutline();
    if(window.innerWidth<=1180)sidebar?.querySelector('[data-action="close-outline-sidebar"]')?.focus({preventScroll:true});
  }else if(typeof force==='boolean'){$('.editor-outline-toggle')?.focus({preventScroll:true});}
  unifiedEditor?.refresh();
}
function closeEditorMenus(except=null){
  for(const menu of document.querySelectorAll('.editor-dropdown-menu[open]')){
    if(menu!==except)menu.open=false;
  }
}
function applyFormat(style){
  if(!unifiedEditor){showToast('请先打开一篇手记的编辑界面',{error:true});return;}
  if(state.editorMode==='reading')setEditorMode('live');
  closeEditorMenus();
  unifiedEditor.format(style);
}
function toggleZenMode(){
  if(state.view!=='editor')return;
  state.zenMode=!state.zenMode;
  document.querySelector('.shell')?.classList.toggle('zen-mode',state.zenMode);
  const button=$('.editor-zen-button');
  if(button){button.classList.toggle('active',state.zenMode);button.setAttribute('aria-pressed',String(state.zenMode));
    button.innerHTML=`${icon('maximize')} <span>${state.zenMode?'退出沉浸':'专注'}</span>`;}
  unifiedEditor?.refresh();
}
function toggleFindBar(visible=true,{replace=false}={}){
  const bar=$('#editorSearchBar');if(!bar)return;
  bar.hidden=!visible;
  if(visible){
    if(state.editorMode==='reading')setEditorMode('live');
    const input=$(replace?'#editorReplaceInput':'#editorFindInput');
    input?.focus();input?.select();
  }else unifiedEditor?.focus();
}
function runFind(command){
  if(!unifiedEditor)return;
  const query=$('#editorFindInput')?.value||'';
  const replacement=$('#editorReplaceInput')?.value||'';
  if(!query)return;
  let success=false;
  if(command==='prev'||command==='next')success=unifiedEditor.findNext(query,{reverse:command==='prev'});
  if(command==='replace'){
    if(!unifiedEditor.replaceMatch(query,replacement))success=unifiedEditor.findNext(query);
    else success=true;
  }
  if(command==='replace-all'){
    const count=unifiedEditor.replaceAll(query,replacement);
    success=count>0;
    showToast(count+' 处已替换');
  }
  if(!success)showToast('没有找到匹配文本');
}
let outlineUpdateTimer=null;
function updateEditorOutline(){
  clearTimeout(outlineUpdateTimer);
  outlineUpdateTimer=null;
  const list=$('#editorOutlineList');
  if(!list||!unifiedEditor)return;
  const heads=unifiedEditor.getOutline();
  list.replaceChildren();
  if(!heads.length){
    const p=document.createElement('p');
    p.textContent='使用 #、## 或 ### 标题，即可快速跳转。';
    list.append(p);return;
  }
  for(const heading of heads){
    const button=document.createElement('button');
    button.type='button';button.className='editor-outline-item';
    button.dataset.action='editor-outline-jump';
    button.dataset.line=String(heading.line);
    button.style.setProperty('--depth',String(Math.max(0,heading.level-1)));
    button.textContent=heading.title.trim();
    button.title=`跳转至第 ${heading.line+1} 行`;
    list.append(button);
  }
}
function queueOutlineUpdate(){
  clearTimeout(outlineUpdateTimer);
  outlineUpdateTimer=setTimeout(updateEditorOutline,350);
}
function setEditorMode(mode){
  if(!unifiedEditor)return;
  unifiedEditor.setMode(mode);
  state.editorMode=mode;
  persistEditorMode(storage,mode);
  $('#editorModeStatus').textContent={live:'所写即所得 · 当前行同时显示 Markdown 与效果',reading:'阅读视图 · 去掉多余空白与编辑噪音',source:'Markdown 源文 · 专注源码'}[mode]||'';
  document.querySelectorAll('.editor-mode-option').forEach(node=>{
    const active=node.dataset.mode===mode;
    node.classList.toggle('active',active);
    node.setAttribute('aria-pressed',String(active));
  });
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
  if(saveAppearance({theme:state.theme==='paper'?'night':'paper'})&&state.view==='settings')render();
}
function selectAppearanceOption(key,value){
  if(!saveAppearance({[key]:value}))return;
  const valueName=key==='accent'?'color':key==='background'?'background':'hero';
  const action=key==='accent'?'setting-accent':key==='background'?'setting-background':'setting-hero';
  document.querySelectorAll(`[data-action="${action}"]`).forEach(node=>{
    const active=node.dataset[valueName]===value;
    node.classList.toggle('active',active);
    node.setAttribute('aria-pressed',String(active));
  });
  const color=$('#accentColor');if(color&&key==='accent')color.value=value;
}
async function uploadAppearanceImage(file,key){
  if(!file)return;
  try{
    const blob=await preparePhoto(file);
    await visualAssets.set(key,blob);
    selectAppearanceOption(key==='hero'?'heroMode':'background','custom');
    applyAppearance();
    if(state.view==='settings')render();
    showToast(key==='hero'?'静物图片已保存':'背景图片已保存');
  }catch(err){showToast('图片设置失败：'+err.message,{error:true});}
}
async function removeAppearanceImage(key){
  try{
    await visualAssets.set(key,null);
    saveAppearance(key==='hero'?{heroMode:'original'}:{background:'paper'});
    if(state.view==='settings')render();
    showToast('图片已恢复默认');
  }catch(err){showToast(err.message,{error:true});}
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
  const changedRepo=gh.config&&(gh.config.owner!==next.owner||gh.config.repo!==next.repo);
  gitClient.setConfig(next);
  if(inputToken)gitClient.setToken(inputToken);
  gh.loading=true;gh.error='';render();
  try{
    const meta=await gitClient.getRepository();
    const files=await gitClient.listFolder(next.folder);
    const attributes=await gitClient.readAttributes();
    if(changedRepo)gh.cryptoKey=null;
    gh.config=next;gh.connected=true;gh.hasToken=gitClient.canWrite;
    gh.defaultBranch=meta.default_branch||'main';
    gh.folder=next.folder;gh.files=files;gh.attributes=attributes;gh.note=null;gh.editing=false;gh.dirty=false;
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
  try{gh.note=await gitClient.readNote(path,{key:gh.cryptoKey});gh.editing=false;gh.draftContent=gh.note.content;gh.dirty=false;}
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
    const rule=await gitClient.getEncryptionRule(gh.note.path);
    const mustEncrypt=Boolean(gh.note.encrypted||rule.encrypted);
    if(mustEncrypt&&!gh.cryptoKey)throw new Error('当前路径需要 git-crypt 密钥，不能明文提交。');
    const result=await gitClient.saveNote({
      path:gh.note.path,content:gh.draftContent,sha:gh.note.sha||null,
      encrypted:mustEncrypt,key:gh.cryptoKey
    });
    gh.note={...gh.note,content:gh.draftContent,encrypted:mustEncrypt,locked:false,sha:result.sha,htmlUrl:result.htmlUrl||gh.note.htmlUrl};
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
  let encrypted;
  try{encrypted=(await gitClient.getEncryptionRule(path)).encrypted;}
  catch(err){ghError(err);return;}
  if(encrypted&&!gh.cryptoKey){ghError(new Error('该路径匹配 git-crypt 规则，请先导入密钥，避免提交明文。'));return;}
  gh.note={path,sha:null,content:'',encrypted,locked:false,htmlUrl:''};
  gh.draftContent=`# ${path.split('/').at(-1).replace(/\.(md|markdown)$/i,'')}\n\n`;
  gh.editing=true;gh.dirty=true;gh.newFileMode=false;render();
}
async function ghImportKeyFile(file){
  if(!file)return;
  if(file.size>1024*1024){ghError(new Error('密钥文件不能超过 1MB。'));return;}
  let raw;
  try{
    raw=new Uint8Array(await file.arrayBuffer());
    const key=await importGitCryptKeyFile(raw);
    gh.cryptoKey=key;
    const previous=gh.note?.path||null;
    gh.error='';
    showToast(`git-crypt 密钥已在本次会话中解锁 · ${key.name}`);
    if(previous&&!gh.editing)await ghOpen(previous);
    else render();
  }catch(err){ghError(err);render();}
  finally{raw?.fill(0);}
}
async function ghLockKey(){
  if(gh.editing&&gh.dirty&&!await confirmDialog({title:'先放弃修改？',description:'锁定后将退出加密笔记编辑。',confirmText:'锁定',danger:true}))return;
  gh.cryptoKey=null;
  gh.editing=false;gh.dirty=false;
  if(gh.note?.encrypted){gh.note={...gh.note,content:'',locked:true};gh.draftContent='';}
  showToast('git-crypt 密钥已从本次页面会话中释放');render();
}
function downloadGitCryptBytes(buffer,filename){
  const blob=new Blob([buffer],{type:'application/octet-stream'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;
  link.download=filename.replace(/[^-_.\w\u3400-\u9fff]/g,'_').slice(0,140);
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function localGitCrypt(file,mode){
  if(!file||!mode)return;
  if(!gh.cryptoKey){showToast('请先导入 git-crypt export-key 密钥文件。',{error:true});return;}
  if(file.size>900000){showToast('git-crypt 文件不能超过 900KB。',{error:true});return;}
  let raw=null;
  try{
    raw=new Uint8Array(await file.arrayBuffer());
    const base=file.name.replace(/\.gitcrypt\.md$/i,'.md').replace(/\.decrypted\.md$/i,'.md');
    if(mode==='decrypt'){
      if(!isGitCryptBlob(raw))throw new Error('不是带有 git-crypt 文件头的加密文件。');
      const clear=await decryptGitCryptBytes(raw,gh.cryptoKey);
      // Reject non-UTF8 output: tool is for Markdown notes, not binary files.
      decodeGitCryptText(clear);
      downloadGitCryptBytes(clear,base.replace(/\.(md|markdown)$/i,'')+'.decrypted.md');
      showToast('已通过 HMAC 校验并解密为本地 Markdown 文件。');
      clear.fill(0);
    }else{
      if(isGitCryptBlob(raw))throw new Error('文件已经是 git-crypt 密文，无法重复加密。');
      decodeGitCryptText(raw);
      const cipher=await encryptGitCryptBytes(raw,gh.cryptoKey);
      downloadGitCryptBytes(cipher,base.replace(/\.(md|markdown)$/i,'')+'.gitcrypt.md');
      showToast('已生成 git-crypt 兼容密文。上传仓库前请确认 .gitattributes 规则。');
    }
  }catch(err){showToast(err.message,{error:true});}
  finally{raw?.fill(0);}
}
async function ghCheck(){
  gh.loading=true;gh.error='';render();
  try{
    const [meta,files,attrs]=await Promise.all([
      gitClient.getRepository(),gitClient.listFolder(gh.folder),gitClient.readAttributes()
    ]);
    gh.files=files;gh.attributes=attrs;
    gh.health=`已验证可读取：${meta.full_name||gh.config.owner+'/'+gh.config.repo} · ${gh.config.branch||meta.default_branch||'默认分支'} · 当前目录 ${files.length} 项`;
    showToast(gh.health);
  }catch(err){gh.health='';ghError(err);}
  finally{gh.loading=false;render();}
}
async function ghDisconnect(){
  if(!await canLeave())return;
  gitClient.forgetToken();gh.cryptoKey=null;gh.attributes='';gh.hasToken=false;gh.connected=false;
  gh.note=null;gh.files=[];gh.error='';gh.editing=false;gh.dirty=false;gh.showSettings=false;
  render();
}

function render(){
  if(unifiedEditor){unifiedEditor.destroy();unifiedEditor=null;}
  if(almanacController){almanacController.destroy();almanacController=null;}
  if(previewFrame!==null){cancelAnimationFrame(previewFrame);previewFrame=null;}
  document.body.dataset.page=state.view;
  const active=state.view==='reader'?'entries':state.view;
  document.querySelectorAll('[data-nav]').forEach(node=>{
    const selected=node.dataset.nav===active;
    node.classList.toggle('active',selected);
    if(selected)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
  });
  $('#pageBreadcrumb').textContent=VIEW_TITLES[state.view]||'不眠手记';
  document.querySelector('.shell')?.classList.toggle('zen-mode',state.view==='editor'&&state.zenMode);
  $('#mainContent').innerHTML=VIEWS[state.view](state);
  for(const dock of document.querySelectorAll('[data-dock]')){
    if(dock.dataset.dock===active)dock.setAttribute('aria-current','page');
    else dock.removeAttribute('aria-current');
  }
  glass.refresh();
  applyAppearance();
  document.title=`${VIEW_TITLES[state.view]} · 不眠手记`;
  playEntranceMotion($('#mainContent'));
  if(state.view==='entries'){
    $('#searchInput').addEventListener('input',e=>{state.query=e.target.value;refreshList();});
  }
  if(state.view==='editor'){
    ['entryTitle','entryDate','entryTags','entryMood'].forEach(id=>{
      $('#'+id)?.addEventListener('input',trackDraftFromInputs);
      $('#'+id)?.addEventListener('change',trackDraftFromInputs);
    });
    unifiedEditor=mountUnifiedEditor({
      host:$('#unifiedEditorHost'),reader:$('#unifiedReader'),
      initial:state.draft?.content||'',mode:state.editorMode,
      onInput:value=>{
        if(!state.draft)return;
        state.draft.content=value;
        if($('#editorWordCount'))$('#editorWordCount').textContent=`${charCount(value)} 字`;
        scheduleDraftSave();
        queueOutlineUpdate();
      }
    });
    updateEditorOutline();
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
      ['insights','线索与行动','待办、链接与周回顾','compass'],
      ['github','GitHub 仓库','浏览与编辑 Markdown','github'],
      ['settings','设置中心','外观、数据、备份与编辑器体验','settings']
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
document.body.addEventListener('pointerdown',event=>{
  // Preserve CodeMirror's current selection while pressing formatting buttons.
  // The subsequent click still performs the requested operation.
  const format=event.target.closest('[data-action="format"], [data-action="editor-undo"], [data-action="editor-redo"]');
  if(format && event.pointerType==='mouse' && event.button===0)event.preventDefault();
});
document.body.addEventListener('click',async e=>{
  if(!e.target.closest('.editor-dropdown-menu'))closeEditorMenus();
  const opened=e.target.closest('.editor-dropdown-menu > summary');
  if(opened)closeEditorMenus(opened.parentElement);
  const btn=e.target.closest('[data-action]');if(!btn)return;
  const a=btn.dataset.action,id=btn.dataset.id;
  switch(a){
    case 'nav':
      if(btn.dataset.tab)state.settingsTab=btn.dataset.tab;
      await leaveTo(btn.dataset.to);break;
    case 'insight-tag':state.filters={tag:btn.dataset.tag||''};navigate('entries');break;
    case 'task-toggle':{
      const id=btn.dataset.id,source=btn.dataset.source,line=Number(btn.dataset.line);
      try{
        const changed=toggleTask(state.entries,id,line,source);
        if(!makeBackup(state.entries,'before-task','修改任务前快照'))break;
        if(writeEntries(changed)){render();showToast('已同步更新原手记中的任务状态');}
      }catch(err){showToast(err.message,{error:true});}break;
    }
    case 'toggle-sidebar':toggleSidebar();break;
    case 'command-palette':palette.open();break;
    case 'theme':changeTheme();break;
    case 'settings-tab':setSettingsTab(btn.dataset.tab);break;
    case 'editor-mode':setEditorMode(btn.dataset.mode);break;
    case 'toggle-zen':toggleZenMode();break;
    case 'toggle-outline-sidebar':toggleOutlineSidebar();break;
    case 'close-outline-sidebar':toggleOutlineSidebar(false);break;
    case 'find-prev':runFind('prev');break;
    case 'find-next':runFind('next');break;
    case 'find-replace':runFind('replace');break;
    case 'find-replace-all':runFind('replace-all');break;
    case 'find-close':toggleFindBar(false);break;
    case 'setting-accent':selectAppearanceOption('accent',btn.dataset.color);break;
    case 'setting-background':
      if(btn.dataset.background==='custom')$('#backgroundFile')?.click();
      else selectAppearanceOption('background',btn.dataset.background);break;
    case 'setting-hero':
      if(btn.dataset.hero==='custom')$('#heroFile')?.click();
      else selectAppearanceOption('heroMode',btn.dataset.hero);break;
    case 'reset-appearance':
      if(await confirmDialog({title:'恢复经典外观？',description:'只重置背景、主题色和阅读排版，不影响任何手记和自定义图片文件。',confirmText:'恢复外观'})){
        saveAppearance({...DEFAULT_APPEARANCE});render();showToast('经典墨绿文房已恢复');
      }break;
    case 'remove-background':
    case 'remove-custom-background':await removeAppearanceImage('background');break;
    case 'remove-hero':
    case 'remove-custom-hero':await removeAppearanceImage('hero');break;
    case 'new':await startEditor();break;
    case 'read':await readEntry(id);break;
    case 'wiki-open':{
      const title=btn.dataset.title||'';
      const found=state.entries.find(entry=>entry.title===title);
      if(found)await readEntry(found.id);
      else if(await confirmDialog({title:'创建关联手记？',description:`尚未找到「${title}」，要创建一页同名手记吗？`,confirmText:'新建手记'})){
        await startEditor(null,{seed:{title: title.slice(0,200),date:todayISO(),content:'',tags:[],mood:''}});
      }
      break;
    }
    case 'edit':await startEditor(id);break;
    case 'favorite':await favoriteEntry(id);break;
    case 'resume-draft':await resumeDraft(id);break;
    case 'save':saveEntry();break;
    case 'leave-editor':await leaveTo('entries');break;
    case 'toggle-editor-focus':toggleEditorFocus();break;
    case 'format':applyFormat(btn.dataset.format);break;
    case 'editor-undo':unifiedEditor?.undo();unifiedEditor?.focus();break;
    case 'editor-redo':unifiedEditor?.redo();unifiedEditor?.focus();break;
    case 'editor-outline-jump':
      unifiedEditor?.goToLine(Number(btn.dataset.line));
      if(window.innerWidth<1100)toggleOutlineSidebar(false);break;
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
    case 'github-key-import':$('#gitCryptKeyFile').click();break;
    case 'github-check':await ghCheck();break;
    case 'gitcrypt-local-encrypt':gitCryptLocalMode='encrypt';$('#gitCryptLocalFile').click();break;
    case 'gitcrypt-local-decrypt':gitCryptLocalMode='decrypt';$('#gitCryptLocalFile').click();break;
    case 'github-key-lock':await ghLockKey();break;
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
document.body.addEventListener('input',event=>{
  const field=event.target;
  if(field.id==='accentColor'){saveAppearance({accent:field.value});return;}
  const key=field.dataset.setting;
  if(!key)return;
  const value=field.type==='checkbox'?field.checked:field.type==='range'?Number(field.value):field.value;
  if(saveAppearance({[key]:value})){
    const output=$(`#${key}Value`);
    if(output)output.textContent=String(value)+(key==='backgroundOpacity'||key==='surfaceOpacity'?'%':key==='bodyFontSize'||key==='contentWidth'?'px':'');
  }
});
document.body.addEventListener('change',async event=>{
  const field=event.target;
  if(field.id==='backgroundFile'||field.id==='heroFile'){
    const file=field.files?.[0];field.value='';
    await uploadAppearanceImage(file,field.id==='heroFile'?'hero':'background');
  }
});
$('#gitCryptLocalFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  const mode=gitCryptLocalMode;gitCryptLocalMode='';await localGitCrypt(file,mode);
});
$('#gitCryptKeyFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';await ghImportKeyFile(file);
});
$('#importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  const encryptedOnly=requireEncryptedImport;requireEncryptedImport=false;
  await importFile(file,encryptedOnly);
});
document.addEventListener('keydown',e=>{
  if(e.target.matches?.('.settings-tab[role="tab"]')&&
      ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();
    const current=e.target.dataset.tab;
    const target=e.key==='Home'?'appearance':e.key==='End'?'data':
      current==='appearance'?'data':'appearance';
    setSettingsTab(target);
    document.querySelector(`.settings-tab[data-tab="${target}"]`)?.focus();
    return;
  }
  if(state.view==='editor' && (e.metaKey||e.ctrlKey) && !e.altKey){
    if(e.key.toLowerCase()==='f'&&!e.shiftKey){
      e.preventDefault();toggleFindBar(true);return;
    }
    if(e.key.toLowerCase()==='h'){
      e.preventDefault();toggleFindBar(true,{replace:true});return;
    }
    if(e.key.toLowerCase()==='e'){
      e.preventDefault();setEditorMode(state.editorMode==='reading'?'live':'reading');return;
    }
    if(e.key.toLowerCase()==='f'&&e.shiftKey){
      e.preventDefault();toggleZenMode();return;
    }
  }
  if(e.key==='Escape'&&state.view==='editor'&&$('#editorSearchBar')&&!$('#editorSearchBar').hidden){
    e.preventDefault();toggleFindBar(false);return;
  }
  if(e.key==='Escape'&&state.view==='editor'&&document.querySelector('.editor-dropdown-menu[open]')){
    e.preventDefault();closeEditorMenus();return;
  }
  if(e.key==='Escape'&&state.view==='editor'&&state.editorOutlineOpen){
    e.preventDefault();toggleOutlineSidebar(false);return;
  }
  if(e.key==='Escape'&&state.view==='editor'&&state.zenMode){
    e.preventDefault();toggleZenMode();return;
  }
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
  showToast('本地存储存在异常，请到设置 → 数据查看',{error:true});
