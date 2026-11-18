def test_la_braise():
    """«  b03-braise-20l » devient « B03-BRAISE-20L »"""
    assert nettoyer_etiquette("  b03-braise-20l ") == "B03-BRAISE-20L"

def test_la_coulee():
    """« B01-Coulée-20L » devient « B01-COULÉE-20L »"""
    assert nettoyer_etiquette("B01-Coulée-20L") == "B01-COULÉE-20L"

def bonus_etiquette_vide():
    """Une étiquette vide reste vide"""
    assert nettoyer_etiquette("   ") == ""

def scenario_principal():
    """L'étiquette nettoyée est collée sur le fût, rangé ensuite au rayon de La Braise"""
    etiquette = nettoyer_etiquette("  b03-braise-20l ")
    juste = etiquette == "B03-BRAISE-20L"
    aller_chercher("FUT-1")
    etiqueter(f"[{etiquette}]", ok=juste)
    if juste:
        ranger("rayon-3", "La Braise : 1 fût rangé")
    else:
        livrer("R", ok=False)
