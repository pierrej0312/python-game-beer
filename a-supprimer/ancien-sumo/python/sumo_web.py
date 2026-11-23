"""Le sumo des robots dans le navigateur (Pyodide) : combats, bilan contre les robots d'entraînement, tournoi.

Le moteur est celui de VS Code (python/sumo/ : regles.py, moteur_combat.py, strategies_reference.py, copiés tels quels
du dossier 04-ateliers/jeux/tournoi/) : mêmes stratégies, mêmes graines, mêmes résultats.
Ici s'ajoutent : le chargement d'un robot depuis son code (texte), une limite de lignes par coup (une boucle sans fin
fait perdre le tour au lieu de bloquer le tournoi) et les résultats en JSON pour la page.
"""
import sys

if "/moteur/sumo" not in sys.path:
    sys.path.insert(0, "/moteur/sumo")

import regles as R  # noqa: E402
from moteur_combat import combattre  # noqa: E402
from strategies_reference import REFERENCES  # noqa: E402
from apprentissage import caracteristiques  # noqa: E402

# Les décisions du tournoi, au format de decisions.csv (donnees_apprentissage.py) : de quoi réentraîner les robots 2 et 3.
COLONNES_DECISIONS = ["combat_id", "tour", "robot", "adversaire", "distance", "energie_moi", "energie_adversaire",
                      "bord_moi", "bord_adversaire", "adversaire_a_pousse", "action", "au_hasard", "valide", "issue", "fin"]


def _noter(strategie, carnet):
    def jouer(etat):
        try:
            carnet.append((etat["tour"], caracteristiques(etat)))
        except Exception:
            carnet.append((etat["tour"], [None] * 6))
        return strategie(etat)
    return jouer

LIGNES_MAX_PAR_COUP = 20000          # au-delà, le coup est perdu (« exception:TropLong ») et le combat continue


class TropLong(Exception):
    pass


def _limiter(strategie):
    """Enveloppe une stratégie : chaque appel compte ses lignes et s'arrête au-delà de LIGNES_MAX_PAR_COUP."""
    def appel(etat):
        compte = [0]

        def suivre(cadre, evenement, argument):
            if evenement == "line":
                compte[0] += 1
                if compte[0] > LIGNES_MAX_PAR_COUP:
                    raise TropLong(f"plus de {LIGNES_MAX_PAR_COUP} lignes pour un seul coup : une boucle ne s'arrête pas")
            return suivre

        sys.settrace(suivre)
        try:
            return strategie(etat)
        finally:
            sys.settrace(None)
    return appel


def charger(robot):
    """robot : {"nom", "code"} ou {"nom", "reference": True}. Renvoie (stratégie, erreur) ; erreur : None ou un dictionnaire."""
    nom = robot["nom"]
    if robot.get("reference"):
        if nom not in REFERENCES:
            return None, {"type": "Inconnu", "ligne": None, "message": f"Pas de robot d'entraînement nommé {nom}."}
        return REFERENCES[nom], None
    espace = {"__name__": "robot_" + "".join(c if c.isalnum() else "_" for c in nom)}
    try:
        exec(compile(robot.get("code") or "", f"<{nom}>", "exec"), espace)
    except SyntaxError as e:
        return None, {"type": "SyntaxError", "ligne": e.lineno, "message": f"Python ne comprend pas la ligne {e.lineno} : {e.msg}"}
    except Exception as e:                                  # une erreur au chargement (import inconnu, nom mal écrit...)
        tb, ligne = e.__traceback__, None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == f"<{nom}>":
                ligne = tb.tb_lineno
            tb = tb.tb_next
        return None, {"type": type(e).__name__, "ligne": ligne, "message": f"{type(e).__name__} : {e}"}
    f = espace.get("strategie")
    if not callable(f):
        return None, {"type": "SansStrategie", "ligne": None, "message": "Le code ne contient pas de fonction strategie(etat)."}
    return _limiter(f), None


def _resume(r):
    erreurs = {}
    for ligne in r["journal"]:
        for cote in ("a", "b"):
            if not ligne[f"valide_{cote}"]:
                erreurs.setdefault(cote, []).append({"tour": ligne["tour"], "raison": ligne[f"raison_{cote}"], "action": ligne[f"action_{cote}"]})
    return erreurs


