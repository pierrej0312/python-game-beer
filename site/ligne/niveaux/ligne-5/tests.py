# Tests du niveau 5 : Remplir en plusieurs passages. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.

def test_quai(r):
    """Les 8 bouteilles arrivent au quai Q2"""
    n = len(r.bouteilles("Q2"))
    assert n == 8, f"Attendu : 8 bouteilles au quai Q2. Obtenu : {n}."

def test_pleines(r):
    """Chaque bouteille expédiée contient 33 cl"""
    v = [b["volume_cl"] for b in r.bouteilles("Q2") if b["volume_cl"] != 33]
    assert not v, f"Des bouteilles sont parties avec {sorted(set(v))} cl : elles quittent l'anneau trop tôt."

def test_capsulees(r):
    """Chaque bouteille expédiée est capsulée"""
    ouvertes = [b["numero"] for b in r.bouteilles("Q2") if not b["capsule"]]
    assert not ouvertes, f"Les bouteilles {ouvertes} sont parties sans capsule."

def bonus_lendemain(r):
    """Le lendemain, les 10 bouteilles (certaines déjà entamées) arrivent pleines et capsulées"""
    b = r.bouteilles("Q2")
    assert len(b) == 10 and all(x["volume_cl"] == 33 and x["capsule"] for x in b), f"Attendu : 10 bouteilles de 33 cl, capsulées, au quai Q2. Obtenu : {len(b)}."
