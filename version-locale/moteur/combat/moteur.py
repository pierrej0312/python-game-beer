"""Le moteur du championnat : il fait combattre deux stratégies, instant par instant, et tient le journal du combat.

Vous n'avez pas besoin de le modifier ; vous pouvez le lire. Les règles et leurs valeurs sont dans regles.py.
Le même moteur existe en JavaScript dans le site du jeu (jeu au clavier, labo des neurones) : les deux donnent
exactement le même combat, instant par instant (tous les nombres sont des entiers).
"""
import copy

import regles as R

PHASES_COUP = ("preparation", "frappe", "recuperation")
COLONNES_JOURNAL = ["combat_id", "tick", "robot_a", "robot_b",
                    "decision_a", "valide_a", "raison_a", "action_a", "phase_a", "position_a", "vie_a", "energie_a", "effet_a", "degats_a",
                    "decision_b", "valide_b", "raison_b", "action_b", "phase_b", "position_b", "vie_b", "energie_b", "effet_b", "degats_b",
                    "distance", "vainqueur", "fin"]


class Robot:
    def __init__(self, position):
        self.position = position
        self.vie = R.VIE
        self.energie = R.ENERGIE_DEPART
        self.phase = "libre"          # libre, avance, recul, garde, garde_basse, attente, preparation, frappe, recuperation, esquive, sonne
        self.coup = None              # le coup en cours (direct, crochet, coup_bas, projection, special)
        self.reste = 0                # instants qui restent dans la phase
        self.pas_esquive = 0          # 1 à 4 pendant une esquive
        self.dernier_coup = None      # le dernier coup lancé
        self.nouveau_sonne = False

    def action_visible(self):
        """Ce que l'autre robot voit faire celui-ci."""
        if self.phase in PHASES_COUP:
            return self.coup
        return {"avance": "avancer", "recul": "reculer", "garde": "garde", "garde_basse": "garde_basse", "esquive": "esquive", "sonne": "sonne"}.get(self.phase, "rien")


def _etat(moi, autre, cote, tick):
    """Ce que la stratégie reçoit. Une copie : la modifier ne change rien au combat."""
    bord = (lambda r: r.position) if cote == "a" else (lambda r: R.RING - r.position)
    bord_autre = (lambda r: R.RING - r.position) if cote == "a" else (lambda r: r.position)
    return {
        "tick": tick,
        "temps": tick / R.TICKS_PAR_SECONDE,
        "distance": abs(autre.position - moi.position),
        "moi": {"vie": moi.vie, "energie": moi.energie, "bord_derriere": bord(moi)},
        "adversaire": {"vie": autre.vie, "energie": autre.energie, "bord_derriere": bord_autre(autre),
                       "action": autre.action_visible(), "phase": autre.phase if autre.phase != "attente" else "libre",
                       "reste": autre.reste if autre.phase in ("preparation", "recuperation", "sonne") else 0},
        "dernier_coup_adversaire": autre.dernier_coup,
    }


def _choisir(strategie, etat):
    """Appelle la stratégie. Renvoie (action, valide, raison)."""
    try:
        action = strategie(copy.deepcopy(etat))
    except Exception as e:                       # la stratégie a planté : le robot attend cet instant
        return None, False, f"exception:{type(e).__name__}: {e}"[:120]
    if not isinstance(action, str):
        return repr(action)[:30], False, f"pas_une_chaine:{type(action).__name__}"
    if action not in R.ACTIONS:
        return action[:30], False, "action_inconnue"
    cout = R.COUPS[action]["energie"] if action in R.COUPS else R.ESQUIVE["energie"] if action == "esquive" else 0
    if cout > etat["moi"]["energie"]:
        return action, False, "energie_insuffisante"
    return action, True, ""


def _demarrer(robot, action):
    if action in R.COUPS:
        robot.energie -= R.COUPS[action]["energie"]
        robot.phase, robot.coup, robot.reste = "preparation", action, R.COUPS[action]["preparation"]
        robot.dernier_coup = action
    elif action == "esquive":
        robot.energie -= R.ESQUIVE["energie"]
        robot.phase, robot.coup, robot.reste, robot.pas_esquive = "esquive", None, R.ESQUIVE["duree"], 0
    else:
        robot.phase, robot.coup = {"attendre": "attente", "avancer": "avance", "reculer": "recul", "garde": "garde", "garde_basse": "garde_basse"}[action], None


def _ecarter(a, b, priorite):
    """Garde les robots dans le ring et à CONTACT cm au moins l'un de l'autre. priorite : le robot qui ne bouge pas ('a', 'b' ou None)."""
    a.position = max(0, min(R.RING, a.position))
    b.position = max(0, min(R.RING, b.position))
    manque = R.CONTACT - (b.position - a.position)
    if manque > 0:
        if priorite == "a":
            b.position += manque
        elif priorite == "b":
            a.position -= manque
        else:
            a.position -= manque // 2
            b.position += manque - manque // 2
        if a.position < 0:                       # contre les cordes : l'autre recule à sa place
            b.position -= a.position
            a.position = 0
        if b.position > R.RING:
            a.position -= b.position - R.RING
            b.position = R.RING


