# Tests de la mission 4.4 (atelier). « test_ » : étoile 1 ; « bonus_ » : étoile 3.

ATTENDU = ["Café du Pont", "Cave aux Bulles", "Taverne Saint-Jean", "Lucas Bertrand"]

def test_commandes(r):
    """commandes contient les 4 commandes à préparer, dans l'ordre"""
    c = r.variables.get("commandes")
    assert c is not None, "Aucune variable commandes : créez une liste nommée commandes."
    assert isinstance(c, list), f"commandes est un {type(c).__name__}, pas une liste : une liste s'écrit entre crochets."
    assert c == ATTENDU, f"Attendu : {ATTENDU}. Obtenu : {c}."

def test_camion(r):
    """camion contient les deux premières commandes"""
    camion = r.variables.get("camion")
    assert camion is not None, "Aucune variable camion : prenez une tranche de commandes et rangez-la dans camion."
    assert camion == ATTENDU[:2], f"Attendu dans camion : {ATTENDU[:2]}. Obtenu : {camion}."

def test_tableau(r):
    """L'affichage montre camion, puis le nombre de commandes : 4"""
    attendu = [str(ATTENDU[:2]), "4"]
    reste = list(r.sorties)
    for ligne in attendu:
        assert ligne in reste, f"L'affichage ne montre pas {ligne}. Il montre : {r.sorties or 'rien'}."
        reste = reste[reste.index(ligne) + 1:]

def bonus_tri(r):
    """L'affichage montre aussi les commandes par ordre alphabétique, et commandes garde son ordre"""
    assert "None" not in r.sorties, "L'affichage montre None : .sort() trie la liste elle-même et renvoie None. Essayez sorted()."
    assert str(sorted(ATTENDU)) in r.sorties, f"Attendu à l'affichage : {sorted(ATTENDU)}."
    assert r.variables.get("commandes") == ATTENDU, "commandes a changé d'ordre : .sort() trie la liste elle-même. sorted() en fait une copie triée."
