"""Contrôle qualité automatique du jeu 1 « les missions » (08-controle-qualite-automatique.md).

Usage : python controle.py [--section fonctionnement|rendu|statique|bilan] [--resolution 1366x768] [--version v1]
Sans --section : tout d'un coup (long avec un rendu logiciel). « bilan » réunit les résultats des sections.
Prérequis : Python 3, Playwright pour Python (pip install playwright), Pillow, Google Chrome.
Sorties : qa/rapports/<date>-<version>.json (résultats bruts) et qa/captures/<version>/ (captures de référence).
Le rapport lisible (qa/rapports/<date>-<version>.md) est rédigé après relecture des captures.
"""
import datetime, json, pathlib, re, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

RACINE = pathlib.Path(__file__).resolve().parent.parent
SITE, SOLUTIONS = RACINE / "site", RACINE / "solutions"
VERSION = sys.argv[sys.argv.index("--version") + 1] if "--version" in sys.argv else "v1"
CAPTURES = RACINE / "qa" / "captures" / VERSION
AVEC_CAPTURES = "--sans-captures" not in sys.argv
PORT, PORT_SANS_ISOLEMENT = 8765, 8766
BASE = f"http://127.0.0.1:{PORT}"
CHROME = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
DELAI_MAX_MS = 5000                     # même valeur que js/commun/python.js
VITESSE_CONTROLE = 12                   # rejeu accéléré pendant le contrôle
RESOLUTIONS = [(1920, 1080), (1366, 768)]

# Codes fautifs : (nom, mission, code, type d'erreur attendu)
FAUTIFS = [
    ("erreur de syntaxe", "1.1-prix-casier", "def prix_casier_consigne(prix_casier, consigne)\n    return prix_casier + consigne\n", "SyntaxError"),
    ("erreur d'indentation", "1.1-prix-casier", "def prix_casier_consigne(prix_casier, consigne):\nreturn prix_casier + consigne\n", "IndentationError"),
    ("nom inconnu", "1.1-prix-casier", "def prix_casier_consigne(prix_casier, consigne):\n    return prix_casier + consine\n", "NameError"),
    ("indice hors limites", "2.1-etiquette", "def nettoyer_etiquette(saisie):\n    return saisie[len(saisie)]\n", "IndexError"),
    ("clé absente", "1.3-prix-commande", "def total_commande(nb_casiers, prix_casier, consigne):\n    tarifs = {\"casier\": prix_casier}\n    return nb_casiers * tarifs[\"consigne\"]\n", "KeyError"),
    ("boucle sans fin sans appel à l'API", "1.2-volume-fut", "def bouteilles_par_fut(fut_litres, bouteille_cl):\n    while True:\n        pass\n", "KeyboardInterrupt"),
    ("boucle sans fin avec appel à l'API", "1.1-prix-casier", "def prix_casier_consigne(prix_casier, consigne):\n    while True:\n        avancer()\n", None),
    ("fonction renommée", "1.1-prix-casier", "def prix(prix_casier, consigne):\n    return prix_casier + consigne\n", None),
]

# Plans fixes des captures de référence : (nom, mission, code : "solution" ou texte, nombre d'actions rejouées avant la capture ; None = état de départ ; "fin" = bilan)
# Séries 3 à 6 : jouées dans l'atelier, contrôlées par controle_atelier.py.
SANS_CONSIGNE = "def prix_casier_consigne(prix_casier, consigne):\n    return prix_casier\n"
PLANS_QA = [
    ("depart", "1.1-prix-casier", None, None),
    ("etiquette", "1.1-prix-casier", "solution", 2),
    ("etiquette-fausse", "1.1-prix-casier", SANS_CONSIGNE, 2),
    ("embouteillage", "1.2-volume-fut", "solution", 2),
    ("commande", "1.3-prix-commande", "solution", 2),
    ("etiquette-nettoyee", "2.1-etiquette", "solution", 2),
    ("bon-livraison", "2.2-bon-livraison", "solution", 2),
    ("bilan", "1.1-prix-casier", "solution", "fin"),
    ("erreur", "1.1-prix-casier", FAUTIFS[0][2], "fin"),
]

resultats = []          # {section, nom, ok, classe, detail}
console = []            # erreurs JavaScript de toute la session


def noter(section, nom, ok, detail="", classe="bloquant"):
    resultats.append({"section": section, "nom": nom, "ok": bool(ok), "classe": classe, "detail": str(detail)})
    print(("OK    " if ok else "ÉCHEC ") + f"[{section}] {nom}" + (f" : {detail}" if detail and not ok else ""), flush=True)


def missions():
    """Missions jouées dans missions.html (séries 1 et 2) ; les autres se jouent dans l'atelier."""
    return [m for m in json.loads((SITE / "missions/index.json").read_text(encoding="utf-8"))["missions"] if not m.get("atelier")]


def solution(identifiant):
    return (SOLUTIONS / f"{identifiant}.py").read_text(encoding="utf-8")


