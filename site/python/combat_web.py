"""Le championnat des robots dans le navigateur (Pyodide) : combat, bilan contre les robots d'entraînement, tournoi.

Le moteur est celui de VS Code (python/combat/ : regles.py, moteur.py, robots_entrainement.py, copiés tels quels du dossier
04-ateliers/jeux/championnat/) : mêmes robots, mêmes résultats. Ici s'ajoutent le chargement d'un robot depuis son code,
une limite de lignes par décision (une boucle sans fin fait perdre l'instant au lieu de bloquer le tournoi) et le JSON.
"""
import sys

if "/moteur/combat" not in sys.path:
    sys.path.insert(0, "/moteur/combat")

import regles as R  # noqa: E402
from moteur import combattre  # noqa: E402
from robots_entrainement import adversaires  # noqa: E402
from apprentissage import CARACTERISTIQUES, caracteristiques  # noqa: E402

# Les décisions du tournoi, au format de decisions.csv (donnees_apprentissage.py) : de quoi réentraîner le robot 2.
COLONNES_DECISIONS = ["combat_id", "tick", "robot", "adversaire", *CARACTERISTIQUES, "action", "valide", "issue", "fin", "joueur"]


def _noter(strategie, carnet):
    def jouer(etat):
        carnet.append((etat["tick"], caracteristiques(etat)))
        return strategie(etat)
    return jouer

LIGNES_MAX_PAR_DECISION = 10000


class TropLong(Exception):
    pass


def _limiter(strategie):
    bloquee = [False]                    # après une boucle sans fin, le robot n'est plus appelé : il attend jusqu'à la fin

    def appel(etat):
        if bloquee[0]:
            raise TropLong("une boucle ne s'arrête pas (relevé plus tôt dans ce combat)")
        compte = [0]

        def suivre(cadre, evenement, argument):
            if evenement == "line":
                compte[0] += 1
                if compte[0] > LIGNES_MAX_PAR_DECISION:
                    bloquee[0] = True
                    raise TropLong(f"plus de {LIGNES_MAX_PAR_DECISION} lignes pour une seule décision : une boucle ne s'arrête pas")
            return suivre

        sys.settrace(suivre)
        try:
            return strategie(etat)
        finally:
            sys.settrace(None)
    return appel


def charger(robot):
    """robot : {"nom", "code"} ou {"nom", "reference": True}. Renvoie une fabrique de stratégie (neuve à chaque combat) et l'erreur."""
    nom = robot["nom"]
    if robot.get("reference"):
        if nom not in adversaires():
            return None, {"type": "Inconnu", "ligne": None, "message": f"Pas de robot d'entraînement nommé {nom}."}
        return (lambda: adversaires()[nom]), None
    code = robot.get("code") or ""
    fichier = f"<{nom}>"

    def fabriquer():
        espace = {"__name__": "robot"}
        exec(compile(code, fichier, "exec"), espace)
        return _limiter(espace["strategie"])
    try:
        espace = {"__name__": "robot"}
        exec(compile(code, fichier, "exec"), espace)
    except SyntaxError as e:
        return None, {"type": "SyntaxError", "ligne": e.lineno, "message": f"Python ne comprend pas la ligne {e.lineno} : {e.msg}"}
    except Exception as e:
        tb, ligne = e.__traceback__, None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == fichier:
                ligne = tb.tb_lineno
            tb = tb.tb_next
        return None, {"type": type(e).__name__, "ligne": ligne, "message": f"{type(e).__name__} : {e}"}
    if not callable(espace.get("strategie")):
        return None, {"type": "SansStrategie", "ligne": None, "message": "Le code ne contient pas de fonction strategie(etat)."}
    return fabriquer, None


def combat(robot_a, robot_b):
    fa, ea = charger(robot_a)
    fb, eb = charger(robot_b)
    if ea or eb:
        return {"erreur": {"robot": "a" if ea else "b", **(ea or eb)}}
    r = combattre(fa(), fb(), robot_a["nom"], robot_b["nom"])
    refus = {}
    for l in r["journal"]:
        for c in ("a", "b"):
            if not l[f"valide_{c}"]:
                refus.setdefault(c, []).append({"tick": l["tick"], "decision": l[f"decision_{c}"], "raison": l[f"raison_{c}"]})
    r["refus"] = refus
    r["erreur"] = None
    return r


