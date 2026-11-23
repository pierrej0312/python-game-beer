// Les modèles de départ des trois générations de robots (04-jeu3-tournoi.md § 11). Les mêmes fichiers existent pour VS Code
// dans 04-ateliers/jeux/tournoi/ : strategie.py (génération 1), robot2_modele.py, robot3_modele.py.
export const MODELES = {
  1: `"""Votre robot de sumo · génération 1, classique. Binôme : (vos prénoms)

Votre robot est la fonction strategie(etat). À chaque tour, elle reçoit l'état du combat
et renvoie une action : "avancer", "reculer", "pousser", "ancrer" ou "recharger".
Les règles sont dans l'onglet Règles (regles.py).
"""


def strategie(etat):
    if etat["distance"] == 1:
        return "pousser"
    return "avancer"
`,
  2: `"""Votre robot de sumo · génération 2, machine learning. Binôme : (vos prénoms)

Les règles de ce robot ne sont pas écrites à l'intuition : elles viennent d'un arbre de décision
entraîné sur les décisions des robots gagnants (notebook robot2_arbre.ipynb, export_text).
Recopiez l'arbre en if / elif. L'arbre parle avec les six nombres calculés au début de la fonction.
"""
import regles


def strategie(etat):
    distance = etat["distance"]
    energie_moi = etat["moi"]["energie"]
    energie_adversaire = etat["adversaire"]["energie"]
    bord_moi = etat["bord_derriere_moi"]
    bord_adversaire = etat["bord_derriere_adversaire"]
    adversaire_a_pousse = 1 if etat["dernier_coup_adversaire"] == "pousser" else 0

    # Recopiez ici les règles de l'arbre. Une ligne « |--- energie_moi <= 0.50 » devient « if energie_moi <= 0.50: »,
    # la ligne « class: recharger » en dessous devient « action = "recharger" ».
    action = "recharger"

    # sécurité : une action trop chère est refusée, et le robot perdrait son tour
    if regles.COUT[action] > energie_moi:
        action = "recharger"
    return action
`,
  3: `"""Votre robot de sumo · génération 3, réseau de neurones. Binôme : (vos prénoms)

Le cerveau de ce robot est un réseau de neurones entraîné sur les décisions des robots gagnants,
dans le labo des neurones (mode Sumo) ou dans le notebook. Collez la ligne « CERVEAU = {...} » exportée
à la place de « CERVEAU = None ». La stratégie fait le calcul couche par couche, avec la fonction neurone.
"""
import regles

CERVEAU = None


def neurone(entrees, poids, biais):
    return sum(e * p for e, p in zip(entrees, poids)) + biais


def caracteristiques(etat):
    """Les six nombres que voit le robot : les mêmes que pendant l'entraînement, dans le même ordre."""
    return [etat["distance"], etat["moi"]["energie"], etat["adversaire"]["energie"],
            etat["bord_derriere_moi"], etat["bord_derriere_adversaire"],
            1 if etat["dernier_coup_adversaire"] == "pousser" else 0]


def strategie(etat):
    if CERVEAU is None:
        return "recharger"
    valeurs = [x / 10 for x in caracteristiques(etat)]        # comme à l'entraînement : les entrées divisées par 10
    couches = CERVEAU["couches"]
    for numero, couche in enumerate(couches):
        valeurs = [neurone(valeurs, poids, biais) for poids, biais in couche]
        if numero < len(couches) - 1:
            valeurs = [max(0, v) for v in valeurs]              # ReLU sur les couches cachées
    action = CERVEAU["actions"][valeurs.index(max(valeurs))]   # la sortie la plus forte décide
    if regles.COUT[action] > etat["moi"]["energie"]:
        action = "recharger"
    return action
`,
};

export const GENERATIONS = { 1: "Génération 1 · classique", 2: "Génération 2 · machine learning", 3: "Génération 3 · réseau de neurones" };