def nouvelle_page(nav, largeur=1366, hauteur=768, progression=None, **options):
    contexte = nav.new_context(viewport={"width": largeur, "height": hauteur}, **options)
    if progression is not None:
        contexte.add_init_script("try { if (!localStorage.getItem('jeux-python.progression.v1')) localStorage.setItem('jeux-python.progression.v1', %s); } catch (e) {}" % json.dumps(json.dumps(progression)))
    page = contexte.new_page()
    page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append("exception : " + str(e)))
    return page


def attendre_python(page):
    page.wait_for_function("window.jeu && document.getElementById('etat-python').classList.contains('pret')", timeout=120000)


def ouvrir(page, identifiant, base=BASE, formateur=True):
    if "missions.html" not in page.url:
        page.goto(f"{base}/missions.html" + ("?formateur=1" if formateur else "") + f"#mission={identifiant}")
    else:
        page.evaluate("(id) => { location.hash = 'mission=' + id; }", identifiant)
    page.wait_for_function("(id) => window.jeu && window.jeu.etat.mission && window.jeu.etat.mission.id === id && window.jeu.etat.rejeu && !document.getElementById('vue-mission').hidden", arg=identifiant, timeout=60000)
    attendre_python(page)


def executer(page, code, attendre_rejeu=True, delai=180000):
    page.evaluate("(code) => { const e = window.jeu.etat; e.resultat = null; e.rejeuTermine = false; e.editeur.ecrire(code); }", code)
    page.evaluate("(v) => window.jeu.etat.rejeu.vitesse(v)", VITESSE_CONTROLE)
    debut = time.time()
    page.click("#bouton-executer")
    page.wait_for_function("window.jeu.etat.resultat !== null && !window.jeu.etat.occupe", timeout=delai)
    duree = time.time() - debut
    if attendre_rejeu:
        page.wait_for_function("window.jeu.etat.rejeuTermine === true", timeout=delai)
    r = page.evaluate("(() => { const r = window.jeu.etat.resultat; return { etoiles: r.etoiles, erreur: r.erreur, nbActions: r.journal.length, tests: r.tests.map(t => [t.groupe, t.ok]), sortie: r.sortie }; })()")
    r["duree"] = duree
    return r


