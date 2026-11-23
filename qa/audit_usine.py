"""Audit de l'usine : chaque mission des séries 3 à 8, avec sa solution, construite et mise en marche dans usine.html."""
import json, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, "qa")
_argv = sys.argv; sys.argv = [sys.argv[0]]
import controle as c
sys.argv = _argv
SORTIE = Path("qa/captures-usine-audit"); SORTIE.mkdir(exist_ok=True)
ids = [m["id"] for m in json.load(open("site/missions/index.json"))["missions"] if m.get("atelier")]
if len(_argv) > 1: ids = [i for i in ids if any(i.startswith(p) for p in _argv[1:])]
port = c.PORT + 7
srv = subprocess.Popen([sys.executable, "qa/serveur.py", str(port)], stderr=subprocess.DEVNULL); time.sleep(1.2)
res = {}
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(channel="chrome", args=c.CHROME)
        for mid in ids:
            sol = json.load(open(f"solutions-atelier/{mid}.json"))["solution"]
            page = nav.new_page(viewport={"width": 1366, "height": 768})
            err = []
            page.on("pageerror", lambda e: err.append("pageerror: " + str(e)[:200]))
            page.on("console", lambda m: err.append(m.text[:200]) if m.type == "error" else None)
            t0 = time.time()
            try:
                page.goto(f"http://127.0.0.1:{port}/usine.html?formateur=1#mission={mid}")
                page.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=120000)
                page.wait_for_timeout(1000)
                page.screenshot(path=SORTIE / f"{mid}-0-depart.png")
                page.evaluate("(t) => window.usine.ecrireCode(t, { cadrer: true })", sol)
                page.wait_for_timeout(2000)
                page.screenshot(path=SORTIE / f"{mid}-1-construit.png")
                page.click("#bouton-vitesse")     # « Rapide » : le rejeu va plus vite, le résultat est le même
                page.evaluate("() => { window.__fini = false; window.usine.lancer().then(() => window.__fini = true, (e) => { window.__fini = 'err ' + e; }); }")
                page.wait_for_timeout(2500)
                page.screenshot(path=SORTIE / f"{mid}-2-marche.png")
                page.wait_for_function("window.__fini !== false", timeout=150000)
                page.wait_for_timeout(1500)
                page.screenshot(path=SORTIE / f"{mid}-3-fin.png")
                r = page.evaluate("() => { const r = window.usine.etat.resultat; const d = window.usine.etat.disposition; return { legende: document.getElementById('legende').textContent, tests: document.getElementById('resume-tests').textContent, machines: d ? d.machines.length : null, erreur: r && r.erreur ? (r.erreur.messageOriginal || JSON.stringify(r.erreur)).slice(0,200) : null, fini: window.__fini }; }")
            except Exception as e:
                r = {"exception": str(e)[:300]}
                try: page.screenshot(path=SORTIE / f"{mid}-x-echec.png")
                except Exception: pass
            r["js"] = err[:5]; r["duree"] = round(time.time() - t0)
            res[mid] = r; print(mid, json.dumps(r, ensure_ascii=False), flush=True)
            page.close()
        nav.close()
finally:
    srv.terminate()
json.dump(res, open(SORTIE / f"audit-{'-'.join(_argv[1:]) or 'tout'}.json", "w"), ensure_ascii=False, indent=1)
