# 🎮 HR模拟器 — HR Simulation Game

一款以人力资源管理为题材的模拟经营类网页游戏。玩家扮演公司HR，通过简历筛选、面试、评估、薪资谈判等环节，模拟完整招聘流程。

## ✨ 特性

- 多 AI 供应商支持：DeepSeek / OpenAI / Claude / Gemini / Kimi / 智谱
- 双模式：代理模式（本地服务器）或 直连模式（自带 API Key）
- 完整招聘流程：简历筛选 → 面试 → HRD审核 → 薪资谈判 → 结果反馈
- 零依赖前端：纯 HTML/CSS/JS，无框架
- 支持打包为 Android APK

## 🚀 快速开始

### 方式一：在线直连（无需安装）

访问 GitHub Pages 部署的页面，在游戏设置中填入你的 API Key 即可开始。

支持任意 OpenAI 兼容接口（DeepSeek、OpenAI、Claude、Gemini 等）。

### 方式二：本地运行

```bash
# 1. 配置 API Key
echo "你的DeepSeek API Key" > server/apikey.txt

# 2. 启动服务器
python3 server/server.py

# 3. 浏览器打开 http://localhost:8000
```

macOS 用户也可双击 `启动游戏.command`。

### 方式三：本地直连

```bash
# 直接打开
open src/index.html
# 或
python3 -m http.server 8000 -d src
```

在游戏设置中填入 API Key 即可。

## 📁 项目结构

```
├── src/                    # 游戏前端源码
│   ├── index.html          # 入口
│   ├── css/                # 样式表
│   ├── js/                 # 游戏逻辑
│   ├── data/               # 数据配置
│   └── avatars/            # 候选人头像 (37个SVG)
├── server/                 # 后端代理服务
├── docs/                   # 文档
├── releases/               # 历史发布版本 (APK)
├── tools/                  # 构建脚本
└── LICENSE                 # MIT
```

## 🔧 技术栈

| 层 | 技术 |
|---|------|
| 前端 | HTML / CSS / JS (无框架) |
| 后端代理 | Python (http.server) |
| AI | DeepSeek / OpenAI / Claude / Gemini / Kimi / 智谱 |
| 打包 | Capacitor (Android APK) |

## 📖 游戏流程

1. 开场介绍 → 2. 候选人简历 → 3. 面试问答 → 4. HRD审核 → 5. 薪资谈判 → 6. 结果反馈

## 📄 License

MIT — 自由使用、修改、分发。
