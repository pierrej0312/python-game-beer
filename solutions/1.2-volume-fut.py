def bouteilles_par_fut(fut_litres, bouteille_cl):
    """Renvoie le nombre de bouteilles pleines remplies avec un fût."""
    fut_cl = fut_litres * 100
    return fut_cl // bouteille_cl
