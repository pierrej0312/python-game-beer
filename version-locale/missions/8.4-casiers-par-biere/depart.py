import csv

CLIENTS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]
acceptees = []
with open("lot_vendredi.csv", encoding="utf-8", newline="") as f:
    for ligne in csv.DictReader(f, delimiter=";"):
        try:
            quantite = int(ligne["quantite"])
        except ValueError:
            continue
        if quantite > 0 and ligne["client"] in CLIENTS:
            acceptees.append(ligne)
