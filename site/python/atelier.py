"""Moteur de l'atelier de construction (prototype).

Le stagiaire construit son programme de deux façons qui restent synchronisées :
- en posant des postes dans le hall (js/atelier/), qui écrivent le Python ;
- en écrivant le Python, que analyser() découpe en postes (arbre : un bloc if, for ou while contient ses branches).

Deux sortes de missions :
- programme : le code s'exécute de haut en bas, les tests regardent les variables à la fin et le tableau de bord ;
- fonction : la ligne def est donnée ; la fonction est appelée sur plusieurs cas (paramètres -> résultat attendu),
  comme des tests unitaires. Chaque cas est suivi ligne par ligne pour le rejeu.

Points d'entrée :
- analyser(code, fonction=None) -> {"ok", "erreur", "postes"} ;
- executer_atelier(code, tests_source, mission=None) -> exécution suivie et tests.
"""
import ast
import contextlib
import copy
import io
import json
import sys

from erreurs_fr import expliquer

# ----- Réglages -----
NOM_FICHIER = "<atelier>"
MAX_EVENEMENTS = 5000          # lignes exécutées suivies au plus (par cas)
MAX_REJEU = 400                # lignes gardées pour le rejeu (les suivantes sont comptées, pas gardées)
MAX_ELEMENTS = 40              # éléments d'une liste envoyés à la scène (au-delà : tronqué)
OPERATEURS = {ast.Add: "+=", ast.Sub: "-=", ast.Mult: "*="}


# ---------------------------------------------------------------- analyse : Python -> postes

