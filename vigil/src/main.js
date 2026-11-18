import {LocalEntryRepository} from './storage/repository.js';
import {DraftRepository,NEW_DRAFT_ID} from './storage/drafts.js';
import {BackupRepository} from './storage/backups.js';
import {storageFootprint} from './storage/footprint.js';
import {buildEntry,filterEntries,sortEntries} from './core/entries.js';
import {todayISO,charCount} from './core/format.js';
import {shiftMonth} from './core/calendar.js';
import {addChinaDays} from './core/almanac.js';
import {renderMarkdown} from './core/markdown.js';
import {mountAlmanac} from './ui/almanac-controller.js';
import {createActionDispatcher} from './ui/action-dispatcher.js';
import {createGithubController} from './ui/github-controller.js';
import {createDataController} from './ui/data-controller.js';
import {GithubClient,GITHUB_CONFIG_KEY,normalizeRepoConfig} from './github/api.js';
import {githubDraftKey,githubDraftSnapshot} from './github/notebook.js';
import {icon} from './ui/icons.js';
import {entriesCards} from './ui/views/entry-cards.js';
import {VIEWS,VIEW_TITLES} from './ui/views/index.js';
import {SETTINGS_TABS} from './ui/views/settings.js';
import {KATEX_VERSION} from './core/math.js';
import {collectDiagnostics,formatDiagnostics} from './core/diagnostics.js';
import {showToast,confirmDialog} from './ui/feedback.js';
import {mountCommandPalette} from './ui/command-palette.js';
import {playEntranceMotion,animateEditorFrame,captureMotionRect,animatePaperUnfold} from './ui/motion.js';
import {createFloatingSurfaces} from './ui/floating.js';
import {mountUnifiedEditor,readEditorMode,persistEditorMode} from './editor/unified-editor.js';
import {DEFAULT_APPEARANCE,readAppearance,writeAppearance,mixHex,contrastInk,hexToRgb,sidebarPalette} from './appearance/settings.js';
import {preparePhoto,createVisualAssets} from './appearance/background.js';
import {initLiquidGlass} from './glass/liquid-glass.js';
import {createSpectralDrape} from './effects/spectral-drape.js';
import {mountThemedSelects,closeThemedSelect} from './ui/themed-select.js';
import {tasksFromEntries} from './insights/insights.js';
import {syncTabIndicators,watchTabIndicatorLayout} from './ui/tab-indicator.js';
watchTabIndicatorLayout();

