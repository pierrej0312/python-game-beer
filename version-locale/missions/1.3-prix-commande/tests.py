def test_cinq_casiers():
    """5 casiers de La Braise coûtent 171,00 €, consignes comprises"""
    assert round(total_commande(5, 31.20, 3.00), 2) == 171.0

def test_un_casier():
    """1 casier de Le Laitier coûte 29,40 €"""
    assert round(total_commande(1, 26.40, 3.00), 2) == 29.4

def bonus_aucun_casier():
    """Une commande de 0 casier coûte 0 €"""
    assert total_commande(0, 31.20, 3.00) == 0

def cache_quantite_en_texte():
    """Contrôle surprise : la quantité arrive du clavier, en texte ("5")"""
    assert round(total_commande("5", 31.20, 3.00), 2) == 171.0

def scenario_principal():
    """Les 5 casiers partent avec leur facture chez la Taverne Saint-Jean, un café"""
    total = total_commande(5, 31.20, 3.00)
    juste = isinstance(total, (int, float)) and round(total, 2) == 171.0
    texte = f"Facture : {round(total, 2)} €" if isinstance(total, (int, float)) else f"Facture : {total!r}"
    aller_chercher("LOT-5")
    etiqueter(texte, ok=juste)
    livrer("Q1" if juste else "R", ok=juste)
