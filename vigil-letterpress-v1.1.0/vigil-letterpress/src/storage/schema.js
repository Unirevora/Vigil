import {isValidDate} from '../core/format.js';

// Application schema, NOT the unknown storage schema of the original Vigil project.
export const SCHEMA_VERSION=1;
export const DATA_KEY='vigil-mvp-data-v1';
export const PREVIOUS_PROTOTYPE_KEY='vigil-mvp-prototype-v1';
export const MAX_IMPORT_BYTES=8*1024*1024;
export const MAX_ENTRIES=10000;

export function normalizeEntry(e, index=0) {
  if (!e || typeof e!=='object' || Array.isArray(e) ||
    typeof e.id!=='string' || !e.id.trim() ||
    typeof e.title!=='string' || typeof e.content!=='string' ||
    !isValidDate(e.date)) {
    throw new Error(`第 ${index+1} 条手记的字段无效。`);
  }
  const timestamp = '1970-01-01T00:00:00.000Z';
  const legacy = e.legacy && typeof e.legacy==='object' && !Array.isArray(e.legacy)
    ? {legacy:e.legacy} : {};
  return {
    id:e.id,
    title:e.title.slice(0,200),
    content:e.content,
    date:e.date,
    createdAt:typeof e.createdAt==='string' ? e.createdAt : timestamp,
    updatedAt:typeof e.updatedAt==='string' ? e.updatedAt : timestamp,
    ...legacy,
    demo:!!e.demo
  };
}
export function validateDataset(obj) {
  if (!obj || typeof obj !== 'object' ||
    obj.schemaVersion!==SCHEMA_VERSION || !Array.isArray(obj.entries)) {
    throw new Error('仅支持本重构版或上一版网页原型的 Schema v1 JSON。');
  }
  if(obj.entries.length>MAX_ENTRIES) throw new Error(`单次最多 ${MAX_ENTRIES} 篇手记。`);
  const entries=obj.entries.map(normalizeEntry);
  const ids=new Set();
  for(const e of entries) {
    if(ids.has(e.id)) throw new Error('手记 ID 重复，已取消导入。');
    ids.add(e.id);
  }
  return entries;
}
export function makeDataset(entries) {
  return {schemaVersion:SCHEMA_VERSION,entries,exportedAt:new Date().toISOString()};
}
