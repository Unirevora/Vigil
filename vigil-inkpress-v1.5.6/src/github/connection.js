/**
 * Repository connection steps are observable and independently diagnosed.
 * A missing or unreadable .gitattributes must not hide a successful browse
 * connection; uploads still revalidate all git-crypt rules before writing.
 */
export const CONNECTION_STAGES=Object.freeze({
  metadata:'仓库信息',contents:'根目录与 Markdown 文件',attributes:'加密属性规则'
});

function labelStage(stage,error){
  const friendly=CONNECTION_STAGES[stage]||'仓库';
  const message=String(error?.message||'请求失败');
  const failure=new Error(`${friendly}阶段失败：${message}`);
  failure.stage=stage;
  failure.cause=error;
  return failure;
}

/** All 3 steps use the SAME client, same relay and same session credentials. */
export async function inspectGithubRepository(client,{folder='',onStage=()=>{}}={}){
  let stage='metadata';
  let meta,files;
  try{
    onStage(stage);
    meta=await client.getRepository();
    stage='contents';
    onStage(stage);
    files=await client.listFolder(folder);
  }catch(error){throw labelStage(stage,error);}
  let attributes='',attributesWarning='';
  stage='attributes';onStage(stage);
  try{attributes=await client.readAttributes();}
  catch(error){
    // For browsing, this is advisory. For writing, saveNote() always calls
    // getEncryptionRule() and refuses unsafe unverified git-crypt paths.
    attributesWarning=String(error?.message||'读取失败').slice(0,260);
  }
  onStage('done');
  return {meta,files,attributes,attributesWarning};
}