class _Analyse:
    def __init__(self, code):
        self.avertissements = []
        self.code = code

    def texte(self, noeud):
        return ast.get_source_segment(self.code, noeud) or ""

    def valeur(self, noeud, libre=True):
        """Une valeur écrite dans le code : texte, nombre, nom de variable ; sinon une expression (texte brut) si libre."""
        if isinstance(noeud, ast.Constant) and isinstance(noeud.value, str):
            return {"type": "texte", "valeur": noeud.value}
        if isinstance(noeud, ast.Constant) and isinstance(noeud.value, (int, float)) and not isinstance(noeud.value, bool):
            return {"type": "nombre", "valeur": noeud.value}
        if isinstance(noeud, ast.UnaryOp) and isinstance(noeud.op, ast.USub) and isinstance(noeud.operand, ast.Constant) \
                and isinstance(noeud.operand.value, (int, float)) and not isinstance(noeud.operand.value, bool):
            return {"type": "nombre", "valeur": -noeud.operand.value}
        if isinstance(noeud, ast.Name):
            return {"type": "variable", "valeur": noeud.id}
        return {"type": "expression", "valeur": self.texte(noeud)} if libre else None

    def entier(self, noeud):
        v = self.valeur(noeud, libre=False)
        return v["valeur"] if v and v["type"] == "nombre" and isinstance(v["valeur"], int) else None

    @staticmethod
    def nom(noeud):
        return noeud.id if isinstance(noeud, ast.Name) else None

    @staticmethod
    def methode(appel, nom_methode):
        if isinstance(appel, ast.Call) and isinstance(appel.func, ast.Attribute) and appel.func.attr == nom_methode:
            return _Analyse.nom(appel.func.value)
        return None

    def affectation(self, dest, valeur):
        if isinstance(valeur, ast.Dict) and all(k is not None for k in valeur.keys):
            paires = [[self.valeur(k, libre=False), self.valeur(v, libre=False)] for k, v in zip(valeur.keys, valeur.values)]
            if all(a and b for a, b in paires):
                return {"type": "creer_dict", "params": {"nom": dest, "paires": paires}}
        if isinstance(valeur, ast.Set):
            elements = [self.valeur(e, libre=False) for e in valeur.elts]
            if all(elements):
                return {"type": "creer_set", "params": {"nom": dest, "elements": elements}}
        if isinstance(valeur, (ast.List, ast.Tuple)):
            elements = [self.valeur(e, libre=False) for e in valeur.elts]
            if all(elements):
                return {"type": "creer_liste" if isinstance(valeur, ast.List) else "creer_tuple", "params": {"nom": dest, "elements": elements}}
        simple = self.valeur(valeur, libre=False)
        if simple:
            return {"type": "variable", "params": {"nom": dest, "valeur": simple}}
        if isinstance(valeur, ast.Subscript) and self.nom(valeur.value):
            source, coupe = self.nom(valeur.value), valeur.slice
            if isinstance(coupe, ast.Slice) and coupe.step is None:
                debut = None if coupe.lower is None else self.entier(coupe.lower)
                fin = None if coupe.upper is None else self.entier(coupe.upper)
                if not ((coupe.lower is not None and debut is None) or (coupe.upper is not None and fin is None)):
                    return {"type": "tranche", "params": {"dest": dest, "source": source, "debut": debut, "fin": fin}}
            elif not isinstance(coupe, ast.Slice):
                indice = self.entier(coupe)
                if indice is not None:
                    return {"type": "lire_case", "params": {"dest": dest, "source": source, "indice": indice}}
                cle = self.valeur(coupe, libre=False)
                if cle:
                    return {"type": "lire_cle", "params": {"dest": dest, "source": source, "cle": cle}}
        if isinstance(valeur, ast.Call) and isinstance(valeur.func, ast.Name) and len(valeur.args) == 1 and not valeur.keywords and self.nom(valeur.args[0]):
            if valeur.func.id == "len":
                return {"type": "longueur", "params": {"dest": dest, "source": self.nom(valeur.args[0])}}
            if valeur.func.id == "sorted":
                return {"type": "trier_copie", "params": {"dest": dest, "source": self.nom(valeur.args[0])}}
        if isinstance(valeur, ast.Compare) and len(valeur.ops) == 1 and isinstance(valeur.ops[0], ast.In) and self.nom(valeur.comparators[0]):
            return {"type": "contient", "params": {"dest": dest, "source": self.nom(valeur.comparators[0]), "valeur": self.valeur(valeur.left)}}
        cible = self.methode(valeur, "sort")
        if cible and not valeur.args and not valeur.keywords:
            return {"type": "trier_sur_place", "params": {"cible": cible, "dest": dest}}
        source = self.methode(valeur, "get")
        if source and len(valeur.args) in (1, 2) and not valeur.keywords:
            cle = self.valeur(valeur.args[0], libre=False)
            defaut = self.valeur(valeur.args[1]) if len(valeur.args) == 2 else None
            if cle:
                return {"type": "lire_get", "params": {"dest": dest, "source": source, "cle": cle, "defaut": defaut}}
        # tout autre calcul : un poste de calcul, l'expression en texte
        return {"type": "calcul", "params": {"nom": dest, "op": "=", "expression": self.texte(valeur)}}

    def poste(self, instruction):
        if isinstance(instruction, ast.If):
            conditions, branches, entetes, corps, noeud = [], [], [], [], instruction
            while True:
                conditions.append(self.texte(noeud.test)); branches.append(self.liste(noeud.body)); entetes.append(noeud.lineno)
                corps.append(self.corps(noeud.body))
                if len(noeud.orelse) == 1 and isinstance(noeud.orelse[0], ast.If):
                    noeud = noeud.orelse[0]; continue
                break
            sinon = bool(noeud.orelse)
            if sinon:
                branches.append(self.liste(noeud.orelse)); corps.append(self.corps(noeud.orelse))
            return {"type": "si", "params": {"conditions": conditions, "sinon": sinon}, "branches": branches, "entetes": entetes, "corps": corps}
        if isinstance(instruction, ast.For) and not instruction.orelse and (isinstance(instruction.target, ast.Name)
                or isinstance(instruction.target, ast.Tuple) and all(isinstance(e, ast.Name) for e in instruction.target.elts)):
            cible = instruction.target.id if isinstance(instruction.target, ast.Name) else ", ".join(e.id for e in instruction.target.elts)
            return {"type": "pour", "params": {"variable": cible, "source": self.texte(instruction.iter)}, "branches": [self.liste(instruction.body)], "entetes": [instruction.lineno], "corps": [self.corps(instruction.body)]}
        if isinstance(instruction, ast.While) and not instruction.orelse:
            return {"type": "tantque", "params": {"condition": self.texte(instruction.test)}, "branches": [self.liste(instruction.body)], "entetes": [instruction.lineno], "corps": [self.corps(instruction.body)]}
        if isinstance(instruction, ast.Return):
            return {"type": "renvoyer", "params": {"expression": self.texte(instruction.value) if instruction.value is not None else ""}}
        if isinstance(instruction, ast.AugAssign) and isinstance(instruction.target, ast.Subscript) and self.nom(instruction.target.value) \
                and not isinstance(instruction.target.slice, ast.Slice) and type(instruction.op) in OPERATEURS:
            cle = self.valeur(instruction.target.slice, libre=False)
            if cle:
                return {"type": "ecrire_cle", "params": {"cible": self.nom(instruction.target.value), "cle": cle, "op": OPERATEURS[type(instruction.op)], "valeur": self.valeur(instruction.value)}}
        if isinstance(instruction, ast.AugAssign) and isinstance(instruction.target, ast.Name) and type(instruction.op) in OPERATEURS:
            return {"type": "calcul", "params": {"nom": instruction.target.id, "op": OPERATEURS[type(instruction.op)], "expression": self.texte(instruction.value)}}
        if isinstance(instruction, ast.Assign) and len(instruction.targets) == 1:
            cible = instruction.targets[0]
            if isinstance(cible, ast.Name):
                return self.affectation(cible.id, instruction.value)
            if isinstance(cible, ast.Tuple) and all(isinstance(e, ast.Name) for e in cible.elts) and self.nom(instruction.value):
                return {"type": "decomposer", "params": {"noms": [e.id for e in cible.elts], "source": self.nom(instruction.value)}}
            if isinstance(cible, ast.Subscript) and self.nom(cible.value) and not isinstance(cible.slice, ast.Slice):
                indice = self.entier(cible.slice)
                if indice is not None:
                    return {"type": "remplacer_case", "params": {"cible": self.nom(cible.value), "indice": indice, "valeur": self.valeur(instruction.value)}}
                cle = self.valeur(cible.slice, libre=False)
                if cle:
                    return {"type": "ecrire_cle", "params": {"cible": self.nom(cible.value), "cle": cle, "op": "=", "valeur": self.valeur(instruction.value)}}
            return None
        if isinstance(instruction, ast.Expr) and isinstance(instruction.value, ast.Call):
            appel = instruction.value
            if isinstance(appel.func, ast.Name) and appel.func.id == "print" and len(appel.args) == 1 and not appel.keywords:
                return {"type": "afficher", "params": {"expression": self.texte(appel.args[0])}}
            for methode, type_ in (("append", "ajouter"), ("remove", "retirer")):
                cible = self.methode(appel, methode)
                if cible and len(appel.args) == 1 and not appel.keywords:
                    return {"type": type_, "params": {"cible": cible, "valeur": self.valeur(appel.args[0])}}
            cible = self.methode(appel, "sort")
            if cible and not appel.args and not appel.keywords:
                return {"type": "trier_sur_place", "params": {"cible": cible, "dest": None}}
            cible = self.methode(appel, "add")
            if cible and len(appel.args) == 1 and not appel.keywords:
                return {"type": "ajouter_set", "params": {"cible": cible, "valeur": self.valeur(appel.args[0])}}
        return None

    @staticmethod
    def corps(instructions, indent_defaut=0, fin_defaut=0):
        """Où insérer dans une liste d'instructions : son retrait, la ligne après laquelle ajouter, la ligne d'un pass seul (à remplacer)."""
        if not instructions:
            return {"indent": indent_defaut, "fin": fin_defaut, "pass": None}
        seul_pass = len(instructions) == 1 and isinstance(instructions[0], ast.Pass)
        return {"indent": instructions[0].col_offset, "fin": instructions[-1].end_lineno,
                "pass": instructions[0].lineno if seul_pass else None}

    def liste(self, instructions):
        postes = []
        for rang, instruction in enumerate(instructions):
            # une instruction placée après un return du même bloc ne sera jamais exécutée
            if rang and isinstance(instructions[rang - 1], ast.Return) and not isinstance(instruction, ast.Pass):
                self.avertissements.append({"ligne": instruction.lineno,
                    "message": f"la ligne {instruction.lineno} ne sera jamais exécutée : elle vient après return, qui fait sortir de la fonction. Placez-la avant le return."})
            if isinstance(instruction, ast.Pass):
                continue                       # pass : un bloc vide, que le hall montre vide
            poste = self.poste(instruction)
            if poste is None:
                poste = {"type": "code_libre", "params": {"code": self.texte(instruction)}}
            poste["lignes"] = [instruction.lineno, instruction.end_lineno]
            postes.append(poste)
        return postes


