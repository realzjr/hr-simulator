@echo off
chcp 65001 >nul
title HR模拟器
cd /d "%~dp0"

echo ==============================
echo    HR模拟器 启动中...
echo ==============================
echo.

:: 检查 apikey.txt
if not exist apikey.txt (
    echo [错误] 未找到 apikey.txt，请在当前目录创建该文件并填入 DeepSeek API Key
    pause
    exit /b 1
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
