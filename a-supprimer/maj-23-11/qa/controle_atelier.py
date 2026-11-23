"""Contrôle automatique de l'ancien atelier de construction (missions des séries 3 à 6 ; l'usine l'a remplacé sur la carte, il reste ouvert depuis l'usine).

Usage : python qa/controle_atelier.py
Vérifie dans Chrome : solution à 3 étoiles, variantes fausses, construction à la souris par la barre et la bulle,
code -> hall (analyse), hall -> code, erreur IndexError expliquée, interface sans débordement ; captures dans qa/captures/v1/atelier-*.png.
"""
import json, pathlib, subprocess, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
_argv = sys.argv; sys.argv = [sys.argv[0]]
import controle as c
sys.argv = _argv

RACINE = c.RACINE
BASE = f"http://127.0.0.1:{c.PORT}"
CAPTURES = RACINE / "qa" / "captures" / "v1"
MISSION = "4.4-file-commandes"
noter = c.noter


def page_atelier(nav, largeur=1366, hauteur=768):
    ctx = nav.new_context(viewport={"width": largeur, "height": hauteur})
    page = ctx.new_page()
    page.on("console", lambda m: c.console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: c.console.append(str(e)))
    page.goto(f"{BASE}/atelier.html?formateur=1#mission={MISSION}")
    page.evaluate("localStorage.clear()"); page.reload()
    page.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
    return page


def ecrire_code(page, code):
    page.evaluate("(t) => window.jeu.etat.editeur.ecrire(t)", code)
    page.wait_for_function("(t) => window.jeu.etat.plateau.postes.length > 0 || !t.trim()", arg=code, timeout=10000)
    page.wait_for_timeout(900)


def lancer(page):
    page.evaluate("() => { window.jeu.etat.scene.vitesse = 6; }")
    page.click("#bouton-lancer")
    page.wait_for_function("window.jeu.etat.etapes.length > 0 && !window.jeu.etat.enCours && window.jeu.etat.curseur >= window.jeu.etat.etapes.length", timeout=60000)
    page.wait_for_timeout(300)
    return page.evaluate("() => ({ etoiles: window.jeu.etat.etoiles, erreur: window.jeu.etat.resultat.erreur, legende: document.getElementById('legende').textContent, bilan: document.querySelectorAll('.bilan-carte').length, "
                         "erreursCas: (window.jeu.etat.resultat.cas || []).map(c => c.erreur && c.erreur.type).filter(Boolean) })")


def case(page, x, z):
    return page.evaluate("([x, z]) => { const v = document.getElementById('vue').getBoundingClientRect(), p = window.jeu.etat.scene.projeter(x, z, 0); return [v.left + p.x, v.top + p.y]; }", [x, z])


