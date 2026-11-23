"""Ce que voit un robot, en six nombres : la base des robots 2 (arbre de décision) et 3 (réseau de neurones).

Les données d'entraînement (decisions.csv) et le labo des neurones utilisent exactement ces six nombres, dans cet ordre.
Votre stratégie doit calculer les mêmes, avec la même fonction : copiez-la telle quelle.
"""
CARACTERISTIQUES = ["distance", "energie_moi", "energie_adversaire", "bord_moi", "bord_adversaire", "adversaire_a_pousse"]


def caracteristiques(etat):
    """Les six nombres que voit le robot, dans l'ordre de CARACTERISTIQUES."""
    return [etat["distance"], etat["moi"]["energie"], etat["adversaire"]["energie"],
            etat["bord_derriere_moi"], etat["bord_derriere_adversaire"],
            1 if etat["dernier_coup_adversaire"] == "pousser" else 0]


def exporter_cerveau(modele, decimales=3):
    """Le cerveau d'un MLPClassifier de scikit-learn, en texte à coller dans la stratégie du robot 3.
    Même format que le bouton « Exporter le cerveau » du labo des neurones : les entrées sont divisées par 10.
    Chaque couche : une liste de neurones ; chaque neurone : ses poids (un par entrée) et son biais."""
    couches = []
    for poids, biais in zip(modele.coefs_, modele.intercepts_):
        neurones = [[[round(float(p), decimales) for p in colonne], round(float(b), decimales)]
                    for colonne, b in zip(poids.T, biais)]
        couches.append(neurones)
    actions = [str(a) for a in modele.classes_]
    if len(actions) == 2:
        raise ValueError("Deux actions seulement : entraînez le réseau sur les cinq actions.")
    return "CERVEAU = " + repr({"actions": actions, "couches": couches})
