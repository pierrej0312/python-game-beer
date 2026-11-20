"""Essai du prototype de l'usine : construire à la souris (API de la page), régler une machine, mettre en marche, captures."""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, "qa")
_argv = sys.argv; sys.argv = [sys.argv[0]]
import controle as c
sys.argv = _argv

SORTIE = Path("qa/captures-usine"); SORTIE.mkdir(exist_ok=True)
srv = subprocess.Popen([sys.executable, "qa/serveur.py", str(c.PORT)], stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(channel="chrome", args=c.CHROME)
        page = nav.new_page(viewport={"width": 1366, "height": 768})
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.on("console", lambda m: erreurs.append(m.text) if m.type == "error" else None)
        page.goto(f"http://127.0.0.1:{c.PORT}/usine.html?formateur=1#mission=4.4-file-commandes")
        page.evaluate("localStorage.clear()"); page.reload()
        page.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
        page.wait_for_timeout(1500)
        page.screenshot(path=SORTIE / "01-depart.png")
        # poser un rayonnage par la première fente, puis le régler
        page.keyboard.press("1")
        page.evaluate("() => window.usine.poser(window.usine.etat.disposition.fentes[0], 'creer_liste')")
        page.wait_for_timeout(1200)
        page.screenshot(path=SORTIE / "02-pose.png")
        page.fill("#champ-ligne", 'commandes = ["Café du Pont", "Cave aux Bulles", "Marie Dumont", "Taverne Saint-Jean"]')
        page.press("#champ-ligne", "Enter")
        page.wait_for_timeout(1200)
        for gabarit, texte in [("ajouter", 'commandes.append("Lucas Bertrand")'), ("retirer", 'commandes.remove("Marie Dumont")'),
                               ("tranche", "camion = commandes[0:2]"), ("afficher", "print(camion)"), ("afficher", "print(len(commandes))")]:
            page.evaluate("(g) => { const f = window.usine.etat.disposition.fentes; return window.usine.poser(f[f.length - 1], g); }", gabarit)
            page.wait_for_timeout(900)
            page.fill("#champ-ligne", texte); page.press("#champ-ligne", "Enter")
            page.wait_for_timeout(900)
        print(page.evaluate("() => window.usine.etat.editeur.lire()"))
        page.screenshot(path=SORTIE / "03-construit.png")
        page.click("#bouton-lancer")
        page.wait_for_timeout(2600)
        page.screenshot(path=SORTIE / "04-en-marche.png")
        page.wait_for_timeout(5000)
        page.screenshot(path=SORTIE / "05-fin.png")
        print("légende :", page.locator("#legende").text_content())
        print("tests :", page.locator("#resume-tests").text_content())
        # une mission à fonction avec boucle : 5.1
        page.goto(f"http://127.0.0.1:{c.PORT}/usine.html?formateur=1#mission=5.1-tournee"); page.wait_for_timeout(1500)
        page.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
        page.wait_for_timeout(1500)
        page.evaluate("(t) => window.usine.ecrireCode(t, { cadrer: true })",
                      'def feuille_de_route(arrets):\n    """Renvoie la liste des lignes de la feuille de route."""\n    lignes = []\n    for numero, arret in enumerate(arrets, start=1):\n        if numero > 0:\n            lignes.append(f"Arrêt {numero} : {arret}")\n    return lignes\n')
        page.wait_for_timeout(1500)
        page.screenshot(path=SORTIE / "06-fonction.png")
        page.click("#bouton-lancer"); page.wait_for_timeout(4000)
        page.screenshot(path=SORTIE / "07-fonction-marche.png")
        page.wait_for_timeout(9000)
        print("légende 5.1 :", page.locator("#legende").text_content())
        print("erreurs JS :", erreurs)
        nav.close()
finally:
    srv.terminate()