# ---------------------------------------------------------------- 2.1 fonctionnement
def controle_fonctionnement(nav):
    S = "fonctionnement"
    page = nouvelle_page(nav, 1000, 620, progression={"pseudo": "Controle", "qualite": "basse", "sans3d": False, "son": False, "missions": {}})
    page.goto(f"{BASE}/index.html")
    page.wait_for_function("document.getElementById('etat-python').classList.contains('pret')", timeout=120000)
    noter(S, "Python se charge sur la page d'accueil", True)
    page.goto(f"{BASE}/missions.html?formateur=1")
    attendre_python(page)
    info = page.evaluate("({ version: window.jeu.pilote.version, ms: window.jeu.pilote.dureeChargementMs, isolee: self.crossOriginIsolated })")
    noter(S, f"Python se charge sur la carte (Python {info['version']}, {info['ms']} ms, page isolée : {info['isolee']})", info["version"] is not None)

    trois_d = {}
    for m in missions():
        ident = m["id"]
        ouvrir(page, ident)
        scene = page.evaluate("Boolean(window.jeu.etat.scene)")
        r = executer(page, (SITE / f"missions/{ident}/depart.py").read_text(encoding="utf-8"), attendre_rejeu=True)
        interne = bool(r["erreur"]) and "moteur" in (r["erreur"].get("explication") or "")
        noter(S, f"{ident} : le code de départ échoue proprement", (not r["etoiles"][0]) and not interne and (r["tests"] or r["erreur"]), r)
        r = executer(page, solution(ident))
        bilan = page.locator(".bilan-carte").count() == 1
        noter(S, f"{ident} : la solution de référence obtient 3 étoiles (3D : {scene}, {r['nbActions']} actions rejouées, bilan affiché : {bilan})", r["etoiles"] == [True, True, True] and not r["erreur"] and bilan and scene, r)
        trois_d[ident] = (r["etoiles"], r["nbActions"], r["tests"])

    # erreurs expliquées
    for nom, ident, code, attendu in FAUTIFS:
        ouvrir(page, ident)
        r = executer(page, code)
        e = r["erreur"] or {}
        panneau = page.inner_text("#panneau")
        onglet = page.get_attribute('.onglet[aria-selected="true"]', "data-onglet")
        ok = bool(e) and bool(e.get("explication")) and bool(e.get("conseil")) and e["explication"] in panneau and e["conseil"] in panneau and onglet == "erreur" and (attendu is None or e.get("type") == attendu)
        noter(S, f"erreur expliquée : {nom} ({e.get('type')}, ligne {e.get('ligne')})", ok, {"erreur": e, "onglet": onglet})
        if nom.startswith("boucle sans fin sans"):
            # durée mesurée sur le moteur lui-même ; la durée « par l'interface » ajoute la remise en place de la scène, lente avec un rendu logiciel
            ms = page.evaluate("async (code) => { const e = window.jeu.etat; const t = performance.now(); await window.jeu.pilote.executer(e.mission, code, e.tests); return Math.round(performance.now() - t); }", code)
            noter(S, f"boucle « while True: pass » interrompue par le moteur en {ms / 1000:.1f} s (seuil {DELAI_MAX_MS / 1000 + 2:.0f} s) ; résultat affiché après {r['duree']:.1f} s avec la 3D en rendu logiciel", ms <= DELAI_MAX_MS + 2000, (ms, r["duree"]))
            r2 = executer(page, solution(ident))
            noter(S, "après l'interruption, l'interface reste utilisable (solution relancée : 3 étoiles)", r2["etoiles"] == [True, True, True], r2)

    # clavier et boutons
    ouvrir(page, "1.1-prix-casier")
    page.evaluate("(code) => { const e = window.jeu.etat; e.resultat = null; e.rejeuTermine = false; e.editeur.ecrire(code); e.editeur.focus(); }", solution("1.1-prix-casier"))
    page.keyboard.press("Control+Enter")
    page.wait_for_function("window.jeu.etat.resultat !== null && window.jeu.etat.rejeuTermine === true", timeout=180000)
    noter(S, "Ctrl+Entrée dans l'éditeur lance l'exécution", page.evaluate("window.jeu.etat.resultat.etoiles[0]"), classe="visible")
    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("p"); pause = page.get_attribute("#bouton-pause", "aria-pressed"); page.keyboard.press("p")
    page.keyboard.press("m"); son = page.get_attribute("#bouton-son", "aria-pressed"); page.keyboard.press("m")
    noter(S, "touches P (pause) et M (son)", pause == "true" and son in ("true", "false") and page.get_attribute("#bouton-pause", "aria-pressed") == "false", {"pause": pause, "son": son}, "visible")
    page.keyboard.press("F10")
    page.wait_for_timeout(600)
    page.keyboard.press("F10")
    page.wait_for_function("document.getElementById('legende').textContent.startsWith('Action 1 sur')", timeout=60000)
    noter(S, "F10 rejoue une action à la fois", True, classe="visible")
    taille = page.evaluate("getComputedStyle(document.querySelector('#editeur .cm-editor')).fontSize")
    page.click("#bouton-agrandir")
    taille2 = page.evaluate("getComputedStyle(document.querySelector('#editeur .cm-editor')).fontSize")
    noter(S, f"bouton A+ : le texte de l'éditeur passe de {taille} à {taille2}", float(taille2[:-2]) > float(taille[:-2]) >= 16, classe="visible")
    page.context.close()

    # sans 3D
    page = nouvelle_page(nav, progression={"pseudo": "Controle", "qualite": "haute", "sans3d": True, "son": False, "missions": {}})
    ecarts = []
    for m in missions():
        ouvrir(page, m["id"])
        r = executer(page, solution(m["id"]))
        lignes = page.locator(".journal-texte li").count()
        if (r["etoiles"], r["nbActions"], r["tests"]) != trois_d[m["id"]] or lignes != r["nbActions"] or page.evaluate("Boolean(window.jeu.etat.scene)"):
            ecarts.append((m["id"], r, lignes))
    noter(S, f"mode sans 3D : les {len(missions())} solutions donnent les mêmes résultats qu'en 3D, journal en texte complet", not ecarts, ecarts)
    page.click("#bouton-depart")
    arme = page.inner_text("#bouton-depart")
    page.click("#bouton-depart")
    noter(S, "« Revenir au code de départ » demande une confirmation puis remet le code", arme == "Confirmer ?" and page.evaluate("window.jeu.etat.editeur.lire() === window.jeu.etat.depart"), arme, "visible")
    page.context.close()

    # déblocage des séries, indices, sauvegarde, envoi (sans le paramètre formateur)
    page = nouvelle_page(nav, progression={"pseudo": "Controle", "qualite": "basse", "sans3d": True, "son": False, "missions": {}})
    page.goto(f"{BASE}/missions.html")
    attendre_python(page)
    fermees = page.evaluate("[...document.querySelectorAll('.serie')].map(s => [...s.querySelectorAll('.carte-mission')].every(b => b.disabled))")
    noter(S, "au départ, seule la série 1 est ouverte", fermees == [False, True, True, True, True, True], fermees)
    page.evaluate("location.hash = 'mission=3.1-quai'")
    page.wait_for_timeout(500)
    noter(S, "une mission d'une série fermée ne s'ouvre pas par son adresse", page.evaluate("document.getElementById('vue-mission').hidden"))
    ouvrir(page, "1.1-prix-casier", formateur=False)
    depart = (SITE / "missions/1.1-prix-casier/depart.py").read_text(encoding="utf-8")
    etapes = []
    for essai in range(1, 5):
        executer(page, depart)
        page.click('.onglet[data-onglet="indice"]')
        etapes.append(page.locator("#panneau .indice").count())
    noter(S, "indices : aucun après 1 échec, le premier après 2, le second après 4", etapes == [0, 1, 1, 2], etapes)
    for ident in ("1.1-prix-casier", "1.2-volume-fut", "1.3-prix-commande"):
        ouvrir(page, ident, formateur=False)
        executer(page, solution(ident))
    fin_serie = page.inner_text(".bilan-carte")
    noter(S, "fin de série : récapitulatif et annonce de la série suivante", "Série 1 réussie" in fin_serie and "Série 2 ouverte" in fin_serie, fin_serie, "visible")
    page.evaluate("location.hash = ''")
    page.wait_for_selector("#series .carte-mission")
    fermees = page.evaluate("[...document.querySelectorAll('.serie')].map(s => [...s.querySelectorAll('.carte-mission')].every(b => b.disabled))")
    etoiles = page.locator("#series .etoile.gagnee").count()
    noter(S, "la série 2 s'ouvre quand la série 1 est réussie", fermees == [False, False, True, True, True, True], fermees)
    page.reload()
    page.wait_for_selector("#series .carte-mission")
    etoiles2 = page.locator("#series .etoile.gagnee").count()
    noter(S, f"sauvegarde : {etoiles} étoiles avant rechargement, {etoiles2} après", etoiles == etoiles2 == 9, (etoiles, etoiles2))
    ouvrir(page, "1.1-prix-casier", formateur=False)
    noter(S, "sauvegarde : le dernier code du stagiaire revient dans l'éditeur", page.evaluate("window.jeu.etat.editeur.lire()") == solution("1.1-prix-casier"), classe="visible")
    page.evaluate("location.hash = ''")
    page.click("#bouton-envoyer")
    page.wait_for_function("document.getElementById('message-carte').textContent.startsWith('Résultat envoyé') || document.getElementById('message-carte').textContent.startsWith('L\\'envoi')", timeout=20000)
    envoi = json.loads(urllib.request.urlopen(f"{BASE}/__dernier_envoi").read().decode("utf-8")) or {}
    attendu = {"form-name": "resultat-missions", "pseudo": "Controle", "serie_max_atteinte": "1", "missions_reussies": "3", "etoiles_total": "9", "missions_a_revoir": "", "mode": "sans 3D", "qualite": "basse"}
    ok = all(envoi.get(c) == v for c, v in attendu.items()) and "date" in envoi and set(envoi) == set(attendu) | {"date"}
    noter(S, "envoi des résultats : champs attendus, aucun code envoyé", ok and page.inner_text("#message-carte").startswith("Résultat envoyé"), envoi)
    page.click("#bouton-zero"); page.click("#bouton-zero")
    noter(S, "« Recommencer à zéro » demande une confirmation puis efface les étoiles (pseudo conservé)", page.locator("#series .etoile.gagnee").count() == 0 and page.evaluate("JSON.parse(localStorage.getItem('jeux-python.progression.v1')).pseudo") == "Controle", classe="visible")
    page.context.close()

    # envoi sans pseudo
    page = nouvelle_page(nav, progression={"pseudo": "", "qualite": "basse", "sans3d": True, "son": False, "missions": {}})
    page.goto(f"{BASE}/missions.html"); page.wait_for_selector("#series .carte-mission")
    page.click("#bouton-envoyer")
    noter(S, "envoi sans pseudo : le jeu demande le pseudo au lieu d'envoyer", "pseudo" in page.inner_text("#message-carte"), page.inner_text("#message-carte"), "visible")
    page.context.close()

    # stockage bloqué
    contexte = nav.new_context(viewport={"width": 1366, "height": 768})
    contexte.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('stockage bloqué'); } });")
    page = contexte.new_page()
    erreurs_stockage = []
    page.on("pageerror", lambda e: erreurs_stockage.append(str(e)))
    page.on("console", lambda m: erreurs_stockage.append(m.text) if m.type == "error" else None)
    page.goto(f"{BASE}/missions.html#mission=1.1-prix-casier")
    ouvrir(page, "1.1-prix-casier", formateur=False)
    r = executer(page, solution("1.1-prix-casier"))
    page.evaluate("location.hash = ''")
    page.wait_for_selector("#series .carte-mission")
    noter(S, "stockage du navigateur bloqué : repli en mémoire, la mission se joue et les étoiles s'affichent", r["etoiles"] == [True, True, True] and page.locator("#series .etoile.gagnee").count() == 3 and not erreurs_stockage, erreurs_stockage)
    contexte.close()

    # mouvements réduits
    page = nouvelle_page(nav, progression={"pseudo": "Controle", "qualite": "haute", "sans3d": False, "son": False, "missions": {}}, reduced_motion="reduce")
    ouvrir(page, "1.1-prix-casier")
    r = executer(page, solution("1.1-prix-casier"))
    noter(S, "prefers-reduced-motion : la scène passe en mode calme et la mission se rejoue jusqu'au bilan", r["etoiles"][0] and page.evaluate("window.jeu.etat.scene.calme === true"), classe="visible")
    page.context.close()

    # repli sans isolement (pas de SharedArrayBuffer)
    page = nouvelle_page(nav, progression={"pseudo": "Controle", "qualite": "basse", "sans3d": True, "son": False, "missions": {}})
    base2 = f"http://127.0.0.1:{PORT_SANS_ISOLEMENT}"
    ouvrir(page, FAUTIFS[5][1], base=base2)
    isolee = page.evaluate("self.crossOriginIsolated")
    r = executer(page, FAUTIFS[5][2])
    r2 = executer(page, solution(FAUTIFS[5][1]))
    noter(S, f"sans les en-têtes d'isolement (page isolée : {isolee}) : boucle sans fin arrêtée en {r['duree']:.1f} s, Python rechargé, solution relancée en {r2['duree']:.1f} s",
          (not isolee) and r["erreur"] and r["erreur"]["type"] == "KeyboardInterrupt" and r["duree"] <= DELAI_MAX_MS / 1000 + 2 and r2["etoiles"] == [True, True, True], (r, r2))
    page.context.close()


