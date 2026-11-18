def test_bouteilles_de_33():
    """Un fût de 20 litres remplit 60 bouteilles de 33 cl"""
    assert bouteilles_par_fut(20, 33) == 60

def test_verres_de_25():
    """Un fût de 20 litres remplit 80 verres de 25 cl"""
    assert bouteilles_par_fut(20, 25) == 80

def bonus_nombre_entier():
    """Le résultat est un nombre entier : on ne vend pas un morceau de bouteille"""
    assert type(bouteilles_par_fut(20, 33)) == int

def scenario_principal():
    """Le fût est vidé en bouteilles : le chariot en reçoit autant que votre fonction en compte"""
    nombre = bouteilles_par_fut(20, 33)
    aller_chercher("FUT-1")
    embouteiller(nombre, ok=nombre == 60 and isinstance(nombre, int))
