/** Read-only, approximate localStorage footprint in UTF-16 bytes.
 * Does NOT inspect or disclose stored note contents. Custom photos are in IDB.
 * This module has no side effects, and tolerates sandboxed/disabled storage. */
export function storageFootprint(storage,prefix='vigil-'){
  let bytes=0,count=0;
  try{
    if(!storage||typeof storage.length!=='number'||typeof storage.key!=='function')
      return {available:false,bytes:0,count:0};
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(typeof key!=='string'||!key.startsWith(prefix))continue;
      const value=storage.getItem(key);
      bytes+=(key.length+(value?.length||0))*2;
      count++;
    }
    return {available:true,bytes,count};
  }catch{return {available:false,bytes:0,count:0};}
}
export function formatFootprint(bytes){
  if(!Number.isFinite(bytes)||bytes<0)return '不可用';
  return bytes<1024?`${Math.ceil(bytes)} B`:
    bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:
    `${(bytes/1048576).toFixed(2)} MB`;
}
