"""API du préparateur de la Brasserie de la Fonderie (jeu des missions).

Chaque fonction enregistre une action dans le journal ; la scène 3D (ou le journal en texte)
rejoue ensuite ce journal. Aucune animation n'est déclenchée ici.
Les mêmes fonctions tournent dans le navigateur (Pyodide) et dans VS Code (Python 3.14).
"""
import sys

# ----- Réglages (modifiables par le formateur) -----
MAX_ACTIONS = 500            # au-delà : le préparateur est étourdi, l'exécution s'arrête
CAPACITE_CHARIOT = 4         # fûts par tournée (fiche du fil rouge)
PLAGE_CUVES = (18, 22)       # degrés Celsius, bornes incluses (valeur fictive du fil rouge)
GRILLE = (10, 6)             # colonnes, lignes du sol de l'entrepôt
FICHIER_STAGIAIRE = "<stagiaire>"
QUAIS = ("Q1", "Q2", "Q3", "Q4", "R")
# Série à partir de laquelle chaque outil est disponible pour le stagiaire
OUTILS_PAR_SERIE = {
    "avancer": 1, "tourner_gauche": 1, "tourner_droite": 1, "prendre": 1, "poser": 1,
    "lire_etiquette": 2, "livrer": 3, "scanner_allee": 4,
    "charger": 5, "temperature_cuve": 5, "stock": 6, "signaler": 8,
}
DIRECTIONS = ("nord", "est", "sud", "ouest")
PAS = {"nord": (0, -1), "est": (1, 0), "sud": (0, 1), "ouest": (-1, 0)}


class ActionImpossible(Exception):
    """Le préparateur ne peut pas faire cette action maintenant."""


class BoucleSansFin(Exception):
    """La limite d'actions est atteinte."""


class OutilVerrouille(Exception):
    """L'outil n'est pas encore disponible dans cette série."""


_ETAT = {}


def reinitialiser(scene=None):
    """Remet la scène dans son état de départ et vide le journal."""
    scene = scene or {}
    depart = scene.get("depart", {"case": [1, 4], "direction": "est"})
    _ETAT.clear()
    _ETAT.update({
        "journal": [],
        "case": list(depart.get("case", [1, 4])),
        "direction": depart.get("direction", "est"),
        "porte": None,
        "objets": {o["id"]: dict(o) for o in scene.get("objets", [])},
        "obstacles": [tuple(c) for c in scene.get("obstacles", [])],
        "cuves": dict(scene.get("cuves", {})),
        "stock": dict(scene.get("stock", {})),
        "futs_quai": int(scene.get("futsQuai", 0)),
        "chariot": 0,
    })


def journal():
    """Copie du journal d'actions."""
    return [dict(a) for a in _ETAT["journal"]]


def _ligne_stagiaire():
    """Numéro de la ligne du code du stagiaire qui a provoqué l'action (ou None)."""
    cadre = sys._getframe(1)
    while cadre is not None:
        if cadre.f_code.co_filename == FICHIER_STAGIAIRE:
            return cadre.f_lineno
        cadre = cadre.f_back
    return None


def _noter(action, ok=True, **champs):
    j = _ETAT["journal"]
    if len(j) >= MAX_ACTIONS:
        j.append({"n": len(j) + 1, "action": "etourdi", "ok": False, "raison": "limite_actions", "ligne": _ligne_stagiaire()})
        raise BoucleSansFin(f"Le préparateur a fait plus de {MAX_ACTIONS} actions : votre boucle ne s'arrête probablement pas.")
    entree = {"n": len(j) + 1, "action": action, "ok": ok, "ligne": _ligne_stagiaire()}
    entree.update(champs)
    j.append(entree)
    return entree


# ----- Outils du stagiaire -----

def avancer(n=1):
    """Avance de n cases dans la direction courante."""
    dx, dy = PAS[_ETAT["direction"]]
    for _ in range(int(n)):
        x, y = _ETAT["case"][0] + dx, _ETAT["case"][1] + dy
        libre = 0 <= x < GRILLE[0] and 0 <= y < GRILLE[1] and (x, y) not in _ETAT["obstacles"]
        if not libre:
            _noter("avancer", ok=False, vers=[x, y], raison="obstacle")
            raise ActionImpossible("Le préparateur ne peut pas avancer : un obstacle ou un mur lui barre la route.")
        _ETAT["case"] = [x, y]
        _noter("avancer", vers=[x, y])


def tourner_gauche():
    """Pivote d'un quart de tour vers la gauche."""
    _ETAT["direction"] = DIRECTIONS[(DIRECTIONS.index(_ETAT["direction"]) - 1) % 4]
    _noter("tourner", sens="gauche", direction=_ETAT["direction"])