def analyser(code, fonction=None):
    """Découpe le code en postes. Mission à fonction : seul le corps de la fonction devient des postes."""
    try:
        arbre = ast.parse(code, NOM_FICHIER)
    except SyntaxError as e:
        return {"ok": False, "erreur": {"ligne": e.lineno, "message": e.msg}, "postes": []}
    a = _Analyse(code)
    if not fonction:
        postes = a.liste(arbre.body)
        return {"ok": True, "erreur": None, "postes": postes, "avertissements": a.avertissements, "corps": _Analyse.corps(arbre.body)}
    definition = next((n for n in arbre.body if isinstance(n, ast.FunctionDef) and n.name == fonction["nom"]), None)
    if definition is None:
        return {"ok": False, "erreur": {"ligne": 1, "message": f"la fonction {fonction['nom']} est absente : gardez la ligne def {fonction['nom']}(…)"}, "postes": []}
    autres = [n for n in arbre.body if n is not definition]
    # une ligne écrite sans retrait, après la fonction : Python l'exécuterait hors de la fonction, et le hall ne la verrait pas
    for n in autres:
        if not isinstance(n, (ast.FunctionDef, ast.Import, ast.ImportFrom)):
            return {"ok": False, "postes": [], "erreur": {"ligne": n.lineno, "horsFonction": True,
                    "message": f"la ligne {n.lineno} est sortie de la fonction {fonction['nom']} : ajoutez 4 espaces au début de la ligne pour l'y remettre"}}
    corps = definition.body
    entete_fin = definition.body[0].end_lineno if corps and isinstance(corps[0], ast.Expr) and isinstance(getattr(corps[0], "value", None), ast.Constant) and isinstance(corps[0].value.value, str) else definition.lineno
    indent_corps = definition.body[0].col_offset if definition.body else definition.col_offset + 4
    # la docstring donnée par la mission reste dans l'en-tête de la fonction : elle ne devient pas un poste
    if corps and isinstance(corps[0], ast.Expr) and isinstance(corps[0].value, ast.Constant) and isinstance(corps[0].value.value, str):
        corps = corps[1:]
    postes = a.liste(corps)
    return {"ok": True, "erreur": None, "postes": postes, "horsFonction": len(autres),
            "parametres": [p.arg for p in definition.args.args], "avertissements": a.avertissements,
            "corps": _Analyse.corps(corps, indent_corps, entete_fin)}


