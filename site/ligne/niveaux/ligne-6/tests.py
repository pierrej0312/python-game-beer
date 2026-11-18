# Tests du niveau 6 : Une machine, deux lignes. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.

def _pretes(bouteilles, biere):
    return [b for b in bouteilles if b["volume_cl"] and b["capsule"] and b["etiquette"] == biere and b["biere"] == biere]

def test_quai_q1(r):
    """Le quai Q1 reçoit 10 bouteilles de La Coulée, prêtes et étiquetées"""
    b = r.bouteilles("Q1")
    assert len(b) == 10, f"Attendu : 10 bouteilles au quai Q1. Obtenu : {len(b)}."
    assert len(_pretes(b, "La Coulée")) == 10, "Au quai Q1, des bouteilles ne sont pas remplies, capsulées et étiquetées « La Coulée »."

def test_quai_q2(r):
    """Le quai Q2 reçoit 8 bouteilles de La Braise, prêtes et étiquetées"""
    b = r.bouteilles("Q2")
    assert len(b) == 8, f"Attendu : 8 bouteilles au quai Q2. Obtenu : {len(b)}."
    assert len(_pretes(b, "La Braise")) == 8, "Au quai Q2, des bouteilles ne sont pas remplies, capsulées et étiquetées « La Braise »."

def bonus_lendemain(r):
    """Le lendemain, 6 bouteilles au quai Q1 et 12 au quai Q2, toutes prêtes"""
    assert len(_pretes(r.bouteilles("Q1"), "La Coulée")) == 6 and len(_pretes(r.bouteilles("Q2"), "La Braise")) == 12, "Le brassin du lendemain n'arrive pas complet et prêt aux deux quais."
