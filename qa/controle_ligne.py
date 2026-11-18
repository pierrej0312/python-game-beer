"""Contrôle qualité automatique du jeu 2 « la ligne de production » (08-controle-qualite-automatique.md).

Usage : python qa/controle_ligne.py [--section fonctionnement|rendu] [--resolution 1366x768] [--version v1]
Les contrôles des textes et de la livraison sont communs aux deux jeux : python qa/controle.py --section statique.
Résultats bruts : qa/rapports/brut/<version>-ligne-<section>.json ; captures : qa/captures/<version>/ligne-*.png
"""
import datetime, json, pathlib, subprocess, sys, time, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
_argv = sys.argv; sys.argv = [sys.argv[0]]
import controle as c          # fonctions communes : pages, mesures d'images, contrôle de l'interface
sys.argv = _argv

RACINE = c.RACINE
SITE = RACINE / "site"
VERSION = sys.argv[sys.argv.index("--version") + 1] if "--version" in sys.argv else "v1"
CAPTURES = RACINE / "qa" / "captures" / VERSION
BASE = f"http://127.0.0.1:{c.PORT}"
VITESSE = 30                    # rejeu accéléré pendant le contrôle
NIVEAUX = [f"ligne-{i}" for i in range(1, 7)]

resultats = c.resultats
noter = c.noter


def solution(ident):
    return json.loads((RACINE / "solutions-ligne" / f"{ident}.json").read_text(encoding="utf-8"))


def appliquer(base, v):
    g = json.loads(json.dumps(base))
    if v.get("retirer"):
        g["pieces"] = [p for p in g["pieces"] if p["id"] not in v["retirer"]]
        g["tapis"] = [t for t in g["tapis"] if t["de"] not in v["retirer"] and t["vers"] not in v["retirer"]]
    if v.get("retirerTapis"):
        g["tapis"] = [t for t in g["tapis"] if t["id"] not in v["retirerTapis"]]
    g["pieces"] += v.get("pieces", []); g["tapis"] += v.get("tapis", [])
    for pid, params in v.get("regler", {}).items():
        next(p for p in g["pieces"] if p["id"] == pid)["params"].update(params)
    if v.get("inverser"):
        a, b = [next(p for p in g["pieces"] if p["id"] == i) for i in v["inverser"]]
        a["type"], b["type"] = b["type"], a["type"]; a["params"], b["params"] = b["params"], a["params"]
    if v.get("machine"):
        g["machine"] = v["machine"]
    return g


def page_ligne(nav, sans3d=False, qualite="basse", largeur=1366, hauteur=768, missions=None, pseudo="Controle"):
    return c.nouvelle_page(nav, largeur, hauteur, progression={"pseudo": pseudo, "qualite": qualite, "sans3d": sans3d, "son": False, "missions": missions or {}})


def ouvrir(page, ident, formateur=True):
    url = f"{BASE}/ligne.html" + ("?formateur=1" if formateur else "") + f"#niveau={ident}"
    if "ligne.html" in page.url and (("formateur" in page.url) == formateur):
        page.evaluate("(id) => { location.hash = 'niveau=' + id; }", ident)
    else:
        page.goto(url)
    page.wait_for_function("(id) => window.jeu && window.jeu.etat.niveau && window.jeu.etat.niveau.id === id && window.jeu.etat.vue && !document.getElementById('vue-niveau').hidden", arg=ident, timeout=60000)
    page.wait_for_function("document.getElementById('etat-python').classList.contains('pret') || window.jeu.pilote.version", timeout=120000)
    page.evaluate("() => { if (window.jeu.etat.vue) window.jeu.etat.vue.surLenteur = null; document.querySelector('.avis')?.remove(); }")


def poser_graphe(page, graphe):
    page.evaluate("(g) => { const e = window.jeu.etat; e.plateau = new window.jeu.Plateau(e.niveau, g); e.selection = null; window.jeu.majTout(); }", graphe)


