def total_commande(nb_casiers, prix_casier, consigne):
    """Renvoie le total d'une commande, consignes comprises."""
    nb_casiers = int(nb_casiers)
    return nb_casiers * (prix_casier + consigne)
