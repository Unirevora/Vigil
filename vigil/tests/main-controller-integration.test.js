import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createGithubController} from '../src/ui/github-controller.js';
import {createDataController} from '../src/ui/data-controller.js';
import {entriesCards} from '../src/ui/views/entry-cards.js';
import {renderMarkdown} from '../src/core/markdown.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const main=read('src/main.js');
const localActionsMatch=main.match(/const actions=\{([\s\S]*?)\n\};\nconst githubController=createGithubController\(\{/);
const localSource=localActionsMatch?.[1]||'';
const localActions=[...localSource.matchAll(/^\s*'([a-z0-9-]+)':/gm)].map(match=>match[1]);

const expectedLocalActions=[
  'nav','insight-tag','toggle-sidebar','command-palette','theme','settings-tab','season-tab',
  'chronicle-today','about-diagnose','about-copy-diagnostics','editor-mode','toggle-zen',
  'toggle-outline-sidebar','close-outline-sidebar','find-prev','find-next','find-replace',
  'find-replace-all','find-close','setting-upload','setting-accent','setting-background',
  'setting-hero','reset-appearance','remove-custom-background','remove-custom-hero','new','read',
  'wiki-open','edit','github-edit-full','entries-source','resume-draft','save','leave-editor',
  'toggle-editor-focus','format','editor-undo','editor-redo','editor-outline-jump','clear-search',
  'reset-list-filters','filter-all','filter-favorite','filter-recent','filter-pending','filter-tag',
  'clear-filter','toggle-order','calendar-shift','calendar-today','calendar-day','calendar-month',
  'calendar-date-list','calendar-open-term','almanac-reset','almanac-day'
];
const noop=()=>{};
const githubController=createGithubController({
  state:{},gh:{},gitClient:{},storage:{},$:noop,render:noop,navigate:noop,
  canLeave:noop,startGithubEditor:noop,drafts:{},refreshDrafts:noop,draftKey:noop,
  trackDraftFromInputs:noop,saveDraftLocal:noop,updateDraftStatus:noop
});
const dataController=createDataController({
  state:{entries:[],backups:[]},repo:{},drafts:{},backups:{},$:noop,
  render:noop,navigate:noop,refreshDrafts:noop,refreshBackups:noop
});
const registered=new Set([
  ...localActions,...Object.keys(githubController.actions),...Object.keys(dataController.actions)
]);

function actionNames(source,{dataset=false}={}){
  const pattern=dataset?
    /\bdataset\.action\s*=\s*(['"])([a-z0-9-]+)\1/g:
    /\bdata-action\s*=\s*(['"])([a-z0-9-]+)\1/gi;
  return [...source.matchAll(pattern)].map(match=>match[2]);
}

function functionSource(text,name){
  const match=new RegExp(`(?:async\\s+)?function ${name}\\(`).exec(text);
  assert.ok(match,`missing function ${name}`);
  const opening=text.indexOf('{',match.index);
  let depth=0;
  for(let index=opening;index<text.length;index++){
    if(text[index]==='{')depth++;
    if(text[index]==='}'){
      depth--;
      if(depth===0)return text.slice(match.index,index+1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

test('main 在命令面板后装配控制器与 dispatcher，click 只经 await dispatchAction(btn)',()=>{
  for(const specifier of [
    "./ui/action-dispatcher.js'","./ui/github-controller.js'","./ui/data-controller.js'"
  ])assert.ok(main.includes(specifier),specifier);
  for(const symbol of ['createActionDispatcher','createGithubController','createDataController'])
    assert.match(main,new RegExp(`import \\{${symbol}\\}`),symbol);

  const palette=main.indexOf('const palette=mountCommandPalette(');
  const assembly=main.indexOf('const actions={');
  const github=main.indexOf('const githubController=createGithubController({');
  const data=main.indexOf('const dataController=createDataController({');
  const dispatcher=main.indexOf('const dispatchAction=createActionDispatcher({');
  const globalKeydown=main.indexOf("document.addEventListener('keydown',event=>{");
  assert.ok(palette>=0&&assembly>palette&&github>assembly&&data>github&&dispatcher>data,'controller assembly order');
  assert.ok(globalKeydown>dispatcher,'controllers must be assembled before global event listeners');
  assert.ok(localActionsMatch,'local action registry missing');
  assert.match(main,/\.\.\.actions,\s*\.\.\.githubController\.actions,\s*\.\.\.dataController\.actions/);
  assert.match(main,/const btn=e\.target\.closest\('\[data-action\]'\);if\(!btn\)return;\s*await dispatchAction\(btn\);/);
  assert.doesNotMatch(main,/switch\(a\)|const a=btn\.dataset\.action,id=btn\.dataset\.id/);
});

test('main 不再持有已迁出的域状态、函数或重复保存实现',()=>{
  assert.doesNotMatch(main,/\brequireEncryptedImport\b|\bgitCryptLocalMode\b/);
  const migrated=[
    'saveGithubEntry','supportsLocalGithubProxy','ensureGithubProxyStatus','ghApplyProxy',
    'ghTestNetwork','ghBrowserCheck','ghError','ghConnect','ghList','ghOpen','ghParent','ghSave',
    'ghNewConfirm','ghImportKeyFile','ghLockKey','downloadGitCryptBytes','localGitCrypt','ghCheck',
    'ghDisconnect','writeEntries','makeBackup','favoriteEntry','deleteEntry','exportAll',
    'exportFiltered','exportEncrypted','importFile','clearDemo','createBackup','restoreBackup',
    'deleteBackup','discardDraft'
  ];
  for(const name of migrated)
    assert.doesNotMatch(main,new RegExp(`(?:async\\s+)?function ${name}\\(`),name);

  const save=functionSource(main,'saveEntry');
  assert.match(save,/if\(state\.editorOrigin==='github'\)\{await githubController\.saveGithubEntry\(\);return;\}/);
  assert.match(save,/if\(!dataController\.writeEntries\(next\)\)\{scheduleDraftSave\(\);return;\}/);
  assert.match(save,/const ok=dataController\.makeBackup\(state\.entries,'autosave','保存手记'\);/);
  assert.ok(save.indexOf('dataController.writeEntries(next)')<save.indexOf("dataController.makeBackup(state.entries,'autosave'"));
});

test('静态 action 全部属于本地、GitHub 或数据控制器注册表',()=>{
  assert.deepEqual([...localActions].sort(),[...expectedLocalActions].sort());
  assert.equal(new Set(localActions).size,localActions.length,'local actions must be unique');
  const files=[
    'index.html',
    ...readdirSync(new URL('../src/ui/views/',import.meta.url))
      .filter(file=>file.endsWith('.js')).map(file=>'src/ui/views/'+file)
  ];
  const observed=new Set();
  for(const file of files){
    for(const action of actionNames(read(file))){
      observed.add(action);
      assert.ok(registered.has(action),`${file}: unregistered action ${action}`);
    }
  }
  assert.ok(observed.size>50,'static action scan must cover the real views');
});

test('动态模板与 dataset.action 生成的 action 全部注册',()=>{
  const empty=entriesCards([],'');
  const filtered=entriesCards([],'关键词');
  const wiki=renderMarkdown('[[关联手记]]');
  assert.deepEqual(actionNames(empty),['new']);
  assert.deepEqual(actionNames(filtered),['clear-search']);
  assert.deepEqual(actionNames(wiki),['wiki-open']);
  assert.match(wiki,/data-title="关联手记"/);
  const datasetActions=actionNames(main,{dataset:true});
  assert.deepEqual(datasetActions,['editor-outline-jump']);

  for(const [source,actions] of [
    ['entriesCards empty',actionNames(empty)],
    ['entriesCards filtered',actionNames(filtered)],
    ['renderMarkdown wiki',actionNames(wiki)],
    ['main dataset.action',datasetActions]
  ])for(const action of actions)
    assert.ok(registered.has(action),`${source}: unregistered action ${action}`);
});

test('三个重置动作引用同一 handler，原始 button 与 dataset.id 继续下传',()=>{
  const handlers=['clear-search','reset-list-filters','filter-all'].map(action=>{
    const match=localSource.match(new RegExp(`'${action}':([A-Za-z_$][\\w$]*)`));
    return match?.[1];
  });
  assert.deepEqual(handlers,['resetListFilters','resetListFilters','resetListFilters']);
  assert.match(main,/function resetListFilters\(\)\{state\.query='';state\.filters=\{\};render\(\);\}/);
  for(const [action,call] of [
    ['read','readEntry(button.dataset.id)'],
    ['edit','startEditor(button.dataset.id)'],
    ['resume-draft','resumeDraft(button.dataset.id)']
  ])assert.ok(localSource.includes(`'${action}':async button=>{await ${call};}`),action);
});

test('render、三个文件 change 与 Ctrl/Cmd+S 调用控制器公开入口',()=>{
  assert.match(main,/if\(state\.view==='github'\)githubController\.ensureGithubProxyStatus\(\);/);
  const localFile=main.indexOf("$('#gitCryptLocalFile').addEventListener('change'");
  const keyFile=main.indexOf("$('#gitCryptKeyFile').addEventListener('change'");
  const importFile=main.indexOf("$('#importFile').addEventListener('change'");
  assert.ok(localFile>=0&&keyFile>localFile&&importFile>keyFile);
  assert.match(main.slice(localFile,keyFile),/await githubController\.processLocalFile\(file\);/);
  assert.match(main.slice(keyFile,importFile),/await githubController\.importKeyFile\(file\);/);
  assert.match(main.slice(importFile),/await dataController\.processImportFile\(file\);/);
  assert.match(main,/if\(state\.view==='editor'\)\{e\.preventDefault\(\);saveEntry\(\);\}/);
  assert.match(main,/else if\(state\.view==='github'&&gh\.editing\)\{e\.preventDefault\(\);githubController\.saveFromGithubView\(\);\}/);
});