def combattre(strategie_a, strategie_b, nom_a="A", nom_b="B", combat_id=None):
    """Fait combattre deux stratégies. Renvoie {"vainqueur": "a" | "b" | "egalite", "fin": "ko" | "temps", "journal": [...]}."""
    combat_id = combat_id or f"{nom_a}-vs-{nom_b}"
    a, b = Robot(R.DEPART_A), Robot(R.DEPART_B)
    journal = []
    vainqueur = fin = None
    for tick in range(1, R.DUREE_MAX + 1):
        # 1. les robots libres choisissent, en même temps, chacun sur ce qu'il voit au début de l'instant
        etats = {"a": _etat(a, b, "a", tick), "b": _etat(b, a, "b", tick)}
        decisions = {}
        for cote, robot, strategie in (("a", a, strategie_a), ("b", b, strategie_b)):
            robot.nouveau_sonne = False
            if robot.phase in ("libre", "avance", "recul", "garde", "garde_basse", "attente"):
                action, valide, raison = _choisir(strategie, etats[cote])
                decisions[cote] = (action, valide, raison)
                if valide:
                    _demarrer(robot, action)
                else:
                    robot.phase, robot.coup = "attente", None
            else:
                decisions[cote] = ("", True, "")
            if robot.phase == "esquive":
                robot.pas_esquive += 1

        # 2. les déplacements
        for robot, sens in ((a, 1), (b, -1)):
            if robot.phase == "avance":
                robot.position += sens * R.AVANCE
            elif robot.phase == "recul":
                robot.position -= sens * R.RECUL
            elif robot.phase == "esquive":
                robot.position -= sens * R.ESQUIVE["recul"]
        _ecarter(a, b, None)

        # 3. les coups qui frappent à cet instant (les deux peuvent frapper en même temps : échange de coups)
        distance = b.position - a.position
        effets = {"a": "", "b": ""}
        degats = {"a": 0, "b": 0}
        coups = []
        for cote, robot, cible in (("a", a, b), ("b", b, a)):
            if robot.phase != "frappe":
                continue
            c = R.COUPS[robot.coup]
            if distance > c["portee"]:
                effets[cote] = "rate"
            elif cible.phase == "esquive" and cible.pas_esquive <= 3:
                effets[cote] = "esquive"
            elif robot.coup in R.BLOQUE_PAR.get(cible.phase, ()):
                coups.append((cote, cible, c["degats"] // R.GARDE_DIVISE, R.GARDE_SONNE, 10))
                effets[cote] = "bloque"
            else:
                d = c["degats"]
                if cible.phase in ("preparation", "recuperation"):
                    d = d * R.CONTRE[0] // R.CONTRE[1]
                    effets[cote] = "contre"
                else:
                    effets[cote] = "touche"
                coups.append((cote, cible, d, c["sonne"], c["recul"]))
        for cote, cible, d, sonne, recul in coups:
            cible.vie = max(0, cible.vie - d)
            degats[cote] = d
            cible.phase, cible.coup, cible.reste, cible.nouveau_sonne = "sonne", None, sonne, True
            cible.position += -recul if cible is a else recul
            _ecarter(a, b, "b" if cible is a else "a")

        # ce que fait chaque robot pendant cet instant (avant la fin des phases) : c'est ce que montre le rejeu
        vus = {"a": (a.action_visible(), a.phase), "b": (b.action_visible(), b.phase)}

        # 4. la fin des phases, l'énergie qui revient
        for robot in (a, b):
            if robot.nouveau_sonne:
                pass
            elif robot.phase == "preparation":
                robot.reste -= 1
                if robot.reste == 0:
                    robot.phase = "frappe"
            elif robot.phase == "frappe":
                robot.phase, robot.reste = "recuperation", R.COUPS[robot.coup]["recuperation"]
            elif robot.phase in ("recuperation", "sonne", "esquive"):
                robot.reste -= 1
                if robot.reste == 0:
                    robot.phase, robot.coup = "libre", None
            robot.energie = min(R.ENERGIE_MAX, robot.energie + R.RECUPERATION_ENERGIE)

        if a.vie == 0 or b.vie == 0:
            vainqueur = "egalite" if a.vie == b.vie == 0 else ("a" if b.vie == 0 else "b")
            fin = "ko"
        elif tick == R.DUREE_MAX:
            vainqueur = "a" if a.vie > b.vie else "b" if b.vie > a.vie else "egalite"
            fin = "temps"

        ligne = {"combat_id": combat_id, "tick": tick, "robot_a": nom_a, "robot_b": nom_b}
        for cote, robot in (("a", a), ("b", b)):
            action, valide, raison = decisions[cote]
            ligne.update({f"decision_{cote}": action or "", f"valide_{cote}": valide, f"raison_{cote}": raison,
                          f"action_{cote}": vus[cote][0], f"phase_{cote}": vus[cote][1], f"position_{cote}": robot.position,
                          f"vie_{cote}": robot.vie, f"energie_{cote}": robot.energie, f"effet_{cote}": effets[cote], f"degats_{cote}": degats[cote]})
        ligne.update({"distance": b.position - a.position, "vainqueur": vainqueur or "", "fin": fin or ""})
        journal.append(ligne)
        if vainqueur:
            break
    return {"vainqueur": vainqueur, "fin": fin, "journal": journal}


def ecrire_journal(journal, chemin):
    """Écrit le journal en CSV (séparateur « ; »), une ligne par instant : à lire avec pandas."""
    import csv
    with open(chemin, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLONNES_JOURNAL, delimiter=";")
        w.writeheader()
        w.writerows(journal)


def ecrire_rejeu(resultat, nom_a, nom_b, chemin):
    """Écrit le combat dans un fichier .json, à ouvrir dans le jeu en ligne (bouton « Revoir un combat ») pour le voir en 3D."""
    import json
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "nomA": nom_a, "nomB": nom_b, "vainqueur": resultat["vainqueur"], "fin": resultat["fin"],
                   "journal": resultat["journal"]}, f, ensure_ascii=False)
