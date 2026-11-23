"""Les robots d'entraînement. Lisez-les : ce sont des exemples de stratégies, du plus simple au plus rusé."""
import random

import regles


def foncer(etat):
    """Avance, pousse dès qu'il touche, recharge quand il n'a plus assez d'énergie."""
    energie = etat["moi"]["energie"]
    if etat["distance"] == 1:
        if energie >= regles.COUT["pousser"]:
            return "pousser"
        return "recharger"
    if energie >= 1:
        return "avancer"
    return "recharger"


def prudent(etat):
    """Garde ses forces, s'ancre quand l'adversaire est au contact, pousse quand l'adversaire est au bord."""
    moi = etat["moi"]
    if etat["distance"] == 1:
        if etat["bord_derriere_adversaire"] <= 1 and moi["energie"] >= regles.COUT["pousser"]:
            return "pousser"
        if moi["energie"] >= regles.COUT["ancrer"]:
            return "ancrer"
        return "recharger"
    if etat["bord_derriere_moi"] <= 1 and moi["energie"] >= 1:
        return "avancer"                        # trop près du bord : il revient vers le centre
    if moi["energie"] < 6:
        return "recharger"
    return "avancer"


def hasard(etat):
    """Joue au hasard parmi les actions qu'il peut payer."""
    possibles = [action for action, cout in regles.COUT.items() if cout <= etat["moi"]["energie"]]
    return random.choice(possibles)


def reactif(etat):
    """Répond au dernier coup de l'adversaire."""
    dernier = etat["dernier_coup_adversaire"]
    energie = etat["moi"]["energie"]
    if etat["distance"] == 1:
        if dernier == "pousser" and energie >= regles.COUT["ancrer"]:
            return "ancrer"                     # il vient de pousser : il pousse sans doute encore
        if dernier in ("recharger", "ancrer") and energie >= regles.COUT["pousser"]:
            return "pousser"                    # il se repose ou se protège : c'est le moment
        if energie >= regles.COUT["pousser"]:
            return "pousser"
        return "recharger"
    if energie >= 1:
        return "avancer"
    return "recharger"


def econome(etat):
    """Recharge jusqu'au maximum, puis attaque en une seule fois."""
    moi = etat["moi"]
    if etat["distance"] == 1 and moi["energie"] >= regles.COUT["pousser"]:
        return "pousser"
    if moi["energie"] < regles.ENERGIE_MAX - 1 and etat["distance"] > 1:
        return "recharger"
    if etat["distance"] > 1:
        return "avancer"
    if moi["energie"] >= regles.COUT["ancrer"]:
        return "ancrer"
    return "recharger"


REFERENCES = {"foncer": foncer, "prudent": prudent, "hasard": hasard, "reactif": reactif, "econome": econome}
