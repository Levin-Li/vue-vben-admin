#!/usr/bin/env python3
"""仅供本机界面验收：使用独立端口避免宿主 SPA/Service Worker 接管夹具。"""
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

module = Path(__file__).with_name('invitation-tenant-browser.ts').resolve().as_posix()
module_url = 'http://localhost:5666/@fs' + module


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/fixture/state':
            self.forward(path, 18586)
            return
        if path == '/fixture/pg-state':
            self.forward('/fixture/state', 18587)
            return
        if path.endswith('/UiSetting/use/resolve'):
            body = b'{"code":0,"data":null}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path != '/':
            print(f'fixture unknown GET: {path}', flush=True)
            self.send_error(404)
            return
        body = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
                '<title>邀请租户隔离验收</title><div id="app"></div>'
                f'<script type="module" src="{module_url}"></script></html>').encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == '/fixture/pg-otp':
            self.forward('/fixture/otp', 18587)
            return
        for prefix, port in (('/fixture-api', 18586), ('/fixture-pg-api', 18587)):
            business = path.removeprefix(prefix)
            if path.startswith(prefix) and business.startswith('/com.levin.oak.base/V1/api/Invitation'):
                self.forward(business, port)
                return
        self.send_error(404)

    def forward(self, path, port):
        length = int(self.headers.get('Content-Length', '0'))
        if length > 1_000_000:
            self.send_error(413)
            return
        body = self.rfile.read(length) if length else None
        headers = {name: self.headers[name] for name in ('Content-Type', 'X-Fixture-Actor') if name in self.headers}
        connection = HTTPConnection('127.0.0.1', port, timeout=20)
        try:
            connection.request(self.command, path, body, headers)
            response = connection.getresponse()
            payload = response.read()
            self.send_response(response.status)
            self.send_header('Content-Type', 'application/json; charset=UTF-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except OSError:
            self.send_error(502, '隔离测试后端不可用')
        finally:
            connection.close()


ThreadingHTTPServer(('127.0.0.1', 18585), Handler).serve_forever()