// Font stack constants, defined once at module level (not rebuilt per applyAppearance call).
const FONT_STACKS={
  song:'"Songti SC","STSong","Noto Serif CJK SC",serif',
  sans:'"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
  kai:'"KaiTi","Kaiti SC","STKaiti",serif'
};
const SETTING_UNITS={backgroundOpacity:'%',surfaceOpacity:'%',sidebarGlass:'%',glassTint:'%',drapeIntensity:'%',floatingIntensity:'%',bodyFontSize:'px',contentWidth:'px',sidebarBlur:'px'};

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
  defaultBranch:'',folder:'',files:[],note:null,editing:false,dirty:false,formDraft:null,
  draftContent:'',newFileMode:false,newPath:'',cryptoKey:null,attributes:'',
  proxySettings:{mode:'env',host:'127.0.0.1',port:7890},proxyEffective:null,proxyLoaded:false,proxyBusy:false,proxyExpanded:false,anonymous:false,attributeWarning:'',connectionStage:'',connectTrace:'',browserCheck:'',browserBusy:false
};
try{const raw=storage.getItem(GITHUB_CONFIG_KEY);if(raw)gh.config=normalizeRepoConfig(JSON.parse(raw));}catch{}
const state={
  entries:[],drafts:[],backups:[],view:'home',selectedId:null,editingId:null,
  entriesSource:'local',githubQuery:'',readerSource:'local',editorOrigin:'local',
  draftKey:null,draft:null,originalDraft:null,draftSavedSignature:null,draftStatus:'',
  query:'',order:'desc',filters:{},calendarMonth:todayISO().slice(0,7),
  calendarSelected:todayISO(),almanacDate:todayISO(),almanacPreview:false,seasonTab:'calendar',
  settingsTab:'appearance',aboutDiagnostics:null,katexAvailable:Boolean(KATEX_VERSION),
  editorFocus:false,editorOutlineOpen:false,zenMode:false,theme:'paper',editorMode:'live',appearance:null,github:gh,
  storageError:'',draftError:'',backupError:'',backupUnsafe:false,corruptStorage:false,migrated:false
};
let draftTimer=null;
let lastAppearanceSignature='';
let draftDirty=false;
let previewFrame=null;
let almanacController=null;
let unifiedEditor=null;
let settingsFrameObserver=null;
let zenFrameAnimation=null;
let typingQuietTimer=null;
let glass=null; // scene sampler is refreshed after every theme / wallpaper change
const visualAssets=createVisualAssets();
const spectralDrape=createSpectralDrape(document.querySelector('#spectralDrape'));
const floatingSurfaces=createFloatingSurfaces();
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
  const urls=visualAssets.urls();
  const sig=JSON.stringify(state.appearance)+state.theme+(urls.backgroundURL||'')+(urls.heroURL||'');
  if(sig===lastAppearanceSignature)return;
  lastAppearanceSignature=sig;
  const a=state.appearance,r=document.documentElement.style;
  const primary=a.accent;
  const palette=sidebarPalette(a.accent,a.sidebarTone,state.theme==='night');
  const sidebarAlpha=(a.sidebarGlass/100);
  const rgb=h=>hexToRgb(h).join(',');
  r.setProperty('--sidebar-glass-top',`rgba(${rgb(palette.top)},${sidebarAlpha.toFixed(2)})`);
  r.setProperty('--sidebar-glass-bottom',`rgba(${rgb(palette.bottom)},${Math.min(.97,sidebarAlpha+.09).toFixed(2)})`);
  r.setProperty('--sidebar-solid',palette.top);
  r.setProperty('--sidebar-accent-ink',palette.active);
  r.setProperty('--sidebar-edge',palette.edge);
  r.setProperty('--sidebar-glass-blur',a.sidebarBlur+'px');
  r.setProperty('--sidebar-dim',`${Math.round(17+(1-sidebarAlpha)*18)}%`);
  const glassHex=mixHex(a.accent,state.theme==='night'?'#27282d':'#eaf2ec',state.theme==='night'?.90:.90);
  const glassBase=hexToRgb(glassHex);
  r.setProperty('--glass-material',`rgba(${glassBase.join(',')},${(a.glassTint/100).toFixed(2)})`);
  r.setProperty('--glass-foreground',state.theme==='night'?'#f5f5ec':'#243b3b');
  document.documentElement.dataset.motion=a.motionMode;
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta)themeMeta.content=palette.top;
  const readableAccent=state.theme==='night'?mixHex(a.accent,'#f7e8dd',.36):a.accent;
  r.setProperty('--appearance-accent',readableAccent);
  r.setProperty('--accent',readableAccent);
  r.setProperty('--appearance-accent-soft',mixHex(a.accent,state.theme==='night'?'#303137':'#f7eedf',.80));
  r.setProperty('--accent-soft',mixHex(a.accent,state.theme==='night'?'#303137':'#f7ecda',.79));
  r.setProperty('--user-primary-bg',primary);
  r.setProperty('--green',primary);
  r.setProperty('--green-soft',mixHex(primary,state.theme==='night'?'#323238':'#ecf0eb',.84));
  r.setProperty('--appearance-contrast',contrastInk(primary));
  r.setProperty('--wallpaper-alpha',String(a.background==='none'?0:a.backgroundOpacity/100));
  r.setProperty('--wallpaper-alpha-night',String(a.background==='none'?0:Math.min(.76,a.backgroundOpacity/100*1.6)));
  // Foreground lenses need a little more refracted detail than the wallpaper itself.
  r.setProperty('--glass-scene-opacity',String(a.background==='none'?0:Math.min(.68,.34+a.backgroundOpacity/100*.8)));
  r.setProperty('--paper-opacity',a.surfaceOpacity+'%');
  r.setProperty('--reader-font-size',a.bodyFontSize+'px');
  r.setProperty('--reader-leading',String(a.lineHeight));
  r.setProperty('--workspace-max-width',a.contentWidth+'px');
  if(a.fontFamily==='heritage'){
    for(const name of ['--font-body','--font-display','--title-font','--text-font'])r.removeProperty(name);
  }else{
    const font=FONT_STACKS[a.fontFamily];
    for(const name of ['--font-body','--font-display','--title-font','--text-font'])r.setProperty(name,font);
  }
  document.body.dataset.wallpaper=a.background;
  document.body.dataset.paperTexture=a.texture?'on':'off';
  spectralDrape.setOptions({enabled:a.spectralDrape,intensity:a.drapeIntensity/100,
    accent:a.accent,night:state.theme==='night',motion:a.motionMode});
  floatingSurfaces.setOptions({enabled:a.floating,motion:a.motionMode,intensity:a.floatingIntensity});
  if(a.background==='custom'&&urls.backgroundURL){
    r.setProperty('--wallpaper-image',`url("${urls.backgroundURL}")`);
    r.setProperty('--glass-scene-url',`url("${urls.backgroundURL}")`);
  }else{
    r.removeProperty('--wallpaper-image');
    const scenes={
      paper:'assets/wallpaper-dawn-1672.webp',
      mountains:'assets/wallpaper-cloud-mist-2560.webp',
      sage:'assets/wallpaper-garden-1672.webp',
      sea:'assets/wallpaper-moonrise-1672.webp'
    };
    // Absolute URL: a relative url() inside a CSS custom property may resolve
    // against assets/vigil.css (Safari) instead of the document.
    // (about:blank / sandboxed documents have no usable base URL: keep the relative path.)
    const absolute=path=>{try{return new URL(path,document.baseURI).href;}catch{return path;}};
    const image=scenes[a.background]?absolute(scenes[a.background]):null;
    if(image){
      r.setProperty('--glass-scene-url',`url("${image}")`);
    }else{
      r.setProperty('--glass-scene-url','none');
    }
  }
  const hero=$('.hero-scene img');
  if(hero){hero.src=a.heroMode==='custom'&&urls.heroURL?urls.heroURL:'assets/typewriter-still-life.webp';}
  glass?.refresh(); // A CSS variable update alone cannot redraw the refracted canvas.
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
glass=initLiquidGlass();

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
  return state.view==='editor' && state.draft!==null && draftDirty;
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
  draftDirty=true;
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
  if(!draftDirty||signature===state.draftSavedSignature)return true;
  try{
    const old=state.entries.find(e=>e.id===state.editingId);
    drafts.save(draftKey(),state.draft,state.editorOrigin==='github'?(gh.note?.sha||''):(old?.updatedAt||''));
    state.draftSavedSignature=signature;
    draftDirty=false;
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
function exitTypingQuietude(){
  clearTimeout(typingQuietTimer);typingQuietTimer=null;
  window.removeEventListener('pointermove',exitTypingQuietude);
  window.removeEventListener('pointerdown',exitTypingQuietude);
  document.querySelector('.composer-page.refined-editor')?.classList.remove('is-typing');
}
function enterTypingQuietude(){
  if(state.view!=='editor')return;
  if(document.querySelector('.editor-dropdown-menu[open]')||($('#editorSearchBar')&&!$('#editorSearchBar').hidden))return;
  const page=document.querySelector('.composer-page.refined-editor');
  if(!page)return;
  if(!page.classList.contains('is-typing')){
    page.classList.add('is-typing');
    window.addEventListener('pointermove',exitTypingQuietude,{once:true,passive:true});
    window.addEventListener('pointerdown',exitTypingQuietude,{once:true,passive:true});
  }
  clearTimeout(typingQuietTimer);
  typingQuietTimer=setTimeout(exitTypingQuietude,3200);
}
function resetDraft(){
  clearTimeout(draftTimer);clearTimeout(outlineUpdateTimer);exitTypingQuietude();state.draft=null;state.originalDraft=null;
  state.draftSavedSignature=null;state.draftKey=null;state.editingId=null;state.editorOrigin='local';
  state.editorFocus=false;state.editorOutlineOpen=false;state.zenMode=false;document.querySelector('.shell')?.classList.remove('zen-mode');state.draftStatus='';
  draftDirty=false;
}
function navigate(view){
  // Preserve routes for older calls while presenting one cohesive calendar/season page.
  if(view==='calendar'){state.seasonTab='calendar';view='chronicle';}
  else if(view==='almanac'){state.seasonTab='almanac';view='chronicle';}
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
  const fromRect=captureMotionRect(
    document.querySelector('.reading-paper')||
    (old?document.querySelector(`[data-entry-card="${CSS.escape?CSS.escape(old.id):old.id}"]`):null)
  );
  resetDraft();
  state.editingId=old?.id||null;state.editorOrigin='local';
  state.draftKey=key;
  state.draft={...chosen,tags:[...chosen.tags]};
  state.originalDraft=JSON.stringify(original);
  state.draftSavedSignature=useSaved?JSON.stringify(chosen):null;
  draftDirty=false;
  state.draftStatus=useSaved?'已恢复草稿，继续写吧':'输入后会自动保存草稿';
  state.view='editor';render();window.scrollTo(0,0);
  animatePaperUnfold(document.querySelector('.editor-paper'),fromRect);
  $('#entryTitle')?.focus();
}
/** Shared full-screen editor for local and GitHub Markdown. The remote path,
 * sha, branch and encryption state live in gh.note; never in entry JSON. */
async function startGithubEditor(){
  if(!gh.connected||!gh.note){showToast('请先连接仓库并打开文件',{error:true});return;}
  if(gh.note.locked){showToast('请先导入此仓库的 git-crypt 密钥',{error:true});return;}
  if(!await canLeave())return;
  const original=githubDraftSnapshot(gh.note);
  const key=githubDraftKey(gh.config,gh.note.path);
  const saved=state.drafts.find(d=>d.key===key);
  let restore=false;
  if(saved&&saved.content!==original.content){
    restore=await confirmDialog({title:'发现 GitHub 手记草稿',
      description:'本机留有这篇仓库手记未提交的版本。恢复后仍会在正式提交时检查远端 SHA，是否恢复？',
      confirmText:'恢复草稿'});
  }
  // Do not silently apply a stale draft if the remote SHA changed.
  if(restore&&saved.baseUpdatedAt&&saved.baseUpdatedAt!==gh.note.sha){
    restore=await confirmDialog({title:'仓库文件已在远端变化',
      description:'草稿基于旧版文件；恢复不会自动覆盖远端，但保存可能产生冲突。继续恢复以便核对内容？',
      confirmText:'仍然恢复'});
  }
  const chosen=restore?{...original,content:saved.content}:original;
  resetDraft();
  state.editorOrigin='github';state.entriesSource='github';state.readerSource='github';
  state.editingId=null;state.draftKey=key;
  state.draft={...chosen,tags:[...chosen.tags]};
  state.originalDraft=JSON.stringify(original);
  state.draftSavedSignature=restore?JSON.stringify(chosen):null;
  draftDirty=false;
  state.draftStatus=restore?'已恢复仓库草稿，尚未提交':'输入后自动保存本机草稿；保存按钮提交 GitHub';
  gh.editing=false;gh.dirty=false;
  state.view='editor';render();window.scrollTo(0,0);
  unifiedEditor?.focus();
}
async function resumeDraft(key){
  if(key.startsWith('github:')){
    if(gh.connected&&gh.note&&githubDraftKey(gh.config,gh.note.path)===key)await startGithubEditor();
    else showToast('请先打开对应的 GitHub 仓库文件，再恢复草稿。',{error:true});
    return;
  }
  if(!state.drafts.some(x=>x.key===key)){showToast('草稿不存在',{error:true});return;}
  await startEditor(key===NEW_DRAFT_ID?null:key,{resume:true});
}
async function readEntry(id){
  if(!await canLeave())return;
  if(!state.entries.some(e=>e.id===id)){showToast('手记不存在',{error:true});return;}
  const safeId=typeof CSS!=='undefined'&&CSS.escape?CSS.escape(id):id;
  const fromRect=captureMotionRect(
    document.querySelector(`[data-entry-card="${safeId}"]`)||document.querySelector('.reading-paper')
  );
  state.selectedId=id;state.readerSource='local';state.entriesSource='local';navigate('reader');
  animatePaperUnfold(document.querySelector('.reading-paper'),fromRect);
}
async function saveEntry(){
  if(!state.draft)return;
  if(state.editorOrigin==='github'){await githubController.saveGithubEntry();return;}
  // Catch active UI before saving when not in preview mode.
  if(unifiedEditor||$('#entryContent'))trackDraftFromInputs();
  let entry,next,old;
  try{
    old=state.entries.find(e=>e.id===state.editingId);
    entry=buildEntry(state.draft,old);
    next=old?state.entries.map(e=>e.id===old.id?entry:e):[...state.entries,entry];
  }catch(err){showToast(err.message,{error:true});return;}
  if(!dataController.writeEntries(next)){scheduleDraftSave();return;}
  const fromRect=captureMotionRect(document.querySelector('.editor-paper'));
  const ok=dataController.makeBackup(state.entries,'autosave','保存手记');
  try{drafts.remove(draftKey());refreshDrafts();}catch(err){state.draftError=err.message;}
  state.selectedId=entry.id;navigate('reader');
  animatePaperUnfold(document.querySelector('.reading-paper'),fromRect);
  showToast(ok?'手记已保存':'已保存手记，备份未成功，请导出 JSON',{error:!ok});
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
  state.settingsTab=SETTINGS_TABS.some(([key])=>key===tab)?tab:'appearance';
  if(state.view!=='settings')state.view='settings';
  render();
}
function setSeasonTab(tab){
  if(!['calendar','almanac'].includes(tab))return;
  if(tab!==state.seasonTab){
    if(tab==='almanac')state.almanacDate=state.calendarSelected;
    else{
      state.calendarSelected=state.almanacDate;
      state.calendarMonth=state.almanacDate.slice(0,7);
    }
  }
  state.seasonTab=tab;
  if(state.view!=='chronicle')state.view='chronicle';
  render();
}
function chronicleToday(){
  const today=todayISO();
  state.calendarSelected=today;
  state.calendarMonth=today.slice(0,7);
  state.almanacDate=today;
  if(state.seasonTab==='almanac'&&almanacController)almanacController.reset();
  else render();
}
function aboutDiagnostics(){
  state.aboutDiagnostics=collectDiagnostics(state,window);
  render();
  document.querySelector('[data-action="about-diagnose"]')?.focus({preventScroll:true});
}
async function copyAboutDiagnostics(){
  if(!state.aboutDiagnostics)return;
  try{
    await navigator.clipboard.writeText(formatDiagnostics(state.aboutDiagnostics));
    showToast('诊断摘要已复制，不包含正文或密钥');
  }catch{
    showToast('浏览器未开放剪贴板，请在 localhost 或 HTTPS 下重试',{error:true});
  }
}
function toggleOutlineSidebar(force){
  if(state.view!=='editor')return;
  state.editorOutlineOpen=typeof force==='boolean'?force:!state.editorOutlineOpen;
  document.querySelector('.refined-editor')?.classList.toggle('outline-open',state.editorOutlineOpen);
  const sidebar=$('#editorOutlineSidebar');
  if(sidebar){
    sidebar.classList.toggle('is-open',state.editorOutlineOpen);
    sidebar.querySelector('.editor-outline-sticky')?.toggleAttribute('inert',!state.editorOutlineOpen);
  }
  const button=$('.editor-outline-toggle');
  if(button){
    button.classList.toggle('active',state.editorOutlineOpen);
    button.setAttribute('aria-pressed',String(state.editorOutlineOpen));
  }
  // The paper's width animates; re-measure CodeMirror once it settles.
  const stage=document.querySelector('.editor-stage');
  if(stage){
    let settled=false;
    const settle=()=>{if(settled)return;settled=true;stage.removeEventListener('transitionend',onEnd);unifiedEditor?.refresh();};
    const onEnd=event=>{if(event.target===stage&&event.propertyName==='grid-template-columns')settle();};
    stage.addEventListener('transitionend',onEnd);
    setTimeout(settle,650);
  }
  if(state.editorOutlineOpen){
    updateEditorOutline();
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
  const page=document.querySelector('.composer-page.refined-editor');
  const previous=page?.getBoundingClientRect();
  state.zenMode=!state.zenMode;
  document.querySelector('.shell')?.classList.toggle('zen-mode',state.zenMode);
  for(const button of document.querySelectorAll('.editor-zen-button')){
    button.classList.toggle('active',state.zenMode);button.setAttribute('aria-pressed',String(state.zenMode));
    button.title=state.zenMode?'退出沉浸 · Ctrl/⌘+Shift+F':'沉浸书写 · Ctrl/⌘+Shift+F';
  }
  fitEditorFrame();
  const animation=animateEditorFrame(page,previous);
  zenFrameAnimation=animation;
  animation?.finished.then(()=>{
    if(zenFrameAnimation!==animation)return;
    zenFrameAnimation=null;unifiedEditor?.refresh();
  }).catch(()=>{});
}
function toggleFindBar(visible=true,{replace=false}={}){
  exitTypingQuietude();
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
  document.querySelectorAll('.editor-mode-option').forEach(node=>{
    const active=node.dataset.mode===mode;
    node.classList.toggle('active',active);
    node.setAttribute('aria-pressed',String(active));
  });
}
function activeListFilters(){
  const f=state.filters;
  return Boolean(state.query.trim()||f.favorite||f.tag||f.month||f.day||f.recent||f.pending);
}
function refreshList(){
  const node=$('#entryResults');if(!node)return;
  const list=filterEntries(state.entries,state.query,state.order,state.filters);
  node.innerHTML=entriesCards(list,activeListFilters()?'已筛选':'',{editorial:true});
  if($('#resultCount'))$('#resultCount').textContent=`${list.length} 篇`;
  if($('#pageTitleCount')){
    $('#pageTitleCount').textContent=String(list.length);
    $('#pageTitleCount').setAttribute('aria-label',`${list.length} 篇手记`);
  }
  const exportButton=$('[data-action="export-filtered"]');
  if(exportButton)exportButton.disabled=repo.readOnly||list.length===0;
  const resetButton=$('[data-action="reset-list-filters"]');
  if(resetButton)resetButton.hidden=!activeListFilters();
  const allButton=$('[data-action="filter-all"]');
  if(allButton){allButton.classList.toggle('selected',!activeListFilters());allButton.setAttribute('aria-pressed',String(!activeListFilters()));}
}
function filterTo(value){
  state.filters={...state.filters,...value};
  if(state.view==='entries')refreshList();else render();
}
function changeTheme(){
  if(saveAppearance({theme:state.theme==='paper'?'night':'paper'})&&state.view==='settings')render();
}
function syncAccentSwatches(color){
  document.querySelectorAll('.settings-color-options [data-action="setting-accent"]').forEach(node=>{
    const active=node.dataset.color===color;
    node.classList.toggle('active',active);
    node.setAttribute('aria-pressed',String(active));
    const dot=node.querySelector('.color-dot');
    if(dot)dot.innerHTML=active?icon('check'):'';
  });
  const preview=$('#accentPreview');if(preview)preview.style.backgroundColor=color;
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
  if(key==='accent')syncAccentSwatches(value);
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

/** Fit the editor frame to the viewport so only its body scrolls, never the page. */
function fitEditorFrame(){
  zenFrameAnimation?.cancel();zenFrameAnimation=null;
  const page=document.querySelector('.composer-page.refined-editor');
  if(!page)return;
  const top=page.getBoundingClientRect().top+window.scrollY;
  const inner=page.closest('.main-inner');
  const pad=inner?parseFloat(getComputedStyle(inner).paddingBottom)||0:0;
  page.style.setProperty('--editor-height',Math.max(480,Math.floor(window.innerHeight-top-pad))+'px');
  unifiedEditor?.refresh();
}
window.addEventListener('resize',fitEditorFrame);
/** Keep the settings heading outside a viewport-sized, independently scrolling panel. */
function fitSettingsFrame(){
  const page=document.querySelector('.settings-hub');
  if(!page)return;
  const top=page.getBoundingClientRect().top+window.scrollY;
  const inner=page.closest('.main-inner');
  const pad=inner?parseFloat(getComputedStyle(inner).paddingBottom)||0:0;
  page.style.setProperty('--settings-height',Math.max(0,Math.floor(window.innerHeight-top-pad))+'px');
}
window.addEventListener('resize',fitSettingsFrame);
function render(){
  settingsFrameObserver?.disconnect();settingsFrameObserver=null;
  zenFrameAnimation?.cancel();zenFrameAnimation=null;
  exitTypingQuietude();
  state.storageUsage=storageFootprint(storage);
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
  document.querySelector('.shell')?.classList.toggle('zen-mode',state.view==='editor'&&state.zenMode);
  closeThemedSelect();
  $('#mainContent').innerHTML=VIEWS[state.view](state);
  for(const dock of document.querySelectorAll('[data-dock]')){
    if(dock.dataset.dock===active)dock.setAttribute('aria-current','page');
    else dock.removeAttribute('aria-current');
  }
  glass.refresh();
  applyAppearance();
  mountThemedSelects($('#mainContent'));
  syncTabIndicators($('#mainContent'));
  if(state.view==='settings'){
    fitSettingsFrame();
    settingsFrameObserver=new ResizeObserver(fitSettingsFrame);
    settingsFrameObserver.observe(document.querySelector('.settings-heading'));
    if($('#appSidebar'))settingsFrameObserver.observe($('#appSidebar'));
  }
  document.title=`${VIEW_TITLES[state.view]} · 不眠手记`;
  if(state.view==='github')githubController.ensureGithubProxyStatus();
  playEntranceMotion($('#mainContent'));
  if(state.view==='entries'){
    $('#searchInput')?.addEventListener('input',e=>{state.query=e.target.value;refreshList();});
    $('#githubSearchInput')?.addEventListener('input',e=>{
      state.githubQuery=e.target.value;
      const query=e.target.value.trim().toLocaleLowerCase();
      let count=0;
      for(const card of document.querySelectorAll('#githubEntryResults .github-note-card')){
        const visible=(card.querySelector('[data-path]')?.dataset.path||'').toLocaleLowerCase().includes(query);
        card.hidden=!visible;if(visible)count++;
      }
      const badge=$('#githubResultCount');if(badge)badge.textContent=String(count);
    });
  }
  if(state.view==='editor'){
    ['entryTitle','entryDate','entryTags','entryMood'].forEach(id=>{
      $('#'+id)?.addEventListener('input',trackDraftFromInputs);
      $('#'+id)?.addEventListener('change',trackDraftFromInputs);
    });
    fitEditorFrame();
    unifiedEditor=mountUnifiedEditor({
      host:$('#unifiedEditorHost'),reader:$('#unifiedReader'),
      initial:state.draft?.content||'',mode:state.editorMode,
      onInput:value=>{
        if(!state.draft)return;
        state.draft.content=value;
        if($('#editorWordCount'))$('#editorWordCount').textContent=`${charCount(value)} 字`;
        draftDirty=true;
        enterTypingQuietude();
        scheduleDraftSave();
        queueOutlineUpdate();
      }
    });
    updateEditorOutline();
  }
  if(state.view==='almanac'||(state.view==='chronicle'&&state.seasonTab==='almanac')){
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
      ['chronicle','日历与风物','归档手记、节气与三候','calendar'],
      ['insights','线索与行动','待办、链接与周回顾','compass'],
      ['github','GitHub 仓库','浏览与编辑 Markdown','github'],
      ['settings','设置中心','外观、数据、备份与编辑器体验','settings']
    ].map(([view,title,hint,svg])=>({title,hint,icon:svg,kind:'nav',view})),
    {title:'查看二十四节气',hint:'进入岁时日历的节气页签',icon:'spark',kind:'season-almanac'},
    {title:'设置 · 关于',hint:'版本、数据隐私与本地环境检查',icon:'info',kind:'about'},
    {title:'只看收藏',hint:'按收藏筛选手记',icon:'star',kind:'favorites'},
    {title:'浏览 GitHub 手记',hint:'在全部手记中切换到 GitHub 文库',icon:'github',kind:'github-library'},
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
        case 'season-almanac':
          if(!await canLeave())return;
          state.seasonTab='almanac';navigate('chronicle');break;
        case 'about':
          if(!await canLeave())return;
          navigate('settings');setSettingsTab('about');break;
        case 'new':await startEditor();break;
        case 'read':await readEntry(item.id);break;
        case 'resume':await resumeDraft(item.id);break;
        case 'github-library':
          if(!await canLeave())return;
          state.entriesSource='github';navigate('entries');break;
        case 'favorites':
          if(!await canLeave())return;
          state.filters={favorite:true};navigate('entries');break;
      }
    }catch(err){showToast(err.message||'命令执行失败',{error:true});}
  }
});
function resetListFilters(){state.query='';state.filters={};render();}
const actions={
  'nav':async button=>{
    if(button.dataset.tab)state.settingsTab=button.dataset.tab;
    await leaveTo(button.dataset.to);
  },
  'insight-tag':button=>{state.filters={tag:button.dataset.tag||''};navigate('entries');},
  'toggle-sidebar':button=>{toggleSidebar();},
  'command-palette':button=>{palette.open();},
  'theme':button=>{changeTheme();},
  'settings-tab':button=>{setSettingsTab(button.dataset.tab);},
  'season-tab':button=>{setSeasonTab(button.dataset.tab);},
  'chronicle-today':button=>{chronicleToday();},
  'about-diagnose':button=>{aboutDiagnostics();},
  'about-copy-diagnostics':async button=>{await copyAboutDiagnostics();},
  'editor-mode':button=>{setEditorMode(button.dataset.mode);},
  'toggle-zen':button=>{toggleZenMode();},
  'toggle-outline-sidebar':button=>{toggleOutlineSidebar();},
  'close-outline-sidebar':button=>{toggleOutlineSidebar(false);},
  'find-prev':button=>{runFind('prev');},
  'find-next':button=>{runFind('next');},
  'find-replace':button=>{runFind('replace');},
  'find-replace-all':button=>{runFind('replace-all');},
  'find-close':button=>{toggleFindBar(false);},
  'setting-upload':button=>{
    if(['backgroundFile','heroFile'].includes(button.dataset.input))$('#'+button.dataset.input)?.click();
  },
  'setting-accent':button=>{selectAppearanceOption('accent',button.dataset.color);},
  'setting-background':button=>{
    if(button.dataset.background==='custom')$('#backgroundFile')?.click();
    else selectAppearanceOption('background',button.dataset.background);
  },
  'setting-hero':button=>{
    if(button.dataset.hero==='custom')$('#heroFile')?.click();
    else selectAppearanceOption('heroMode',button.dataset.hero);
  },
  'reset-appearance':async button=>{
    if(await confirmDialog({title:'恢复默认设置？',description:'将外观、材质、动效与正文排版恢复为默认值，不影响手记和已上传的图片文件。',confirmText:'恢复默认'})){
      if(saveAppearance({...DEFAULT_APPEARANCE})){render();showToast('外观与排版已恢复默认');}
    }
  },
  'remove-custom-background':async button=>{await removeAppearanceImage('background');},
  'remove-custom-hero':async button=>{await removeAppearanceImage('hero');},
  'new':async button=>{await startEditor();},
  'read':async button=>{await readEntry(button.dataset.id);},
  'wiki-open':async button=>{
    const title=button.dataset.title||'';
    const found=state.entries.find(entry=>entry.title===title);
    if(found)await readEntry(found.id);
    else if(await confirmDialog({title:'创建关联手记？',description:`尚未找到「${title}」，要创建一页同名手记吗？`,confirmText:'新建手记'})){
      await startEditor(null,{seed:{title:title.slice(0,200),date:todayISO(),content:'',tags:[],mood:''}});
    }
  },
  'edit':async button=>{await startEditor(button.dataset.id);},
  'github-edit-full':async button=>{await startGithubEditor();},
  'entries-source':async button=>{
    if(!await canLeave())return;
    state.entriesSource=button.dataset.source==='github'?'github':'local';
    state.view='entries';render();
  },
  'resume-draft':async button=>{await resumeDraft(button.dataset.id);},
  'save':async button=>{await saveEntry();},
  'leave-editor':async button=>{await leaveTo('entries');},
  'toggle-editor-focus':button=>{toggleEditorFocus();},
  'format':button=>{applyFormat(button.dataset.format);},
  'editor-undo':button=>{unifiedEditor?.undo();unifiedEditor?.focus();},
  'editor-redo':button=>{unifiedEditor?.redo();unifiedEditor?.focus();},
  'editor-outline-jump':button=>{
    unifiedEditor?.goToLine(Number(button.dataset.line));
    if(window.innerWidth<1100)toggleOutlineSidebar(false);
  },
  'clear-search':resetListFilters,
  'reset-list-filters':resetListFilters,
  'filter-all':resetListFilters,
  'filter-favorite':button=>{filterTo({favorite:!state.filters.favorite});},
  'filter-recent':button=>{filterTo({recent:!state.filters.recent});},
  'filter-pending':button=>{filterTo({pending:!state.filters.pending});},
  'filter-tag':button=>{filterTo({tag:button.dataset.tag||''});},
  'clear-filter':button=>{state.filters={};render();},
  'toggle-order':button=>{state.order=state.order==='desc'?'asc':'desc';render();},
  'calendar-shift':button=>{
    const nextMonth=shiftMonth(state.calendarMonth,Number(button.dataset.offset));
    const year=Number(nextMonth.slice(0,4));
    if(year<1901||year>2099){showToast('风物日历支持 1901–2099 年',{error:true});return;}
    state.calendarMonth=nextMonth;
    state.calendarSelected=nextMonth+'-01';render();
  },
  'calendar-today':button=>{
    state.calendarMonth=todayISO().slice(0,7);state.calendarSelected=todayISO();render();
  },
  'calendar-day':button=>{state.calendarSelected=button.dataset.date;render();},
  'calendar-month':button=>{state.filters={month:button.dataset.month};navigate('entries');},
  'calendar-date-list':button=>{state.filters={day:button.dataset.date};navigate('entries');},
  'calendar-open-term':button=>{
    state.almanacDate=button.dataset.date;state.seasonTab='almanac';navigate('chronicle');
  },
  'almanac-reset':button=>{almanacController?.reset();},
  'almanac-day':button=>{
    if(almanacController)almanacController.preview(addChinaDays(state.almanacDate,Number(button.dataset.days)));
  }
};
const githubController=createGithubController({
  state,gh,gitClient,storage,$,render,navigate,canLeave,startGithubEditor,
  drafts,refreshDrafts,draftKey,trackDraftFromInputs,saveDraftLocal,updateDraftStatus
});
const dataController=createDataController({
  state,repo,drafts,backups,$,render,navigate,refreshDrafts,refreshBackups
});
const dispatchAction=createActionDispatcher({
  ...actions,
  ...githubController.actions,
  ...dataController.actions
});
document.addEventListener('keydown',event=>{
  if(event.key!=='/'||event.ctrlKey||event.metaKey||event.altKey||state.view!=='entries')return;
  const target=event.target;
  if(target?.closest?.('input,textarea,select,[contenteditable="true"],.CodeMirror'))return;
  event.preventDefault();$('#searchInput')?.focus();
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
  await dispatchAction(btn);
});
document.body.addEventListener('input',event=>{
  const field=event.target;
  if(field.id==='accentColor'){if(saveAppearance({accent:field.value}))syncAccentSwatches(field.value);return;}
  const key=field.dataset.setting;
  if(!key)return;
  const value=field.type==='checkbox'?field.checked:field.type==='range'?Number(field.value):field.value;
  if(saveAppearance({[key]:value})){
    if(key==='spectralDrape'){
      const intensity=$('#setting-drapeIntensity');
      if(intensity)intensity.disabled=!value;
    }
    if(key==='floating'){
      const amplitude=$('#setting-floatingIntensity');
      if(amplitude)amplitude.disabled=!value;
    }
    const output=$(`#${key}Value`);
    if(output)output.textContent=String(value)+(SETTING_UNITS[key]||'');
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
  await githubController.processLocalFile(file);
});
$('#gitCryptKeyFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  await githubController.importKeyFile(file);
});
$('#importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  await dataController.processImportFile(file);
});
document.addEventListener('keydown',e=>{
  if(e.target.matches?.('.chronicle-tab[role="tab"]')&&
      ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();
    const tabs=['calendar','almanac'];
    const current=tabs.indexOf(e.target.dataset.tab);
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:
      (current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    setSeasonTab(tabs[next]);
    document.querySelector(`.chronicle-tab[data-tab="${tabs[next]}"]`)?.focus();
    return;
  }
  if(e.target.matches?.('.settings-tab[role="tab"]')&&
      ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();
    const tabs=SETTINGS_TABS.map(([key])=>key);
    const current=Math.max(0,tabs.indexOf(e.target.dataset.tab));
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:
      (current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    const target=tabs[next];
    setSettingsTab(target);
    document.querySelector(`.settings-tab[data-tab="${target}"]`)?.focus();
    return;
  }
  if(e.target.matches?.('.notebook-tab[role="tab"]')&&
      ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();
    const tabs=['local','github'];
    const current=Math.max(0,tabs.indexOf(e.target.dataset.source));
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:
      (current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    const target=tabs[next];
    // Same path as a click, so GitHub library state is handled identically.
    document.querySelector(`.notebook-tab[data-source="${target}"]`)?.click();
    requestAnimationFrame(()=>document.querySelector(`.notebook-tab[data-source="${target}"]`)?.focus());
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
    else if(state.view==='github'&&gh.editing){e.preventDefault();githubController.saveFromGithubView();}
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
