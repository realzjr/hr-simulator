"""
HR模拟器 本地服务器
- 静态文件服务（替代 python3 -m http.server）
- /api/chat 代理转发到 DeepSeek API（解决浏览器 CORS 问题）

启动：cd HR模拟器 && python3 server.py
访问：http://localhost:8000
"""

import http.server
import json
import os
import urllib.request
import urllib.error
import threading
import webbrowser

PORT = 8000
API_URL = 'https://api.deepseek.com/chat/completions'

# 读取 API Key
def load_api_key():
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'apikey.txt')
    try:
        with open(key_path, 'r') as f:
            return f.read().strip()
    except Exception as e:
        print(f'[server] 读取 apikey.txt 失败: {e}')
        return None

class Handler(http.server.SimpleHTTPRequestHandler):

    def do_POST(self):
        if self.path == '/api/chat':
            self.handle_api_chat()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_api_chat(self):
        api_key = load_api_key()
        if not api_key:
            self.send_json(500, {'error': 'apikey.txt 未配置'})
            return

        # 读取请求体
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        # 转发到 DeepSeek
        req = urllib.request.Request(
            API_URL,
            data=body,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
            },
            method='POST',
        )

        try:
            # 绕过系统代理，直连 DeepSeek API
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(req, timeout=60) as resp:
                data = resp.read()
                self.send_json(200, json.loads(data))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            print(f'[server] DeepSeek API 错误 {e.code}: {err_body[:200]}')
            self.send_json(e.code, {'error': err_body})
        except Exception as e:
            print(f'[server] 请求异常: {e}')
            self.send_json(500, {'error': str(e)})

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # 静态资源（SVG/图片/JS/CSS）允许浏览器缓存，HTML不缓存以便开发刷新
        path = self.path.split('?')[0].lower()
        if path.endswith(('.svg', '.png', '.jpg', '.js', '.css', '.woff', '.woff2')):
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # 打印所有请求日志，方便调试
        super().log_message(format, *args)

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    url = f'http://localhost:{PORT}'
    print(f'HR模拟器服务器已启动: {url}')
    print(f'API代理: /api/chat -> DeepSeek')
    # 延迟0.5秒后自动打开浏览器
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    http.server.HTTPServer(('', PORT), Handler).serve_forever()
