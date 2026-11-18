# Tests du niveau 3 : Écarter les bouteilles mal remplies. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.

def test_quai(r):
    """Les 12 bouteilles d'au moins 32 cl arrivent au quai Q2"""
    b = r.bouteilles("Q2")
    assert len(b) == 12, f"Attendu : 12 bouteilles au quai Q2. Obtenu : {len(b)}."
    mauvaises = [x["volume_cl"] for x in b if x["volume_cl"] < 32]
    assert not mauvaises, f"Des bouteilles de {mauvaises} cl sont parties au quai : elles devaient aller au rebut."

def test_rebut(r):
    """Les 4 bouteilles de moins de 32 cl partent au rebut"""
    v = sorted(x["volume_cl"] for x in r.rebut)
    assert v == [29, 30, 31, 31], f"Attendu au rebut : 29, 30, 31 et 31 cl. Obtenu : {v or 'rien'}."

def test_capsulees(r):
    """Les bouteilles expédiées sont capsulées"""
    ouvertes = [x["numero"] for x in r.bouteilles("Q2") if not x["capsule"]]
    assert not ouvertes, f"Les bouteilles {ouvertes} sont parties sans capsule."

def bonus_lendemain(r):
    """Le lendemain, les bouteilles de 32 cl tout juste partent au quai"""
    v = sorted(x["volume_cl"] for x in r.bouteilles("Q2"))
    assert v.count(32) == 2, "Les deux bouteilles de 32 cl du lendemain devaient partir au quai : relisez la comparaison de votre contrôle."
    assert len(r.rebut) == 2, f"Attendu au rebut le lendemain : 2 bouteilles. Obtenu : {len(r.rebut)}."