def main():
    global MISSION
    S = "atelier"
    CAPTURES.mkdir(parents=True, exist_ok=True)
    sol = json.loads((RACINE / "solutions-atelier" / f"{MISSION}.json").read_text(encoding="utf-8"))
    serveur = subprocess.Popen([sys.executable, str(RACINE / "qa/serveur.py"), str(c.PORT)], stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    try:
        with c.sync_playwright() as p:
            nav = p.chromium.launch(channel="chrome", args=c.CHROME)
            page = page_atelier(nav)
            # code -> hall, puis lancer
            ecrire_code(page, sol["solution"])
            postes = page.evaluate("window.jeu.etat.plateau.postes.map(p => p.type)")
            noter(S, f"code écrit -> hall : 7 postes, aucun « code libre » ({postes})", len(postes) == 7 and "code_libre" not in postes, postes)
            r = lancer(page)
            noter(S, "solution de référence : 3 étoiles et bilan affiché", r["etoiles"] == [True, True, True] and r["bilan"] == 1, r)
            page.screenshot(path=str(CAPTURES / "atelier-bilan-1366x768.png"))
            for v in sol["variantes"]:
                ecrire_code(page, sol["solution"].replace(*v["remplacer"]))
                r = lancer(page)
                if "erreur" in v["attendu"]:
                    ok = bool(r["erreur"]) and r["erreur"]["type"] == v["attendu"]["erreur"]
                else:
                    ok = all(a is None or a == b for a, b in zip(v["attendu"]["etoiles"], r["etoiles"] or [None] * 3))
                noter(S, f"variante « {v['nom']} » échoue comme prévu", ok, r)
                if "IndexError" in v["nom"]:
                    noter(S, "IndexError : la légende dit quelle case manque et combien le rayonnage en a", "la case 4 n'existe pas" in r["legende"] and "4 cases" in r["legende"], r["legende"], "visible")
                    page.screenshot(path=str(CAPTURES / "atelier-erreur-1366x768.png"))
            page.context.close()

            # construction à la souris : barre, sous-menu, bulle
            page = page_atelier(nav)
            boutons = page.locator("#barre-outils .icone-outil")
            boutons.nth(4).hover(); page.wait_for_timeout(250)
            info = page.inner_text("#info-bulle")
            noter(S, "infobulle de la barre : nom, nom Python, catégorie", "Liste" in info and "list" in info and "Type de données" in info, info, "visible")
            boutons.nth(4).click(); page.wait_for_timeout(250)
            gris = page.locator(".sous-menu .icone-outil[aria-disabled='true']").count()
            noter(S, "sous-menu Liste : les méthodes restent grisées tant qu'aucun rayonnage n'est posé", gris >= 8, gris, "visible")
            page.locator(".sous-menu .icone-outil").nth(6).hover(); page.wait_for_timeout(250)
            page.screenshot(path=str(CAPTURES / "atelier-barre-1366x768.png"))
            page.locator(".sous-menu .icone-outil").nth(0).click()
            page.mouse.click(*case(page, 2, 3)); page.wait_for_timeout(300)
            page.fill(".bulle input[type=text]", "commandes")
            for i, val in enumerate(["Café du Pont", "Cave aux Bulles", "Marie Dumont", "Taverne Saint-Jean"]):
                page.click(".bulle .bouton.discret"); page.locator(".bulle .element input").nth(i).fill(val)
            apercu = page.inner_text(".bulle .apercu")
            page.screenshot(path=str(CAPTURES / "atelier-bulle-1366x768.png"))
            page.keyboard.press("Enter"); page.wait_for_timeout(900)
            boutons.nth(4).click(); page.locator(".sous-menu .icone-outil").nth(6).click()
            page.mouse.click(*case(page, 4, 3)); page.wait_for_timeout(300)
            page.locator(".bulle .element input").fill("Lucas Bertrand"); page.keyboard.press("Enter"); page.wait_for_timeout(900)
            code = page.evaluate("window.jeu.etat.editeur.lire()")
            attendu = 'commandes = ["Café du Pont", "Cave aux Bulles", "Marie Dumont", "Taverne Saint-Jean"]\ncommandes.append("Lucas Bertrand")\n'
            noter(S, "hall -> code : un rayonnage et un append posés à la souris écrivent les deux lignes attendues", code == attendu and apercu.startswith("commandes = ["), [code, apercu])
            # le nom invalide est refusé dans la bulle
            boutons.nth(4).click(); page.locator(".sous-menu .icone-outil").nth(0).click()
            page.mouse.click(*case(page, 6, 3)); page.wait_for_timeout(300)
            page.fill(".bulle input[type=text]", "Mes Commandes")
            msg, desactive = page.inner_text(".bulle .message-erreur"), page.is_disabled(".bulle .bouton.principal")
            noter(S, "bulle : un nom de variable invalide est expliqué et bloque la validation", "nom de variable valide" in msg and desactive, msg, "visible")
            page.keyboard.press("Escape"); page.wait_for_timeout(300)
            n = page.evaluate("window.jeu.etat.plateau.postes.length")
            noter(S, "Échap dans la bulle d'un poste neuf : le poste n'est pas posé", n == 2, n)
            # données contre le mur : aperçu après construction
            page.wait_for_timeout(800)
            ap = page.evaluate("window.jeu.etat.apercu.commandes && window.jeu.etat.apercu.commandes.n")
            noter(S, "aperçu : le rayonnage commandes apparaît contre le mur avec ses 5 cases", ap == 5, ap)
            page.screenshot(path=str(CAPTURES / "atelier-construit-1366x768.png"))
            # un clic sur un poste (outil Choisir) rouvre sa bulle, remplie ; on change une case et le nom
            page.mouse.click(*case(page, 2, 3)); page.wait_for_timeout(400)
            nom = page.input_value(".bulle input[type=text]")
            cases = page.locator(".bulle .element input").count()
            noter(S, "clic sur un poste posé : la bulle s'ouvre avec le nom et les cases déjà remplis", nom == "commandes" and cases == 4, [nom, cases])
            page.locator(".bulle .element input").nth(2).fill("Marie Durand")
            page.fill(".bulle input[type=text]", "file")
            page.click(".bulle .actions .bouton.principal"); page.wait_for_timeout(900)
            code = page.evaluate("window.jeu.etat.editeur.lire()")
            noter(S, "bulle enregistrée : la case et le nom changent dans le code, l'append suivant utilise le nouveau nom",
                  '"Marie Durand"' in code and code.startswith("file = [") and "file.append(" in code, code)
            # un clic sur la donnée contre le mur ouvre la bulle du poste qui la crée
            page.wait_for_timeout(600)
            page.mouse.click(*case(page, 2, 0)); page.wait_for_timeout(400)
            ouverte = page.locator(".bulle").count() and page.input_value(".bulle input[type=text]")
            noter(S, "clic sur le rayonnage contre le mur : la bulle du poste qui le crée s'ouvre", ouverte == "file", ouverte)
            page.keyboard.press("Escape"); page.wait_for_timeout(200)
            # outil Tapis : du début du programme au poste 2 -> le poste 2 passe en premier
            boutons.nth(1).click()
            page.mouse.move(*case(page, 0, 3)); page.mouse.down()
            for x, z in [(0, 4), (1, 4), (2, 4), (3, 4), (4, 4), (4, 3)]:
                page.mouse.move(*case(page, x, z), steps=3); page.wait_for_timeout(40)
            page.mouse.up(); page.wait_for_timeout(900)
            code = page.evaluate("window.jeu.etat.editeur.lire()")
            manuels = page.evaluate("window.jeu.etat.plateau.tapis().filter(t => t.manuel).length")
            noter(S, "outil Tapis : un tapis tracé du début au poste 2 le fait passer en premier dans le code", code.startswith("file.append(") and manuels == 1, [code, manuels])
            page.screenshot(path=str(CAPTURES / "atelier-tapis-1366x768.png"))
            # marteau : sur le tapis tracé, il redevient automatique ; sur un poste, le poste disparaît
            boutons.nth(2).click()
            page.mouse.click(*case(page, 2, 4)); page.wait_for_timeout(400)
            manuels = page.evaluate("window.jeu.etat.plateau.tapis().filter(t => t.manuel).length")
            page.mouse.click(*case(page, 4, 3)); page.wait_for_timeout(900)
            code = page.evaluate("window.jeu.etat.editeur.lire()")
            noter(S, "marteau : le tapis tracé redevient automatique, puis le poste frappé disparaît du code", manuels == 0 and "append" not in code and code.startswith("file = ["), [manuels, code])
            d = page.evaluate(c.JS_INTERFACE)
            noter(S, "interface sans texte coupé ni débordement (1366 × 768)", not d, d, "visible")
            page.context.close()
            # ---- missions à fonction : solutions, variantes, construction des blocs à la souris ----

            index = json.loads((RACINE / "site" / "atelier" / "missions" / "index.json").read_text(encoding="utf-8"))["missions"]
            for fiche in index:
                mid = fiche["id"]
                # l'ancien atelier couvre les séries 3 à 6 ; les séries 7 et 8 (modules, fichiers) se jouent dans l'usine
                if mid == "4.4-file-commandes" or fiche["serie"] > 6:
                    continue
                MISSION = mid
                solf = json.loads((RACINE / "solutions-atelier" / f"{mid}.json").read_text(encoding="utf-8"))
                mission = json.loads((RACINE / "site" / "atelier" / "missions" / mid / "mission.json").read_text(encoding="utf-8"))
                page = page_atelier(nav)
                depart = page.evaluate("window.jeu.etat.editeur.lire()")
                noter(S, f"{mid} : l'éditeur s'ouvre sur le code de départ de la mission", depart == mission["depart"], depart)
                ecrire_code(page, solf["solution"])
                libres = page.evaluate("window.jeu.etat.plateau.postes.filter(p => p.type === 'code_libre').length")
                r = lancer(page)
                noter(S, f"{mid} : la fonction de référence devient des postes (aucun code libre) et passe tous les cas (3 étoiles)", r["etoiles"] == [True, True, True] and libres == 0, [libres, r])
                for v in solf["variantes"]:
                    ecrire_code(page, solf["solution"].replace(*v["remplacer"]))
                    r = lancer(page)
                    if "erreurCas" in v["attendu"]:
                        ok = v["attendu"]["erreurCas"] in r["erreursCas"]
                    else:
                        ok = all(a is None or a == b for a, b in zip(v["attendu"]["etoiles"], r["etoiles"] or [None] * 3))
                    noter(S, f"{mid} : variante « {v['nom']} » échoue comme prévu, la légende nomme le cas rejoué", ok and ("Cas" in r["legende"] or mission["fonction"]["nom"] in r["legende"]), r)
                if mid in ("6.1-stock", "6.3-futs-par-quai"):
                    page.screenshot(path=str(CAPTURES / f"atelier-{mid}-1366x768.png"))
                page.context.close()

            def fonction_vide(mid):
                global MISSION
                MISSION = mid
                pg = page_atelier(nav)
                return pg, pg.locator("#barre-outils .icone-outil")

            def outil(pg, b, groupe, rang):
                pg.locator(f"#barre-outils .icone-outil[data-categorie={groupe}]").click(); pg.wait_for_timeout(150)
                pg.locator(".sous-menu .icone-outil").nth(rang).click(); pg.wait_for_timeout(150)

            def emplacement(pg, rang=0):
                e = pg.evaluate("window.jeu.etat.emplacements")[rang]
                return case(pg, e["x"], e["z"])

            def bulle_texte(pg, rang, valeur):
                pg.locator(".bulle input[type=text]").nth(rang).fill(valeur)

            # while construit à la souris (mission 5.2 refaite le 20/11/2026 : le chariot se charge tant que la commande suivante tient)
            pg, b = fonction_vide("5.2-chargement")
            pg.evaluate("(t) => window.jeu.etat.editeur.ecrire(t)",
                        'def charger_chariot(commandes):\n    """Renvoie le nombre de commandes chargées dans le chariot de 6 casiers, dans l\'ordre de la file."""\n    pass\n')
            pg.wait_for_timeout(1200)
            outil(pg, b, "variable", 0); pg.mouse.click(*case(pg, 2, 3)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "chargees"); pg.select_option(".bulle .element select", "nombre"); pg.locator(".bulle .element input").fill("0"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
            outil(pg, b, "variable", 0); pg.mouse.click(*case(pg, 3, 3)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "place"); pg.select_option(".bulle .element select", "nombre"); pg.locator(".bulle .element input").fill("6"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
            outil(pg, b, "boucle", 1); pg.mouse.click(*case(pg, 5, 3)); pg.wait_for_timeout(250)
            pg.fill(".bulle .condition input.code", "chargees < len(commandes) and commandes[chargees] <= place"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "variable", 1); pg.mouse.click(*emplacement(pg)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "place"); pg.select_option(".bulle select", "-="); bulle_texte(pg, 1, "commandes[chargees]"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "variable", 1); pg.mouse.click(*emplacement(pg)); pg.wait_for_timeout(250)
            pg.screenshot(path=str(CAPTURES / "atelier-emplacement-1366x768.png"))
            bulle_texte(pg, 0, "chargees"); pg.select_option(".bulle select", "+="); bulle_texte(pg, 1, "1"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "sortie", 1); pg.mouse.click(*case(pg, 9, 3)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "chargees"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(900)
            code = pg.evaluate("window.jeu.etat.editeur.lire()")
            attendu = json.loads((RACINE / "solutions-atelier" / "5.2-chargement.json").read_text(encoding="utf-8"))["solution"]
            noter(S, "while construit à la souris (deux bacs, détecteur à deux conditions, deux calculs dans l'anneau, expédition) : le code est la solution", code == attendu, code)
            r = lancer(pg)
            noter(S, "while construit à la souris : 3 étoiles", r["etoiles"] == [True, True, True], r)
            pg.screenshot(path=str(CAPTURES / "atelier-while-1366x768.png"))
            pg.context.close()

            # if, elif, else construits à la souris
            pg, b = fonction_vide("3.4-remise-magasin")
            outil(pg, b, "condition", 0); pg.mouse.click(*case(pg, 2, 3)); pg.wait_for_timeout(250)
            pg.fill(".bulle .condition input.code", "nb_casiers >= 10"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "sortie", 1); pg.mouse.click(*emplacement(pg)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "5"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "condition", 1); pg.mouse.click(*case(pg, 2, 3)); pg.wait_for_timeout(300)
            pg.locator(".bulle .condition input.code").nth(1).fill("nb_casiers >= 5"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "sortie", 1); pg.mouse.click(*emplacement(pg, 1)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "2"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(500)
            outil(pg, b, "condition", 2); pg.mouse.click(*case(pg, 2, 3)); pg.wait_for_timeout(500)
            outil(pg, b, "sortie", 1); pg.mouse.click(*emplacement(pg, 2)); pg.wait_for_timeout(250)
            bulle_texte(pg, 0, "0"); pg.click(".bulle .actions .bouton.principal"); pg.wait_for_timeout(900)
            code = pg.evaluate("window.jeu.etat.editeur.lire()")
            attendu = json.loads((RACINE / "solutions-atelier" / "3.4-remise-magasin.json").read_text(encoding="utf-8"))["solution"]
            noter(S, "if, elif, else construits à la souris (outils elif et else sur le if posé, emplacements des voies) : le code est la solution", code == attendu, code)
            r = lancer(pg)
            noter(S, "if / elif / else construits à la souris : 3 étoiles", r["etoiles"] == [True, True, True], r)
            # un autre cas rejoué depuis le menu
            pg.select_option("#choix-cas", "2"); pg.wait_for_timeout(200)
            pg.wait_for_function("window.jeu.etat.etapes.length > 0 && !window.jeu.etat.enCours && window.jeu.etat.curseur >= window.jeu.etat.etapes.length", timeout=30000)
            leg = pg.inner_text("#legende"); fin = pg.evaluate("window.jeu.etat.casCourant")
            noter(S, "menu des cas : le cas 3 (12 casiers) est rejoué", fin == 2, [fin, leg])
            pg.screenshot(path=str(CAPTURES / "atelier-if-elif-1366x768.png"))
            # annuler / rétablir : le hall et le code reviennent ensemble
            pg.evaluate("document.activeElement && document.activeElement.blur()")
            pg.keyboard.press("Control+z"); pg.wait_for_timeout(1200)
            avant = pg.evaluate("window.jeu.etat.editeur.lire()"); n_avant = pg.evaluate("window.jeu.etat.plateau.postes.length")
            pg.keyboard.press("Control+y"); pg.wait_for_timeout(1200)
            apres = pg.evaluate("window.jeu.etat.editeur.lire()")
            noter(S, "Ctrl+Z retire le dernier poste posé (hall et code), Ctrl+Y le remet", avant != attendu and "return 0" not in avant and n_avant == 3 and apres == attendu, [n_avant, avant, apres])
            d = pg.evaluate(c.JS_INTERFACE)
            noter(S, "mission à fonction : interface sans texte coupé ni débordement (1366 × 768)", not d, d, "visible")
            pg.context.close()

            # ---- sans 3D : le hall en cases, les données en texte, le journal du rejeu ----
            ctx = nav.new_context(viewport={"width": 1366, "height": 768}); pg = ctx.new_page()
            pg.on("pageerror", lambda e: c.console.append(str(e)))
            pg.goto(f"{BASE}/atelier.html?formateur=1#mission=6.3-futs-par-quai")
            pg.evaluate("localStorage.setItem('jeux-python.progression.v1', JSON.stringify({ sans3d: true }))"); pg.reload()
            pg.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
            sol63 = json.loads((RACINE / "solutions-atelier" / "6.3-futs-par-quai.json").read_text(encoding="utf-8"))["solution"]
            ecrire_code(pg, sol63); pg.click("#bouton-vitesse")
            r = lancer(pg)
            infos = pg.evaluate("() => ({ postes: document.querySelectorAll('.case2d.piece2d').length, attendus: window.jeu.etat.plateau.postes.length, journal: document.querySelectorAll('.journal2d li').length, "
                                "donnees: [...document.querySelectorAll('.donnee2d')].map(b => b.textContent), canvas: document.querySelectorAll('#vue canvas').length, mode: document.getElementById('bouton-mode').textContent, vitesse: window.jeu.etat.scene.vitesse })")
            noter(S, "sans 3D : un poste par case, le journal du rejeu, les données en texte, pas de 3D, 3 étoiles", r["etoiles"] == [True, True, True] and infos["postes"] == infos["attendus"] == 4
                  and infos["journal"] > 5 and any("par_quai" in d for d in infos["donnees"]) and infos["canvas"] == 0 and infos["mode"] == "Sans 3D", [r["etoiles"], infos])
            noter(S, "bouton Rejeu rapide : le rejeu va plus vite", infos["vitesse"] > 1, infos["vitesse"])
            pg.screenshot(path=str(CAPTURES / "atelier-sans3d-1366x768.png"))
            d = pg.evaluate(c.JS_INTERFACE)
            noter(S, "sans 3D : interface sans texte coupé ni débordement (1366 × 768)", not d, d, "visible")
            pg.locator(".case2d.piece2d").first.click(); pg.wait_for_timeout(300)
            noter(S, "sans 3D : un clic sur un poste ouvre sa bulle", pg.locator(".bulle").count() == 1)
            ctx.close()

            # ---- la carte des missions ouvre l'usine (depuis le 20/11/2026) ; l'ancien atelier : progression commune, mission suivante ----
            ctx = nav.new_context(viewport={"width": 1366, "height": 768}); pg = ctx.new_page()
            pg.on("pageerror", lambda e: c.console.append(str(e)))
            pg.goto(f"{BASE}/missions.html"); pg.evaluate("localStorage.clear()"); pg.goto(f"{BASE}/missions.html?formateur=1")
            pg.wait_for_selector(".carte-mission.atelier")
            nb = pg.locator(".carte-mission.atelier").count()
            pg.locator(".carte-mission.atelier").first.click()
            pg.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
            noter(S, f"carte : les {nb} missions des séries 3 à 8 ouvrent l'usine (3.1 d'abord)", nb == 23 and "usine.html?formateur=1#mission=3.1-quai" in pg.url, [nb, pg.url])
            pg.goto("about:blank"); pg.goto(f"{BASE}/atelier.html?formateur=1#mission=3.1-quai")
            pg.wait_for_function("document.getElementById('etat-python').textContent.includes('prêt')", timeout=90000)
            sol31 = json.loads((RACINE / "solutions-atelier" / "3.1-quai.json").read_text(encoding="utf-8"))["solution"]
            ecrire_code(pg, sol31); r = lancer(pg)
            lien = pg.get_attribute(".bilan-actions a.principal", "href")
            noter(S, "bilan de 3.1 : 3 étoiles et « Mission suivante » vers 3.2 dans l'atelier", r["etoiles"] == [True, True, True] and lien and lien.endswith("#mission=3.2-tarif"), [r["etoiles"], lien])
            pg.click(".bilan-actions a.principal"); pg.wait_for_function("window.jeu && window.jeu.etat.mission && window.jeu.etat.mission.id === '3.2-tarif'", timeout=30000)
            noter(S, "« Mission suivante » charge la mission 3.2", True)
            pg.click("#bouton-carte"); pg.wait_for_selector(".carte-mission.atelier")
            etoiles = pg.locator(".carte-mission.atelier").first.locator(".etoile.gagnee").count()
            noter(S, "retour à la carte : la mission 3.1 montre ses 3 étoiles (progression commune)", etoiles == 3, etoiles)
            pg.goto(f"{BASE}/index.html"); jeu2 = pg.locator("a[href*='ligne.html']").count()     # l'ancien jeu 2 ; « ligne de production » décrit maintenant l'usine
            noter(S, "accueil : un seul bouton, plus de lien vers la ligne de production", jeu2 == 0 and pg.locator(".accueil-actions button").count() == 1, jeu2)
            pg.goto(f"{BASE}/atelier.html#mission=6.1-stock"); pg.wait_for_url("**/missions.html*", timeout=10000)
            noter(S, "une mission d'une série fermée renvoie à la carte", "missions.html" in pg.url, pg.url)
            ctx.close()
            nav.close()

        erreurs = [m for m in c.console if "GL Driver Message" not in m]
        noter(S, f"aucune erreur JavaScript ({len(erreurs)} relevée(s))", not erreurs, erreurs[:10])
    finally:
        serveur.terminate()
    echecs = [r for r in c.resultats if not r["ok"]]
    print(f"\n{len(c.resultats) - len(echecs)} contrôles réussis sur {len(c.resultats)} ; {len(echecs)} en échec")
    for r in echecs: print(" -", r["nom"], "|", str(r["detail"])[:300])
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