def lancer(page, attendre_fin=True):
    page.evaluate("() => { const e = window.jeu.etat; e.resultat = null; e.rejeuTermine = false; e.rapide = true; }")
    page.evaluate("(v) => { window.jeu.etat.vue.vitesse = v; }", VITESSE)
    page.click("#bouton-lancer")
    page.wait_for_timeout(300)
    refus = page.evaluate("window.jeu.etat.resultat === null && window.jeu.etat.problemes.some(p => p.bloquant) && !window.jeu.etat.occupe")
    if refus:
        return {"problemes": page.evaluate("window.jeu.etat.problemes.filter(p => p.bloquant).map(p => p.message)")}
    page.wait_for_function("window.jeu.etat.resultat !== null", timeout=120000)
    if attendre_fin:
        page.wait_for_function("window.jeu.etat.rejeuTermine === true", timeout=300000)
    return page.evaluate("""() => { const e = window.jeu.etat; return { etoiles: e.etoilesDernieres, erreur: e.resultat.erreur, etapes: e.etapes.length,
        chutes: e.etapes.filter(x => x.type === "chute").length, remarques: e.problemes.filter(p => !p.bloquant).map(p => p.message),
        tests: e.resultat.tests.map(t => [t.groupe, t.ok]), bilan: document.querySelectorAll('.bilan-carte').length }; }""")


