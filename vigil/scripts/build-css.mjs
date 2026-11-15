/** Single-request CSS builder; preserves legacy cascade order exactly.
 * No external npm packages and no regex-based minification (unsafe for CSS).
 * Source remains editable in src/styles; `npm run dev` regenerates automatically.
 *
 * Source modules write asset URLs project-root-relative (`/assets/x.webp`,
 * `/fonts/x.ttf`). The bundle rewrites them relative to assets/vigil.css
 * (`x.webp`, `../fonts/x.ttf`) so the app also works under a sub-path such as
 * https://host/vigil/, and refuses references to files that do not exist.
 */
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,sep,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const BUNDLE_DIR='/assets';
const OPTIONAL_ASSETS=/^\/fonts\/[^/]+\.(?:ttf|otf|woff2?)$/; // user-supplied fonts (see fonts/README.md)
export function bundleRelativeUrl(url){
  if(!url.startsWith('/')||url.startsWith('//'))return url;
  return posix.relative(BUNDLE_DIR,url);
}
async function rewriteUrls(css,name,missing){
  const out=[];let last=0;
  for(const match of css.matchAll(/url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/g)){
    const url=match[2];
    if(!url.startsWith('/')||url.startsWith('//'))continue;
    const file=resolve(root,`.${url.split(/[?#]/)[0]}`);
    if(!file.startsWith(root+sep))throw new Error(`Asset path escapes project in ${name}: ${url}`);
    const exists=await stat(file).then(s=>s.isFile(),()=>false);
    if(!exists){
      if(!OPTIONAL_ASSETS.test(url))throw new Error(`Missing asset in ${name}: ${url}`);
      missing.add(url);
    }
    out.push(css.slice(last,match.index),`url(${match[1]}${bundleRelativeUrl(url)}${match[1]})`);
    last=match.index+match[0].length;
  }
  out.push(css.slice(last));
  return out.join('');
}
export async function buildCSS(){
  const {styles}=JSON.parse(await readFile(resolve(root,'scripts/style-order.json'),'utf8'));
  if(!Array.isArray(styles)||!styles.length)throw new Error('Missing stylesheet manifest');
  const contents=[];
  const missing=new Set();
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
    css=await rewriteUrls(css,name,missing);
    contents.push(`/* ---- ${name} ---- */\n${css.trim()}\n`);
  }
  const output=`/* Generated automatically by npm run build:css. Edit modules, not this file. */\n`+contents.join('\n');
  const dest=resolve(root,'assets/vigil.css');
  await writeFile(dest,output,'utf8');
  return {file:dest,styles:styles.length,bytes:Buffer.byteLength(output),missingOptional:[...missing]};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await buildCSS();
  console.log(`VIGIL stylesheet: ${result.styles} source modules → ${result.bytes} bytes in one request`);
  for(const url of result.missingOptional)console.warn(`  note: optional ${url} not present; system fonts will be used`);
}