# ---------------------------------------------------------------- exécution suivie

def _encoder(valeur, profondeur=0):
    """Valeur Python -> description JSON pour la scène (type + contenu)."""
    if valeur is None:
        return {"t": "None"}
    if isinstance(valeur, bool):
        return {"t": "bool", "v": valeur}
    if isinstance(valeur, (int, float)):
        return {"t": type(valeur).__name__, "v": valeur}
    if isinstance(valeur, str):
        return {"t": "str", "v": valeur}
    if isinstance(valeur, (list, tuple, set, frozenset)) and profondeur < 2:
        elements = list(valeur)
        if isinstance(valeur, (set, frozenset)):
            # un set n'a pas d'ordre : on le montre trié, pour que l'affichage ne change pas d'une exécution à l'autre
            elements.sort(key=lambda e: (type(e).__name__, repr(e)))
        return {"t": type(valeur).__name__, "v": [_encoder(e, profondeur + 1) for e in elements[:MAX_ELEMENTS]], "n": len(elements)}
    if isinstance(valeur, dict) and profondeur < 2:
        paires = list(valeur.items())
        return {"t": "dict", "v": [[_encoder(k, profondeur + 1), _encoder(v, profondeur + 1)] for k, v in paires[:MAX_ELEMENTS]], "n": len(paires)}
    return {"t": type(valeur).__name__, "r": repr(valeur)[:60]}


def _visibles(espace, exclus=()):
    return {nom: v for nom, v in espace.items()
            if nom not in exclus and not nom.startswith("_") and not callable(v) and type(v).__name__ != "module"}


def _photo(espace, exclus=()):
    return {nom: _encoder(v) for nom, v in _visibles(espace, exclus).items()}


def _erreur(e, ligne=None):
    explication, conseil = expliquer(type(e).__name__)
    return {"type": type(e).__name__, "ligne": ligne, "messageOriginal": f"{type(e).__name__}: {e}", "explication": explication, "conseil": conseil}


def _boucle_sans_fin(ligne):
    return {"type": "BoucleSansFin", "ligne": ligne, "messageOriginal": f"Plus de {MAX_EVENEMENTS} lignes exécutées",
            "explication": "Une boucle tourne sans fin : sa condition ne devient jamais fausse.",
            "conseil": "Dans le corps de la boucle, la variable de la condition doit changer pour que la boucle s'arrête."}


