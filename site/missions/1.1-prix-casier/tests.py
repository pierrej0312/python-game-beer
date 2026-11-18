def test_le_laitier():
    """Un casier de Le Laitier à 26,40 € revient à 29,40 € avec sa consigne"""
    assert prix_casier_consigne(26.40, 3.00) == 29.4

def test_etincelle():
    """Un casier de L'Étincelle à 30,00 € revient à 33,00 €"""
    assert prix_casier_consigne(30.00, 3.00) == 33.0

def bonus_casier_offert():
    """Un casier offert ne coûte que sa consigne"""
    assert prix_casier_consigne(0, 3.00) == 3.0

def scenario_principal():
    """Le casier reçoit son étiquette de prix au pupitre, puis part au quai des magasins"""
    prix = prix_casier_consigne(26.40, 3.00)
    juste = isinstance(prix, (int, float)) and round(prix, 2) == 29.4
    aller_chercher("CASIER-1")
    etiqueter(f"Le Laitier : {prix} €", ok=juste)
    livrer("Q2" if juste else "R", ok=juste)
