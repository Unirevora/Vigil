import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');

/** Style modules in cascade order, as listed in scripts/style-order.json. */
export function styleModules(){
  return JSON.parse(read('scripts/style-order.json')).styles;
}

/** All authored CSS (feature modules + vendor CodeMirror) concatenated in cascade order. */
export function readStyles(){
  return styleModules().map(path=>read(path.replace(/^\//,''))).join('\n');
}

/** One feature module, e.g. readStyle('tabs'). */
export function readStyle(name){
  return read(`src/styles/${name}.css`);
}