def _ligne_erreur(exception):
    tb, ligne = exception.__traceback__, None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == NOM_FICHIER:
            ligne = tb.tb_lineno
        tb = tb.tb_next
    return ligne


class _Suivi:
    """Note chaque ligne exécutée du code du stagiaire et l'état des variables juste avant."""

    def __init__(self, exclus, locales):
        self.trace, self.trop, self.exclus, self.locales, self.final, self.compte = [], False, exclus, locales, None, 0

    def __call__(self, cadre, evenement, argument):
        if cadre.f_code.co_filename != NOM_FICHIER:
            return None
        espace = cadre.f_locals if self.locales else cadre.f_globals
        if evenement == "line":
            self.compte += 1
            if self.compte > MAX_EVENEMENTS:
                self.trop = True
                raise RuntimeError(f"plus de {MAX_EVENEMENTS} lignes exécutées : une boucle ne s'arrête probablement jamais")
            if len(self.trace) < MAX_REJEU:
                self.trace.append({"l": cadre.f_lineno, "etat": _photo(espace, self.exclus)})
        elif evenement == "return" and self.locales and cadre.f_code.co_name != "<module>":
            self.final = _photo(espace, self.exclus)
        return self


class Resultat:
    """Ce que voient les tests d'un programme : les variables à la fin et le tableau de bord."""

    def __init__(self, variables, sorties, erreur):
        self.variables = variables
        self.sorties = sorties
        self.erreur = erreur


def _lancer_tests(tests_source, resultat):
    espace = {}
    exec(compile(tests_source, "tests.py", "exec"), espace)
    sortie = []
    for nom, fonction in espace.items():
        if not callable(fonction) or not (nom.startswith("test_") or nom.startswith("bonus_")):
            continue
        groupe = "bonus" if nom.startswith("bonus_") else "visible"
        libelle = (fonction.__doc__ or nom).strip()
        try:
            fonction(resultat)
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": True, "message": ""})
        except AssertionError as e:
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": False, "message": str(e)})
        except Exception as e:
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": False, "message": f"{type(e).__name__} : {e}"})
    return sortie


def _compiler(code):
    try:
        return compile(code, NOM_FICHIER, "exec"), None
    except SyntaxError as e:
        explication, conseil = expliquer("SyntaxError")
        return None, {"type": "SyntaxError", "ligne": e.lineno, "messageOriginal": f"SyntaxError: {e.msg}", "explication": explication, "conseil": conseil}


def _executer_programme(code, tests_source):
    espace = {"__name__": "__atelier__", "__builtins__": __builtins__}
    initiales = set(espace)
    suivi = _Suivi(initiales, False)
    compile_, erreur = _compiler(code)
    tampon = io.StringIO()
    if compile_ is not None:
        try:
            with contextlib.redirect_stdout(tampon):
                sys.settrace(suivi)
                try:
                    exec(compile_, espace)
                finally:
                    sys.settrace(None)
        except Exception as e:
            erreur = _boucle_sans_fin(_ligne_erreur(e)) if suivi.trop else _erreur(e, _ligne_erreur(e))
    sorties = tampon.getvalue().splitlines()
    finales = _visibles(espace, initiales)
    tests = [] if erreur else _lancer_tests(tests_source, Resultat(copy.deepcopy(finales), sorties, erreur))
    return {"mode": "programme", "erreur": erreur, "sortie": sorties, "trace": suivi.trace, "traceTronquee": suivi.compte > MAX_REJEU,
            "etatFinal": _photo(espace, initiales), "tests": tests}


def _texte(v):
    return repr(v)


def _egal(obtenu, attendu):
    """Égalité des résultats ; un nombre à virgule est comparé à 1e-6 près (0.1 * 3 n'est pas exactement 0.3)."""
    if isinstance(attendu, float) or isinstance(obtenu, float):
        return isinstance(obtenu, (int, float)) and not isinstance(obtenu, bool) and abs(obtenu - attendu) < 1e-6
    if isinstance(attendu, (list, tuple)) and isinstance(obtenu, type(attendu)) and len(obtenu) == len(attendu):
        return all(_egal(a, b) for a, b in zip(obtenu, attendu))
    return type(obtenu) is type(attendu) and obtenu == attendu or (type(obtenu) in (int, float) and type(attendu) in (int, float) and obtenu == attendu)


