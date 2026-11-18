# Tests du niveau 2 : Compter la production. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.

def test_quai(r):
    """Les 18 bouteilles arrivent au quai Q2"""
    n = len(r.bouteilles("Q2"))
    assert n == 18, f"Attendu : 18 bouteilles au quai Q2. Obtenu : {n}."

def test_tableau(r):
    """Le tableau de bord affiche 18"""
    assert r.sorties, "Le tableau de bord n'affiche rien : posez-en un et réglez-le sur votre bac."
    assert r.sorties[-1] == "18", f"Attendu : le tableau de bord affiche 18. Il affiche : {r.sorties[-1]}."

def bonus_lendemain(r):
    """Avec 24 bouteilles le lendemain, le tableau de bord affiche 24"""
    assert r.sorties and r.sorties[-1] == "24", f"Attendu : 24. Obtenu : {r.sorties[-1] if r.sorties else 'rien'}."
