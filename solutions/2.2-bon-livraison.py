def ligne_bon(client, nb_casiers, biere, prix_casier):
    """Renvoie une ligne du bon de livraison."""
    total = nb_casiers * prix_casier
    client = client.strip()
    return f"{client} : {nb_casiers} casiers de {biere} - {total:.2f} €"
