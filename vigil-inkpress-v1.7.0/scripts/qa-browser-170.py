"""Local, no-network Chromium end-to-end regression for v1.7.0.
The public GitHub API is represented by a deterministic fake Response. Never
uses a real Token or network connection. This script is for QA only.
"""
from __future__ import annotations
import asyncio, json, re, posixpath, base64
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parent.parent
VENDOR=['vendor/codemirror/codemirror.js','vendor/codemirror/markdown.js','vendor/codemirror/continuelist.js']
PKG=['src/main.js']
module_sources={}
pattern=re.compile(r'''\bfrom\s*['"](\.{1,2}/[^'"]+)['"]''')

def resolve(source:str,dep:str)->str:
    if not dep.startswith('.'):
        raise ValueError(f'Unrecognized dependency {source} -> {dep}')
    return posixpath.normpath(posixpath.join(posixpath.dirname(source),dep))

def collect(module:str):
    if module in module_sources:return
    source=(ROOT/module).read_text(encoding='utf-8')
    for dep in pattern.findall(source):collect(resolve(module,dep))
    module_sources[module]=source
collect('src/main.js')

HTML=(ROOT/'index.html').read_text(encoding='utf-8')
HTML=re.sub(r'<link[^>]*href="/assets/vigil\.css"[^>]*>','',HTML)
HTML=re.sub(r'<script\s+src="/vendor/[^>]+>\s*</script>','',HTML)
HTML=re.sub(r'<script type="module" src="/src/main\.js"></script>','',HTML)
CSS=(ROOT/'assets/vigil.css').read_text(encoding='utf-8')
HTML=HTML.replace('</head>','<style>'+CSS+'</style></head>')
HTML=HTML.replace('src="/assets/vigil-mark.svg"',
 'src="data:image/svg+xml;base64,'+base64.b64encode((ROOT/'assets/vigil-mark.svg').read_bytes()).decode()+'"')

FAKE_FETCH=r'''(function(){
  const original=globalThis.fetch;
  const encoded=new TextEncoder();
  const base64=text=>btoa(String.fromCharCode(...encoded.encode(text)));
  window.__qa={calls:[],put:null,newPut:null,failWrite:false,content:'# 薄暮札记\n\n#### 四级标题\n\n> [!tip]+ 关照细节\n> 记录自己。\n\n<span class="font-kai" style="font-family: KaiTi">楷体字</span>', sha:'old_sha'};
  globalThis.fetch=async function(url,opts={}){
    const text=String(url),call={url:text,method:opts.method||'GET',hasAuth:Boolean(opts.headers?.Authorization)};
    window.__qa.calls.push(call);
    const path=new URL(text,'https://api.github.com').pathname;
    const response=(body,status=200)=>new Response(JSON.stringify(body),{
      status,headers:{'Content-Type':'application/json','X-Vigil-Github-Proxy':'1'}});
    if(path==='/repos/demo/journal')return response({full_name:'demo/journal',default_branch:'main'});
    if(path==='/repos/demo/journal/contents/.gitattributes')return response({message:'Not Found'},404);
    if(path==='/repos/demo/journal/contents/notes')return response([
      {type:'file',name:'薄暮.md',path:'notes/薄暮.md',size:encoded.encode(window.__qa.content).length,sha:window.__qa.sha},
      {type:'dir',name:'按月',path:'notes/按月'}]);
    if(path==='/repos/demo/journal/contents/notes/%E8%96%84%E6%9A%AE.md'){
      if(opts.method==='PUT'){
        if(window.__qa.failWrite)return response({message:'File changed remotely'},409);
        window.__qa.put=JSON.parse(opts.body);
        window.__qa.content=new TextDecoder().decode(Uint8Array.from(atob(window.__qa.put.content),c=>c.charCodeAt(0)));
        window.__qa.sha='next_sha';
        return response({content:{sha:'next_sha',html_url:'https://github.com/demo/journal/blob/main/notes/x.md'},commit:{sha:'commit'}});
      }
      return response({type:'file',path:'notes/薄暮.md',sha:window.__qa.sha,encoding:'base64',content:base64(window.__qa.content)});
    }
    if(path==='/repos/demo/journal/contents/notes/%E6%96%B0%E6%89%8B%E8%AE%B0.md'&&opts.method==='PUT'){
      window.__qa.newPut=JSON.parse(opts.body);
      return response({content:{sha:'created_sha'},commit:{sha:'created_commit'}});
    }
    if(path==='/repos/demo/journal/contents/notes/%E6%8C%89%E6%9C%88')return response([]);
    return response({message:'Not found: '+path},404);
  };
  const saved={};
  Object.defineProperty(window,'localStorage',{configurable:true,value:{
    get length(){return Object.keys(saved).length},
    key(i){return Object.keys(saved)[i]??null},
    getItem(k){return Object.hasOwn(saved,k)?saved[k]:null},
    setItem(k,v){saved[k]=String(v)},removeItem(k){delete saved[k]}
  }});
})();'''

async def build_page(page):
    await page.set_content(HTML,wait_until='load')
    await page.evaluate(FAKE_FETCH)
    for p in VENDOR:
        await page.add_script_tag(content=(ROOT/p).read_text(encoding='utf-8'))
    payload=[{'name':name,'source':source} for name,source in module_sources.items()]
    await page.evaluate('''async (modules) => {
      const urls={};
      for(const item of modules){
        let code=item.source.replace(/(from\\s+['"])([^'"\\s]+)(['"])/g,(whole,before,dep,after)=>{
          const rel=dep.split('/');const base=item.name.split('/');base.pop();
          for(const part of rel){if(part==='..')base.pop();else if(part!=='.')base.push(part)}
          const target=base.join('/');
          if(!urls[target])throw new Error('Missing blob module '+target+' from '+item.name);
          return before+urls[target]+after;
        });
        urls[item.name]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      }
      await import(urls['src/main.js']);
    }''',payload)
    await page.wait_for_timeout(300)

