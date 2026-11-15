#!/usr/bin/env python3
"""Chromium UI regression for VIGIL 1.5.3 (optional Playwright dependency)."""
import asyncio,importlib.util
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qa_fixture',ROOT/'scripts/make-inline-qa.py')
fixture_module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture_module)
FIXTURE=fixture_module.fixture()[0]
OUTPUT=ROOT/'docs'

async def main():
  checks=[]
  def check(name,value):checks.append((name,bool(value)));print(('PASS ' if value else 'FAIL ')+name)
  async with async_playwright() as pw:
    browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=await browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
    page=await context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    try:
      await page.set_content(FIXTURE,wait_until='load')
      await page.wait_for_timeout(500)
      check('Homepage loads',await page.locator('.heritage-hero').count()==1)
      await page.locator('.header-settings').click()
      check('Flat settings tabs exist',await page.locator('.settings-153 .settings-tab').count()==4)
      check('Tab markup not nested in card',await page.locator('.settings-153 .settings-tab .settings-tab').count()==0)
      check('No legacy boxed panels in new appearance',await page.locator('.settings-153 .appearance-section').count()==0)
      await page.screenshot(path=str(OUTPUT/'preview-153-settings-appearance.png'),full_page=True)
      before=await page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--sidebar-solid').trim()")
      await page.locator('[data-action="setting-accent"][data-color="#49687c"]').click()
      await page.wait_for_timeout(450)
      after=await page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--sidebar-solid').trim()")
      check('Theme changes sidebar derived color',before!=after)
      check('Sidebar frosted blur active',('blur(' in await page.locator('.sidebar').evaluate('(el)=>getComputedStyle(el).backdropFilter')))
      await page.screenshot(path=str(OUTPUT/'preview-153-blue-sidebar.png'),full_page=True)
      saved=await page.evaluate("JSON.parse(localStorage.getItem('vigil-appearance-v142'))")
      check('Theme color saved for reload',saved['accent']=='#49687c')
      check('Sidebar retains translucent gradient','rgba' in await page.locator('.sidebar').evaluate('(el)=>getComputedStyle(el).backgroundImage'))
      await page.locator('[data-tab="reading"]').click()
      check('Reading panel changes without navigation',await page.locator('#fontFamilySelect').count()==1)
      check('Themed select enhanced',await page.locator('.vigil-select-trigger').count()>=1)
      await page.locator('.vigil-select-trigger').first.click()
      check('Dropdown custom listbox visible',await page.locator('.vigil-select-popup:visible .vigil-select-option').count()>=4)
      await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter')
      check('Select keyboard writes native select',await page.locator('#fontFamilySelect').input_value()!='heritage')
      await page.locator('[data-tab="interaction"]').click()
      check('Glass controls appear',await page.locator('[data-setting="sidebarBlur"]').count()==1)
      await page.locator('[data-setting="sidebarGlass"]').fill('68')
      check('Glass slider updates live',await page.evaluate("JSON.parse(localStorage.getItem('vigil-appearance-v142')).sidebarGlass===68"))
      await page.screenshot(path=str(OUTPUT/'preview-153-interaction.png'),full_page=True)
      # Four-tab keyboard navigation follows left/right/Home/End, not old two-tab toggle.
      await page.locator('[data-tab="interaction"]').focus()
      await page.keyboard.press('ArrowLeft')
      check('ArrowLeft selects adjacent Reading tab',await page.locator('[data-tab="reading"]').get_attribute('aria-selected')=='true')
      await page.keyboard.press('End')
      check('End selects Data tab',await page.locator('[data-tab="data"]').get_attribute('aria-selected')=='true')
      await page.locator('[data-tab="data"]').click()
      check('Data backup still available',await page.locator('[data-action="export-encrypted"]').count()==1)
      await page.screenshot(path=str(OUTPUT/'preview-153-settings-data.png'),full_page=True)
      check('No JS errors on settings',not errors)
      # App functionality smoke, then responsive widths across major views.
      await page.locator('[data-action="new"]').first.click()
      await page.locator('#entryTitle').fill('1.5.3 测试记录')
      # CodeMirror text input
      cm=page.locator('.CodeMirror').first
      check('Editor loads',await cm.count()==1)
      await cm.click();await page.keyboard.type('## 主题设置后继续写作\n\n测试 **加粗** 与 $a+b$。',delay=5)
      await page.locator('[data-action="save"]').first.click()
      check('Note saving still works',await page.locator('.reading-title').count()==1)
      await page.locator('[data-nav="settings"]').first.click()
      await page.locator('[data-tab="appearance"]').click()
      await page.screenshot(path=str(OUTPUT/'preview-153-settings-appearance.png'),full_page=True)
      for width in [320,390,768,900,1024,1440,1672]:
        mobile=width<=900
        c=await browser.new_context(viewport={'width':width,'height':840})
        p=await c.new_page()
        e=[];p.on('pageerror',lambda er:e.append(str(er)))
        await p.set_content(FIXTURE,wait_until='load');await p.wait_for_timeout(150)
        sizes={}
        sizes['home']=await p.evaluate('document.documentElement.scrollWidth')
        if mobile and not await p.locator('#sidebarNav').is_visible():
          await p.locator('#sidebarToggle').click();await p.wait_for_timeout(80)
        await p.locator('[data-nav="settings"]').first.click();await p.wait_for_timeout(60)
        sizes['appearance']=await p.evaluate('document.documentElement.scrollWidth')
        if width==390:await p.screenshot(path=str(OUTPUT/'preview-153-settings-mobile.png'),full_page=True)
        for tab in ['reading','interaction','data']:
          await p.locator(f'[data-tab="{tab}"]').click()
          sizes[tab]=await p.evaluate('document.documentElement.scrollWidth')
        # browser native menu at phone widths also floats within viewport
        await p.locator('[data-tab="reading"]').click()
        await p.locator('.vigil-select-trigger').first.click()
        popup=await p.locator('.vigil-select-popup').bounding_box()
        check(f'{width}px no horizontal overflow',max(sizes.values())<=width+1)
        check(f'{width}px menu fits screen',popup is not None and popup['x']>=-1 and popup['x']+popup['width']<=width+1)
        check(f'{width}px runtime errors',not e)
        await c.close()
      check('Main page runtime errors',not errors)
    finally:
      await browser.close()
  failures=[name for name,valid in checks if not valid]
  print(f'{len(checks)-len(failures)}/{len(checks)} checks passed')
  if failures:raise RuntimeError('Failures: '+', '.join(failures))

if __name__=='__main__':asyncio.run(main())
