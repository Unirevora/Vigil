import {escapeHtml} from './format.js';

/** A deliberately small, non-executable subset of Obsidian inline HTML.
 * No event handlers, URL-bearing attributes, script, embeds, or user CSS files.
 * Only typography and semantic inline wrappers are allowed.
 */
const INLINE_TAGS=new Set(['span','u','s','small','mark']);
const BLOCK_TAGS=new Set(['div']);
const CUSTOM_CLASS=/^[\p{L}\p{N}_-]{1,48}$/u;
const FONT_FAMILY=/^[\p{L}\p{N}\s,'"._-]{1,110}$/u;
const FONT_WEIGHT=/^(?:normal|bold|lighter|bolder|[1-9]00)$/i;
const CSS_COLOR=/^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;

export function sanitizeTypographyStyle(source){
  const parts=[];
  for(const chunk of String(source).split(';')){
    const index=chunk.indexOf(':');
    if(index<1)continue;
    const property=chunk.slice(0,index).trim().toLowerCase();
    const raw=chunk.slice(index+1).trim();
    let allowed=false;
    if(property==='font-family')allowed=FONT_FAMILY.test(raw)&&!/\b(?:javascript|expression|import|behavior|url)\b/i.test(raw);
    else if(property==='font-size')allowed=/^(?:[89]|[1-6]\d|7[0-2])px$|^(?:0\.[7-9]|[1-2](?:\.\d{1,2})?|3)em$|^(?:0\.[7-9]|[1-2](?:\.\d{1,2})?|3)rem$/i.test(raw);
    else if(property==='font-weight')allowed=FONT_WEIGHT.test(raw);
    else if(property==='font-style')allowed=/^(normal|italic|oblique)$/i.test(raw);
    else if(property==='text-decoration')allowed=/^(underline|line-through|none)$/i.test(raw);
    else if(property==='color')allowed=CSS_COLOR.test(raw)&&!/expression|url|var\(/i.test(raw);
    else if(property==='letter-spacing')allowed=/^-?(?:\d|10)(?:\.\d{1,2})?px$/.test(raw);
    else if(property==='line-height')allowed=/^(?:1(?:\.\d{1,2})?|2(?:\.\d{1,2})?)$/.test(raw);
    else if(property==='text-align')allowed=/^(left|center|right|justify)$/.test(raw);
    if(allowed)parts.push(`${property}: ${raw}`);
  }
  return parts.join('; ');
}
export function sanitizeStyledTag(tag,{allowBlock=false}={}){
  const match=String(tag).match(/^<(\/)?([a-z]+)([^<>]*)>$/i);
  if(!match)return null;
  const name=match[2].toLowerCase();
  if(!INLINE_TAGS.has(name)&&!(allowBlock&&BLOCK_TAGS.has(name)))return null;
  if(match[1])return match[3].trim()?null:`</${name}>`;
  const attrs=match[3];
  if(/\/\s*$/.test(attrs))return null;
  const accepted=[];
  const re=/\s+([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let cursor=0;
  for(const entry of attrs.matchAll(re)){
    if(attrs.slice(cursor,entry.index).trim())return null;
    cursor=entry.index+entry[0].length;
    const key=entry[1].toLowerCase(),value=entry[2]??entry[3]??'';
    if(key==='class'){
      const names=value.trim().split(/\s+/).filter(Boolean);
      if(names.length&&names.length<=8&&names.every(s=>CUSTOM_CLASS.test(s)))
        accepted.push(`class="${escapeHtml(names.join(' '))}"`);
    }else if(key==='style'){
      const safe=sanitizeTypographyStyle(value);
      if(safe)accepted.push(`style="${escapeHtml(safe)}"`);
    }
    // Unknown attributes are stripped, never passed through.
  }
  if(attrs.slice(cursor).trim())return null;
  return `<${name}${accepted.length?' '+accepted.join(' '):''}>`;
}

/** Convert a fragment to escaped text plus validated inline HTML. */
export function renderSafeStyledInline(source,plainText){
  return String(source).split(/(<\/?(?:span|u|s|small|mark)\b[^<>]*>)/gi).map(segment=>{
    const tag=sanitizeStyledTag(segment);
    return tag??plainText(segment);
  }).join('');
}

export function renderSafeDivBlock(source){
  const match=String(source).match(/^\s*(<div\b[^<>]*>)([\s\S]*?)(<\/div>)\s*$/i);
  if(!match)return null;
  const opener=sanitizeStyledTag(match[1],{allowBlock:true});
  if(!opener)return null;
  // HTML blocks intentionally preserve literal Markdown characters.
  const interior=renderSafeStyledInline(match[2],escapeHtml);
  return `${opener}${interior}</div>`;
}
