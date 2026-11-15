"""Optional Chromium smoke test. Requires `pip install playwright` and chromium.
Runs against localhost; does not access a GitHub account or private user files.
"""
from pathlib import Path
from urllib.parse import urlparse,unquote
import os,subprocess,time,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
import importlib.util
spec=importlib.util.spec_from_file_location('vigil_fixture_builder',ROOT/'scripts/make-inline-qa.py')
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
FIXTURE=builder.fixture()[0]
PORT=os.getenv('QA_PORT','5191')
PREVIEW=ROOT/'docs'
PREVIEW.mkdir(exist_ok=True)
server=None
CONTENT_TYPES={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.json':'application/json',
 '.ttf':'font/ttf','.woff':'font/woff'}
def serve_static(route):
    relative=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
    file=(ROOT/relative).resolve()
    if not file.is_relative_to(ROOT) or not file.is_file():
        route.fulfill(status=404,body='Not Found');return
    route.fulfill(status=200,content_type=CONTENT_TYPES.get(file.suffix,'application/octet-stream'),body=file.read_bytes())
checks=[]
def record(name,condition):
    checks.append((name,bool(condition)))
    print(('PASS ' if condition else 'FAIL ')+name,flush=True)
try:
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        desktop=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
        errors=[]
        desktop.on('pageerror',lambda e:errors.append(str(e)))
        desktop.set_content(FIXTURE,wait_until='load')
        desktop.locator('[data-action="new"]').first.click()
        desktop.locator('.CodeMirror').wait_for()
        content='# 写一篇手记\n\n今天的 **重要决定** 与 *心情*，还有公式 $x^2+y^2=z^2$。\n\n\n\n第一段\n第二行\n\n\n\n最后一段\n\n$$\n\\frac{1}{2}=0.5\n$$\n\n- [ ] 留下记录'
        desktop.evaluate('''value=>{
          const cm=document.querySelector('.CodeMirror').CodeMirror;
          cm.setValue(value);cm.setCursor({line:2,ch:15});cm.focus();
        }''',content)
        desktop.wait_for_timeout(600)
        record('Markdown remains in CodeMirror source',desktop.evaluate("document.querySelector('.CodeMirror').CodeMirror.getValue()")==content)
        record('Active-line **strong** is styled',desktop.locator('.CodeMirror .cm-live-bold').count()>0)
        record('Active-line syntax tokens remain visible',desktop.locator('.CodeMirror .cm-live-syntax').count()>0)
        record('Active inline KaTeX preview exists',desktop.locator('.CodeMirror .cm-math-active-inline').count()>0)
        record('KaTeX outputs MathML',desktop.locator('.CodeMirror .cm-math-active-inline math').count()>0)
        record('Editing heading still displays typography', desktop.locator('.CodeMirror .cm-live-heading').count()>0)
        # Preserve scope while toggling (we are not retouching textarea nodes).
        desktop.screenshot(path=str(PREVIEW/'preview-151-live.png'),full_page=True)
        desktop.locator('[data-action="editor-mode"][data-mode="reading"]').click()
        record('Reading pane visible',desktop.locator('#unifiedReader').is_visible())
        record('CodeMirror host takes no space in reading mode',
          desktop.evaluate("getComputedStyle(document.querySelector('#unifiedEditorHost')).display==='none'"))
        record('Reading begins immediately under mode toolbar',desktop.evaluate("(()=>{const a=document.querySelector('#unifiedReader').getBoundingClientRect().top; const b=document.querySelector('.unified-pane-label').getBoundingClientRect().bottom;return a-b<15})()"))
        record('Reading no line-break per ordinary newline',desktop.locator('#unifiedReader br').count()==0)
        record('Reading contains three paragraphs + equation + task',desktop.locator('#unifiedReader > p').count()==3)
        record('Reading has no empty paragraph',desktop.evaluate("![...document.querySelectorAll('#unifiedReader p')].some(p=>p.textContent.trim()==='')"))
        reader_height=desktop.locator('#unifiedReader').evaluate('(e)=>e.scrollHeight')
        record('Reading height not absurdly inflated',reader_height<1400)
        desktop.screenshot(path=str(PREVIEW/'preview-151-reading.png'),full_page=True)
        desktop.locator('[data-action="editor-mode"][data-mode="source"]').click()
        record('Reading to source keeps exact Markdown',desktop.evaluate('document.querySelector(".CodeMirror").CodeMirror.getValue()')==content)
        desktop.evaluate('''()=>{
          const cm=document.querySelector('.CodeMirror').CodeMirror;
          cm.replaceRange('追加一行',{line:0,ch:0});cm.undo();
        }''')
        record('Undo works after mode switches',desktop.evaluate('document.querySelector(".CodeMirror").CodeMirror.getValue()')==content)
        desktop.locator('[data-action="editor-mode"][data-mode="live"]').click()
        desktop.evaluate('''()=>{const cm=document.querySelector('.CodeMirror').CodeMirror;cm.setCursor({line:14,ch:3});cm.focus()}''')
        desktop.wait_for_timeout(350)
        record('Active block math has source AND rendered result',desktop.locator('.cm-active-block-preview math').count()>=1)
        desktop.locator('.editor-outline > summary').click()
        record('Document outline has heading',desktop.locator('.editor-outline-item').count()>=1)
        desktop.locator('.editor-outline-item').first.click()
        record('Outline navigates to heading',desktop.evaluate('document.querySelector(".CodeMirror").CodeMirror.getCursor().line')==0)
        desktop.locator('[data-action="save"]').first.click()
        record('Saved Markdown renders in reading view',desktop.locator('.reading-paper .article-content math').count()>=1)
        desktop.locator('[data-action="edit"]').first.click()
        record('Reopened editor retains source',desktop.evaluate('document.querySelector(".CodeMirror").CodeMirror.getValue()')==content)
        # Settings backgrounds.
        desktop.locator('[data-nav="settings"]').click()
        record('Simplified wallpaper preset count',desktop.locator('.background-option').count()==6)
        desktop.locator('[data-background="mountains"]').click()
        record('Wallpaper choice saved',desktop.evaluate("JSON.parse(localStorage.getItem('vigil-appearance-v142')).background")=='mountains')
        record('New landscape asset appears in CSS',desktop.evaluate("getComputedStyle(document.body,'::before').backgroundImage.includes('data:image/webp')"))
        desktop.screenshot(path=str(PREVIEW/'preview-151-settings.png'),full_page=True)
        # A true type-driven interaction on a blank Codemirror.
        desktop.locator('[data-action="new"]').first.click()
        desktop.evaluate("document.querySelector('.CodeMirror').CodeMirror.focus()")
        desktop.keyboard.insert_text('## 立即排版')
        desktop.wait_for_timeout(300)
        record('Typed heading is styled WITHOUT leaving line',desktop.locator('.cm-live-h2').count()>0)
        record('Typed heading displays active source marker',desktop.locator('.cm-live-syntax').count()>0)
        desktop.evaluate("document.querySelector('.CodeMirror').CodeMirror.replaceRange(' 和 **粗体**', {line:0,ch:9})")
        desktop.wait_for_timeout(350)
        record('Typed bold styled on active line',desktop.locator('.CodeMirror .cm-live-bold').count()>0)
        record('No JS runtime errors desktop',not errors)
        if errors:print('errors',errors[:5])
        desktop.close()
        # Responsive smoke, even with large content and settings.
        for width in [320,390,768,1024,1440,1672]:
            pg=browser.new_page(viewport={'width':width,'height':860})
            es=[];pg.on('pageerror',lambda e:es.append(str(e)))
            pg.set_content(FIXTURE,wait_until='load')
            pg.locator('[data-action="new"]').first.click()
            pg.evaluate('''value=>{const cm=document.querySelector('.CodeMirror').CodeMirror;cm.setValue(value);cm.setCursor({line:2,ch:10})}''',content)
            pg.wait_for_timeout(220)
            scroll=pg.evaluate('document.documentElement.scrollWidth')
            record(f'Editor responsive {width}px',scroll<=width)
            if width==390:pg.screenshot(path=str(PREVIEW/'preview-151-mobile-editor.png'),full_page=True)
            pg.close()
        browser.close()
finally:
    if server:
        server.terminate()
        try:server.wait(timeout=3)
        except subprocess.TimeoutExpired:server.kill()
print('PASS TOTAL',sum(ok for _,ok in checks),'/',len(checks))
if not all(ok for _,ok in checks):raise SystemExit(1)