# ---------------------------------------------------------------- fonctionnement
def controle_fonctionnement(nav):
    S = "ligne-fonctionnement"
    for sans3d in (False, True):
        mode = "sans 3D" if sans3d else "3D"
        page = page_ligne(nav, sans3d=sans3d)
        for ident in NIVEAUX:
            ouvrir(page, ident)
            depart = lancer(page)
            noter(S, f"{ident}, {mode} : le plateau de départ ne réussit pas (refusé ou sans étoile 1)", depart.get("problemes") or not depart["etoiles"][0], depart)
            sol = solution(ident)
            poser_graphe(page, sol["solution"])
            r = lancer(page)
            noter(S, f"{ident}, {mode} : la solution de référence obtient 3 étoiles ({r.get('etapes')} étapes rejouées, bilan affiché)", r.get("etoiles") == [True, True, True] and not r.get("erreur") and r.get("bilan") == 1, r)
            if not sans3d:
                for v in sol["variantes"]:
                    poser_graphe(page, appliquer(sol["solution"], v))
                    r = lancer(page)
                    if v["attendu"].get("erreur"):
                        ok = bool(r.get("erreur")) and page.evaluate("document.getElementById('legende').classList.contains('echec')")
                    else:
                        ok = all(a is None or a == b for a, b in zip(v["attendu"]["etoiles"], r.get("etoiles") or [None] * 3))
                    noter(S, f"{ident} : variante « {v['nom']} » échoue comme prévu", ok, r)
        page.context.close()

    # validation du plateau : messages en clair
    page = page_ligne(nav)
    ouvrir(page, "ligne-3")
    g = solution("ligne-3")["solution"]; g2 = appliquer(g, {"retirer": []}); g2["tapis"] = [t for t in g2["tapis"] if not (t["de"] == "cq" and t["sortie"] == "oui")]
    poser_graphe(page, g2); r = lancer(page)
    noter(S, "contrôle qualité sans tapis sur « oui » : la ligne démarre, les 4 bouteilles mal remplies tombent dans la trappe, une remarque le dit",
          r.get("chutes") == 4 and any("trappe" in m for m in r.get("remarques", [])) and not r.get("problemes"), r)
    g3 = solution("ligne-3")["solution"]; g3["tapis"] = [t for t in g3["tapis"] if not (t["de"] == "cq" and t["sortie"] == "non")]
    g3["tapis"].append({"id": "ouvert", "de": "cq", "sortie": "non", "vers": None, "ouvert": True, "cases": [[6, 3], [7, 3]]})
    poser_graphe(page, g3); r = lancer(page)
    code = page.evaluate("window.jeu.etat.generation.code")
    noter(S, "tapis ouvert sur « non » : les 12 bonnes bouteilles tombent dans la trappe, le code écrit un else avec un commentaire et pass",
          r.get("chutes") == 12 and "tombe dans la trappe" in code and "pass" in code, r)
    ouvrir(page, "ligne-5")
    g5 = solution("ligne-5")["solution"]; g5["tapis"] = [t for t in g5["tapis"] if t["de"] != "rem"]
    poser_graphe(page, g5); r = lancer(page)
    noter(S, "anneau sans retour au détecteur : la ligne refuse de démarrer et explique l'anneau", any("revenir au détecteur" in m for m in r.get("problemes", [])), r)
    ouvrir(page, "ligne-2")
    g = appliquer(solution("ligne-2")["solution"], {"regler": {"bac": {"nom": "Nb Bouteilles"}}})
    poser_graphe(page, g); r = lancer(page)
    noter(S, "nom de bac invalide : message sur les règles de nommage", any("nom de variable valide" in m for m in r.get("problemes", [])), r)
    ouvrir(page, "ligne-1")
    cycle = {"pieces": [{"id": "a", "type": "remplisseuse", "x": 3, "z": 3, "params": {}}, {"id": "b", "type": "capsuleuse", "x": 3, "z": 5, "params": {}}],
             "tapis": [{"id": "t1", "de": "cuve", "sortie": "suite", "vers": "a", "cases": [[1, 3], [2, 3]]}, {"id": "t2", "de": "a", "sortie": "suite", "vers": "b", "cases": [[3, 4]]},
                       {"id": "t3", "de": "b", "sortie": "suite", "vers": "a", "cases": [[4, 5], [4, 4]]}]}
    poser_graphe(page, cycle); r = lancer(page)
    noter(S, "tapis qui revient en arrière : refusé (« tourneraient sans fin »)", any("sans fin" in m for m in r.get("problemes", [])), r)
    page.context.close()

    # construction à la souris (3D) et au clic (sans 3D)
    for sans3d in (False, True):
        page = page_ligne(nav, sans3d=sans3d)
        ouvrir(page, "ligne-1")
        ecran = (lambda x, z: (lambda b: (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2))(page.locator(f'.case2d[data-x="{x}"][data-z="{z}"]').bounding_box())) if sans3d else \
            (lambda x, z: page.evaluate("""async ([x, z]) => { const THREE = await import("three"); const v = window.jeu.etat.vue, r = v.rendu.domElement.getBoundingClientRect();
                const p = new THREE.Vector3(x - 5.5, 0, z - 3.5).project(v.camera); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; }""", [x, z]))
        def clic(x, z):
            page.mouse.click(*ecran(x, z)); page.wait_for_timeout(60)
        page.click('[data-outil="remplisseuse"]'); clic(3, 3)
        page.click('[data-outil="capsuleuse"]'); clic(7, 3)
        page.click('[data-outil="tapis"]')
        if sans3d:
            for chemin in ([0, 1, 2, 3], [3, 4, 5, 6, 7], [7, 8, 9, 10, 11]):
                for x in chemin: clic(x, 3)
        else:
            for chemin in ([0, 1, 2, 3], [3, 5, 7], [7, 9, 11]):
                page.mouse.move(*ecran(chemin[0], 3)); page.mouse.down()
                for x in chemin[1:]: page.mouse.move(*ecran(x, 3), steps=4); page.wait_for_timeout(40)
                page.mouse.up(); page.wait_for_timeout(80)
        r = lancer(page)
        noter(S, f"niveau 1 construit {'au clic sans 3D' if sans3d else 'à la souris en 3D (tapis glissés, cases sautées comblées)'} : 3 étoiles", r.get("etoiles") == [True, True, True], r)
        # un tapis ouvert : glissé puis relâché sur une case vide (3D), ou deuxième clic sur la dernière case (sans 3D)
        if page.locator(".bilan").count(): page.click(".bilan-actions .bouton:not(.principal)")
        page.click('[data-outil="retirer"]'); clic(9, 3)
        page.click('[data-outil="tapis"]')
        if sans3d:
            clic(7, 3); clic(8, 3); clic(9, 3); clic(9, 3)
        else:
            page.mouse.move(*ecran(7, 3)); page.mouse.down()
            for x in (8, 9): page.mouse.move(*ecran(x, 3), steps=4); page.wait_for_timeout(40)
            page.mouse.up(); page.wait_for_timeout(80)
        ouverts = page.evaluate("window.jeu.etat.plateau.tapis.filter(t => t.ouvert).map(t => t.cases.length)")
        r = lancer(page)
        noter(S, f"tapis ouvert {'au clic sans 3D' if sans3d else 'à la souris en 3D'} : posé, la ligne tourne et les 12 bouteilles tombent dans la trappe", ouverts == [2] and r.get("chutes") == 12, (ouverts, r))
        page.context.close()

    # pas à pas, raccourcis, machine, onglet Pièce
    page = page_ligne(nav)
    ouvrir(page, "ligne-3"); poser_graphe(page, solution("ligne-3")["solution"])
    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("F10")
    page.wait_for_function("window.jeu.etat.etapes.length > 0 && window.jeu.etat.curseur === 1", timeout=60000)
    page.keyboard.press("F10"); page.wait_for_function("window.jeu.etat.curseur === 2", timeout=20000)
    surligne = page.locator(".cm-ligne-rejeu").count()
    noter(S, "F10 : la ligne avance d'une étape et la ligne de code est surlignée", surligne == 1 and "Étape 2 sur" in page.inner_text("#legende"), page.inner_text("#legende"), "visible")
    page.keyboard.press("p"); pause = page.get_attribute("#bouton-pause", "aria-pressed"); page.keyboard.press("p")
    noter(S, "touche P : pause du rejeu", pause == "true", pause, "visible")
    ouvrir(page, "ligne-6")
    page.click(".machine-def"); page.fill("#machine-nom", "2machine"); page.click("#machine-valider")
    msg = page.inner_text("#machine-erreur")
    page.fill("#machine-nom", "conditionner"); page.select_option('#machine-etapes select[data-etape="0"]', "remplir"); page.select_option('#machine-etapes select[data-etape="1"]', "remplir"); page.click("#machine-valider")
    msg2 = page.inner_text("#machine-erreur")
    noter(S, "création de la machine : nom de fonction invalide et étape en double refusés avec un message", "nom de fonction" in msg and "une fois" in msg2, [msg, msg2], "visible")
    page.keyboard.press("Escape")
    page.click('[data-outil="selection"]')
    page.evaluate("() => { const e = window.jeu.etat; e.selection = 'cuve1'; e.onglet = 'piece'; window.jeu.majTout(); }")
    noter(S, "onglet Pièce : la cuve indique son contenu", "10 bouteilles de La Coulée" in page.inner_text("#panneau"), page.inner_text("#panneau")[:120], "visible")
    page.context.close()

    # progression : déblocage, sauvegarde du plateau, envoi
    page = page_ligne(nav, pseudo="Controle")
    page.goto(f"{BASE}/ligne.html"); page.wait_for_selector(".carte-niveau")
    fermes = page.evaluate("[...document.querySelectorAll('.carte-niveau')].map(b => b.disabled)")
    noter(S, "au départ, seul le niveau 1 est ouvert", fermes == [False, True, True, True, True, True], fermes)
    ouvrir(page, "ligne-1", formateur=False); poser_graphe(page, solution("ligne-1")["solution"]); lancer(page)
    page.evaluate("location.hash = ''"); page.wait_for_selector(".carte-niveau")
    fermes = page.evaluate("[...document.querySelectorAll('.carte-niveau')].map(b => b.disabled)")
    noter(S, "le niveau 2 s'ouvre quand le niveau 1 est réussi", fermes == [False, False, True, True, True, True], fermes)
    page.reload(); page.wait_for_selector(".carte-niveau")
    etoiles = page.locator(".carte-niveau .etoile.gagnee").count()
    ouvrir(page, "ligne-1", formateur=False)
    n = page.evaluate("window.jeu.etat.plateau.pieces.length")
    noter(S, f"sauvegarde : après rechargement, 3 étoiles et le plateau construit ({n} pièces) reviennent", etoiles == 3 and n == 4, (etoiles, n))
    page.evaluate("location.hash = ''"); page.wait_for_selector(".carte-niveau")
    page.click("#bouton-envoyer")
    page.wait_for_function("document.getElementById('message-carte').textContent.startsWith('Résultat') || document.getElementById('message-carte').textContent.startsWith('L\\'envoi')", timeout=20000)
    envoi = json.loads(urllib.request.urlopen(f"{BASE}/__dernier_envoi").read().decode("utf-8")) or {}
    attendu = {"form-name": "resultat-ligne", "pseudo": "Controle", "niveau_max_atteint": "1", "niveaux_reussis": "1", "etoiles_total": "3", "niveaux_a_revoir": "", "mode": "3D", "qualite": "basse"}
    noter(S, "envoi des résultats du jeu 2 : formulaire resultat-ligne, champs attendus, aucun plateau envoyé", all(envoi.get(k) == v for k, v in attendu.items()) and set(envoi) == set(attendu) | {"date"}, envoi)
    page.context.close()

    # clavier dans la grille sans 3D
    page = page_ligne(nav, sans3d=True)
    ouvrir(page, "ligne-1")
    page.locator('.case2d[data-x="0"][data-z="0"]').focus()
    page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowDown")
    pos = page.evaluate("[document.activeElement.dataset.x, document.activeElement.dataset.z]")
    page.click('[data-outil="remplisseuse"]')
    page.locator('.case2d[data-x="1"][data-z="1"]').focus(); page.keyboard.press("Enter")
    pose = page.evaluate("window.jeu.etat.plateau.pieces.some(p => p.type === 'remplisseuse' && p.x === 1 && p.z === 1)")
    noter(S, "sans 3D au clavier : les flèches déplacent le focus, Entrée pose la pièce", pos == ["1", "1"] and pose, (pos, pose), "visible")
    page.context.close()


