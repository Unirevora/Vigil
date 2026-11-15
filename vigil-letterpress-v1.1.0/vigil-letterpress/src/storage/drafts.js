import {isValidDate} from '../core/format.js';

/** Drafts are isolated from published entries; they never overwrite a committed entry. */
export const DRAFT_KEY = 'vigil-mvp-drafts-v1';
export const NEW_DRAFT_ID = '__new__';
export const MAX_DRAFTS = 40;

export function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      typeof raw.key !== 'string' || raw.key.length > 255 || !raw.key ||
      typeof raw.title !== 'string' ||
      typeof raw.content !== 'string' ||
      !isValidDate(raw.date)) {
    throw new Error('草稿数据结构无效。');
  }
  return {
    key:raw.key,
    title:raw.title.slice(0,200),
    content:raw.content,
    date:raw.date,
    baseUpdatedAt:typeof raw.baseUpdatedAt === 'string' ? raw.baseUpdatedAt : '',
    updatedAt:typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  };
}
export class DraftRepository {
  constructor(storage=globalThis.localStorage) {
    this.storage=storage;
  }
  list() {
    const raw=this.storage.getItem(DRAFT_KEY);
    if(raw===null)return [];
    let data;
    try { data=JSON.parse(raw); }
    catch {throw new Error('草稿存储无法解析，已阻止覆盖。');}
    if(!data || data.schemaVersion!==1 || !Array.isArray(data.drafts) ||
       data.drafts.length>MAX_DRAFTS) {
      throw new Error('草稿存储格式异常，已阻止覆盖。');
    }
    const drafts=data.drafts.map(normalizeDraft);
    if(new Set(drafts.map(d=>d.key)).size!==drafts.length) {
      throw new Error('草稿键重复，已阻止覆盖。');
    }
    return drafts;
  }
  get(key){return this.list().find(d=>d.key===key)??null;}
  write(drafts){
    this.storage.setItem(DRAFT_KEY,JSON.stringify({schemaVersion:1,drafts}));
  }
  save(key,draft,baseUpdatedAt=''){
    const snapshot=normalizeDraft({
      key,
      title:draft.title,
      content:draft.content,
      date:draft.date,
      baseUpdatedAt,
      updatedAt:new Date().toISOString()
    });
    const drafts=this.list().filter(d=>d.key!==key);
    if(drafts.length>=MAX_DRAFTS) {
      throw new Error(`草稿已达到 ${MAX_DRAFTS} 份上限。请先整理旧草稿，系统不会自动删除。`);
    }
    this.write([...drafts,snapshot]);
    return snapshot;
  }
  remove(key){
    const previous=this.list();
    const drafts=previous.filter(d=>d.key!==key);
    if(drafts.length!==previous.length)this.write(drafts);
  }
  clear(){this.list();this.write([]);}
}
