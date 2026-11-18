# Tests du niveau 1 : Remplir, capsuler, expédier. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.

def test_toutes_au_quai(r):
    """Les 12 bouteilles arrivent au quai Q1"""
    n = len(r.bouteilles("Q1"))
    assert n == 12, f"Attendu : 12 bouteilles au quai Q1. Obtenu : {n}."

def test_remplies(r):
    """Chaque bouteille expédiée est remplie"""
    vides = [b["numero"] for b in r.bouteilles("Q1") if b["volume_cl"] == 0]
    assert not vides, f"Les bouteilles {vides} sont arrivées vides : la remplisseuse est-elle sur leur chemin ?"

def test_capsulees(r):
    """Chaque bouteille expédiée est capsulée"""
    ouvertes = [b["numero"] for b in r.bouteilles("Q1") if not b["capsule"]]
    assert not ouvertes, f"Les bouteilles {ouvertes} sont arrivées sans capsule."

def bonus_lendemain(r):
    """Le brassin du lendemain (20 bouteilles) arrive aussi au quai, rempli et capsulé"""
    b = r.bouteilles("Q1")
    assert len(b) == 20 and all(x["capsule"] and x["volume_cl"] for x in b), f"Attendu : 20 bouteilles prêtes au quai Q1. Obtenu : {len(b)}."