# ---------------------------------------------------------------- rendu
PLANS = [
    ("carte", None, None, None),
    ("depart", "ligne-1", None, None),
    ("construit", "ligne-3", "solution", None),
    ("rejeu", "ligne-3", "solution", 9),
    ("tri", "ligne-4", "solution", 7),
    ("anneau", "ligne-5", "solution", 6),
    ("trappe", "ligne-3", "ouvert", ("milieu", 3)),
    ("machine", "ligne-6", "solution", 5),
    ("bilan", "ligne-5", "solution", "fin"),
    ("erreur", "ligne-1", "erreur", "fin"),
    ("problemes", "ligne-5", "probleme", None),
]


def controle_rendu(nav):
    S = "ligne-rendu"
    CAPTURES.mkdir(parents=True, exist_ok=True)
    mesures = {}
    for largeur, hauteur in c.RESOLUTIONS:
        taille = f"{largeur}x{hauteur}"
        for qualite, sans3d in (("haute", False), ("basse", False), ("haute", True)):
            mode = "sans3d" if sans3d else qualite
            page = page_ligne(nav, sans3d=sans3d, qualite=qualite, largeur=largeur, hauteur=hauteur)
            for nom, ident, graphe, moment in PLANS:
                if sans3d and nom not in ("depart", "rejeu", "bilan", "machine", "anneau", "trappe"):
                    continue
                if ident is None:
                    page.goto(f"{BASE}/ligne.html?formateur=1"); page.wait_for_selector(".carte-niveau"); page.wait_for_timeout(300)
                else:
                    ouvrir(page, ident)
                    if graphe == "solution":
                        poser_graphe(page, solution(ident)["solution"])
                    elif graphe == "erreur":
                        poser_graphe(page, appliquer(solution(ident)["solution"], solution(ident)["variantes"][0]))
                    elif graphe == "probleme":
                        g = solution(ident)["solution"]; g["tapis"] = [t for t in g["tapis"] if t["de"] != "rem"]
                        poser_graphe(page, g); page.click("#bouton-lancer"); page.wait_for_timeout(400)
                    elif graphe == "ouvert":
                        g = solution(ident)["solution"]; g["tapis"] = [t for t in g["tapis"] if not (t["de"] == "cq" and t["sortie"] == "non")]
                        g["tapis"].append({"id": "ouvert", "de": "cq", "sortie": "non", "vers": None, "ouvert": True, "cases": [[6, 3], [6, 4], [7, 4]]})
                        poser_graphe(page, g)
                    if isinstance(moment, tuple):
                        # capture pendant une étape : les k premières sautées, la suivante jouée lentement
                        lancer(page, attendre_fin=False)
                        page.evaluate("async () => { window.jeu.etat.vue.sauter = true; await window.jeu.pas(); await new Promise(r => setTimeout(r, 200)); }")
                        page.evaluate("""async (k) => { const e = window.jeu.etat; e.vue.sauter = true; e.vue.preparerRejeu(e.plateau); e.curseur = 0;
                            for (let i = 0; i < k; i++) await window.jeu.pas(); e.vue.sauter = false; e.vue.vitesse = 0.3; window.jeu.pas(); }""", moment[1])
                        page.wait_for_timeout(1700 if not sans3d else 300)
                    elif moment == "fin":
                        lancer(page)
                    elif moment:
                        lancer(page, attendre_fin=False)
                        page.evaluate("async () => { window.jeu.etat.vue.sauter = true; await window.jeu.pas(); await new Promise(r => setTimeout(r, 200)); }")
                        page.evaluate("""async (k) => { const e = window.jeu.etat; e.vue.sauter = true; e.vue.preparerRejeu(e.plateau); e.curseur = 0;
                            for (let i = 0; i < k; i++) await window.jeu.pas(); e.vue.sauter = false; }""", moment)
                page.evaluate("document.querySelector('.avis')?.remove()")
                if not isinstance(moment, tuple):
                    page.wait_for_timeout(1200)
                chemin = CAPTURES / f"ligne-{nom}-{mode}-{taille}.png"
                page.screenshot(path=str(chemin))
                if ident and not sans3d:
                    mesures[chemin.name] = c.mesures_image(chemin)
                d = page.evaluate(c.JS_INTERFACE)
                noter(S, f"interface, plan « {nom} », {mode}, {taille}", not d, d, "visible")
            page.context.close()
    for nom, m in mesures.items():
        noter(S, f"capture {nom} : ni trop sombre ni brûlée ({m['noirs_%']} % de noir pur, {m['blancs_%']} % de blanc pur, luminosité {m['luminosite_moyenne']})",
              m["noirs_%"] < 35 and (m["blancs_%"] < 3 or "bilan" in nom) and m["luminosite_moyenne"] > 25, m, "visible")
    return mesures