def combat(robot_a, robot_b, graine=None):
    """Un combat. Renvoie {"vainqueur", "fin", "journal", "refus", "erreur"} ; erreur si un robot ne se charge pas."""
    sa, ea = charger(robot_a)
    sb, eb = charger(robot_b)
    if ea or eb:
        return {"erreur": {"robot": "a" if ea else "b", **(ea or eb)}}
    r = combattre(sa, sb, robot_a["nom"], robot_b["nom"], graine=R.GRAINE if graine is None else graine)
    r["refus"] = _resume(r)
    r["erreur"] = None
    return r


def bilan(robot):
    """Le robot contre chaque robot d'entraînement, en A puis en B. Comme combat.py sans argument."""
    s, e = charger(robot)
    if e:
        return {"erreur": e}
    lignes, victoires = [], 0
    for nom, autre in REFERENCES.items():
        r1 = combattre(s, autre, robot["nom"], nom)
        r2 = combattre(autre, s, nom, robot["nom"])
        victoires += (r1["vainqueur"] == "a") + (r2["vainqueur"] == "b")
        lignes.append({"adversaire": nom,
                       "enA": {"a": "gagné", "b": "perdu", "egalite": "égalité"}[r1["vainqueur"]], "toursA": len(r1["journal"]),
                       "enB": {"b": "gagné", "a": "perdu", "egalite": "égalité"}[r2["vainqueur"]], "toursB": len(r2["journal"])})
    return {"erreur": None, "lignes": lignes, "victoires": victoires, "combats": 2 * len(REFERENCES)}


def tournoi(robots, references=False):
    """Chaque robot rencontre tous les autres, deux combats par rencontre (côtés inversés), comme tournoi.py.
    robots : [{"nom", "code", "generation"}]. Victoire 3 points, égalité 1. Les robots qui ne se chargent pas sont écartés."""
    charges, ecartes, generation = {}, [], {}
    if references:
        for nom in REFERENCES:
            charges[nom] = REFERENCES[nom]
            generation[nom] = "entraînement"
    for robot in robots:
        s, e = charger(robot)
        if e:
            ecartes.append({"nom": robot["nom"], **e})
        else:
            charges[robot["nom"]] = s
            generation[robot["nom"]] = robot.get("generation") or ""
    noms = list(charges)
    points = {n: {"nom": n, "generation": generation[n], "points": 0, "v": 0, "n": 0, "d": 0} for n in noms}
    rencontres, journal, decisions = [], [], []
    for i, na in enumerate(noms):
        for nb in noms[i + 1:]:
            for a, b in ((na, nb), (nb, na)):
                carnet_a, carnet_b = [], []
                r = combattre(_noter(charges[a], carnet_a), _noter(charges[b], carnet_b), a, b)
                journal += r["journal"]
                issue = {"a": ("gagne", "perdu"), "b": ("perdu", "gagne"), "egalite": ("egalite", "egalite")}[r["vainqueur"]]
                for cote, carnet, nom, autre, iss in (("a", carnet_a, a, b, issue[0]), ("b", carnet_b, b, a, issue[1])):
                    for (tour, c), ligne in zip(carnet, r["journal"]):
                        decisions.append([ligne["combat_id"], tour, nom, autre, *c, ligne[f"action_{cote}"], False,
                                          ligne[f"valide_{cote}"], iss, r["fin"]])
                rencontres.append({"combat_id": r["journal"][0]["combat_id"], "a": a, "b": b, "vainqueur": r["vainqueur"],
                                   "fin": r["fin"], "tours": len(r["journal"])})
                if r["vainqueur"] == "egalite":
                    for n in (a, b):
                        points[n]["points"] += 1
                        points[n]["n"] += 1
                else:
                    g, p = (a, b) if r["vainqueur"] == "a" else (b, a)
                    points[g]["points"] += 3
                    points[g]["v"] += 1
                    points[p]["d"] += 1
    classement = sorted(points.values(), key=lambda x: (-x["points"], -x["v"], x["nom"]))
    return {"classement": classement, "rencontres": rencontres, "ecartes": ecartes, "journal": journal,
            "colonnesDecisions": COLONNES_DECISIONS, "decisions": decisions}


def regles():
    """Les constantes de regles.py, pour la page (taille de la plateforme, énergie...)."""
    return {k: getattr(R, k) for k in dir(R) if k.isupper()}