# ---------------------------------------------------------------- 2.2 rendu
JS_INTERFACE = r"""
(() => {
  const defauts = [];
  // un élément caché par une zone qui défile (il suffit de la faire défiler pour le voir) n'est pas « hors écran »
  const masqueParDefilement = (e) => { const r = e.getBoundingClientRect(); for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x); if (/(auto|scroll)/.test(o.overflowX + o.overflowY)) { const z = x.getBoundingClientRect(); if (r.right > z.right + 1 || r.bottom > z.bottom + 1 || r.left < z.left - 1 || r.top < z.top - 1) return true; } } return false; };
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && !masqueParDefilement(e); };
  const L = innerWidth, H = innerHeight;
  const vm = document.getElementById('vue-mission'); const enMission = Boolean(vm) && !vm.hidden;
  if (document.documentElement.scrollWidth > L + 1) defauts.push('la page déborde en largeur : ' + document.documentElement.scrollWidth + ' > ' + L);
  if (enMission && document.documentElement.scrollHeight > H + 1) defauts.push("l'écran de mission déborde en hauteur : " + document.documentElement.scrollHeight + ' > ' + H);
  for (const e of document.querySelectorAll('button, .onglet, h1, #mission-enonce, .objectifs li, .legende-rejeu, .etat-python')) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.left < -1 || r.right > L + 1 || (enMission && (r.top < -1 || r.bottom > H + 1))) defauts.push('hors écran : ' + (e.id || e.className || e.tagName) + ' ' + e.textContent.trim().slice(0, 30));
    if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 1) defauts.push('texte de bouton coupé : ' + e.textContent.trim());
  }
  // taille des textes
  const petits = new Set();
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (marcheur.nextNode()) {
    const n = marcheur.currentNode; if (!n.textContent.trim()) continue;
    const e = n.parentElement; if (!visible(e) || e.closest('script, style')) continue;
    const taille = parseFloat(getComputedStyle(e).fontSize);
    if (taille < 14) petits.add(taille + 'px : ' + n.textContent.trim().slice(0, 30));
  }
  for (const p of petits) defauts.push('texte sous 14 px : ' + p);
  // contraste (WCAG) du texte sur le premier fond opaque trouvé en remontant
  const lum = (c) => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const rvb = (t) => { const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const fond = (e) => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); const b = rvb(s.backgroundColor); if (b && b.a > 0.6) return b.c; if (s.backgroundImage && s.backgroundImage !== 'none') { const g = rvb(s.backgroundImage); if (g) return g.c; } } return [255, 255, 255]; };
  const vus = new Set();
  const m2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (m2.nextNode()) {
    const n = m2.currentNode; if (!n.textContent.trim()) continue;
    const e = n.parentElement; if (!visible(e) || e.closest('script, style, .cm-editor, canvas') || e.closest(':disabled') || e.closest('.fermee')) continue;
    const t = rvb(getComputedStyle(e).color); if (!t) continue;
    const a = lum(t.c), b = lum(fond(e)); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const taille = parseFloat(getComputedStyle(e).fontSize), gras = parseInt(getComputedStyle(e).fontWeight) >= 700;
    const seuil = (taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5;
    const cle = (e.className || e.tagName) + '|' + ratio.toFixed(1);
    if (ratio < seuil && !vus.has(cle)) { vus.add(cle); defauts.push('contraste ' + ratio.toFixed(1) + ' (seuil ' + seuil + ') : ' + (e.className || e.tagName) + ' « ' + n.textContent.trim().slice(0, 30) + ' »'); }
  }
  return defauts;
})()
"""


