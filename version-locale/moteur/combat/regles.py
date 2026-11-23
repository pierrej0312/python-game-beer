"""Les règles du championnat des robots de la Fonderie. Lisez-les : votre robot en dépend.

Le combat se joue en temps réel, découpé en instants (des « ticks ») : 10 par seconde, 60 secondes au plus.
À chaque instant où votre robot est libre, le moteur appelle votre fonction strategie(etat) : elle renvoie une action.
Un coup ne part pas tout de suite : il se prépare, frappe, puis le robot récupère. Pendant tout ce temps,
votre fonction n'est pas appelée. Lire ce que fait l'adversaire, et choisir le bon moment, c'est tout le jeu.

Toutes les mesures sont des nombres entiers : les distances en centimètres, la vie et l'énergie en points.
"""

TICKS_PAR_SECONDE = 10
DUREE_MAX = 60 * TICKS_PAR_SECONDE       # 600 instants : au-delà, le robot qui a le plus de vie gagne

RING = 1000                              # le ring fait 10 m entre les cordes
DEPART_A, DEPART_B = 350, 650            # positions de départ (A à gauche, B à droite)
CONTACT = 80                             # deux robots ne se rapprochent pas à moins de 80 cm

VIE = 100
ENERGIE_MAX = 100
ENERGIE_DEPART = 50
RECUPERATION_ENERGIE = 1                 # énergie regagnée à chaque instant

AVANCE = 30                              # cm par instant en avançant
RECUL = 25                               # cm par instant en reculant

# Les coups : nombre d'instants de préparation, la frappe (1 instant), la récupération ; portée en cm ;
# dégâts ; énergie dépensée au départ ; instants où la cible reste sonnée ; recul de la cible en cm.
COUPS = {
    "direct":     {"preparation": 2, "recuperation": 3, "portee": 160, "degats": 6,  "energie": 8,  "sonne": 3,  "recul": 30},
    "crochet":    {"preparation": 5, "recuperation": 6, "portee": 140, "degats": 15, "energie": 18, "sonne": 6,  "recul": 70},
    "coup_bas":   {"preparation": 3, "recuperation": 5, "portee": 150, "degats": 9,  "energie": 10, "sonne": 5,  "recul": 40},
    "projection": {"preparation": 3, "recuperation": 7, "portee": 110, "degats": 12, "energie": 15, "sonne": 9,  "recul": 150},
    "special":    {"preparation": 7, "recuperation": 9, "portee": 150, "degats": 28, "energie": 60, "sonne": 12, "recul": 200},
}
# Deux gardes, et aucune n'arrête tout : la garde haute bloque les coups de poing, la garde basse bloque le balayage
# et la projection (le robot accroupi ne se laisse pas soulever). Un coup qui n'est pas bloqué touche normalement.
BLOQUE_PAR = {
    "garde":       {"direct", "crochet", "special"},
    "garde_basse": {"coup_bas", "projection"},
}
GARDE_DIVISE = 5                         # un coup bloqué ne fait qu'un cinquième des dégâts (arrondi en dessous)
GARDE_SONNE = 2                          # et immobilise la cible 2 instants
CONTRE = 3, 2                            # touché pendant la préparation ou la récupération d'un coup : dégâts x 3 / 2

ESQUIVE = {"duree": 4, "energie": 12, "recul": 40}   # 4 instants ; intouchable aux instants 1 à 3 ; recule de 40 cm par instant

ACTIONS = ["attendre", "avancer", "reculer", "garde", "garde_basse", "direct", "crochet", "coup_bas", "projection", "esquive", "special"]
