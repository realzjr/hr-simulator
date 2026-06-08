═══════════════════════════════════
        HR模拟器 — 使用说明
═══════════════════════════════════

【前置要求】
  1. Python 3.7 或更高版本
  2. DeepSeek API Key（申请地址：https://platform.deepseek.com）

【配置步骤】
  1. 打开 apikey.txt，将里面的内容替换为你自己的 DeepSeek API Key
  2. 保存文件

【启动游戏】
  · Mac 用户：双击「启动游戏.command」
    - 首次运行可能提示"无法打开"，请右键 → 打开
    - 或在终端执行：cd 到本目录，运行 python3 server.py

  · Windows 用户：双击「启动游戏.bat」
    - 如提示找不到 Python，请先安装：https://www.python.org/downloads/
    - 安装时务必勾选「Add Python to PATH」

【游戏访问】
  启动后浏览器会自动打开 http://localhost:8000

【关闭游戏】
  · Mac：在终端按 Ctrl+C，或直接关闭终端窗口
  · Windows：直接关闭命令行窗口

【常见问题】
  Q: 页面打开后提示 API 错误？
  A: 检查 apikey.txt 是否填写正确，确保网络能访问 api.deepseek.com

  Q: Mac 提示"无法验证开发者"？
  A: 系统偏好设置 → 隐私与安全性 → 仍然允许，或右键 → 打开

  Q: 端口 8000 被占用？
  A: 编辑 server.py 第18行，将 PORT = 8000 改为其他端口号
