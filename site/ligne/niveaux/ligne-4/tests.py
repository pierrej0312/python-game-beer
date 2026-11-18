# Tests du niveau 4 : Trier trois bières. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.

def test_toutes_au_quai(r):
    """Les 15 bouteilles arrivent au quai Q2"""
    n = len(r.bouteilles("Q2"))
    assert n == 15, f"Attendu : 15 bouteilles au quai Q2. Obtenu : {n}."

def test_bonnes_etiquettes(r):
    """Chaque bouteille porte l'étiquette de sa bière"""
    fausses = [f"n° {b['numero']} ({b['biere']}, étiquette {b['etiquette'] or 'aucune'})" for b in r.bouteilles("Q2") if b["etiquette"] != b["biere"]]
    assert not fausses, "Bouteilles mal étiquetées : " + ", ".join(fausses[:4]) + ("…" if len(fausses) > 4 else "")

def bonus_lendemain(r):
    """Le lendemain, les deux bouteilles du Laitier partent au rebut, les autres sont bien étiquetées"""
    laitier = [b for b in r.rebut if b["biere"] == "Le Laitier" and not b["etiquette"]]
    assert len(laitier) == 2, "Les bouteilles du Laitier n'ont pas d'étiqueteuse : elles devaient partir au rebut, sans étiquette. Que fait votre dernier else ?"
    assert all(b["etiquette"] == b["biere"] for b in r.bouteilles("Q2")), "Une bouteille du lendemain est arrivée au quai avec une mauvaise étiquette."
