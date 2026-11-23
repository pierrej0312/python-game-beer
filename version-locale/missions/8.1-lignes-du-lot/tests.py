# Tests de la mission 8.1 (atelier). « test_ » : étoile 1 ; « bonus_ » : étoile 3.

def test_nombre(r):
    """nb_commandes vaut 16 : l'en-tête n'est pas une commande"""
    n = r.variables.get("nb_commandes")
    assert n is not None, "Aucune variable nb_commandes."
    assert n != 17, "17 : l'en-tête a été compté comme une commande."
    assert n == 16, f"Attendu : 16 commandes. Obtenu : {n}."

def test_affichage(r):
    """L'affichage montre le nombre de commandes"""
    assert any("16" in ligne for ligne in r.sorties), f"L'affichage ne montre pas 16. Il montre : {r.sorties or 'rien'}."

def bonus_futs(r):
    """nb_futs vaut 5 : cinq commandes sont en fûts"""
    assert r.variables.get("nb_futs") == 5, f"Attendu : 5 commandes en fûts. Obtenu : {r.variables.get('nb_futs')}."
