/** Custom photos use IndexedDB Blob storage; never occupy journal localStorage. */
const DB='vigil-appearance-image-v142',STORE='images';
const LIMIT=12*1024*1024;
function openDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB'in window))return reject(new Error('当前浏览器不支持图片存储'));
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('无法打开图片存储'));
  });
}
async function operate(mode,key,value){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),os=tx.objectStore(STORE);
    const req=mode==='readonly'?os.get(key):value===null?os.delete(key):os.put(value,key);
    let result;
    req.onsuccess=()=>{result=req.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=()=>{db.close();reject(tx.error||new Error('无法保存图片'));};
    tx.onabort=()=>{db.close();reject(tx.error||new Error('图片保存被取消'));};
  });
}
export const getStoredImage=key=>operate('readonly',key);
export const setStoredImage=(key,blob)=>operate('readwrite',key,blob);
export const deleteStoredImage=key=>operate('readwrite',key,null);
export async function preparePhoto(file){
  if(!file||!/^image\/(png|jpeg|webp|gif)$/i.test(file.type))throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片');
  if(file.size>LIMIT)throw new Error('图片原文件请勿超过 12MB');
  const bitmap=await createImageBitmap(file);
  try{
    const factor=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('无法处理图片');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.79));
    if(!blob)throw new Error('图片压缩失败');
    if(blob.size>3*1024*1024)throw new Error('压缩后图片超过 3MB，请选择尺寸更小的图片');
    return blob;
  }finally{bitmap.close();}
}
export function createVisualAssets(){
  let backgroundURL=null,heroURL=null;
  const release=(url)=>{if(url)URL.revokeObjectURL(url);};
  const set=async(key,blob)=>{
    if(blob)await setStoredImage(key,blob);
    else await deleteStoredImage(key);
    await reload();
  };
  const reload=async()=>{
    const [background,hero]=await Promise.all([getStoredImage('background'),getStoredImage('hero')]);
    release(backgroundURL);release(heroURL);
    backgroundURL=background?URL.createObjectURL(background):null;
    heroURL=hero?URL.createObjectURL(hero):null;
    return {backgroundURL,heroURL};
  };
  const urls=()=>({backgroundURL,heroURL});
  return {set,reload,urls,destroy:()=>{release(backgroundURL);release(heroURL);}};
}
