"""Serveur local du jeu, avec les mêmes en-têtes que le fichier _headers de Netlify.

Usage : python serveur.py [port] [--sans-isolement]
--sans-isolement : n'envoie pas les en-têtes (pour tester le repli quand SharedArrayBuffer est indisponible).
"""
import functools, http.server, json, pathlib, sys, urllib.parse

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"
ISOLEMENT = "--sans-isolement" not in sys.argv
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8765)

class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".wasm": "application/wasm"}
    def end_headers(self):
        if ISOLEMENT:
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *args):
        pass
    def do_POST(self):
        # Imite Netlify Forms : un envoi sur « / » avec le champ form-name est accepté. Le dernier envoi est gardé pour le contrôle.
        corps = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8")
        champs = urllib.parse.parse_qs(corps, keep_blank_values=True)
        if self.path == "/" and "form-name" in champs:
            Gestionnaire.dernier_envoi = {c: v[0] for c, v in champs.items()}
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers(); self.wfile.write(b"ok")
        else:
            self.send_response(404); self.end_headers()
    def do_GET(self):
        if self.path == "/__dernier_envoi":
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps(getattr(Gestionnaire, "dernier_envoi", None)).encode("utf-8"))
        else:
            super().do_GET()

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Gestionnaire, directory=str(SITE))).serve_forever()