def bilan(robot):
    f, e = charger(robot)
    if e:
        return {"erreur": e}
    lignes, victoires = [], 0
    for nom in adversaires():
        r1 = combattre(f(), adversaires()[nom], robot["nom"], nom)
        r2 = combattre(adversaires()[nom], f(), nom, robot["nom"])
        victoires += (r1["vainqueur"] == "a") + (r2["vainqueur"] == "b")
        d1, d2 = r1["journal"][-1], r2["journal"][-1]
        lignes.append({"adversaire": nom,
                       "enA": {"a": "gagné", "b": "perdu", "egalite": "égalité"}[r1["vainqueur"]], "vieA": [d1["vie_a"], d1["vie_b"]], "finA": r1["fin"],
                       "enB": {"b": "gagné", "a": "perdu", "egalite": "égalité"}[r2["vainqueur"]], "vieB": [d2["vie_b"], d2["vie_a"]], "finB": r2["fin"]})
    return {"erreur": None, "lignes": lignes, "victoires": victoires, "combats": 2 * len(adversaires())}


def tournoi(robots, entrainement=False):
    """Chaque robot rencontre tous les autres, deux combats par rencontre (côtés inversés). Victoire 3, égalité 1.
    Le journal complet de chaque combat est renvoyé pour le rejeu ; robots : [{"nom", "code", "generation"}]."""
    charges, ecartes, generation = {}, [], {}
    if entrainement:
        for nom in adversaires():
            charges[nom], generation[nom] = (lambda nom=nom: adversaires()[nom]), "entraînement"
    for robot in robots:
        f, e = charger(robot)
        if e:
            ecartes.append({"nom": robot["nom"], **e})
        else:
            charges[robot["nom"]], generation[robot["nom"]] = f, robot.get("generation") or ""
    noms = list(charges)
    points = {n: {"nom": n, "generation": generation[n], "points": 0, "v": 0, "n": 0, "d": 0, "ko": 0} for n in noms}
    rencontres, journal, decisions = [], [], []
    for i, na in enumerate(noms):
        for nb in noms[i + 1:]:
            for a, b in ((na, nb), (nb, na)):
                carnet_a, carnet_b = [], []
                r = combattre(_noter(charges[a](), carnet_a), _noter(charges[b](), carnet_b), a, b)
                journal += r["journal"]
                fin = r["journal"][-1]
                issue = {"a": ("gagne", "perdu"), "b": ("perdu", "gagne"), "egalite": ("egalite", "egalite")}[r["vainqueur"]]
                par_tick = {l["tick"]: l for l in r["journal"]}
                for cote, carnet, nom, autre, iss in (("a", carnet_a, a, b, issue[0]), ("b", carnet_b, b, a, issue[1])):
                    for tick, c in carnet:
                        l = par_tick[tick]
                        decisions.append([l["combat_id"], tick, nom, autre, *c, l[f"decision_{cote}"], l[f"valide_{cote}"], iss, r["fin"], 0])
                rencontres.append({"combat_id": fin["combat_id"], "a": a, "b": b, "vainqueur": r["vainqueur"], "fin": r["fin"],
                                   "duree": fin["tick"] / R.TICKS_PAR_SECONDE, "vie_a": fin["vie_a"], "vie_b": fin["vie_b"]})
                if r["vainqueur"] == "egalite":
                    for n in (a, b):
                        points[n]["points"] += 1
                        points[n]["n"] += 1
                else:
                    g, p = (a, b) if r["vainqueur"] == "a" else (b, a)
                    points[g]["points"] += 3
                    points[g]["v"] += 1
                    points[g]["ko"] += r["fin"] == "ko"
                    points[p]["d"] += 1
    classement = sorted(points.values(), key=lambda x: (-x["points"], -x["v"], -x["ko"], x["nom"]))
    return {"classement": classement, "rencontres": rencontres, "ecartes": ecartes, "journal": journal,
            "colonnesDecisions": COLONNES_DECISIONS, "decisions": decisions}


def _json(v):
    """Les ensembles (set) deviennent des listes triées, à toute profondeur : le JSON ne connaît pas les ensembles."""
    if isinstance(v, set):
        return sorted(v)
    if isinstance(v, dict):
        return {k: _json(x) for k, x in v.items()}
    return v


def regles():
    return {k: _json(getattr(R, k)) for k in dir(R) if k.isupper()}
