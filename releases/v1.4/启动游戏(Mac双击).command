#!/bin/bash
cd "$(dirname "$0")/game"

echo "=============================="
echo "   HR模拟器 启动中..."
echo "=============================="
echo ""

# 检查 apikey.txt
if [ ! -f apikey.txt ]; then
    echo "[提示] 未找到 apikey.txt，将以本地模式运行（无需API）"
    echo "  如需在线模式，请在 game/ 目录下创建 apikey.txt 并填入 API Key"
    echo ""
fi

# 检查 Python
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "[错误] 未找到 Python，请先安装 Python 3.7+"
    echo "  brew install python3"
    echo "  或访问 https://www.python.org/downloads/"
    echo "按回车键退出..."
    read
    exit 1
fi

echo "使用 $PYTHON 启动服务器..."
echo "启动后浏览器将自动打开 http://localhost:8000"
echo "按 Ctrl+C 可停止服务器"
echo ""
$PYTHON server.py