def mesures_image(chemin, zone_scene=True):
    from PIL import Image
    im = Image.open(chemin).convert("RGB")
    if zone_scene:
        im = im.crop((0, int(im.height * 0.08), int(im.width * 0.45), int(im.height * 0.9)))
    px = list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()); n = len(px)
    noirs = sum(1 for r, g, b in px if max(r, g, b) < 6) / n
    blancs = sum(1 for r, g, b in px if min(r, g, b) > 249) / n
    temoin = sum(1 for r, g, b in px if r > 240 and b > 240 and g < 30)
    moyenne = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px) / n
    return {"noirs_%": round(100 * noirs, 1), "blancs_%": round(100 * blancs, 2), "pixels_temoin": temoin, "luminosite_moyenne": round(moyenne, 1)}


def controle_rendu(nav):
    S = "rendu"
    CAPTURES.mkdir(parents=True, exist_ok=True)
    mesures = {}
    for largeur, hauteur in RESOLUTIONS:
        taille = f"{largeur}x{hauteur}"
        # pages sans scène
        page = nouvelle_page(nav, largeur, hauteur, progression={"pseudo": "Marie", "qualite": "haute", "sans3d": False, "son": False, "missions": {
            "1.1-prix-casier": {"etoiles": [True, True, True], "essais": 2, "echecs": 1, "code": None, "termineeLe": None},
            "1.2-volume-fut": {"etoiles": [True, False, True], "essais": 1, "echecs": 0, "code": None, "termineeLe": None},
            "1.3-prix-commande": {"etoiles": [True, True, False], "essais": 3, "echecs": 2, "code": None, "termineeLe": None}}})
        page.goto(f"{BASE}/index.html"); page.wait_for_function("document.getElementById('etat-python').classList.contains('pret')", timeout=120000)
        page.screenshot(path=str(CAPTURES / f"accueil-{taille}.png"))
        d = page.evaluate(JS_INTERFACE)
        noter(S, f"interface, accueil, {taille}", not d, d, "visible")
        page.goto(f"{BASE}/missions.html"); attendre_python(page)
        page.screenshot(path=str(CAPTURES / f"carte-{taille}.png"))
        d = page.evaluate(JS_INTERFACE)
        noter(S, f"interface, carte, {taille}", not d, d, "visible")
        page.context.close()
        # sans 3D
        page = nouvelle_page(nav, largeur, hauteur, progression={"pseudo": "Marie", "qualite": "haute", "sans3d": True, "son": False, "missions": {}})
        ouvrir(page, "2.2-bon-livraison"); executer(page, solution("2.2-bon-livraison"))
        page.screenshot(path=str(CAPTURES / f"sans3d-{taille}.png"))
        d = page.evaluate(JS_INTERFACE)
        noter(S, f"interface, mission sans 3D avec bilan, {taille}", not d, d, "visible")
        page.context.close()
        # plans 3D
        for qualite in ("haute", "basse"):
            page = nouvelle_page(nav, largeur, hauteur, progression={"pseudo": "Marie", "qualite": qualite, "sans3d": False, "son": False, "missions": {}})
            for nom, ident, code, moment in PLANS_QA:
                if not AVEC_CAPTURES: break
                ouvrir(page, ident)
                page.evaluate("window.jeu.etat.scene.surLenteur = null; document.querySelector('.avis')?.remove()")   # l'avis de lenteur est normal en rendu logiciel
                if code is not None:
                    executer(page, solution(ident) if code == "solution" else code)
                    if moment != "fin":
                        page.evaluate("""async (n) => { const e = window.jeu.etat; document.querySelector('.bilan')?.remove();
                            e.rejeu.preparer(e.mission, e.resultat.journal, null); for (let i = 0; i < n; i++) await e.rejeu.pas(); }""", moment)
                page.evaluate("document.querySelector('.avis')?.remove()")
                page.wait_for_timeout(900)
                chemin = CAPTURES / f"{nom}-{qualite}-{taille}.png"
                page.screenshot(path=str(chemin))
                mesures[chemin.name] = mesures_image(chemin)
                d = page.evaluate(JS_INTERFACE)
                noter(S, f"interface, plan « {nom} », qualité {qualite}, {taille}", not d, d, "visible")
            page.context.close()
    for nom, m in mesures.items():
        noter(S, f"capture {nom} : ni trop sombre ni brûlée ({m['noirs_%']} % de noir pur, {m['blancs_%']} % de blanc pur, luminosité moyenne {m['luminosite_moyenne']}), aucun pixel témoin",
              m["noirs_%"] < 35 and (m["blancs_%"] < 3 or nom.startswith("bilan")) and m["pixels_temoin"] == 0 and m["luminosite_moyenne"] > 25, m, "visible")
    return mesures


