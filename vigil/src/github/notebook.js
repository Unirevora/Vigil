import {normalizePath,isMarkdownPath} from './api.js';

/** The GitHub workspace remains a remote, independent notebook: it is never
 * silently merged into the local JSON schema, drafts use namespaced keys. */
export function githubNoteTitle(path){
  const file=String(path).split('/').at(-1)||'未命名手记';
  return file.replace(/\.(?:md|markdown|mdown)$/i,'')||file;
}
export function githubDraftKey(config,path){
  const clean=normalizePath(path);
  if(!isMarkdownPath(clean))throw new Error('仓库手记必须是 Markdown 文件');
  const scope=`${config.owner}/${config.repo}/${config.branch||'HEAD'}/${clean}`;
  // Deterministic 128-bit key, no repository path or token stored in the key.
  let a=0xcbf29ce484222325n,b=0x84222325cbf29cen;
  for(const char of new TextEncoder().encode(scope)){
    a=((a^BigInt(char))*0x100000001b3n)&0xffffffffffffffffn;
    b=((b^BigInt(char))*0x100000001b3n)&0xffffffffffffffffn;
  }
  return `github:${a.toString(16).padStart(16,'0')}${b.toString(16).padStart(16,'0')}`;
}
export function githubEntriesScope(config,folder){
  const root=normalizePath(config?.folder||'');
  const current=normalizePath(folder||root);
  if(root&&current!==root&&!current.startsWith(root+'/'))throw new Error('目录已超出所选笔记范围');
  return {root,current,canGoBack:current!==root};
}
export function githubDraftSnapshot(note){
  return {title:githubNoteTitle(note.path),date:new Date().toISOString().slice(0,10),
    content:note.content,tags:[],mood:''};
}
