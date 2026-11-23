"""Moteur du jeu 2 : la ligne de production de la brasserie (05-jeu2-builder.md).

Le plateau construit par le stagiaire est traduit en Python par js/ligne/generateur.js.
Ce module exécute ce code avec les machines de la brasserie, suit son exécution ligne par ligne
(pour que les bouteilles de la scène suivent le code), puis lance les tests du niveau.

Point d'entrée : executer_ligne(code, niveau, tests_source, suivre) -> dict
"""
import copy
import sys

from erreurs_fr import expliquer

# ----- Réglages -----
MAX_EVENEMENTS = 30000          # lignes exécutées suivies au plus (la scène n'en rejoue pas davantage)
CONTENANCE_CL = 33              # bouteille de 33 cl (fiche du fil rouge)
NOM_FICHIER = "<ligne>"


class ActionImpossible(Exception):
    """Une machine ne peut pas traiter ce qu'elle reçoit (bouteille vide à capsuler, par exemple)."""


class _Etat:
    def __init__(self, donnees):
        self.donnees = donnees          # {"C1": [...], "stock": [...]}
        self.quais = {}                 # quai -> liste d'envois (bouteille ou casier)
        self.rebut = []
        self.sorties = []
        self.journal = []               # gestes des machines, dans l'ordre


_ETAT = _Etat({})


def _cle(bouteille):
    """Identifie une bouteille sur tout le plateau : sa source et son numéro (deux cuves numérotent chacune à partir de 1)."""
    return f"{bouteille.get('_source', 'stock')}:{bouteille.get('numero')}"


def _copie(bouteille):
    return {c: v for c, v in bouteille.items() if not c.startswith("_")}


def _noter(action, bouteille=None, **details):
    ligne = None
    cadre = sys._getframe(2)
    while cadre is not None:
        if cadre.f_code.co_filename == NOM_FICHIER:
            ligne = cadre.f_lineno
            break
        cadre = cadre.f_back
    entree = {"n": len(_ETAT.journal) + 1, "action": action, "ligne": ligne}
    if isinstance(bouteille, dict):
        entree["bouteille"] = bouteille.get("numero")
        entree["cle"] = _cle(bouteille)
    entree.update(details)
    _ETAT.journal.append(entree)


def _verifier_bouteille(objet, machine):
    if isinstance(objet, list):
        raise ActionImpossible(f"La {machine} a reçu un casier entier. Elle traite une bouteille à la fois : placez-la avant la mise en casiers.")
    if not isinstance(objet, dict) or "numero" not in objet:
        raise ActionImpossible(f"La {machine} n'a pas reçu de bouteille.")


# ---------- les machines de la brasserie ----------

def cuve(nom):
    """Les bouteilles vides du brassin de la cuve, une par une."""
    if nom not in _ETAT.donnees:
        raise ActionImpossible(f"La cuve {nom} n'a pas de brassin pour ce niveau.")
    return [dict(b, _source=nom) for b in _ETAT.donnees[nom]]


def stock():
    """Les bouteilles qui attendent dans la zone de stock, une par une."""
    return [dict(b) for b in _ETAT.donnees.get("stock", [])]


def remplir(bouteille):
    """Verse une dose dans la bouteille, sans dépasser son niveau cible.

    Par défaut la dose remplit la bouteille d'un coup (33 cl). Un niveau peut fixer une dose plus petite
    (_dose, plusieurs passages nécessaires) ou un niveau cible plus bas (_cible, bouteille mal remplie).
    """
    _verifier_bouteille(bouteille, "remplisseuse")
    cible = bouteille.get("_cible", CONTENANCE_CL)
    dose = bouteille.get("_dose", cible)
    volume = bouteille.get("volume_cl", 0)
    if volume >= cible:
        raise ActionImpossible(f"La bouteille {bouteille['numero']} est déjà pleine ({volume} cl) : la remplisseuse n'a plus rien à verser.")
    bouteille["volume_cl"] = min(cible, volume + dose)
    _noter("remplir", bouteille, volume_cl=bouteille["volume_cl"])
    return bouteille


def capsuler(bouteille):
    _verifier_bouteille(bouteille, "capsuleuse")
    if bouteille.get("volume_cl", 0) == 0:
        raise ActionImpossible(f"La capsuleuse a reçu la bouteille {bouteille['numero']} vide : placez la remplisseuse avant la capsuleuse.")
    if bouteille.get("capsule"):
        raise ActionImpossible(f"La bouteille {bouteille['numero']} a déjà sa capsule : une seule capsuleuse par ligne.")
    bouteille["capsule"] = True
    _noter("capsuler", bouteille)
    return bouteille


def etiqueter(bouteille, biere):
    _verifier_bouteille(bouteille, "étiqueteuse")
    if bouteille.get("volume_cl", 0) == 0:
        raise ActionImpossible(f"L'étiqueteuse a reçu la bouteille {bouteille['numero']} vide : on étiquette une bouteille remplie.")
    if bouteille.get("etiquette"):
        raise ActionImpossible(f"La bouteille {bouteille['numero']} porte déjà une étiquette : une seule étiqueteuse sur son chemin.")
    bouteille["etiquette"] = biere
    _noter("etiqueter", bouteille, etiquette=biere)
    return bouteille


def expedier(envoi, quai):
    """Le quai d'expédition reçoit une bouteille ou un casier plein."""
    if isinstance(envoi, list):
        copie = [_copie(b) for b in envoi]
        _ETAT.quais.setdefault(quai, []).append(copie)
        _noter("expedier", None, quai=quai, casier=[_cle(b) for b in envoi])
    else:
        _ETAT.quais.setdefault(quai, []).append(_copie(envoi))
        _noter("expedier", envoi, quai=quai)


