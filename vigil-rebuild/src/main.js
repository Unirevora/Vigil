import {LocalEntryRepository} from './storage/repository.js';
import {readImportFile,downloadJson} from './storage/transfer.js';
import {buildEntry,filterEntries} from './core/entries.js';
import {todayISO,charCount} from './core/format.js';
import {icon} from './ui/icons.js';
import {entriesCards} from './ui/views/entry-cards.js';
import {VIEWS,VIEW_TITLES} from './ui/views/index.js';
import {showToast,confirmDialog} from './ui/feedback.js';

const $=selector=>document.querySelector(selector);

const state = {
  entries:[],view:'home',selectedId:null,editingId:null,
  draft:null,originalDraft:null,query:'',order:'desc',
  storageError:'',corruptStorage:false,migrated:false
};

let repository;
try {
  repository=new LocalEntryRepository(window.localStorage);
} catch {
  repository=new LocalEntryRepository({
    getItem(){throw new Error('浏览器拒绝访问本地存储');},
    setItem(){throw new Error('浏览器拒绝访问本地存储');}
  });
}

const data=repository.load();
state.entries=data.entries;
state.corruptStorage=repository.readOnly;
state.storageError=data.error||'';
state.migrated=data.migrated;

document.querySelectorAll('[data-icon]').forEach(node => {
  node.innerHTML=icon(node.dataset.icon);
});
$('#topToday').textContent=new Intl.DateTimeFormat('zh-CN',{
  month:'long',day:'numeric',weekday:'long'
}).format(new Date());

function hasDraftChanges() {
  return state.view==='editor' && state.draft!==null &&
    JSON.stringify(state.draft)!==state.originalDraft;
}

async function confirmLeaving() {
  return !hasDraftChanges() || await confirmDialog({
    title:'还有未保存的文字',
    description:'离开写作页面会丢失这次尚未保存的修改。确定继续吗？',
    confirmText:'放弃修改',danger:true
  });
}

function navigate(view) {
  state.view=view;
  if(view!=='editor') {
    state.draft=null;
    state.originalDraft=null;
    state.editingId=null;
  }
  render();
  window.scrollTo(0,0);
}

async function leaveTo(view) {
  if(!await confirmLeaving()) return;
  navigate(view);
}

async function startEditor(id=null) {
  if(!await confirmLeaving()) return;
  const entry=state.entries.find(e=>e.id===id);
  state.editingId=entry?.id??null;
  state.draft=entry
    ? {title:entry.title,date:entry.date,content:entry.content}
    : {title:'',date:todayISO(),content:''};
  state.originalDraft=JSON.stringify(state.draft);
  state.view='editor';
  render();
  window.scrollTo(0,0);
  $('#entryTitle')?.focus();
}

async function readEntry(id) {
  if(!await confirmLeaving()) return;
  if(!state.entries.some(e=>e.id===id)) {
    showToast('手记不存在或已被删除。',{error:true});
    return;
  }
  state.selectedId=id;
  navigate('reader');
}

function writeEntries(next) {
  if(repository.readOnly) {
    showToast('存储处于只读保护状态，未执行写入。',{error:true});
    return false;
  }
  try {
    const saved=repository.save(next);
    state.entries=saved;
    state.storageError='';
    return true;
  } catch(error) {
    state.storageError=error.message || '本地存储写入失败';
    updateStorageBadge();
    showToast(`保存失败：${state.storageError}。当前编辑内容未被清除。`,{error:true});
    return false;
  }
}

function saveEntry() {
  if(state.view!=='editor' || !state.draft) return;
  try {
    const old=state.entries.find(e=>e.id===state.editingId);
    const updated=buildEntry(state.draft,old);
    const next=old
      ? state.entries.map(e=>e.id===old.id?updated:e)
      : [...state.entries,updated];
    if(!writeEntries(next)) return;
    state.selectedId=updated.id;
    navigate('reader');
    showToast(old?'手记已更新，并保存在本机。':'手记已写入，并保存在本机。');
  } catch(error) {
    showToast(error.message||'保存时发生错误。',{error:true});
  }
}

async function deleteEntry(id) {
  const entry=state.entries.find(e=>e.id===id);
  if(!entry)return;
  const ok=await confirmDialog({
    title:'真的要删除这篇手记吗？',
    description:`「${entry.title||'未命名手记'}」将从当前浏览器删除，这个操作无法在应用内撤销。`,
    confirmText:'确认删除',danger:true
  });
  if(ok && writeEntries(state.entries.filter(e=>e.id!==id))) {
    state.selectedId=null;
    navigate('entries');
    showToast('手记已删除。');
  }
}

