"""Sert le dossier site/ en local, avec les mêmes en-têtes que le fichier site/_headers de Netlify.

Usage : python serveur_local.py [port]        puis ouvrir http://127.0.0.1:8765/
Le jeu ne s'ouvre pas par double-clic sur index.html : le navigateur refuse de charger ses scripts depuis le disque.
L'envoi des résultats ne fonctionne que sur Netlify.
"""
import functools, http.server, pathlib, sys

DOSSIER = pathlib.Path(__file__).resolve().parent / "site"
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8765)


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm"}

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Jeu servi sur http://127.0.0.1:{PORT}/  (fermez cette fenêtre pour arrêter)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Gestionnaire, directory=str(DOSSIER))).serve_forever()
