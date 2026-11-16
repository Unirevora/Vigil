import {GithubClient,GITHUB_CONFIG_KEY,normalizeRepoConfig,isMarkdownPath,normalizePath} from '../github/api.js';
import {inspectGithubRepository} from '../github/connection.js';
import {githubNoteTitle} from '../github/notebook.js';
import {checkGithubBrowserPaths} from '../github/browser-diagnostics.js';
import {importGitCryptKeyFile,encryptGitCryptBytes,decryptGitCryptBytes,isGitCryptBlob,decodeGitCryptText} from '../security/git-crypt.js';
import {showToast,confirmDialog} from './feedback.js';

export function createGithubController(context){
  const {
    state,gh,gitClient,storage,$,render,navigate,canLeave,startGithubEditor,
    drafts,refreshDrafts,draftKey,trackDraftFromInputs,saveDraftLocal,updateDraftStatus
  }=context;
  let gitCryptLocalMode='';

  async function saveGithubEntry(){
    if(state.editorOrigin!=='github'||!state.draft||!gh.note||!gh.connected){
      showToast('远端文件会话已失效，请先保存草稿后重新连接',{error:true});return;
    }
    trackDraftFromInputs();
    const savedContent=state.draft.content;
    const note=gh.note;
    if(!gitClient.canWrite){
      saveDraftLocal();showToast('这是只读仓库。请到 GitHub 仓库页提供 Contents 读写 Token。',{error:true});return;
    }
    const btn=document.querySelector('[data-action="save"]');
    if(btn?.disabled)return;
    if(btn)btn.disabled=true;
    updateDraftStatus('正在检查 SHA 与加密规则…');
    try{
      const rule=await gitClient.getEncryptionRule(note.path);
      const mustEncrypt=Boolean(note.encrypted||rule.encrypted);
      if(mustEncrypt&&!gh.cryptoKey)throw new Error('文件受 git-crypt 保护，必须先导入仓库密钥，禁止明文提交。');
      // Read-after-write is deliberately not coupled to commit success. A list
      // refresh failure must never make the user retry a successful PUT.
      const result=await gitClient.saveNote({path:note.path,content:savedContent,sha:note.sha,
        encrypted:mustEncrypt,key:gh.cryptoKey});
      gh.note={...note,content:savedContent,sha:result.sha||note.sha,
        encrypted:mustEncrypt,locked:false,htmlUrl:result.htmlUrl||note.htmlUrl};
      try{drafts.remove(draftKey());refreshDrafts();}
      catch(error){state.draftError=error.message;}
      try{gh.files=await gitClient.listFolder(gh.folder);}
      catch{showToast('提交已成功，但文件列表刷新失败；请稍后手动刷新。');}
      state.readerSource='github';state.entriesSource='github';
      navigate('reader');showToast('GitHub 手记已提交（SHA 已更新）');
    }catch(error){
      saveDraftLocal();updateDraftStatus('提交失败 · 草稿保留在此设备');
      ghError(error);
    }finally{
      if(state.view==='editor'&&state.editorOrigin==='github'){
        const current=document.querySelector('[data-action="save"]');
        if(current)current.disabled=false;
      }
    }
  }

  // Only the local server can use the configured proxy, never an arbitrary URL.
  // The status endpoint is strictly local; /diagnose performs an actual upstream test.
  function supportsLocalGithubProxy(){
    return gitClient.canUseLocalRelay;
  }
  function ensureGithubProxyStatus(){
    if(gh.proxyLoaded||!supportsLocalGithubProxy())return;
    gh.proxyLoaded=true;
    fetch('api/github/proxy',{cache:'no-store'}).then(response=>{
      if(!response.ok||response.headers.get('X-Vigil-Github-Proxy')!=='1')throw Error('LOCAL_RELAY_MISSING');
      return response.json();
    }).then(data=>{
      gh.proxySettings={...gh.proxySettings,...data.settings};
      gh.proxyEffective=data.effective||null;
      gh.proxyLocked=data.locked===true; // server deployment: proxy fixed to direct
      if(state.view==='github'&&!gh.loading&&!gh.proxyBusy)render();
    }).catch(()=>{gh.proxyEffective=null;});
  }
  async function ghApplyProxy(){
    if(!supportsLocalGithubProxy()){
      gh.error='仅项目自带的 Node 本地服务支持代理设置，请运行 npm run dev 后访问 http://127.0.0.1:5173/。';
      render();return;
    }
    const mode=$('#ghProxyMode')?.value||'env';
    const host=$('#ghProxyHost')?.value?.trim()||'127.0.0.1';
    const port=Number($('#ghProxyPort')?.value||7890);
    gh.proxySettings={mode,host,port};gh.proxyExpanded=true;
    gh.proxyBusy=true;gh.loading=true;gh.error='';gh.health='';render();
    try{
      const response=await fetch('api/github/proxy',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode,host,port}),cache:'no-store'
      });
      const info=await response.json();
      if(!response.ok||!info.ok)throw new Error(info.message||'代理配置失败');
      gh.proxySettings={...gh.proxySettings,...info.settings};
      gh.proxyEffective=info.effective||null;
      gh.proxyLoaded=true;
      gh.loading=false;gh.proxyBusy=false;
      await ghTestNetwork();
    }catch(error){
      gh.error='代理设置失败：'+String(error.message||error);
      showToast(gh.error,{error:true});
    }finally{gh.loading=false;gh.proxyBusy=false;render();}
  }
  async function ghTestNetwork(){
    gh.loading=true;gh.error='';gh.health='';render();
    try{
      if(supportsLocalGithubProxy()){
        const response=await fetch('api/github/diagnose',{cache:'no-store'});
        if(response.headers.get('X-Vigil-Github-Proxy')==='1'){
          const info=await response.json();
          gh.proxyEffective=info.proxy||gh.proxyEffective;
          if(!info.ok)throw new Error(`${info.message||'无法访问 GitHub'}（${info.detail||info.code||'NETWORK'}；${info.proxy?.source||'DIRECT'}）。`);
          gh.health=`GitHub 示例仓库 JSON 已完整读取 · ${info.proxy?.source||'DIRECT'}${info.proxy?.endpoint?' · '+info.proxy.endpoint:''} · HTTP ${info.upstreamStatus}。若连接仍失败，请使用匿名公开示例验证具体请求阶段。`;
          showToast('GitHub 公共 API 网络测试成功');return;
        }
      }
      // Static deployments or a non-Vigil local server: public no-token probe.
      const trial=new GithubClient();trial.setConfig({owner:'octocat',repo:'Hello-World'});
      const meta=await trial.getRepository();
      gh.health=`GitHub 网络可访问（${trial.transportLabel}）· ${meta.full_name||'octocat/Hello-World'}`;
      showToast('GitHub 公共 API 可访问');
    }catch(err){
      gh.error=`网络诊断：${err.message}`;
      showToast(gh.error,{error:true});
    }finally{gh.loading=false;render();}
  }

  // Check the actual BROWSER fetch path, not only the Node CLI. This never
  // attaches credentials or reuses a private repository URL / prior PAT.
  async function ghBrowserCheck(){
    if(gh.browserBusy)return;
    gh.formDraft={
      repoUrl:$('#ghRepo')?.value||gh.formDraft?.repoUrl||'',
      branch:$('#ghBranch')?.value||gh.formDraft?.branch||'',
      folder:$('#ghFolder')?.value||gh.formDraft?.folder||''
    };
    gh.browserBusy=true;
    gh.browserCheck='正在从当前浏览器分别检查四个公开 GitHub 请求…';
    render();
    try{
      gh.browserCheck=(await checkGithubBrowserPaths()).text;
    }catch(error){
      gh.browserCheck=`浏览器检查无法完成：${String(error?.name||'NETWORK')}`;
    }finally{
      gh.browserBusy=false;
      if(state.view==='github')render();
    }
  }

  // GitHub browsing and editing. Repository config is stored; the token NEVER is.
  function ghError(err){
    gh.error=err?.message||'GitHub 请求失败';
    showToast(gh.error,{error:true});
  }
  async function ghConnect({publicDemo=false}={}){
    if(gh.connected && gh.editing && gh.dirty &&
       !await confirmDialog({title:'放弃尚未提交的修改？',description:'切换仓库连接会丢失当前编辑框内的改动。',confirmText:'继续连接',danger:true}))return;
    // Explicit public-demo mode is isolated from ALL existing repo inputs and PATs.
    const values=publicDemo?{
      repoUrl:'https://github.com/octocat/Hello-World',branch:'',folder:''
    }:{
      repoUrl:$('#ghRepo')?.value,branch:$('#ghBranch')?.value,folder:$('#ghFolder')?.value
    };
    let next;
    try{next=normalizeRepoConfig(values);}catch(err){ghError(err);render();return;}
    const anonymous=publicDemo||Boolean($('#ghAnonymous')?.checked);
    gh.anonymous=anonymous;
    gh.formDraft={...values};
    const inputToken=anonymous?'':($('#ghToken')?.value?.trim()||'');
    const priorConfig=gitClient.config,priorToken=gitClient.token;
    const priorReadMode=gitClient.anonymousConnectionMode,priorRelayWarning=gitClient.relayWarning;
    const changedRepo=gh.config&&(gh.config.owner!==next.owner||gh.config.repo!==next.repo);
    gitClient.setConfig(next);
    // A previous PAT is intentionally retained for editing, but an explicit
    // anonymous connection drops it rather than silently using stale auth.
    if(anonymous){
      gitClient.forgetToken();
      // User explicitly selected anonymous browsing. If the local relay fails,
      // a read-only browser GET may be attempted without exposing a PAT.
      gitClient.setAnonymousConnectionMode('auto');
    }else{
      gitClient.setAnonymousConnectionMode('relay');
      if(inputToken)gitClient.setToken(inputToken);
    }
    gh.loading=true;gh.error='';gh.health='';gh.connectionStage='metadata';
    gh.connectTrace='';gh.attributeWarning='';
    render();
    try{
      const {meta,files,attributes,attributesWarning}=await inspectGithubRepository(gitClient,{
        folder:next.folder,onStage:step=>{gh.connectionStage=step;}
      });
      if(changedRepo)gh.cryptoKey=null;
      gh.config=next;gh.connected=true;gh.hasToken=gitClient.canWrite;
      gh.defaultBranch=meta.default_branch||'main';
      gh.folder=next.folder;gh.files=files;gh.attributes=attributes;
      gh.attributeWarning=attributesWarning;
      gh.connectTrace='';gh.note=null;gh.editing=false;gh.dirty=false;
      gh.showSettings=false;gh.formDraft=null;
      gh.health=`已通过${gitClient.transportLabel}连接 · ${meta.full_name||next.owner+'/'+next.repo}${anonymous?' · 匿名访问':''}${gitClient.relayWarning?' · '+gitClient.relayWarning:''}`;
      try{storage.setItem(GITHUB_CONFIG_KEY,JSON.stringify(next));}catch{}
      state.entriesSource='github';state.readerSource='github';state.view='entries';
      showToast('仓库已连接，已添加到全部手记');
    }catch(err){
      gitClient.config=priorConfig;
      gitClient.setToken(priorToken);
      gitClient.anonymousConnectionMode=priorReadMode;
      gitClient.relayWarning=priorRelayWarning;
      gh.hasToken=gitClient.canWrite;
      gh.connectionStage=err.stage||gh.connectionStage;
      // Safe client-side trace: transport name, HTTP status / error code only.
      // Never includes repository URL, Authorization, file content or keys.
      // No URLs, tokens, or response bodies. This disambiguates a rejected
      // browser fetch from a successful response whose JSON stream failed.
      const traceStages={fetch:'发送请求', 'response-headers':'检查响应头',
        'response-body':'读取 JSON','response-check':'校验状态','response-verified':'完成验证'};
      gh.connectTrace=[`连接阶段：${gh.connectionStage||'未知'}`,
        ...gitClient.requestTrace.map(item=>`${item.route} · ${item.status?`HTTP ${item.status}`:
          `${traceStages[item.phase]||'未知环节'} · ${item.error||'NETWORK'}${item.hint?` · ${item.hint}`:''}`}`)]
        .join('\n');
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
    try{
      gh.note=await gitClient.readNote(path,{key:gh.cryptoKey});
      gh.editing=false;gh.draftContent=gh.note.content;gh.dirty=false;
      state.readerSource='github';state.entriesSource='github';state.view='reader';
    }catch(err){ghError(err);}
    finally{gh.loading=false;render();}
  }
  async function ghParent(){
    const root=gh.config?.folder||'';
    if(!gh.folder||gh.folder===root)return;
    const parent=gh.folder.split('/').slice(0,-1).join('/');
    if(root&&!(parent===root||parent.startsWith(root+'/')))return;
    await ghList(parent);
  }
  async function saveFromGithubView(){
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
    const startContent=`# ${githubNoteTitle(path)}\n\n`;
    gh.note={path,sha:null,content:startContent,encrypted,locked:false,htmlUrl:''};
    gh.draftContent=startContent;gh.editing=false;gh.dirty=false;gh.newFileMode=false;
    await startGithubEditor();
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
      gh.health=`已通过${gitClient.transportLabel}验证：${meta.full_name||gh.config.owner+'/'+gh.config.repo} · ${gh.config.branch||meta.default_branch||'默认分支'} · 当前目录 ${files.length} 项`;
      showToast(gh.health);
    }catch(err){gh.health='';ghError(err);}
    finally{gh.loading=false;render();}
  }
  async function ghDisconnect(){
    if(!await canLeave())return;
    gitClient.forgetToken();gh.cryptoKey=null;gh.attributes='';gh.hasToken=false;gh.connected=false;
    gh.note=null;gh.files=[];gh.error='';gh.health='';gh.formDraft=null;gh.editing=false;gh.dirty=false;gh.showSettings=false;
    render();
  }
  async function importKeyFile(file){
    await ghImportKeyFile(file);
  }
  async function processLocalFile(file){
    const mode=gitCryptLocalMode;gitCryptLocalMode='';await localGitCrypt(file,mode);
  }

  const actions={
    'github-connect':async button=>{await ghConnect();},
    'github-go-library':async button=>{
      if(!await canLeave())return;
      state.entriesSource='github';navigate('entries');
    },
    'github-refresh-note':async button=>{if(gh.note?.path)await ghOpen(gh.note.path);},
    'github-connect-public':async button=>{await ghConnect({publicDemo:true});},
    'github-test-network':async button=>{await ghTestNetwork();},
    'github-browser-check':async button=>{await ghBrowserCheck();},
    'github-proxy-apply':async button=>{await ghApplyProxy();},
    'github-proxy-clash':async button=>{
      const mode=$('#ghProxyMode'),host=$('#ghProxyHost'),port=$('#ghProxyPort');
      if(mode)mode.value='http';
      if(host)host.value='127.0.0.1';
      if(port)port.value='7897';
      await ghApplyProxy();
    },
    'github-key-import':button=>{$('#gitCryptKeyFile').click();},
    'github-check':async button=>{await ghCheck();},
    'gitcrypt-local-encrypt':button=>{gitCryptLocalMode='encrypt';$('#gitCryptLocalFile').click();},
    'gitcrypt-local-decrypt':button=>{gitCryptLocalMode='decrypt';$('#gitCryptLocalFile').click();},
    'github-key-lock':async button=>{await ghLockKey();},
    'github-disconnect':async button=>{await ghDisconnect();},
    'github-settings':button=>{gh.showSettings=!gh.showSettings;render();},
    'github-refresh':async button=>{await ghList(gh.folder);},
    'github-folder':async button=>{await ghList(button.dataset.path);},
    'github-note':async button=>{await ghOpen(button.dataset.path);},
    'github-parent':async button=>{await ghParent();},
    'github-edit':async button=>{await startGithubEditor();},
    'github-cancel-edit':async button=>{
      if(gh.dirty&&!await confirmDialog({title:'放弃修改？',description:'还没有提交到仓库。',confirmText:'放弃',danger:true}))return;
      gh.editing=false;gh.dirty=false;render();
    },
    'github-save':async button=>{await saveGithubEntry();},
    'github-new':button=>{gh.newFileMode=true;gh.newPath=gh.folder?gh.folder+'/':'';render();$('#ghNewPath')?.focus();},
    'github-new-cancel':button=>{gh.newFileMode=false;render();},
    'github-new-confirm':async button=>{await ghNewConfirm();}
  };

  return {actions,ensureGithubProxyStatus,saveGithubEntry,saveFromGithubView,importKeyFile,processLocalFile};
}
