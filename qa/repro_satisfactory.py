"""Reproduit les deux frustrations rapportées le 19/11 sur l'atelier (mission 3.2) : return supprimé puis remis, poste ajouté après le return."""
import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, "qa")
_argv = sys.argv; sys.argv = [sys.argv[0]]
import controle as c
sys.argv = _argv

MISSION = sys.argv[1] if len(sys.argv) > 1 else "3.2-tarif"
srv = subprocess.Popen([sys.executable, "qa/serveur.py", str(c.PORT)], stderr=subprocess.DEVNULL)
time.sleep(1.2)

def etat(page, titre):
    d = page.evaluate("() => ({code: window.jeu.etat.editeur.lire(), postes: window.jeu.etat.plateau.postes.map(p => p.type + '@' + p.x + ',' + p.z), bandeau: document.getElementById('bandeau-code').textContent})")
    print(f"--- {titre}\n{d['code']}postes ({len(d['postes'])}) : {d['postes']}\nbandeau : {d['bandeau'][:160]}")
    return d

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(channel="chrome", args=c.CHROME)
        page = nav.new_page(viewport={"width": 1366, "height": 768})
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.goto(f"http://127.0.0.1:{c.PORT}/atelier.html?formateur=1#mission={MISSION}")
        page.evaluate("localStorage.clear()"); page.reload()
        page.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
        page.wait_for_timeout(1500)
        etat(page, "départ")
        # 1. supprimer la ligne return au clavier, dans l'éditeur
        ed = page.locator(".cm-content")
        ligne = page.locator(".cm-line", has_text="return total")
        ligne.click(); page.keyboard.press("End"); page.keyboard.press("Shift+Home")
        page.keyboard.press("Backspace"); page.keyboard.press("Backspace")
        page.wait_for_timeout(2000)
        etat(page, "return supprimé au clavier")
        # 2. le retaper
        page.keyboard.press("End"); page.keyboard.press("Enter")
        page.keyboard.type("return total", delay=60)
        page.wait_for_timeout(2500)
        etat(page, "return retapé")
        page.click("#bouton-lancer"); page.wait_for_timeout(3000)
        print("légende :", page.locator("#legende").text_content()[:200])
        # 3. remettre le return dans la fonction (4 espaces), puis poser un if depuis la barre : il doit aller avant le return
        # avant de corriger : un clic dans le hall ne doit rien changer
        avant = page.evaluate("() => window.jeu.etat.editeur.lire()")
        page.evaluate("() => { window.jeu.etat.choix = { piece: 'si' }; }")
        box = page.locator("#vue canvas").first.bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.6, box["y"] + box["height"] * 0.6)
        page.wait_for_timeout(800)
        print("code inchangé après clic dans le hall :", avant == page.evaluate("() => window.jeu.etat.editeur.lire()"), "|", page.locator("#legende").text_content()[:120])
        page.evaluate("() => { window.jeu.etat.choix = {}; }")
        page.locator(".cm-line", has_text="return total").click(); page.keyboard.press("Home"); page.keyboard.type("    ")
        page.wait_for_timeout(2000)
        etat(page, "return réindenté")
        page.evaluate("""() => { const j = window.jeu, pl = j.etat.plateau; const [x, z] = pl.premiereLibre([8, 5]);
                       const r = pl.poser("si", x, z, null); j.apresChangementHall(); return r; }""")
        page.wait_for_timeout(1500)
        etat(page, "if posé à la fin depuis la barre")
        # 4. code après return tapé à la main
        page.evaluate("(t) => window.jeu.etat.editeur.ecrire(t)", "def prix_futs(type_client, nb_futs, prix_fut):\n    total = nb_futs * prix_fut\n    return total\n    total = 0\n")
        page.wait_for_timeout(2000)
        etat(page, "ligne après return")
        print("erreurs JS :", erreurs)
        nav.close()
finally:
    srv.terminate()