function exportAll() {
  if(repository.readOnly) {
    showToast('当前数据处于保护状态，请先检查存储异常。',{error:true});
    return;
  }
  try {
    downloadJson(state.entries,'vigil-notes');
    showToast(`已开始下载 ${state.entries.length} 篇手记的备份。`);
  } catch(error) {
    showToast(`导出失败：${error.message}`,{error:true});
  }
}

async function importFile(file) {
  if(!file)return;
  if(repository.readOnly) {
    showToast('当前本地数据异常，暂不允许覆盖导入。',{error:true});
    return;
  }
  let incoming;
  try {incoming=await readImportFile(file);}
  catch(error){showToast(`导入失败：${error.message}`,{error:true});return;}

  const ok=await confirmDialog({
    title:'使用导入文件替换当前手记？',
    description:`文件包含 ${incoming.length} 篇手记，将替换当前 ${state.entries.length} 篇。\n将先触发当前数据备份下载，请确保备份文件已妥善保存。`,
    confirmText:'备份并替换',
    danger:true
  });
  if(!ok)return;
  // Never overwrite without attempting an exported backup.
  if(state.entries.length) {
    try {
      downloadJson(state.entries,'vigil-before-import');
    } catch(error) {
      showToast(`备份下载失败，已取消导入：${error.message}`,{error:true});
      return;
    }
  }
  if(writeEntries(incoming)) {
    state.query='';
    navigate('entries');
    showToast(`已导入 ${incoming.length} 篇手记。`);
  }
}

async function clearDemo() {
  const count=state.entries.filter(e=>e.demo).length;
  if(!count)return;
  const ok=await confirmDialog({
    title:'清除示例手记？',
    description:`将删除 ${count} 篇示例内容，自己新建或编辑过的手记不受影响。`,
    confirmText:'清除示例',danger:true
  });
  if(ok && writeEntries(state.entries.filter(e=>!e.demo))) {
    render();
    showToast('示例手记已清除。');
  }
}

function updateStorageBadge() {
  const badge=$('#storageBadge');
  const error=Boolean(state.storageError);
  badge.innerHTML=`${icon(error?'alert':'lock')} ${error?'存储异常':'仅本机保存'}`;
  badge.style.background=error?'#f7eee8':'#e8eee6';
  badge.style.color=error?'#a15446':'';
}

function render() {
  const active=state.view==='reader'?'entries':state.view;
  document.querySelectorAll('[data-nav]').forEach(button=>{
    const selected=button.dataset.nav===active;
    button.classList.toggle('active',selected);
    if(selected)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  updateStorageBadge();
  $('#mainContent').innerHTML=VIEWS[state.view](state);
  document.title=`${VIEW_TITLES[state.view]} · 不眠手记 Vigil`;

  if(state.view==='entries') {
    $('#searchInput').addEventListener('input',event=>{
      state.query=event.target.value;
      const results=filterEntries(state.entries,state.query,state.order);
      $('#entryResults').innerHTML=entriesCards(results,state.query);
      $('#resultCount').textContent=`共 ${results.length} 篇手记${state.query?' · 搜索结果':''}`;
    });
  }
  if(state.view==='editor') {
    const track=()=>{
      state.draft={
        title:$('#entryTitle').value,
        date:$('#entryDate').value,
        content:$('#entryContent').value
      };
      $('#editorStatus').textContent=
        `${charCount(state.draft.content)} 字 · ${hasDraftChanges()?'有未保存的修改':'已保存'} · Markdown 源码编辑`;
    };
    ['entryTitle','entryDate','entryContent'].forEach(id=>{
      $(`#${id}`).addEventListener('input',track);
    });
  }
}

document.body.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button)return;
  switch(button.dataset.action) {
    case 'nav':await leaveTo(button.dataset.to);break;
    case 'new':await startEditor();break;
    case 'read':await readEntry(button.dataset.id);break;
    case 'edit':await startEditor(button.dataset.id);break;
    case 'save':saveEntry();break;
    case 'cancel-edit':await leaveTo('entries');break;
    case 'delete':await deleteEntry(button.dataset.id);break;
    case 'clear-search':state.query='';render();$('#searchInput')?.focus();break;
    case 'toggle-order':
      state.order=state.order==='desc'?'asc':'desc';
      render();
      break;
    case 'export':exportAll();break;
    case 'import':$('#importFile').click();break;
    case 'clear-demo':await clearDemo();break;
  }
});

$('#importFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  event.target.value='';
  await importFile(file);
});

document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&state.view==='editor') {
    event.preventDefault();
    saveEntry();
  }
});
window.addEventListener('beforeunload',event=>{
  if(hasDraftChanges()) {
    event.preventDefault();
    event.returnValue='';
  }
});

render();
if(state.storageError) {
  showToast(state.storageError,{error:true});
} else if(state.migrated) {
  showToast('已从上一版网页原型复制手记数据，原存储未删除。');
}
