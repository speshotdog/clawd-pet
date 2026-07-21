#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""vtest 收檔伺服器：接收瀏覽器 canvas.toDataURL 的 PNG，寫入 out/。
用法：python recv_server.py [port]  (預設 17997)
POST /save?name=<frame_name>  body = "data:image/png;base64,...."
回傳 CORS 標頭（text/plain body 屬 simple request，無 preflight）。
"""
import sys, os, base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        name = (q.get('name', ['frame'])[0]).replace('/', '_').replace('\\', '_')
        ln = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(ln).decode('utf-8', 'replace')
        if ',' in body:
            body = body.split(',', 1)[1]
        try:
            raw = base64.b64decode(body)
            path = os.path.join(OUT, name + '.png')
            with open(path, 'wb') as f:
                f.write(raw)
            msg = b'OK ' + path.encode('utf-8')
            code = 200
        except Exception as e:  # noqa
            msg = ('ERR ' + str(e)).encode('utf-8')
            code = 500
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.end_headers()
        self.wfile.write(msg)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 17997
    print(f'recv_server on http://localhost:{port}  -> {OUT}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
