# Tests de la mission 8.4 (atelier). « test_ » : étoile 1 ; « bonus_ » : étoile 3.

def test_casiers(r):
    """Casiers par bière : B01 14, B02 2, B03 13, B04 4"""
    c = r.variables.get("casiers")
    assert c is not None, "Aucune variable casiers : créez un dictionnaire nommé casiers."
    assert c == {"B01": 14, "B02": 2, "B03": 13, "B04": 4}, f"Attendu : B01 14, B02 2, B03 13, B04 4. Obtenu : {c}."

def bonus_futs(r):
    """Fûts par bière : B01 15, B02 2, B04 3, B05 4"""
    assert r.variables.get("futs") == {"B01": 15, "B02": 2, "B04": 3, "B05": 4}, f"Obtenu pour futs : {r.variables.get('futs')}."
