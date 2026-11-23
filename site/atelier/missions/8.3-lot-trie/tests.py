# Tests de la mission 8.3 (atelier). « test_ » : étoile 1 ; « bonus_ » : étoile 3.

ENTETE = ["date", "client", "biere", "format", "quantite"]

def _champs(ligne):
    # une commande lue avec csv.DictReader (dictionnaire) ou avec split (liste) : on lit les deux
    return ligne if isinstance(ligne, dict) else dict(zip(ENTETE, ligne))

def _liste(r, nom):
    v = r.variables.get(nom)
    assert v is not None, f"Aucune variable {nom} : rangez les commandes dans une liste nommée {nom}."
    assert isinstance(v, list), f"{nom} est un {type(v).__name__}, pas une liste."
    return [_champs(x) for x in v]

def test_total(r):
    """Les 16 commandes sont rangées : acceptées ou rejetées"""
    a, j = _liste(r, "acceptees"), _liste(r, "rejetees")
    assert len(a) + len(j) == 16, f"{len(a)} acceptées et {len(j)} rejetées : {len(a) + len(j)} commandes au lieu de 16."

def test_rejets(r):
    """Les quantités illisibles, négatives ou vides et le client inconnu sont rejetés"""
    j = _liste(r, "rejetees")
    for motif, essai in [("la quantité « douze »", lambda c: c["quantite"] == "douze"), ("la quantité -2", lambda c: c["quantite"] == "-2"),
                         ("la quantité vide", lambda c: c["quantite"] == ""), ("le client C11", lambda c: c["client"] == "C11")]:
        assert any(essai(c) for c in j), f"La commande avec {motif} n'est pas dans rejetees."

def test_acceptees(r):
    """Les commandes acceptées sont toutes justes"""
    for c in _liste(r, "acceptees"):
        assert c["client"] in {f"C0{i}" for i in range(1, 9)}, f"Client inconnu accepté : {c['client']}."
        assert c["quantite"].strip().isdigit() and int(c["quantite"]) > 0, f"Quantité fausse acceptée : {c['quantite']!r}."

def bonus_date(r):
    """La commande du 31 novembre est rejetée : cette date n'existe pas"""
    assert any(c["date"] == "2026-11-31" for c in _liste(r, "rejetees")), "La commande datée du 2026-11-31 n'est pas dans rejetees."
