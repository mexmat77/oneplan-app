import os, http.server, socketserver
os.chdir("/Users/faigaliev/Desktop/Сайт One-Plan/One-Plan приложение")
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8765), H) as s:
    s.serve_forever()