async def run():
    results=[]
    async with async_playwright() as p:
      browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
      for width in [1440,390]:
        page=await browser.new_page(viewport={'width':width,'height':950},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        await build_page(page)
        results.append((width,'App loaded',await page.locator('.heritage-hero').count()==1))
        # Navigation on narrow screens collapses after actions. Settings tab remains separate.
        if width<=900:
          await page.locator('#sidebarToggle').click()
          await page.wait_for_timeout(150)
        await page.locator('[data-nav="entries"]').click()
        results.append((width,'Two notebook sources',await page.locator('.notebook-tab').count()==2))
        await page.locator('[data-action="entries-source"][data-source="github"]').click()
        results.append((width,'Remote connection CTA',await page.locator('.notebook-unlinked').count()==1))
        # settings: select repo and optionally PAT (memory only)
        await page.locator('.notebook-unlinked [data-to="github"]').click()
        await page.locator('#ghRepo').fill('https://github.com/demo/journal')
        await page.locator('#ghFolder').fill('notes')
        await page.locator('#ghToken').fill('test-only-fine-grained')
        await page.locator('[data-action="github-connect"]').click()
        await page.wait_for_timeout(350)
        results.append((width,'Connected returns to all notes',await page.locator('.github-notebook-grid .github-note-card').count()==1))
        results.append((width,'GitHub folder shown',await page.locator('.notebook-folder').count()==1))
        if width==1440:await page.screenshot(path='/mnt/data/vigil-170-remote-list.png',full_page=True)
        await page.locator('[data-action="github-note"]').click()
        await page.wait_for_timeout(300)
        results.append((width,'Shared reader: callout and H4',await page.locator('.reading-paper .vigil-callout').count()==1 and await page.locator('.reading-paper h4').count()==1))
        if width==1440:await page.screenshot(path='/mnt/data/vigil-170-remote-reader.png',full_page=True)
        await page.locator('[data-action="github-edit-full"]').click()
        await page.wait_for_timeout(300)
        results.append((width,'Shared 3-mode editor',await page.locator('.editor-mode-option').count()==3 and await page.locator('.github-editor-origin').count()==1))
        # Change source via CM directly so no keyboard event race across modes.
        await page.evaluate("document.querySelector('.CodeMirror').CodeMirror.setValue('# 新内容\\n\\n#### 四级章节\\n\\n> [!note] 持续记录\\n> 今天很好。')")
        await page.locator('[data-action="editor-mode"][data-mode="reading"]').click()
        await page.wait_for_timeout(220)
        results.append((width,'Embedded reading Callout',await page.locator('#unifiedReader .vigil-callout').count()==1))
        await page.locator('[data-action="save"]').click()
        await page.wait_for_timeout(420)
        commit=await page.evaluate('window.__qa.put')
        results.append((width,'SHA commit and remote content',bool(commit and commit.get('sha')=='old_sha' and await page.locator('.reading-paper .article-content h1').count()==1)))
        if width==390:
          # A new repository markdown is created with NO stale SHA and can
          # be composed in the same three-mode editor.
          await page.locator('[data-action="github-go-library"]').click()
          await page.locator('[data-action="github-new"]').click()
          await page.locator('#ghNewPath').fill('notes/新手记.md')
          await page.locator('[data-action="github-new-confirm"]').click()
          await page.wait_for_timeout(180)
          results.append((width,'Remote new note opens shared editor',await page.locator('.CodeMirror').count()==1))
          await page.evaluate("(text)=>document.querySelector('.CodeMirror').CodeMirror.setValue(text)", '# 新手记\n\n新的一页。')
          await page.locator('[data-action="save"]').click()
          await page.wait_for_timeout(300)
          result=await page.evaluate('window.__qa.newPut')
          results.append((width,'New note PUT has no stale SHA',bool(result and 'sha' not in result and await page.locator('.github-reading-paper').count()==1)))
        if width==1440:
          # GitHub conflict should never erase current editor or its offline draft.
          await page.locator('[data-action="github-edit-full"]').click()
          await page.evaluate("document.querySelector('.CodeMirror').CodeMirror.setValue('# 仍未提交的改动')")
          await page.evaluate('window.__qa.failWrite=true')
          await page.locator('[data-action="save"]').click()
          await page.wait_for_timeout(500)
          kept=await page.evaluate('''() => {
            const raw=localStorage.getItem('vigil-mvp-drafts-v1');
            const rows=raw?JSON.parse(raw).drafts:[];
            return rows.some(d=>d.key.startsWith('github:')&&d.content.includes('仍未提交的改动'));
          }''')
          results.append((width,'SHA conflict retains offline GitHub draft',bool(kept and await page.locator('.CodeMirror').count()==1)))
          await page.screenshot(path='/mnt/data/vigil-170-remote-unsaved.png',full_page=True)
        results.append((width,'No horizontal overflow',await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')))
        results.append((width,'No runtime JS errors',not errors))
        if errors:print('JS errors:',width,errors[:3])
        if width==1440:await page.screenshot(path='/mnt/data/vigil-170-remote-saved.png',full_page=True)
        else:await page.screenshot(path='/mnt/data/vigil-170-mobile-remote.png',full_page=True)
        await page.close()
      await browser.close()
    for width,case,passed in results:print(('PASS' if passed else 'FAIL'),width,case)
    print('RESULT:',sum(passed for _,_,passed in results),'/',len(results))
    return all(passed for _,_,passed in results)

if __name__=='__main__':
    if not asyncio.run(run()):raise SystemExit(1)
