"""Le moteur du sumo : calcule un combat entre deux stratégies, tour par tour.

Le même fichier tourne dans VS Code (combat.py, tournoi.py) et dans le navigateur (Pyodide) :
mêmes stratégies, mêmes graines, mêmes résultats. Aucune bibliothèque en dehors de Python.

Une stratégie est une fonction strategie(etat) qui renvoie une action (une chaîne de regles.ACTIONS).
"""
import copy
import random

import regles as R

COLONNES_JOURNAL = ["combat_id", "tour", "strategie_a", "strategie_b", "action_a", "action_b",
                    "valide_a", "valide_b", "raison_a", "raison_b", "position_a", "position_b",
                    "energie_a", "energie_b", "ancre_a", "ancre_b", "distance", "vainqueur", "fin"]


def _etat_pour(moi, autre, sens, tour, historique):
    """L'état vu par un robot. sens : +1 pour A (regarde à droite), -1 pour B."""
    bord_moi = moi["position"] if sens == 1 else R.TAILLE_PLATEFORME - 1 - moi["position"]
    bord_autre = R.TAILLE_PLATEFORME - 1 - autre["position"] if sens == 1 else autre["position"]
    return {
        "tour": tour,
        "moi": dict(moi),
        "adversaire": dict(autre),
        "distance": abs(autre["position"] - moi["position"]),
        "bord_derriere_moi": bord_moi,
        "bord_derriere_adversaire": bord_autre,
        "dernier_coup_adversaire": historique[-1][1] if historique else None,
        "historique": list(historique),
    }


def _choisir(strategie, etat, energie):
    """Appelle la stratégie. Renvoie (action, valide, raison) ; une action non valide ne fait rien."""
    try:
        action = strategie(copy.deepcopy(etat))
    except Exception as e:                       # une stratégie qui plante perd son tour, le combat continue
        return None, False, f"exception:{type(e).__name__}: {e}"
    if not isinstance(action, str):
        return None, False, f"pas_une_chaine:{type(action).__name__}"
    if action not in R.ACTIONS:
        return action, False, "action_inconnue"
    if R.COUT[action] > energie:
        return action, False, "energie_insuffisante"
    return action, True, ""


def combattre(strategie_a, strategie_b, nom_a="a", nom_b="b", graine=R.GRAINE, combat_id=None):
    """Joue un combat complet. Renvoie {"vainqueur": "a" | "b" | "egalite", "fin": ..., "journal": [lignes]}."""
    random.seed(graine)                         # le hasard des stratégies est reproductible
    combat_id = combat_id or f"{nom_a}-vs-{nom_b}-{graine}"
    a = {"position": R.DEPART_A, "energie": R.ENERGIE_DEPART, "ancre": False}
    b = {"position": R.DEPART_B, "energie": R.ENERGIE_DEPART, "ancre": False}
    hist_a, hist_b, journal = [], [], []
    vainqueur, fin = None, None

    for tour in range(1, R.TOURS_MAX + 1):
        a["ancre"] = b["ancre"] = False
        etat_a = _etat_pour(a, b, 1, tour, hist_a)
        etat_b = _etat_pour(b, a, -1, tour, hist_b)
        act_a, ok_a, raison_a = _choisir(strategie_a, etat_a, a["energie"])
        act_b, ok_b, raison_b = _choisir(strategie_b, etat_b, b["energie"])
        fait_a = act_a if ok_a else None
        fait_b = act_b if ok_b else None
        # 2. énergie dépensée
        if fait_a: a["energie"] -= R.COUT[fait_a]
        if fait_b: b["energie"] -= R.COUT[fait_b]
        # 3. ancrages
        a["ancre"] = fait_a == "ancrer"
        b["ancre"] = fait_b == "ancrer"
        # 4. déplacements (A va vers +1, B vers -1)
        voulu_a = a["position"] + {"avancer": 1, "reculer": -1}.get(fait_a, 0)
        voulu_b = b["position"] + {"avancer": -1, "reculer": 1}.get(fait_b, 0)
        if voulu_a >= voulu_b:                  # ils voudraient la même case, ou se croiser : ceux qui avancent restent sur place
            if fait_a == "avancer": voulu_a = a["position"]
            if fait_b == "avancer": voulu_b = b["position"]
            if voulu_a >= voulu_b:              # cas restant : un seul avançait vers l'autre qui reculait trop peu
                voulu_a, voulu_b = a["position"], b["position"]
        a["position"], b["position"] = voulu_a, voulu_b
        # 5. poussées, au contact seulement
        contact = b["position"] - a["position"] == 1
        pousse_a, pousse_b = fait_a == "pousser" and contact, fait_b == "pousser" and contact
        if pousse_a and not pousse_b:
            b["position"] += R.POUSSEE_ANCRE if b["ancre"] else R.POUSSEE
        elif pousse_b and not pousse_a:
            a["position"] -= R.POUSSEE_ANCRE if a["ancre"] else R.POUSSEE
        # 6. recharges
        if fait_a == "recharger": a["energie"] = min(R.ENERGIE_MAX, a["energie"] + R.RECHARGE)
        if fait_b == "recharger": b["energie"] = min(R.ENERGIE_MAX, b["energie"] + R.RECHARGE)

        hist_a.append((act_a, act_b)); hist_b.append((act_b, act_a))
        dehors_a = not 0 <= a["position"] < R.TAILLE_PLATEFORME
        dehors_b = not 0 <= b["position"] < R.TAILLE_PLATEFORME
        if dehors_a or dehors_b:
            vainqueur = "egalite" if dehors_a and dehors_b else ("b" if dehors_a else "a")
            fin = "sortie"
        elif tour == R.TOURS_MAX:
            centre = (R.TAILLE_PLATEFORME - 1) / 2
            ecart_a, ecart_b = abs(a["position"] - centre), abs(b["position"] - centre)
            if ecart_a != ecart_b:
                vainqueur = "a" if ecart_a < ecart_b else "b"
            elif a["energie"] != b["energie"]:
                vainqueur = "a" if a["energie"] > b["energie"] else "b"
            else:
                vainqueur = "egalite"
            fin = "tours_max"
        journal.append({
            "combat_id": combat_id, "tour": tour, "strategie_a": nom_a, "strategie_b": nom_b,
            "action_a": act_a, "action_b": act_b, "valide_a": ok_a, "valide_b": ok_b,
            "raison_a": raison_a, "raison_b": raison_b,
            "position_a": a["position"], "position_b": b["position"],
            "energie_a": a["energie"], "energie_b": b["energie"],
            "ancre_a": a["ancre"], "ancre_b": b["ancre"],
            "distance": b["position"] - a["position"], "vainqueur": vainqueur or "", "fin": fin or "",
        })
        if vainqueur:
            break
    return {"vainqueur": vainqueur, "fin": fin, "journal": journal}


def ecrire_journal(journal, chemin):
    """Enregistre un ou plusieurs journaux (liste de lignes) en CSV, séparateur « ; »."""
    import csv
    with open(chemin, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLONNES_JOURNAL, delimiter=";")
        w.writeheader()
        w.writerows(journal)