def rebut(bouteille):
    _ETAT.rebut.append(_copie(bouteille))
    _noter("rebut", bouteille)


OUTILS = {"cuve": cuve, "stock": stock, "remplir": remplir, "capsuler": capsuler,
          "etiqueter": etiqueter, "expedier": expedier, "rebut": rebut}


# ---------- exécution suivie ligne par ligne ----------

def _valeur_suivie(valeur):
    if isinstance(valeur, list):
        return len(valeur)
    if isinstance(valeur, (int, float, str, bool)) or valeur is None:
        return valeur
    return str(valeur)


def _executer(code, donnees, suivre, tracer):
    global _ETAT
    _ETAT = _Etat(copy.deepcopy(donnees))
    espace = {"__name__": "__ligne__", "__builtins__": __builtins__}
    espace.update(OUTILS)
    espace["print"] = lambda *args, sep=" ", end="\n", **_: _ETAT.sorties.append(sep.join(str(a) for a in args))
    trace = []
    trop = [False]

    def suivi(cadre, evenement, argument):
        if cadre.f_code.co_filename != NOM_FICHIER:
            return None
        if evenement == "line":
            if len(trace) >= MAX_EVENEMENTS:
                trop[0] = True
                return suivi
            b = cadre.f_locals.get("bouteille")
            valeurs = {nom: _valeur_suivie(cadre.f_globals[nom]) for nom in suivre if nom in cadre.f_globals}
            trace.append({"l": cadre.f_lineno, "b": _cle(b) if isinstance(b, dict) and "numero" in b else None, "v": valeurs})
        return suivi

    erreur = None
    try:
        compile_ = compile(code, NOM_FICHIER, "exec")
        if tracer:
            sys.settrace(suivi)
        try:
            exec(compile_, espace)
        finally:
            sys.settrace(None)
    except ActionImpossible as e:
        erreur = {"type": "ActionImpossible", "ligne": _ligne_erreur(e), "messageOriginal": str(e),
                  "explication": str(e), "conseil": "Corrigez l'ordre ou le réglage des machines sur le plateau, puis relancez la ligne."}
    except Exception as e:  # le code généré est valide : une erreur ici vient d'un réglage (valeur d'une condition…)
        explication, conseil = expliquer(type(e).__name__)
        erreur = {"type": type(e).__name__, "ligne": _ligne_erreur(e), "messageOriginal": f"{type(e).__name__}: {e}",
                  "explication": explication, "conseil": conseil}
    finales = {nom: _valeur_suivie(espace[nom]) for nom in suivre if nom in espace}
    return {"etat": _ETAT, "trace": trace, "erreur": erreur, "variables": finales, "traceTronquee": trop[0]}


def _ligne_erreur(exception):
    tb = exception.__traceback__
    ligne = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == NOM_FICHIER:
            ligne = tb.tb_lineno
        tb = tb.tb_next
    return ligne


# ---------- résultats vus par les tests ----------

class Resultat:
    """Ce que la ligne a produit : ce que chaque quai a reçu, le rebut, le tableau de bord, les bacs."""

    def __init__(self, execution):
        e = execution["etat"]
        self._quais = e.quais
        self.rebut = e.rebut
        self.sorties = e.sorties
        self.variables = execution["variables"]
        self.erreur = execution["erreur"]

    def quai(self, nom):
        return self._quais.get(nom, [])

    def bouteilles(self, nom):
        """Les bouteilles reçues par un quai, casiers défaits."""
        tout = []
        for envoi in self.quai(nom):
            tout.extend(envoi if isinstance(envoi, list) else [envoi])
        return tout

    def casiers(self, nom):
        return [envoi for envoi in self.quai(nom) if isinstance(envoi, list)]


def _lancer_tests(tests_source, resultats):
    espace = {}
    exec(compile(tests_source, "tests.py", "exec"), espace)
    sortie = []
    for nom, fonction in espace.items():
        if not callable(fonction) or not (nom.startswith("test_") or nom.startswith("bonus_")):
            continue
        groupe = "bonus" if nom.startswith("bonus_") else "visible"
        r = resultats[groupe]
        libelle = (fonction.__doc__ or nom).strip()
        if r is None:
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": False, "message": "Le brassin du lendemain n'a pas pu passer sur la ligne."})
            continue
        try:
            fonction(r)
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": True, "message": ""})
        except AssertionError as e:
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": False, "message": str(e)})
        except Exception as e:
            sortie.append({"nom": nom, "libelle": libelle, "groupe": groupe, "ok": False, "message": f"{type(e).__name__} : {e}"})
    return sortie


def executer_ligne(code, niveau, tests_source, suivre):
    """Exécute la ligne sur le brassin du jour (suivi ligne par ligne), puis sur celui du lendemain, et lance les tests."""
    jour = _executer(code, niveau["donnees"], suivre, tracer=True)
    journal = _ETAT.journal
    lendemain = _executer(code, niveau["donneesLendemain"], suivre, tracer=False) if niveau.get("donneesLendemain") else None
    resultats = {"visible": None if jour["erreur"] else Resultat(jour),
                 "bonus": None if (lendemain is None or lendemain["erreur"]) else Resultat(lendemain)}
    tests = _lancer_tests(tests_source, resultats) if not jour["erreur"] else []
    etat = jour["etat"]
    return {
        "niveauId": niveau["id"],
        "erreur": jour["erreur"],
        "sortie": etat.sorties,
        "trace": jour["trace"],
        "traceTronquee": jour["traceTronquee"],
        "journal": journal,
        "quais": {q: len(v) for q, v in etat.quais.items()},
        "rebut": len(etat.rebut),
        "variables": jour["variables"],
        "tests": tests,
        "erreurLendemain": lendemain["erreur"] if lendemain else None,
    }
