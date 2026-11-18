"""Exécute le code d'un stagiaire et les tests d'une mission, et renvoie un résultat structuré.

Utilisé par le navigateur (Pyodide, dans le worker) et par version-locale/lancer_tests.py (Python 3.14).
Entrée : le code du stagiaire (texte), le contenu de tests.py (texte), la mission (dictionnaire de mission.json).
Sortie : un dictionnaire sérialisable en JSON (tests, journal, sortie, erreur, étoiles).
"""
import ast
import contextlib
import io
import tokenize
import traceback

import api_robot
import erreurs_fr

MAX_LIGNES_SORTIE = 200
FICHIER_STAGIAIRE = api_robot.FICHIER_STAGIAIRE
FICHIER_TESTS = "<tests>"


class _EchecTest(AssertionError):
    pass


def _egal(obtenu, attendu):
    if obtenu != attendu:
        raise _EchecTest(f"Attendu : {attendu!r} ; obtenu : {obtenu!r}")


class _AssertionsLisibles(ast.NodeTransformer):
    """Transforme « assert a == b » (sans message) en comparaison qui dit Attendu / Obtenu."""

    def visit_Assert(self, noeud):
        t = noeud.test
        if noeud.msg is None and isinstance(t, ast.Compare) and len(t.ops) == 1 and isinstance(t.ops[0], ast.Eq):
            appel = ast.Expr(ast.Call(ast.Name("_egal", ast.Load()), [t.left, t.comparators[0]], []))
            return ast.copy_location(appel, noeud)
        return noeud


def _ligne_stagiaire(exc):
    """Dernière ligne du code du stagiaire dans la pile de l'exception."""
    if isinstance(exc, SyntaxError) and exc.filename == FICHIER_STAGIAIRE:
        return exc.lineno
    ligne = None
    for cadre in traceback.extract_tb(exc.__traceback__):
        if cadre.filename == FICHIER_STAGIAIRE:
            ligne = cadre.lineno
    return ligne


def _decrire_erreur(exc, nom_type=None):
    nom = nom_type or type(exc).__name__
    explication, conseil = erreurs_fr.expliquer(nom)
    if isinstance(exc, SyntaxError):
        original = exc.msg or str(exc)
    elif isinstance(exc, KeyError):
        original = f"clé absente : {exc.args[0]!r}" if exc.args else "clé absente"
    else:
        original = str(exc)
    if nom in ("ActionImpossible", "BoucleSansFin", "OutilVerrouille"):
        conseil = original or conseil
    return {"type": nom, "ligne": _ligne_stagiaire(exc), "messageOriginal": f"{nom}: {original}" if original else nom,
            "explication": explication, "conseil": conseil}


def compter_lignes(code):
    """Nombre de lignes de code : sans lignes vides, sans commentaires, sans docstrings."""
    try:
        arbre = ast.parse(code)
    except SyntaxError:
        return None
    doc = set()
    for noeud in ast.walk(arbre):
        if isinstance(noeud, (ast.Module, ast.FunctionDef, ast.ClassDef)) and noeud.body:
            premier = noeud.body[0]
            if isinstance(premier, ast.Expr) and isinstance(premier.value, ast.Constant) and isinstance(premier.value.value, str):
                doc.update(range(premier.lineno, premier.end_lineno + 1))
    lignes = set()
    ignores = (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.ENDMARKER, tokenize.ENCODING)
    for jeton in tokenize.generate_tokens(io.StringIO(code).readline):
        if jeton.type not in ignores:
            lignes.update(range(jeton.start[0], jeton.end[0] + 1))
    return len(lignes - doc)


def _verrou(nom, serie_requise):
    def outil_verrouille(*args, **kwargs):
        raise api_robot.OutilVerrouille(f"L'outil {nom}() se débloque à la série {serie_requise}.")
    return outil_verrouille


def _espace_stagiaire(mission):
    serie = mission.get("serie", 1)
    autorises = mission.get("outilsAutorises")
    ns = {"__name__": "__main__"}
    for nom, fonction in api_robot.OUTILS_STAGIAIRE.items():
        requis = api_robot.OUTILS_PAR_SERIE.get(nom, 1)
        disponible = (nom in autorises) if autorises is not None else (serie >= requis)
        ns[nom] = fonction if disponible else _verrou(nom, requis)
    return ns


