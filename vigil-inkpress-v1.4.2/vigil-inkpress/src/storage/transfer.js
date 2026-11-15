import {makeDataset,validateDataset,MAX_IMPORT_BYTES} from './schema.js';

export function parseImportText(text) {
  if(typeof text!=='string') throw new Error('文件内容必须是文本。');
  if(new Blob([text]).size>MAX_IMPORT_BYTES) throw new Error('导入 JSON 文件不能超过 8 MB。');
  let decoded;
  try { decoded=JSON.parse(text); }
  catch { throw new Error('JSON 文件格式无效。'); }
  return validateDataset(decoded);
}
export async function readImportFile(file) {
  if(!file) throw new Error('未选择文件。');
  if(file.size>MAX_IMPORT_BYTES) throw new Error('导入文件不能超过 8 MB。');
  return parseImportText(await file.text());
}
export function exportJson(entries) {
  return JSON.stringify(makeDataset(entries),null,2);
}
export function downloadJson(entries,name='vigil-notes') {
  const blob=new Blob([exportJson(entries)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`${name}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