# ---------------------------------------------------------------- 2.3 textes
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-⛿✀-➿️⭐⬆⬇⌚⌛⏩-⏺]")
INTERDITS = ["en constante évolution", "plongeons dans", "il est important de noter", "n'hésitez pas", "dans le monde d", "à l'ère d", "révolutionn", "incontournable"]
TUTOIEMENT = re.compile(r"(?<![\w'’-])(tu|ton|ta|tes|toi|t')(?![\w-])", re.IGNORECASE)


def textes_affiches():
    """Renvoie {fichier: texte} pour tout ce que le stagiaire peut lire : pages, missions, tests, messages Python et JavaScript."""
    textes = {}
    for f in list(SITE.glob("*.html")):
        brut = re.sub(r"<script.*?</script>|<style.*?</style>", " ", f.read_text(encoding="utf-8"), flags=re.S)
        textes[f.name] = re.sub(r"<[^>]+>", " ", brut)
    for f in sorted(list(SITE.glob("missions/**/*.json")) + list(SITE.glob("ligne/niveaux/**/*.json")) + list(SITE.glob("atelier/missions/**/*.json"))):
        textes[str(f.relative_to(SITE))] = "\n".join(chaines_json(json.loads(f.read_text(encoding="utf-8"))))
    for f in sorted(list(SITE.glob("missions/**/*.py")) + list(SITE.glob("ligne/niveaux/**/*.py")) + list(SITE.glob("atelier/missions/**/*.py")) + list(SITE.glob("python/*.py"))):
        textes[str(f.relative_to(SITE))] = f.read_text(encoding="utf-8")
    for f in sorted(list(SITE.glob("js/*.js")) + list(SITE.glob("js/commun/*.js")) + list(SITE.glob("js/ligne/*.js")) + list(SITE.glob("js/atelier/*.js")) + list(SITE.glob("worker/*.mjs"))):
        source = f.read_text(encoding="utf-8")
        textes[str(f.relative_to(SITE))] = "\n".join(m.group(0) for m in re.finditer(r"\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'", source))
    return textes