def tourner_droite():
    """Pivote d'un quart de tour vers la droite."""
    _ETAT["direction"] = DIRECTIONS[(DIRECTIONS.index(_ETAT["direction"]) + 1) % 4]
    _noter("tourner", sens="droite", direction=_ETAT["direction"])


def _objet_devant():
    dx, dy = PAS[_ETAT["direction"]]
    devant = [_ETAT["case"][0] + dx, _ETAT["case"][1] + dy]
    for o in _ETAT["objets"].values():
        if o.get("case") == devant and not o.get("livre"):
            return o
    return None


def prendre():
    """Prend l'objet posé devant le préparateur. Renvoie son étiquette (dictionnaire)."""
    if _ETAT["porte"] is not None:
        _noter("prendre", ok=False, raison="mains_pleines")
        raise ActionImpossible("Le préparateur porte déjà un objet : posez-le ou livrez-le d'abord.")
    o = _objet_devant()
    if o is None:
        _noter("prendre", ok=False, raison="rien_devant")
        raise ActionImpossible("Il n'y a rien à prendre devant le préparateur.")
    return aller_chercher(o["id"])


def poser():
    """Pose devant lui l'objet que porte le préparateur."""
    if _ETAT["porte"] is None:
        _noter("poser", ok=False, raison="mains_vides")
        raise ActionImpossible("Le préparateur ne porte rien.")
    _noter("poser", objet=_ETAT["porte"])
    _ETAT["porte"] = None


def lire_etiquette():
    """Lit l'étiquette de l'objet devant le préparateur, sans le prendre."""
    o = _objet_devant()
    if o is None:
        _noter("lire", ok=False, raison="rien_devant")
        raise ActionImpossible("Il n'y a rien à lire devant le préparateur.")
    _noter("lire", objet=o["id"])
    return _etiquette(o)


def livrer(quai, ok=None):
    """Livre l'objet porté au quai nommé (Q1, Q2, Q3, Q4 ou R pour le rebut)."""
    if _ETAT["porte"] is None:
        _noter("livrer", ok=False, quai=str(quai), raison="mains_vides")
        raise ActionImpossible("Le préparateur ne porte rien : prenez un objet avant de le livrer.")
    if quai not in QUAIS:
        _noter("livrer", ok=False, quai=str(quai), raison="quai_inconnu")
        raise ActionImpossible(f"Le quai {quai!r} n'existe pas. Les quais : Q1, Q2, Q3, Q4 et R.")
    o = _ETAT["objets"][_ETAT["porte"]]
    if ok is None:
        ok = o.get("destination") in (None, quai)
    champs = {"quai": quai, "objet": o["id"]}
    if not ok:
        champs["raison"] = "mauvais_quai"
    _noter("livrer", ok=bool(ok), **champs)
    o["livre"] = quai
    _ETAT["porte"] = None


def scanner_allee():
    """Liste des étiquettes des objets encore dans l'entrepôt."""
    _noter("scanner")
    return [_etiquette(o) for o in _ETAT["objets"].values() if not o.get("livre")]


def stock():
    """État du stock : dictionnaire code de bière -> nombre."""
    _noter("stock")
    return dict(_ETAT["stock"])


def temperature_cuve(numero):
    """Température d'une cuve (C1 à C4), en degrés Celsius."""
    nom = numero if isinstance(numero, str) else f"C{numero}"
    if nom not in _ETAT["cuves"]:
        _noter("cuve", ok=False, lieu=str(nom), raison="cuve_inconnue")
        raise ActionImpossible(f"La cuve {nom!r} n'existe pas dans cette mission.")
    t = _ETAT["cuves"][nom]
    _noter("controle", lieu=nom, texte=f"{t} °C")
    return t


def charger():
    """Roule un fût du quai jusqu'au chariot. Le chariot porte 4 fûts au plus."""
    if _ETAT["chariot"] >= CAPACITE_CHARIOT:
        _noter("charger", ok=False, raison="chariot_plein", total=_ETAT["chariot"])
        raise ActionImpossible(f"Le chariot est plein : il porte {CAPACITE_CHARIOT} fûts au plus.")
    if _ETAT["futs_quai"] <= 0:
        _noter("charger", ok=False, raison="quai_vide", total=_ETAT["chariot"])
        raise ActionImpossible("Il ne reste aucun fût sur le quai.")
    _ETAT["futs_quai"] -= 1
    _ETAT["chariot"] += 1
    _noter("charger", total=_ETAT["chariot"], reste=_ETAT["futs_quai"])


def signaler(probleme):
    """Note un problème sans s'arrêter."""
    _noter("signaler", texte=str(probleme))


# ----- Outils des scénarios (écrits par le formateur dans tests.py) -----

def _etiquette(o):
    return {c: o.get(c) for c in ("id", "type", "biere", "contenance_l", "destination") if c in o}


