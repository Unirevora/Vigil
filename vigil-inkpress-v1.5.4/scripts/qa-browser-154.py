#!/usr/bin/env python3
"""Optional real-HTTP browser smoke test for Vigil 1.5.4.

Requirements (development only): pip install playwright; python -m playwright install chromium
No account, token, key, remote repository, or private note is required.
Run from any directory: python3 scripts/qa-browser-154.py
"""
from pathlib import Path
from contextlib import closing
from urllib.request import urlopen
import asyncio
import os
import socket
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent.parent
try:
    from playwright.async_api import async_playwright
except ImportError:
    print('缺少 Playwright 测试依赖。开发环境运行：pip install playwright && python -m playwright install chromium')
    raise SystemExit(2)


def available_port():
    with closing(socket.socket()) as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]

async def run(base):
    count=0
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        try:
            for width in [390,1440]:
                context=await browser.new_context(viewport={'width':width,'height':830})
                page=await context.new_page()
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                await page.goto(base,wait_until='load')
                assert await page.locator('#pageBreadcrumb').inner_text()=='概览'
                assert await page.locator('.header-monogram').count()==0
                assert await page.locator('.topbar').evaluate('(e)=>getComputedStyle(e).backdropFilter')=='none'
                count+=3
                await page.locator('.header-settings').click()
                assert await page.locator('#settings-tab-about').count()==1
                radius=await page.locator('.settings-hub-tabs').evaluate('(e)=>getComputedStyle(e).borderRadius')
                assert radius!='0px'
                count+=2
                await page.locator('#settings-tab-about').click()
                assert await page.locator('.about-page').count()==1
                await page.locator('[data-action="about-diagnose"]').click()
                assert await page.locator('.about-diagnostic-results').count()==1
                count+=2
                if width<=900:
                    await page.locator('#sidebarToggle').click()
                await page.locator('[data-nav="chronicle"]').click()
                assert await page.locator('.archive-layout').count()==1
                count+=1
                await page.locator('#chronicle-tab-almanac').click()
                assert await page.locator('#seasonDial').count()==1
                await page.locator('#chronicle-tab-almanac').focus()
                await page.keyboard.press('ArrowLeft')
                assert await page.locator('#chronicle-tab-calendar').get_attribute('aria-selected')=='true'
                count+=2
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert not errors,errors
                count+=2
                await context.close()
        finally:
            await browser.close()
    return count

async def main():
    port=available_port()
    env={**os.environ,'PORT':str(port)}
    server=subprocess.Popen(['node','scripts/dev-server.mjs'],cwd=ROOT,env=env,
                            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        base=f'http://127.0.0.1:{port}/'
        for _ in range(30):
            if server.poll() is not None:raise RuntimeError('开发服务器提前退出')
            try:
                with urlopen(base,timeout=1) as response:
                    if response.status==200:break
            except Exception:
                await asyncio.sleep(.12)
        else:raise RuntimeError('无法启动 HTTP 开发服务器')
        passed=await run(base)
        print(f'Vigil 1.5.4 真正 HTTP / ESM 浏览器检查：{passed}/{passed} PASS')
    finally:
        server.terminate()
        try:server.wait(timeout=3)
        except subprocess.TimeoutExpired:server.kill()

if __name__=='__main__':
    try:asyncio.run(main())
    except Exception as error:
        print('浏览器验收失败：',error,file=sys.stderr)
        raise SystemExit(1)
