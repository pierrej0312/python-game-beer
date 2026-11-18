def test_cafe_du_pont():
    """3 casiers de La Coulée pour le Café du Pont : 86.40 €"""
    assert ligne_bon("Café du Pont", 3, "La Coulée", 28.80) == "Café du Pont : 3 casiers de La Coulée - 86.40 €"

def test_le_comptoir():
    """6 casiers de L'Étincelle pour Le Comptoir des Hauts-Fourneaux : 180.00 €"""
    assert ligne_bon("Le Comptoir des Hauts-Fourneaux", 6, "L'Étincelle", 30.00) == "Le Comptoir des Hauts-Fourneaux : 6 casiers de L'Étincelle - 180.00 €"

def bonus_deux_decimales():
    """Le total garde deux décimales : 264.00 €, pas 264.0 €"""
    assert ligne_bon("Taverne Saint-Jean", 10, "Le Laitier", 26.40) == "Taverne Saint-Jean : 10 casiers de Le Laitier - 264.00 €"

def cache_espaces_autour_du_client():
    """Contrôle surprise : le nom du client arrive avec des espaces autour"""
    assert ligne_bon("  Café du Pont ", 3, "La Coulée", 28.80) == "Café du Pont : 3 casiers de La Coulée - 86.40 €"

def scenario_principal():
    """Les 3 casiers partent au Café du Pont avec le bon que votre fonction compose"""
    ligne = ligne_bon("Café du Pont", 3, "La Coulée", 28.80)
    juste = ligne == "Café du Pont : 3 casiers de La Coulée - 86.40 €"
    aller_chercher("LOT-3")
    etiqueter(ligne if ligne else "(bon vide)", ok=juste)
    livrer("Q1" if juste else "R", ok=juste)