def _decoder(valeur):
    """Valeurs des cas (JSON) -> Python : {"__tuple__": [...]} redevient un tuple."""
    if isinstance(valeur, dict):
        if set(valeur) == {"__tuple__"}:
            return tuple(_decoder(v) for v in valeur["__tuple__"])
        return {k: _decoder(v) for k, v in valeur.items()}
    if isinstance(valeur, list):
        return [_decoder(v) for v in valeur]
    return valeur


def _executer_fonction(code, mission):
    """Appelle la fonction sur chaque cas de la mission : paramètres -> résultat attendu."""
    fonction = mission["fonction"]
    compile_, erreur = _compiler(code)
    resultat = {"mode": "fonction", "erreur": erreur, "cas": [], "tests": [], "sortie": []}
    if compile_ is None:
        return resultat
    espace = {"__name__": "__atelier__", "__builtins__": __builtins__}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(compile_, espace)
    except Exception as e:
        resultat["erreur"] = _erreur(e, _ligne_erreur(e))
        return resultat
    f = espace.get(fonction["nom"])
    if not callable(f):
        explication, conseil = expliquer("NameError")
        resultat["erreur"] = {"type": "FonctionAbsente", "ligne": 1, "messageOriginal": f"La fonction {fonction['nom']} est absente",
                              "explication": f"Gardez la ligne def {fonction['nom']}(…) donnée par la mission.", "conseil": conseil}
        return resultat
    for i, cas in enumerate(mission["cas"]):
        cas = dict(cas, args=_decoder(cas["args"]), attendu=_decoder(cas["attendu"]))
        args = copy.deepcopy(cas["args"])
        avant = copy.deepcopy(args)
        suivi, tampon, erreur_cas, retour = _Suivi((), True), io.StringIO(), None, None
        try:
            with contextlib.redirect_stdout(tampon):
                sys.settrace(suivi)
                try:
                    retour = f(*args)
                finally:
                    sys.settrace(None)
        except Exception as e:
            erreur_cas = _boucle_sans_fin(_ligne_erreur(e)) if suivi.trop else _erreur(e, _ligne_erreur(e))
        appel = f"{fonction['nom']}({', '.join(_texte(a) for a in cas['args'])})"
        ok, message = False, ""
        if erreur_cas:
            message = f"{appel} s'arrête ligne {erreur_cas['ligne']} : {erreur_cas['messageOriginal']}." if erreur_cas["type"] != "BoucleSansFin" \
                else f"{appel} : la boucle de la ligne {erreur_cas['ligne']} ne s'arrête jamais."
        elif not _egal(retour, cas["attendu"]):
            message = f"{appel} renvoie {_texte(retour)} ; attendu : {_texte(cas['attendu'])}."
            if retour is None:
                message += " None : la fonction n'a pas atteint de return."
        elif any(a != b for a, b in zip(args, avant)) and cas.get("inchange", mission.get("inchange", False)):
            change = next(k for k, (a, b) in enumerate(zip(args, avant)) if a != b)
            message = f"{appel} renvoie le bon résultat, mais a modifié son paramètre : {fonction['parametres'][change]} vaut maintenant {_texte(args[change])}."
        else:
            ok = True
        noms = fonction["parametres"]
        resultat["cas"].append({
            "numero": i, "groupe": cas.get("groupe", "visible"), "libelle": cas.get("libelle", appel), "appel": appel,
            "args": {noms[k]: _encoder(a) for k, a in enumerate(cas["args"])}, "attendu": _encoder(cas["attendu"]),
            "retour": _encoder(retour), "erreur": erreur_cas, "ok": ok, "message": message, "trace": suivi.trace,
            "traceTronquee": suivi.compte > MAX_REJEU, "etatFinal": suivi.final if suivi.final is not None else (suivi.trace[-1]["etat"] if suivi.trace else {}),
            "sortie": tampon.getvalue().splitlines()})
        resultat["tests"].append({"nom": f"cas_{i}", "libelle": cas.get("libelle") or f"{appel} renvoie {_texte(cas['attendu'])}", "groupe": cas.get("groupe", "visible"),
                                  "ok": ok, "message": message})
    return resultat


def executer_atelier(code, tests_source, mission=None):
    if isinstance(mission, str):
        mission = json.loads(mission) if mission else None
    if mission and mission.get("fonction"):
        return _executer_fonction(code, mission)
    return _executer_programme(code, tests_source)
