import {makeDataset,validateDataset} from './schema.js';

export const BACKUP_KEY='vigil-mvp-backups-v1';
export const BACKUP_LIMIT=5;

function makeId(){
  return globalThis.crypto?.randomUUID?.() ||
    `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class BackupRepository {
  constructor(storage=globalThis.localStorage){
    this.storage=storage;
  }
  list() {
    const raw=this.storage.getItem(BACKUP_KEY);
    if(raw===null)return [];
    let payload;
    try{payload=JSON.parse(raw);}
    catch{throw new Error('本地备份记录无法解析，禁止覆盖。');}
    if(!payload || payload.schemaVersion!==1 || !Array.isArray(payload.backups) ||
        payload.backups.length>BACKUP_LIMIT) {
      throw new Error('本地备份数据结构异常，禁止覆盖。');
    }
    const ids=new Set();
    return payload.backups.map((backup,i)=>{
      if(!backup || typeof backup.id!=='string' ||
         typeof backup.createdAt!=='string' ||
         typeof backup.reason!=='string' || typeof backup.label!=='string' ||
         ids.has(backup.id)) {
        throw new Error(`第 ${i+1} 份备份元信息异常。`);
      }
      ids.add(backup.id);
      return {
        id:backup.id,
        createdAt:backup.createdAt,
        reason:backup.reason,
        label:backup.label,
        entries:validateDataset(makeDataset(backup.entries))
      };
    }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  write(backups) {
    if(backups.length>BACKUP_LIMIT)throw new Error('备份数量超出上限。');
    this.storage.setItem(BACKUP_KEY,JSON.stringify({schemaVersion:1,backups}));
  }
  create(entries,reason='manual',label='手动备份') {
    const snapshot={
      id:makeId(),
      createdAt:new Date().toISOString(),
      reason,label,
      entries:validateDataset(makeDataset(entries))
    };
    const backups=this.list();
    // Exact duplicate snapshots have the same safety value. Avoid consuming a
    // limited localStorage quota and displacing meaningful historical states.
    // Keys and on-disk format remain v1 for zero-migration compatibility.
    const previous=backups[0];
    if(previous&&JSON.stringify(previous.entries)===JSON.stringify(snapshot.entries)){
      return previous;
    }
    this.write([snapshot,...backups].slice(0,BACKUP_LIMIT));
    return snapshot;
  }
  get(id){return this.list().find(b=>b.id===id)??null;}
  remove(id) {
    const current=this.list();
    const rest=current.filter(b=>b.id!==id);
    if(rest.length===current.length)return false;
    this.write(rest);
    return true;
  }
  clear(){this.list();this.write([]);}
}
