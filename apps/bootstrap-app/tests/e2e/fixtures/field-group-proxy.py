#!/usr/bin/env python3
"""仅供隔离浏览器验收：回环静态页面和真实测试 HTTP 服务的透明代理。"""
import argparse
import html
import http.client
import http.server
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--backend-port', type=int, required=True)
parser.add_argument('--port', type=int, default=0)
parser.add_argument('--port-file', required=True)
parser.add_argument('--kind', choices=('group', 'value'), default='group')
args = parser.parse_args()
port_file = Path(args.port_file)
if not str(port_file).startswith('/tmp/field-group-ui-') or '..' in port_file.parts or port_file.exists():
    raise SystemExit('必须提供未存在的 /tmp/field-group-ui-* 端口文件')
if not 1024 <= args.backend_port <= 65535 or not 0 <= args.port <= 65535:
    raise SystemExit('端口无效')
module_name = 'field-group-crud.ts' if args.kind == 'group' else 'field-value-crud.ts'
module = Path(__file__).with_name(module_name).resolve().as_posix()
module_url = 'http://localhost:5666/@fs' + module

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if urlsplit(self.path).path == '/':
            body = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
                    '<title>字段权限隔离验收</title><div id="app"></div>'
                    f'<script type="module" src="{html.escape(module_url, quote=True)}"></script></html>').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.forward()

    def do_POST(self):
        self.forward()

    def forward(self):
        path = urlsplit(self.path).path
        business_prefix = '/fixture/' if args.kind == 'group' else '/enum-fixture/'
        if not (path.startswith(business_prefix) or path == '/com.levin.oak.base/V1/api/UiSetting/use/resolve'):
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', '0'))
        if length > 1_000_000:
            self.send_error(413)
            return
        body = self.rfile.read(length) if length else None
        headers = {name: self.headers[name] for name in ('Content-Type', 'X-Fixture-User') if name in self.headers}
        connection = http.client.HTTPConnection('127.0.0.1', args.backend_port, timeout=15)
        try:
            connection.request(self.command, self.path, body, headers)
            result = connection.getresponse()
            payload = result.read()
            self.send_response(result.status)
            self.send_header('Content-Type', result.getheader('Content-Type', 'application/json'))
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except OSError:
            self.send_error(502, '隔离测试后端不可用')
        finally:
            connection.close()

server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
port_file.write_text(str(server.server_port), encoding='utf-8')
try:
    server.serve_forever()
finally:
    server.server_close()
    port_file.unlink(missing_ok=True)
