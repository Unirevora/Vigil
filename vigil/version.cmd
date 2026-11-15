@echo off
rem ==== Vigil Inkpress: change the version everywhere (double-click, or: version.cmd 1.7.4 [发布名]) ====
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Vigil Inkpress 版本号

where node >nul 2>&1 || (echo [错误] 未找到 Node.js 18+ & goto :end)

if not "%~1"=="" (
  node scripts\version.mjs %*
  goto :end
)

node scripts\version.mjs
echo.
echo 输入新版本号（例如 1.7.4），也可以输入 patch / minor / major 自动递增；直接回车则不修改。
set "NEWVER="
set /p "NEWVER=新版本号: "
if "%NEWVER%"=="" goto :end
set "NEWNAME="
set /p "NEWNAME=发布名（显示在「关于」页，回车保留原名）: "
echo.
if "%NEWNAME%"=="" (
  node scripts\version.mjs %NEWVER%
) else (
  node scripts\version.mjs %NEWVER% "%NEWNAME%"
)

:end
echo.
echo %cmdcmdline% | findstr /i /c:"%~nx0" >nul && pause
exit /b