def chaines_json(valeur):
    if isinstance(valeur, str): yield valeur
    elif isinstance(valeur, dict):
        for v in valeur.values(): yield from chaines_json(v)
    elif isinstance(valeur, list):
        for v in valeur: yield from chaines_json(v)


def controle_textes():
    S = "textes"
    textes = textes_affiches()
    emojis = [(f, m.group(0)) for f, t in textes.items() for m in EMOJI.finditer(t)]
    noter(S, f"aucun émoji dans les textes affichés ({len(textes)} fichiers lus)", not emojis, emojis, "visible")
    creux = [(f, i) for f, t in textes.items() for i in INTERDITS if i in t.lower()]
    noter(S, "aucune formule interdite par CLAUDE.md", not creux, creux, "visible")
    lexique = [(f, m.group(0)) for f, t in textes.items() for m in re.finditer(r"apprenant\w*|élève\w*|étudiant\w*", t, re.IGNORECASE)]
    noter(S, "lexique du formateur : « stagiaires », jamais « apprenants »", not lexique, lexique, "visible")
    tu = [(f, t[max(0, m.start() - 30):m.end() + 30].replace("\n", " ")) for f, t in textes.items() for m in TUTOIEMENT.finditer(t)]
    noter(S, "vouvoiement : aucune forme de tutoiement repérée", not tu, tu, "visible")
    return {"fichiers": len(textes), "tutoiement": tu}


# ---------------------------------------------------------------- 2.4 livraison
def controle_livraison():
    S = "livraison"
    fichiers = [f for f in SITE.rglob("*") if f.is_file()]
    propres = [f for f in fichiers if "vendor" not in f.parts]
    noter(S, "aucun dossier ni fichier de solutions dans le site", not [f for f in fichiers if "solution" in str(f.relative_to(SITE)).lower()])
    fuites = []
    sources = [(s.name, s.read_text(encoding="utf-8")) for s in sorted(SOLUTIONS.glob("*.py"))]
    sources += [(s.name, json.loads(s.read_text(encoding="utf-8"))["solution"]) for s in sorted((RACINE / "solutions-atelier").glob("*.json"))]
    for nom, texte in sources:
        corps = [l.strip() for l in texte.splitlines() if l.strip() and not l.strip().startswith(("def ", "#", '"""'))]
        if not corps: continue
        for f in propres:
            if f.suffix in (".py", ".json", ".js", ".html", ".md", ".mjs"):
                t = f.read_text(encoding="utf-8")
                if all(l in t for l in corps): fuites.append((nom, str(f.relative_to(SITE))))
    noter(S, "aucun fichier du site ne contient le corps d'une solution de référence", not fuites, fuites)
    secrets = []
    motif = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|(?:password|passwd|mot_de_passe|secret|api[_-]?key|token)\w*\s*[:=]\s*[\"']|bearer\s+\w", re.IGNORECASE)
    for f in propres:
        if f.suffix in (".py", ".json", ".js", ".html", ".md", ".mjs", ".css", "") or f.name == "_headers":
            for m in motif.finditer(f.read_text(encoding="utf-8", errors="replace")):
                secrets.append((str(f.relative_to(SITE)), m.group(0)))
    noter(S, "aucun secret ni adresse e-mail dans le code du site (hors vendor, bibliothèques tierces non modifiées)", not secrets, secrets)
    a_verifier = [str(f.relative_to(SITE)) for f in propres if f.suffix in (".py", ".json", ".js", ".html", ".md", ".mjs", ".css") and "À VÉRIFIER" in f.read_text(encoding="utf-8", errors="replace")]
    noter(S, "aucun [À VÉRIFIER] dans le code livré", not a_verifier, a_verifier)
    essais = [str(f.relative_to(SITE)) for f in fichiers if f.name.startswith("_") and f.name != "_headers"]
    noter(S, "aucune page d'essai dans le site", not essais, essais)
    poids = lambda liste: round(sum(f.stat().st_size for f in liste) / 1e6, 2)
    pyodide = [f for f in fichiers if "pyodide" in f.parts]
    detail = {"total_Mo": poids(fichiers), "pyodide_Mo": poids(pyodide), "hors_pyodide_Mo": poids([f for f in fichiers if f not in pyodide]),
              "three_Mo": poids([f for f in fichiers if "three" in f.parts]), "codemirror_Mo": poids([f for f in fichiers if "codemirror" in f.parts]),
              "code_du_jeu_Mo": poids(propres), "nombre_de_fichiers": len(fichiers)}
    noter(S, f"poids du site : {detail['total_Mo']} Mo dont Pyodide {detail['pyodide_Mo']} Mo ; hors Pyodide {detail['hors_pyodide_Mo']} Mo", True, detail)
    licences = (SITE / "assets/LICENCES.md")
    texte = licences.read_text(encoding="utf-8") if licences.exists() else ""
    manquants = [str(f.relative_to(SITE)) for f in fichiers if "assets" in f.parts and f.name != "LICENCES.md" and f.name not in texte]
    manquants += [d for d in ("three", "pyodide", "codemirror") if d not in texte.lower()]
    noter(S, "assets/LICENCES.md cite chaque ressource importée et chaque bibliothèque de vendor/", licences.exists() and not manquants, manquants)
    noter(S, "_headers dans le dossier publié, netlify.toml et LISEZ-MOI.md à la racine du dépôt", (SITE / "_headers").exists() and (RACINE / "netlify.toml").exists() and (RACINE / "LISEZ-MOI.md").exists())
    return detail