def aller_chercher(identifiant):
    """Le préparateur va chercher un objet de la scène et le prend."""
    if _ETAT["porte"] is not None:
        _noter("prendre", ok=False, raison="mains_pleines")
        raise ActionImpossible("Le préparateur porte déjà un objet.")
    o = _ETAT["objets"].get(identifiant)
    if o is None or o.get("livre"):
        _noter("prendre", ok=False, objet=str(identifiant), raison="objet_absent")
        raise ActionImpossible(f"L'objet {identifiant!r} n'est pas dans l'entrepôt.")
    _ETAT["porte"] = identifiant
    _noter("prendre", objet=identifiant)
    return _etiquette(o)


def afficher(texte, ok=None):
    """Affiche un texte sur l'écran de contrôle de l'entrepôt."""
    champs = {"texte": str(texte)}
    _noter("ecran", ok=True if ok is None else bool(ok), **champs)


RAYONS = ("rayon-1", "rayon-2", "rayon-3")


def etiqueter(texte, ok=True):
    """Le préparateur passe au pupitre et colle une étiquette sur l'objet qu'il porte."""
    if _ETAT["porte"] is None:
        _noter("etiqueter", ok=False, texte=str(texte), raison="mains_vides")
        raise ActionImpossible("Le préparateur ne porte rien : il n'a rien à étiqueter.")
    _noter("etiqueter", ok=bool(ok), objet=_ETAT["porte"], texte=str(texte))


def ranger(rayon, texte="", ok=True):
    """Le préparateur range l'objet porté dans un rayon ; l'écran du rayon affiche un texte."""
    if _ETAT["porte"] is None:
        _noter("ranger", ok=False, rayon=str(rayon), raison="mains_vides")
        raise ActionImpossible("Le préparateur ne porte rien : il n'a rien à ranger.")
    if rayon not in RAYONS:
        _noter("ranger", ok=False, rayon=str(rayon), raison="rayon_inconnu")
        raise ActionImpossible(f"Le rayon {rayon!r} n'existe pas. Les rayons : rayon-1, rayon-2, rayon-3.")
    o = _ETAT["objets"][_ETAT["porte"]]
    _noter("ranger", ok=bool(ok), rayon=rayon, objet=o["id"], texte=str(texte))
    o["livre"] = rayon
    _ETAT["porte"] = None


def embouteiller(nombre, ok=True):
    """Le préparateur vide le fût porté en bouteilles, rangées sur le chariot : autant que nombre."""
    if _ETAT["porte"] is None:
        _noter("embouteiller", ok=False, raison="mains_vides")
        raise ActionImpossible("Le préparateur ne porte aucun fût à embouteiller.")
    o = _ETAT["objets"][_ETAT["porte"]]
    # quantite : la valeur renvoyée si c'est un nombre (60.6 donne 60 bouteilles pleines et une à moitié), sinon 0
    nombre_valide = isinstance(nombre, (int, float)) and not isinstance(nombre, bool) and nombre == nombre and abs(nombre) < 1e6
    _noter("embouteiller", ok=bool(ok), objet=o["id"], texte=str(nombre), quantite=float(nombre) if nombre_valide else 0.0)
    o["livre"] = "embouteillage"
    _ETAT["porte"] = None


def controler(lieu, texte, ok=True):
    """Le préparateur se rend à un endroit (rayon, cuve) ; l'écran du lieu affiche un texte."""
    _noter("controle", ok=bool(ok), lieu=str(lieu), texte=str(texte))


def preparer_quai(nb_futs):
    """Pose nb_futs fûts sur le quai de chargement et vide le chariot (sans action au journal)."""
    _ETAT["futs_quai"] = int(nb_futs)
    _ETAT["chariot"] = 0


def nb_charges():
    """Nombre de fûts sur le chariot."""
    return _ETAT["chariot"]


def actions(nom=None, ok=None):
    """Actions du journal, filtrées par nom et par réussite."""
    return [a for a in _ETAT["journal"] if (nom is None or a["action"] == nom) and (ok is None or a["ok"] == ok)]


OUTILS_STAGIAIRE = {
    "avancer": avancer, "tourner_gauche": tourner_gauche, "tourner_droite": tourner_droite,
    "prendre": prendre, "poser": poser, "lire_etiquette": lire_etiquette, "livrer": livrer,
    "scanner_allee": scanner_allee, "stock": stock, "temperature_cuve": temperature_cuve,
    "charger": charger, "signaler": signaler,
}
OUTILS_SCENARIO = {
    "aller_chercher": aller_chercher, "afficher": afficher, "controler": controler,
    "etiqueter": etiqueter, "ranger": ranger, "embouteiller": embouteiller,
    "preparer_quai": preparer_quai, "nb_charges": nb_charges, "actions": actions,
}

reinitialiser()
