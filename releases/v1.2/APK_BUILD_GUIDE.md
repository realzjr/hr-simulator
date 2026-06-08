# HR模拟器 — APK 打包流程

## 前置条件

| 依赖 | 版本要求 | 验证命令 |
|------|---------|---------|
| Node.js | ≥18 | `node -v` |
| JDK | **21+**（Capacitor 8 要求） | `java -version` |
| Capacitor CLI | 已在 apk-build 的 devDependencies 中 | `npx cap --version` |

JDK 安装：`brew install openjdk@21`，安装后确认 `/usr/libexec/java_home -v 21` 有输出。

---

## 完整打包步骤

### 1. 运行预检脚本

```bash
cd HR模拟器-dev
./pre-build-check.sh
```

必须全部 `[✓]` 通过才能继续。致命错误（`[✗]`）会 exit 1 阻断。

### 2. 同步 game/ → apk-build/www/

```bash
# 备份 APK 专有文件（这些文件不在 game/ 中）
cp apk-build/www/js/apk-config.js /tmp/apk-config-backup.js
cp apk-build/www/index.html /tmp/apk-index-backup.html

# 按目录同步（不要用 rsync --delete，会删除 APK 专有文件）
rsync -a game/data/    apk-build/www/data/
rsync -a game/js/      apk-build/www/js/
rsync -a game/css/     apk-build/www/css/
rsync -a game/avatars/ apk-build/www/avatars/
rsync -a game/images/  apk-build/www/images/

# 恢复 APK 专有文件
cp /tmp/apk-config-backup.js apk-build/www/js/apk-config.js
cp /tmp/apk-index-backup.html apk-build/www/index.html
```

**绝对不要** `rsync -a --delete game/ apk-build/www/`，会删除 `apk-config.js` 和 `lib/` 目录。

### 3. APK 专有文件说明

这些文件只存在于 `apk-build/www/`，**不在** `game/` 中：

| 文件 | 用途 |
|------|------|
| `js/apk-config.js` | 预设 API key + 在线模式，免配置即玩 |
| `lib/html2canvas.min.js` | 本地化 CDN 依赖（APK 无法访问 CDN） |
| `lib/qrcode.min.js` | 本地化 CDN 依赖 |
| `index.html` | 与 game/index.html 不同：引用本地 lib、加载 apk-config.js |

### 4. Capacitor 同步 + 构建

```bash
cd apk-build
export JAVA_HOME=$(/usr/libexec/java_home -v 21)

npx cap sync android
cd android
./gradlew assembleDebug
```

APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### 5. 版本封装

```bash
VERSION="vX.X"          # 替换为实际版本号
DATE=$(date +%Y%m%d)
RELEASE_DIR="/Users/a123/Desktop/HR模拟器-releases/${DATE}-${VERSION}"
mkdir -p "$RELEASE_DIR"

# 复制游戏文件（排除开发专用文件）
rsync -a game/ "$RELEASE_DIR/game/" --exclude server.py --exclude apikey.txt
rsync -a docs/ "$RELEASE_DIR/docs/"
rsync -a apk-build/ "$RELEASE_DIR/apk-build/" \
  --exclude android/.gradle --exclude android/build \
  --exclude android/app/build --exclude android/.idea --exclude "*.iml"

# 复制启动脚本
cp README.txt 启动游戏\(Mac双击\).command 启动游戏\(Windows双击\).bat "$RELEASE_DIR/"

# 复制 APK 并命名
cp apk-build/android/app/build/outputs/apk/debug/app-debug.apk \
   "$RELEASE_DIR/HR模拟器-${DATE}-${VERSION}.apk"
```

---

## 权限与网络配置

### Android 权限（AndroidManifest.xml）

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

仅需网络权限，用于在线模式调用 AI API。

### 网络安全

- **HTTP/HTTPS 全放通**：无 `network_security_config.xml` 限制
- **跨域全放通**：Cordova 配置 `<access origin="*" />`
- APK 内 WebView 直连 API endpoint（DeepSeek/OpenAI/Claude 等），无需代理

### Capacitor 配置（capacitor.config.json）

```json
{
  "appId": "com.hrsimulator.game",
  "appName": "HR模拟器",
  "webDir": "www"
}
```

---

## 常见问题

### JDK 版本错误：`无效的源发行版：21`

Capacitor 8 要求 JDK 21+。安装：
```bash
brew install openjdk@21
```

### rsync 后本地模式崩溃

原因：`rsync --delete` 删除了 `apk-config.js`。解决方案：按上述步骤 2 分目录同步 + 备份恢复。

### localData.js 语法错误导致本地模式失效

`LOCAL_DATA` 加载失败时，游戏静默回退到在线模式。运行 `node --check game/data/localData.js` 或 `./pre-build-check.sh` 检查。

常见原因：编辑时引入 Unicode 弯引号（`""`）替代了标准双引号（`""`）。

---

## Release 目录结构

每次封装后的版本目录结构：

```
HR模拟器-releases/
└── YYYYMMDD-vX.X/
    ├── game/                        # 游戏主体（不含 server.py、apikey.txt）
    ├── docs/                        # 开发文档
    ├── apk-build/                   # APK 构建项目（不含 build 产物）
    ├── HR模拟器-YYYYMMDD-vX.X.apk  # 可安装的 APK
    ├── README.txt                   # 用户操作指南
    ├── 启动游戏(Mac双击).command
    └── 启动游戏(Windows双击).bat
```