def executer(code, tests_source, mission):
    """Exécute le code du stagiaire puis les tests. Renvoie le résultat de la mission."""
    scene = mission.get("scene", {})
    resultat = {"missionId": mission.get("id"), "sortie": [], "erreur": None, "journal": [], "tests": [],
                "nbActions": 0, "limiteAtteinte": False, "nbLignes": compter_lignes(code), "etoiles": [False, False, False]}
    tampon = io.StringIO()
    api_robot.reinitialiser(scene)
    ns = _espace_stagiaire(mission)

    # 1. Compiler puis exécuter le code du stagiaire
    try:
        with contextlib.redirect_stdout(tampon):
            exec(compile(code, FICHIER_STAGIAIRE, "exec"), ns)
    except KeyboardInterrupt as exc:
        resultat["erreur"] = _decrire_erreur(exc)
    except BaseException as exc:  # erreur de syntaxe ou exception au niveau du module
        resultat["erreur"] = _decrire_erreur(exc)
    resultat["journal"] = api_robot.journal()

    attendue = mission.get("fonctionAttendue")
    if resultat["erreur"] is None and attendue and not callable(ns.get(attendue)):
        explication, conseil = erreurs_fr.expliquer("FonctionAbsente")
        resultat["erreur"] = {"type": "FonctionAbsente", "ligne": None,
                              "messageOriginal": f"La fonction {attendue}() est introuvable.",
                              "explication": explication, "conseil": conseil}

    # 2. Préparer les tests (même espace de noms que le stagiaire, plus les outils des scénarios)
    tests = []
    ns_tests = dict(ns)
    ns_tests.update(api_robot.OUTILS_STAGIAIRE)
    ns_tests.update(api_robot.OUTILS_SCENARIO)
    ns_tests["_egal"] = _egal
    arbre = ast.fix_missing_locations(_AssertionsLisibles().visit(ast.parse(tests_source, FICHIER_TESTS)))
    exec(compile(arbre, FICHIER_TESTS, "exec"), ns_tests)
    for nom, objet in ns_tests.items():
        for prefixe, groupe in (("test_", "visible"), ("bonus_", "bonus"), ("cache_", "cache")):
            if nom.startswith(prefixe) and callable(objet):
                tests.append((groupe, nom, objet))
    ordre = {"visible": 0, "bonus": 1, "cache": 2}
    tests.sort(key=lambda t: ordre[t[0]])  # tri stable : l'ordre d'écriture est gardé dans chaque groupe

    # 3. Lancer les tests : chacun repart d'une scène neuve
    for groupe, nom, fonction in tests:
        libelle = (fonction.__doc__ or nom).strip()
        fiche = {"nom": nom, "libelle": libelle, "groupe": groupe, "ok": False, "message": None, "journal": []}
        if resultat["erreur"] is not None:
            fiche["message"] = "Le test n'a pas pu tourner : corrigez d'abord l'erreur."
        else:
            api_robot.reinitialiser(scene)
            try:
                with contextlib.redirect_stdout(tampon):
                    fonction()
                fiche["ok"] = True
            except _EchecTest as exc:
                fiche["message"] = str(exc)
            except AssertionError as exc:
                fiche["message"] = str(exc) or "Le résultat n'est pas celui attendu."
            except KeyboardInterrupt as exc:
                resultat["erreur"] = _decrire_erreur(exc)
                fiche["message"] = "Exécution arrêtée."
            except Exception as exc:
                d = _decrire_erreur(exc)
                ou = f" (ligne {d['ligne']} de votre code)" if d["ligne"] else ""
                fiche["message"] = f"{d['messageOriginal']}{ou}. {d['explication']}"
                fiche["erreur"] = d
            fiche["journal"] = api_robot.journal()
        resultat["tests"].append(fiche)

    # 4. Le scénario principal : c'est lui que la scène rejoue
    scenario = ns_tests.get(mission.get("scenarioPrincipal", "scenario_principal"))
    if resultat["erreur"] is None and callable(scenario):
        api_robot.reinitialiser(scene)
        try:
            with contextlib.redirect_stdout(tampon):
                scenario()
        except KeyboardInterrupt as exc:
            resultat["erreur"] = _decrire_erreur(exc)
        except Exception as exc:
            resultat["erreur"] = _decrire_erreur(exc)
        resultat["journal"] = api_robot.journal()

    # 5. Sortie, étoiles
    lignes = tampon.getvalue().splitlines()
    if len(lignes) > MAX_LIGNES_SORTIE:
        lignes = lignes[:MAX_LIGNES_SORTIE] + ["Sortie tronquée : plus de 200 lignes."]
    resultat["sortie"] = lignes
    resultat["nbActions"] = len(resultat["journal"])
    resultat["limiteAtteinte"] = any(a["action"] == "etourdi" for a in resultat["journal"])

    visibles = [t for t in resultat["tests"] if t["groupe"] == "visible"]
    bonus = [t for t in resultat["tests"] if t["groupe"] == "bonus"]
    etoile1 = bool(visibles) and all(t["ok"] for t in visibles) and resultat["erreur"] is None
    regle = mission.get("etoiles", {})
    if regle.get("critere") == "actions":
        mesure = resultat["nbActions"]
    else:
        mesure = resultat["nbLignes"]
    etoile2 = etoile1 and mesure is not None and mesure <= regle.get("max", 10 ** 9)
    etoile3 = etoile1 and bool(bonus) and all(t["ok"] for t in bonus)
    resultat["mesureEtoile2"] = mesure
    resultat["etoiles"] = [etoile1, etoile2, etoile3]
    return resultat