def main():
    section = sys.argv[sys.argv.index("--section") + 1] if "--section" in sys.argv else "tout"
    if "--resolution" in sys.argv:
        l, h = sys.argv[sys.argv.index("--resolution") + 1].split("x"); c.RESOLUTIONS = [(int(l), int(h))]
    serveurs = [subprocess.Popen([sys.executable, str(RACINE / "qa/serveur.py"), str(c.PORT)], stderr=subprocess.DEVNULL)]
    time.sleep(1.2)
    debut = time.time(); extra = {}
    try:
        with c.sync_playwright() as p:
            nav = p.chromium.launch(channel="chrome", args=c.CHROME)
            extra["navigateur"] = nav.version
            if section in ("tout", "fonctionnement"): controle_fonctionnement(nav)
            if section in ("tout", "rendu"): extra["mesures"] = controle_rendu(nav)
            nav.close()
        erreurs = [m for m in c.console if "GL Driver Message" not in m]
        noter("ligne-" + (section if section != "tout" else "fonctionnement"), f"aucune erreur JavaScript pendant la session ({len(erreurs)} relevée(s))", not erreurs, erreurs[:20])
    finally:
        for s in serveurs: s.terminate()
    extra["duree_s"] = round(time.time() - debut)
    brut = RACINE / "qa" / "rapports" / "brut"; brut.mkdir(parents=True, exist_ok=True)
    suffixe = "ligne-" + section + ("-" + "x".join(map(str, c.RESOLUTIONS[0])) if "--resolution" in sys.argv else "")
    (brut / f"{VERSION}-{suffixe}.json").write_text(json.dumps({"section": suffixe, "resultats": resultats, **extra}, ensure_ascii=False, indent=1), encoding="utf-8")
    echecs = [r for r in resultats if not r["ok"]]
    print(f"\n{len(resultats) - len(echecs)} contrôles réussis sur {len(resultats)} ; {len(echecs)} en échec ; durée {extra['duree_s']} s")
    for r in echecs: print(" -", r["classe"], "|", r["section"], "|", r["nom"], "|", r["detail"][:400])
    return 1 if any(r["classe"] == "bloquant" for r in echecs) else 0


if __name__ == "__main__":
    sys.exit(main())