def main():
    section = sys.argv[sys.argv.index("--section") + 1] if "--section" in sys.argv else "tout"
    global RESOLUTIONS
    if "--resolution" in sys.argv:
        l, h = sys.argv[sys.argv.index("--resolution") + 1].split("x"); RESOLUTIONS = [(int(l), int(h))]
    brut = RACINE / "qa" / "rapports" / "brut"; brut.mkdir(parents=True, exist_ok=True)
    if section == "bilan":
        tout, extra = [], {}
        for f in sorted(brut.glob(f"{VERSION}-*.json")):
            d = json.loads(f.read_text(encoding="utf-8")); tout += d.pop("resultats"); d.pop("section", None)
            for c, v in d.items():
                if isinstance(v, dict) and isinstance(extra.get(c), dict): extra[c].update(v)
                elif c == "duree_s": extra[c] = extra.get(c, 0) + v
                else: extra[c] = v
        sortie = RACINE / "qa" / "rapports" / f"{datetime.date.today().isoformat()}-{VERSION}.json"
        sortie.write_text(json.dumps({"version": VERSION, "resultats": tout, **extra}, ensure_ascii=False, indent=1), encoding="utf-8")
        echecs = [r for r in tout if not r["ok"]]
        print(f"{len(tout) - len(echecs)} contrôles réussis sur {len(tout)} ; {len(echecs)} en échec ; durée cumulée {extra.get('duree_s')} s ; résultats : {sortie}")
        for r in echecs: print(" -", r["classe"], "|", r["section"], "|", r["nom"], "|", r["detail"][:400])
        return 1 if any(r["classe"] == "bloquant" for r in echecs) else 0
    serveurs = [subprocess.Popen([sys.executable, str(RACINE / "qa/serveur.py"), str(PORT)], stderr=subprocess.DEVNULL),
                subprocess.Popen([sys.executable, str(RACINE / "qa/serveur.py"), str(PORT_SANS_ISOLEMENT), "--sans-isolement"], stderr=subprocess.DEVNULL)]
    time.sleep(1.2)
    debut = time.time()
    extra = {}
    try:
        if section in ("tout", "fonctionnement", "rendu"):
            with sync_playwright() as p:
                nav = p.chromium.launch(channel="chrome", args=CHROME)
                extra["navigateur"] = nav.version
                if section in ("tout", "fonctionnement"): controle_fonctionnement(nav)
                if section in ("tout", "rendu"): extra["mesures"] = controle_rendu(nav)
                nav.close()
            noter(section if section != "tout" else "fonctionnement", f"aucune erreur JavaScript pendant la session ({len(console)} relevée(s))", not console, console[:20])
        if section in ("tout", "statique"):
            extra["textes"] = controle_textes()
            extra["poids"] = controle_livraison()
    finally:
        for s in serveurs: s.terminate()
    extra["duree_s"] = round(time.time() - debut)
    suffixe = section + ("-" + "x".join(map(str, RESOLUTIONS[0])) if "--resolution" in sys.argv else "")
    (brut / f"{VERSION}-{suffixe}.json").write_text(json.dumps({"section": section, "resultats": resultats, **extra}, ensure_ascii=False, indent=1), encoding="utf-8")
    echecs = [r for r in resultats if not r["ok"]]
    print(f"\n{len(resultats) - len(echecs)} contrôles réussis sur {len(resultats)} ; {len(echecs)} en échec ; durée {extra['duree_s']} s")
    for r in echecs: print(" -", r["classe"], "|", r["section"], "|", r["nom"], "|", r["detail"][:400])
    return 1 if any(r["classe"] == "bloquant" for r in echecs) else 0


if __name__ == "__main__":
    sys.exit(main())
