@echo off
chcp 65001 >nul
title HR模拟器
cd /d "%~dp0\game"

echo ==============================
echo    HR模拟器 启动中...
echo ==============================
echo.

:: 检查 apikey.txt
if not exist apikey.txt (
    echo [提示] 未找到 apikey.txt，将以本地模式运行（无需API）
    echo   如需在线模式，请在 game\ 目录下创建 apikey.txt 并填入 API Key
    echo.
)

:: 检查 Python
where python >nul 2>nul
if %errorlevel%==0 (
    set PYTHON=python
    goto :found
)
where python3 >nul 2>nul
if %errorlevel%==0 (
    set PYTHON=python3
    goto :found
)

echo [错误] 未找到 Python，请先安装 Python 3.7+
echo 下载地址: https://www.python.org/downloads/
pause
exit /b 1

:found
echo 使用 %PYTHON% 启动服务器...
echo 启动后浏览器将自动打开 http://localhost:8000
echo 关闭此窗口即可停止服务器
echo.
%PYTHON% server.py
pause
