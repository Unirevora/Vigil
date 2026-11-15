@echo off
rem ==== Vigil Inkpress one-click deploy (double-click, or run: deploy.cmd [--skip-tests] [--no-nginx]) ====
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Vigil Inkpress 一键部署

where node >nul 2>&1 || (echo [错误] 未找到 Node.js 18+，请先安装：https://nodejs.org/ & goto :fail)
where ssh  >nul 2>&1 || (echo [错误] 未找到 ssh。请在“设置 - 可选功能”中安装 OpenSSH 客户端。 & goto :fail)
where tar  >nul 2>&1 || (echo [错误] 未找到 tar（Windows 10 1803 及以上系统自带）。 & goto :fail)

node scripts\deploy.mjs %*
if errorlevel 1 goto :fail

echo.
echo 部署成功：https://10.129.81.79:8443/vigil/
call :maybe_pause
exit /b 0

:fail
echo.
echo 部署失败，请查看上面的输出。服务器端出错时会自动回滚到上一版本。
call :maybe_pause
exit /b 1

:maybe_pause
rem Pause only when launched by double-click (Explorer runs: cmd.exe /c ""...\deploy.cmd" ").
if defined VIGIL_NO_PAUSE exit /b 0
echo %cmdcmdline% | findstr /i /c:"%~nx0" >nul && pause
exit /b 0
