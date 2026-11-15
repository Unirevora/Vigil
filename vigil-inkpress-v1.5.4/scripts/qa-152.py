"""Offline Chromium regression fixture for VIGIL 1.5.2; no external accounts/network."""
from pathlib import Path
import importlib.util
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qa_fixture',ROOT/'scripts/make-inline-qa.py')
fixture_module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture_module)
FIXTURE=fixture_module.fixture()[0]
OUT=ROOT/'docs'
checks=[]

def check(name,condition):
    ok=bool(condition)
    checks.append((name,ok))
    print(('PASS ' if ok else 'FAIL ')+name,flush=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    desktop=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    desktop.on('pageerror',lambda e:errors.append(str(e)))
    desktop.set_content(FIXTURE,wait_until='load')
    desktop.wait_for_timeout(200)
    check('home renders',desktop.locator('.heritage-hero').count()==1)
    check('desktop dock hidden',not desktop.locator('.glass-dock').is_visible())
    desktop.screenshot(path=str(OUT/'preview-152-home-desktop.png'),full_page=True)
    desktop.locator('.header-settings').click()
    check('settings has two tabs',desktop.locator('[role="tab"]').count()==2)
    check('settings first tab is appearance',desktop.locator('[data-tab="appearance"]').get_attribute('aria-selected')=='true')
    desktop.locator('[data-action="settings-tab"][data-tab="data"]').click()
    check('data panel works',desktop.locator('.data-summary').count()==1 and desktop.locator('[data-action="export-encrypted"]').count()>0)
    desktop.screenshot(path=str(OUT/'preview-152-settings-data.png'),full_page=True)
    desktop.locator('[data-action="settings-tab"][data-tab="appearance"]').click()
    desktop.screenshot(path=str(OUT/'preview-152-settings-appearance.png'),full_page=True)
    desktop.locator('[data-action="new"]').first.click()
    check('editor mounts',desktop.locator('.CodeMirror').count()==1)
    check('editor has 3 format menus',desktop.locator('.editor-dropdown-menu').count()==3)
    cm='document.querySelector(".CodeMirror").CodeMirror'
    desktop.evaluate(f"{cm}.setValue('第一段\\n\\n第二段')")
    desktop.evaluate(f"{cm}.setCursor({{line:0,ch:2}})")
    desktop.locator('.editor-dropdown-menu[data-menu="heading"] summary').click()
    desktop.locator('[data-format="heading1"]').click()
    check('heading 1 insertion',desktop.evaluate(f"{cm}.getLine(0).startsWith('# ')") )
    desktop.locator('.editor-dropdown-menu[data-menu="list"] summary').click()
    desktop.locator('[data-format="orderedList"]').click()
    check('numbered list inserted',desktop.evaluate(f"{cm}.getLine(0).startsWith('1. ')") )
    desktop.locator('[data-action="toggle-outline-sidebar"]').click()
    check('right outline opens',desktop.locator('#editorOutlineSidebar').get_attribute('class').find('is-open')>=0)
    desktop.screenshot(path=str(OUT/'preview-152-editor-outline-desktop.png'),full_page=True)
    desktop.locator('[data-action="close-outline-sidebar"]').last.click()
    desktop.locator('[data-action="editor-mode"][data-mode="reading"]').click()
    check('reading view visible',desktop.locator('#unifiedReader').is_visible())
    desktop.screenshot(path=str(OUT/'preview-152-editor-reading.png'),full_page=True)
    check('no errors desktop',not errors)
    if errors:print('DESKTOP ERRORS',errors[:5])
    desktop.close()
    for width in [320,390,768,1440]:
        page=browser.new_page(viewport={'width':width,'height':840},device_scale_factor=1, is_mobile=width<=430,
                              has_touch=width<=430)
        local_errors=[]
        page.on('pageerror',lambda e:local_errors.append(str(e)))
        page.set_content(FIXTURE,wait_until='load')
        page.wait_for_timeout(100)
        check(f'home no overflow {width}',page.evaluate('document.documentElement.scrollWidth')<=width+1)
        if width<=900:
            check(f'mobile dock visible {width}',page.locator('.glass-dock').is_visible())
        page.locator('.header-settings').click()
        page.locator('[data-action="settings-tab"][data-tab="data"]').click()
        check(f'settings data no overflow {width}',page.evaluate('document.documentElement.scrollWidth')<=width+1)
        if width==390:page.screenshot(path=str(OUT/'preview-152-settings-mobile.png'),full_page=True)
        page.locator('[data-action="new"]').first.click()
        page.evaluate(f"{cm}.setValue('# 今日\\n\\n## 片刻\\n\\n**文字** 与 $x^2$。')")
        page.wait_for_timeout(120)
        check(f'editor no overflow {width}',page.evaluate('document.documentElement.scrollWidth')<=width+1)
        if width==390:
            page.screenshot(path=str(OUT/'preview-152-editor-mobile.png'),full_page=True)
            page.locator('[data-action="toggle-outline-sidebar"]').click()
            page.wait_for_timeout(280)
            check('mobile outline visible',page.locator('#editorUnifiedPane').get_attribute('data-outline-open')=='true' and page.locator('#editorOutlineSidebar').is_visible())
            page.screenshot(path=str(OUT/'preview-152-outline-mobile.png'),full_page=False)
            page.locator('.editor-outline-scrim').click(position={'x':20,'y':20},force=True)
            page.wait_for_timeout(240)
            check('mobile outline closes via backdrop',page.locator('#editorUnifiedPane').get_attribute('data-outline-open')=='false')
        check(f'no JS errors {width}',not local_errors)
        if local_errors:print('JS ERRORS',width,local_errors[:4])
        page.close()
    browser.close()
print('PASS TOTAL',sum(ok for _,ok in checks),'/',len(checks))
if not all(ok for _,ok in checks):raise SystemExit(1)
