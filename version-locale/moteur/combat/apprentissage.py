"""Ce que voit un robot, en dix-neuf nombres : la base des robots 2 (arbre de décision) et 3 (réseau de neurones).

Les données d'entraînement (decisions.csv, vos combats joués au clavier) et le labo des neurones utilisent exactement
ces nombres, dans cet ordre. Votre stratégie doit les calculer de la même façon : copiez la fonction telle quelle.
"""
CARACTERISTIQUES = ["distance", "vie_moi", "vie_adversaire", "energie_moi", "energie_adversaire", "bord_moi", "bord_adversaire",
                    "adv_prepare", "adv_frappe", "adv_recupere", "adv_garde", "adv_garde_basse", "adv_sonne", "adv_reste",
                    "adv_direct", "adv_crochet", "adv_coup_bas", "adv_projection", "adv_special"]
# pour le réseau de neurones : chaque nombre est divisé par son échelle (des valeurs entre 0 et 1 environ)
ECHELLES = [1000, 100, 100, 100, 100, 1000, 1000, 1, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 1]
COUPS_VUS = ["direct", "crochet", "coup_bas", "projection", "special"]


def caracteristiques(etat):
    """Les dix-neuf nombres que voit le robot, dans l'ordre de CARACTERISTIQUES.
    Les cinq derniers disent quel coup l'adversaire prépare, frappe ou finit (1 pour ce coup, 0 pour les autres)."""
    adv = etat["adversaire"]
    phase = adv["phase"]
    return [etat["distance"], etat["moi"]["vie"], adv["vie"], etat["moi"]["energie"], adv["energie"],
            etat["moi"]["bord_derriere"], adv["bord_derriere"],
            1 if phase == "preparation" else 0, 1 if phase == "frappe" else 0, 1 if phase == "recuperation" else 0,
            1 if phase == "garde" else 0, 1 if phase == "garde_basse" else 0, 1 if phase == "sonne" else 0, adv["reste"],
            *[1 if adv["action"] == coup else 0 for coup in COUPS_VUS]]


def arbre_en_code(arbre, noms=CARACTERISTIQUES):
    """Écrit les règles d'un arbre de décision (scikit-learn) en if / else Python, prêtes à coller dans robot2.py.
    Ce sont exactement les règles que montre export_text : lisez les deux, ligne à ligne."""
    t = arbre.tree_
    lignes = []

    def descendre(noeud, retrait):
        espace = " " * retrait
        if t.children_left[noeud] == -1:                         # une feuille : l'action la plus fréquente ici
            lignes.append(f'{espace}action = "{arbre.classes_[t.value[noeud][0].argmax()]}"')
            return
        lignes.append(f"{espace}if {noms[t.feature[noeud]]} <= {t.threshold[noeud]:.2f}:")
        descendre(t.children_left[noeud], retrait + 4)
        lignes.append(f"{espace}else:")
        descendre(t.children_right[noeud], retrait + 4)

    descendre(0, 4)
    return "\n".join(lignes)
