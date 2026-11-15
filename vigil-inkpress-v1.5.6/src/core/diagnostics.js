/** Local-only, non-sensitive environment report; never includes notes, tokens, URLs, keys or file contents. */
export const APP_VERSION='1.5.5';

export function collectDiagnostics(state,environment=globalThis){
  const storage=(()=>{
    let target;
    const probe='vigil-health-probe';
    try{
      target=environment.localStorage;
      target.setItem(probe,'ok');
      return target.getItem(probe)==='ok';
    }catch{return false;}
    finally{try{target?.removeItem(probe);}catch{}}
  })();
  return {
    version:APP_VERSION,
    localStorage:storage,
    indexedDB:typeof environment.indexedDB!=='undefined',
    webCrypto:Boolean(environment.crypto?.subtle),
    secureContext:environment.isSecureContext===true,
    markdownEditor:Boolean(environment.CodeMirror),
    katex:Boolean(state.katexAvailable),
    entries:state.entries?.length||0,
    drafts:state.drafts?.length||0,
    backups:state.backups?.length||0,
    storageProtected:Boolean(state.corruptStorage),
    githubConnected:Boolean(state.github?.connected)
  };
}

export function formatDiagnostics(report){
  // Short safe report that can be copied into an issue without leaking notes or private repo identity.
  const yes=value=>value?'可用':'不可用';
  return [
    `不眠手记 ${report.version} · 本地环境诊断`,
    `本地存储：${yes(report.localStorage)}`,
    `图片存储：${yes(report.indexedDB)}`,
    `安全环境：${yes(report.secureContext)}`,
    `浏览器加密：${yes(report.webCrypto)}`,
    `Markdown 编辑器：${yes(report.markdownEditor)}`,
    `KaTeX：${yes(report.katex)}`,
    `文库可写：${yes(!report.storageProtected)}`,
    `GitHub 工作区：${report.githubConnected?'当前已连接':'当前未连接'}`,
    `手记 ${report.entries} 篇 / 草稿 ${report.drafts} 份 / 备份 ${report.backups} 份`,
    '本报告不包含正文、仓库地址、口令、密钥或访问令牌。'
  ].join('\n');
}
