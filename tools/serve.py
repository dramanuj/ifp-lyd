#!/usr/bin/env python3
"""Tiny static file server WITH HTTP Range support (needed for seeking in audio; python's
http.server does not support Range). Usage:
    python3 tools/serve.py [--port 8000] [--root .] [--prefix /ifp-lyd/]
--prefix serves the folder under a sub-path, like GitHub Pages project sites (https://USER.github.io/REPO/)."""
import argparse, os, re, sys, mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote, urlparse

class H(SimpleHTTPRequestHandler):
    prefix = '/'
    def translate_path(self, path):
        p = unquote(urlparse(path).path)
        if self.prefix != '/':
            if not p.startswith(self.prefix):
                return os.path.join(self.root, '__nope__')
            p = '/' + p[len(self.prefix):]
        full = os.path.normpath(os.path.join(self.root, p.lstrip('/')))
        return full if full.startswith(self.root) else os.path.join(self.root, '__nope__')
    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes'); self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def do_GET(self):
        rng = self.headers.get('Range'); path = self.translate_path(self.path)
        if rng and os.path.isfile(path):
            m = re.match(r'bytes=(\d*)-(\d*)$', rng.strip())
            size = os.path.getsize(path)
            if m and (m.group(1) or m.group(2)):
                if m.group(1): a = int(m.group(1)); b = int(m.group(2)) if m.group(2) else size - 1
                else: n = int(m.group(2)); a = max(0, size - n); b = size - 1
                b = min(b, size - 1)
                if a > b or a >= size:
                    self.send_response(416); self.send_header('Content-Range', f'bytes */{size}'); self.end_headers(); return
                self.send_response(206)
                self.send_header('Content-Type', mimetypes.guess_type(path)[0] or 'application/octet-stream')
                self.send_header('Content-Range', f'bytes {a}-{b}/{size}'); self.send_header('Content-Length', str(b - a + 1)); self.end_headers()
                with open(path, 'rb') as f:
                    f.seek(a); left = b - a + 1
                    while left > 0:
                        chunk = f.read(min(65536, left))
                        if not chunk: break
                        try: self.wfile.write(chunk)
                        except (BrokenPipeError, ConnectionResetError): return
                        left -= len(chunk)
                return
        try: super().do_GET()
        except (BrokenPipeError, ConnectionResetError): pass
    def log_message(self, *a): pass

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=8000); ap.add_argument('--root', default='.'); ap.add_argument('--prefix', default='/')
    a = ap.parse_args(); H.root = os.path.abspath(a.root); H.prefix = '/' + a.prefix.strip('/') + '/' if a.prefix.strip('/') else '/'
    mimetypes.add_type('text/vtt', '.vtt'); mimetypes.add_type('audio/mpeg', '.mp3')
    print(f'Serving {H.root} at http://localhost:{a.port}{H.prefix}  (Ctrl+C to stop)')
    try: ThreadingHTTPServer(('', a.port), H).serve_forever()
    except KeyboardInterrupt: pass
