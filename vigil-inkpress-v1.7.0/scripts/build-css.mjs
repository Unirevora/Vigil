/** Single-request CSS builder; preserves legacy cascade order exactly.
 * No external npm packages and no regex-based minification (unsafe for CSS).
 * Source remains editable in src/styles; `npm run dev` regenerates automatically.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
export async function buildCSS(){
  const {styles}=JSON.parse(await readFile(resolve(root,'scripts/style-order.json'),'utf8'));
  if(!Array.isArray(styles)||!styles.length)throw new Error('Missing stylesheet manifest');
  const contents=[];
  for(const name of styles){
    if(typeof name!=='string'||!/^\/(?:src\/styles\/|vendor\/codemirror\/)[\w\-.\/]+\.css$/.test(name)){
      throw new Error(`Unexpected stylesheet source: ${name}`);
    }
    const full=resolve(root,`.${name}`);
    if(!full.startsWith(root+sep))throw new Error(`Path escapes project: ${name}`);
    let css=await readFile(full,'utf8');
    // No source currently has relative url() references. Refuse new ones so
    // the bundle cannot silently change the source-relative URL semantics.
    for(const match of css.matchAll(/url\(\s*['"]?([^'"\)\s]+)['"]?\s*\)/g)){
      if(!match[1].startsWith('/')&&!match[1].startsWith('#')&&
        !match[1].startsWith('data:')&&!match[1].startsWith('https:')){
        throw new Error(`Relative asset path in ${name}: ${match[1]}`);
      }
    }
    contents.push(`/* ---- ${name} ---- */\n${css.trim()}\n`);
  }
  const output=`/* Generated automatically by npm run build:css. Edit modules, not this file. */\n`+contents.join('\n');
  const dest=resolve(root,'assets/vigil.css');
  await writeFile(dest,output,'utf8');
  return {file:dest,styles:styles.length,bytes:Buffer.byteLength(output)};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await buildCSS();
  console.log(`VIGIL stylesheet: ${result.styles} source modules → ${result.bytes} bytes in one request`);
}
