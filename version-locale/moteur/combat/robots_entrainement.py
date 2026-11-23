"""Les robots d'entraînement : six adversaires au style marqué, pour essayer le vôtre.

Ils n'utilisent que des if / elif et le dictionnaire etat : lisez-les, ils montrent comment on écrit une stratégie.
"""
import regles as R


class Hasard:
    """Un tirage au hasard reproductible (le même en Python et dans le jeu en ligne) : graine fixe, mêmes nombres."""
    def __init__(self, graine=2026):
        self.a = graine & 0xFFFFFFFF

    def suivant(self):
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def peut(etat, action):
    """Vrai si le robot a assez d'énergie pour cette action."""
    cout = R.COUPS[action]["energie"] if action in R.COUPS else R.ESQUIVE["energie"] if action == "esquive" else 0
    return etat["moi"]["energie"] >= cout


def boxeur(etat):
    """Avance et enchaîne les directs ; punit d'un crochet un adversaire qui récupère ; balaie un robot en garde haute."""
    adv, d = etat["adversaire"], etat["distance"]
    if adv["phase"] == "recuperation" and d <= 140 and peut(etat, "crochet"):
        return "crochet"
    if adv["action"] == "garde" and d <= 140 and peut(etat, "coup_bas"):
        return "coup_bas"
    if d <= 160 and peut(etat, "direct"):
        return "direct"
    if d <= 160:
        return "garde"
    return "avancer"


def cogneur(etat):
    """Cherche le gros coup : crochet à portée, spécial dès qu'il peut."""
    d = etat["distance"]
    if d <= 150 and peut(etat, "special"):
        return "special"
    if d <= 140 and peut(etat, "crochet"):
        return "crochet"
    if d <= 140:
        return "reculer"
    return "avancer"


def mur(etat):
    """Se protège quand un coup arrive (garde basse contre le balayage et la projection, garde haute sinon),
    contre-attaque quand l'adversaire récupère : un crochet s'il a le temps (5 instants de préparation), sinon un direct."""
    adv, d = etat["adversaire"], etat["distance"]
    if adv["phase"] in ("recuperation", "sonne") and d <= 140 and adv["reste"] >= 5 and peut(etat, "crochet"):
        return "crochet"
    if adv["phase"] in ("recuperation", "sonne") and d <= 160 and peut(etat, "direct"):
        return "direct"
    if adv["phase"] in ("preparation", "frappe") and d <= 200:
        if adv["action"] in ("coup_bas", "projection"):
            return "garde_basse"
        return "garde"
    if d > 170:
        return "avancer"
    return "garde"


def lutteur(etat):
    """Attrape les robots en garde haute, frappe au visage ceux qui se baissent ; sinon, des directs."""
    adv, d = etat["adversaire"], etat["distance"]
    if adv["action"] == "garde" and d <= 110 and peut(etat, "projection"):
        return "projection"
    if adv["action"] == "garde_basse" and d <= 160 and peut(etat, "direct"):
        return "direct"
    if d > 110:
        return "avancer"
    if peut(etat, "direct"):
        return "direct"
    return "garde"


def danseur(etat):
    """Reste à distance, esquive les coups qui arrivent, frappe les robots qui récupèrent."""
    adv, d = etat["adversaire"], etat["distance"]
    if adv["phase"] == "preparation" and d <= 170 and peut(etat, "esquive"):
        return "esquive"
    if adv["phase"] in ("recuperation", "sonne") and d <= 160 and peut(etat, "direct"):
        return "direct"
    if d < 180 and etat["moi"]["bord_derriere"] > 50:
        return "reculer"
    if d > 220:
        return "avancer"
    return "garde"


def fabriquer_hasard(graine=2026):
    h = Hasard(graine)

    def hasard(etat):
        """Choisit une action au hasard parmi celles qu'il peut payer."""
        possibles = [a for a in R.ACTIONS if peut(etat, a)]
        return possibles[int(h.suivant() * len(possibles))]
    return hasard


REFERENCES = {"boxeur": boxeur, "cogneur": cogneur, "mur": mur, "lutteur": lutteur, "danseur": danseur}


def adversaires():
    """Les six robots d'entraînement, le hasard recréé à chaque appel (même tirage à chaque combat)."""
    return {**REFERENCES, "hasard": fabriquer_hasard()}
