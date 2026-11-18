"""Écrit les missions du jeu 1 (séries 1 à 6) et leurs solutions, puis les vérifie.

Usage : python faire_missions.py
- site/missions/<id>/mission.json, depart.py, tests.py  (déployés)
- site/missions/index.json                                     (liste des missions, lue par le site)
- solutions/<id>.py                                            (jamais déployées)
Vérifications (runner.py, le même que dans le navigateur) : chaque solution obtient 3 étoiles et passe
les tests cachés ; chaque code de départ échoue sans erreur du moteur.
Données : fiche du fil rouge (cours/python-de-base/01-notes/fil-rouge-brasserie.md).
"""
import json
import pathlib
import sys
import textwrap

RACINE = pathlib.Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
sys.path.insert(0, str(SITE / "python"))
import runner  # noqa: E402

d = textwrap.dedent

SERIES = {
    1: {"titre": "Les variables et les calculs", "outil": "Révision de jeudi : des nombres, des opérateurs, une conversion."},
    2: {"titre": "Le texte", "outil": "Révision de jeudi : les méthodes de texte et les f-strings."},
    3: {"titre": "Les conditions", "outil": "Nouveau : l'atelier. Construisez la fonction dans le hall ou écrivez-la en Python ; le chariot suit le chemin que vos conditions choisissent."},
    4: {"titre": "Les listes et les tuples", "outil": "Nouveau : les rayonnages et les caisses plombées. La file des commandes arrive dans une liste."},
    5: {"titre": "Les boucles", "outil": "Nouveau : le carrousel (for) et la boucle tant que (while). Le chariot refait le tour à chaque élément."},
    6: {"titre": "Les dictionnaires et les sets", "outil": "Nouveau : l'armoire à tiroirs et le bac de tri. Le stock de la brasserie tient dans un dictionnaire."},
}

M = []


def mission(**champs):
    M.append(champs)


# ------------------------------------------------------------------ série 1
mission(
    id="1.1-prix-casier", serie=1, numero=1, titre="Un prix s'additionne avec sa consigne",
    notions=["variables", "opérateurs"], fonction="prix_casier_consigne",
    enonce="Un casier de Le Laitier coûte 26,40 €, sa consigne 3,00 €. Complétez prix_casier_consigne() pour qu'elle renvoie le prix du casier, consigne comprise.",
    depart=d('''\
        def prix_casier_consigne(prix_casier, consigne):
            """Renvoie le prix d'un casier, consigne comprise."""
            # À vous de jouer : remplacez 0 par votre calcul.
            return 0
        '''),
    solution=d('''\
        def prix_casier_consigne(prix_casier, consigne):
            """Renvoie le prix d'un casier, consigne comprise."""
            return prix_casier + consigne
        '''),
    tests=d('''\
        def test_le_laitier():
            """Un casier de Le Laitier à 26,40 € revient à 29,40 € avec sa consigne"""
            assert prix_casier_consigne(26.40, 3.00) == 29.4

        def test_etincelle():
            """Un casier de L'Étincelle à 30,00 € revient à 33,00 €"""
            assert prix_casier_consigne(30.00, 3.00) == 33.0

        def bonus_casier_offert():
            """Un casier offert ne coûte que sa consigne"""
            assert prix_casier_consigne(0, 3.00) == 3.0

        def scenario_principal():
            """Le casier reçoit son étiquette de prix au pupitre, puis part au quai des magasins"""
            prix = prix_casier_consigne(26.40, 3.00)
            juste = isinstance(prix, (int, float)) and round(prix, 2) == 29.4
            aller_chercher("CASIER-1")
            etiqueter(f"Le Laitier : {prix} €", ok=juste)
            livrer("Q2" if juste else "R", ok=juste)
        '''),
    indices=["Le prix à payer, c'est le prix du casier plus la consigne.", "Écrivez le calcul après return, à la place du 0."],
    scene={"objets": [{"id": "CASIER-1", "type": "casier", "biere": "B02"}]}, duree=3)

mission(
    id="1.2-volume-fut", serie=1, numero=2, titre="La division entière compte les bouteilles pleines",
    notions=["opérateurs", "division entière"], fonction="bouteilles_par_fut",
    enonce="Un fût contient 20 litres, une bouteille 33 cl. Complétez bouteilles_par_fut() pour qu'elle renvoie le nombre de bouteilles pleines que l'on remplit avec un fût.",
    depart=d('''\
        def bouteilles_par_fut(fut_litres, bouteille_cl):
            """Renvoie le nombre de bouteilles pleines remplies avec un fût."""
            fut_cl = fut_litres * 100
            # À vous de jouer : combien de fois bouteille_cl rentre-t-il dans fut_cl ?
            return 0
        '''),
    solution=d('''\
        def bouteilles_par_fut(fut_litres, bouteille_cl):
            """Renvoie le nombre de bouteilles pleines remplies avec un fût."""
            fut_cl = fut_litres * 100
            return fut_cl // bouteille_cl
        '''),
    tests=d('''\
        def test_bouteilles_de_33():
            """Un fût de 20 litres remplit 60 bouteilles de 33 cl"""
            assert bouteilles_par_fut(20, 33) == 60

        def test_verres_de_25():
            """Un fût de 20 litres remplit 80 verres de 25 cl"""
            assert bouteilles_par_fut(20, 25) == 80

        def bonus_nombre_entier():
            """Le résultat est un nombre entier : on ne vend pas un morceau de bouteille"""
            assert type(bouteilles_par_fut(20, 33)) == int

        def scenario_principal():
            """Le fût est vidé en bouteilles : le chariot en reçoit autant que votre fonction en compte"""
            nombre = bouteilles_par_fut(20, 33)
            aller_chercher("FUT-1")
            embouteiller(nombre, ok=nombre == 60 and isinstance(nombre, int))
        '''),
    indices=["L'opérateur // donne le nombre de fois que ça rentre, sans la virgule.", "Le calcul tient en une ligne : fut_cl // bouteille_cl."],
    scene={"objets": [{"id": "FUT-1", "type": "fut", "biere": "B01"}]}, duree=3)

mission(
    id="1.3-prix-commande", serie=1, numero=3, surprise=True, titre="Ce qui vient du clavier se convertit avant le calcul",
    notions=["opérateurs", "conversions"], fonction="total_commande",
    enonce="La Taverne Saint-Jean commande 5 casiers de La Braise à 31,20 €, consigne de 3,00 € par casier. Complétez total_commande() pour qu'elle renvoie le total, consignes comprises.",
    depart=d('''\
        def total_commande(nb_casiers, prix_casier, consigne):
            """Renvoie le total d'une commande, consignes comprises."""
            # À vous de jouer
            return 0
        '''),
    solution=d('''\
        def total_commande(nb_casiers, prix_casier, consigne):
            """Renvoie le total d'une commande, consignes comprises."""
            nb_casiers = int(nb_casiers)
            return nb_casiers * (prix_casier + consigne)
        '''),
    tests=d('''\
        def test_cinq_casiers():
            """5 casiers de La Braise coûtent 171,00 €, consignes comprises"""
            assert round(total_commande(5, 31.20, 3.00), 2) == 171.0

        def test_un_casier():
            """1 casier de Le Laitier coûte 29,40 €"""
            assert round(total_commande(1, 26.40, 3.00), 2) == 29.4

        def bonus_aucun_casier():
            """Une commande de 0 casier coûte 0 €"""
            assert total_commande(0, 31.20, 3.00) == 0

        def cache_quantite_en_texte():
            """Contrôle surprise : la quantité arrive du clavier, en texte ("5")"""
            assert round(total_commande("5", 31.20, 3.00), 2) == 171.0

        def scenario_principal():
            """Les 5 casiers partent avec leur facture chez la Taverne Saint-Jean, un café"""
            total = total_commande(5, 31.20, 3.00)
            juste = isinstance(total, (int, float)) and round(total, 2) == 171.0
            texte = f"Facture : {round(total, 2)} €" if isinstance(total, (int, float)) else f"Facture : {total!r}"
            aller_chercher("LOT-5")
            etiqueter(texte, ok=juste)
            livrer("Q1" if juste else "R", ok=juste)
        '''),
    indices=["Chaque casier coûte son prix plus sa consigne.", "Pour le contrôle surprise : int() transforme le texte \"5\" en nombre 5."],
    scene={"objets": [{"id": "LOT-5", "type": "casier", "biere": "B03", "nombre": 5}]}, duree=5, marge=1)

# ------------------------------------------------------------------ série 2
mission(
    id="2.1-etiquette", serie=2, numero=1, titre="Une étiquette se nettoie en une ligne",
    notions=["chaînes", "méthodes"], fonction="nettoyer_etiquette",
    enonce="L'étiquette d'un fût a été saisie à la main, avec des espaces et des minuscules. Complétez nettoyer_etiquette() pour qu'elle renvoie l'étiquette sans espaces autour et en majuscules.",
    depart=d('''\
        def nettoyer_etiquette(saisie):
            """Renvoie l'étiquette sans espaces autour, en majuscules."""
            # À vous de jouer
            return saisie
        '''),
    solution=d('''\
        def nettoyer_etiquette(saisie):
            """Renvoie l'étiquette sans espaces autour, en majuscules."""
            return saisie.strip().upper()
        '''),
    tests=d('''\
        def test_la_braise():
            """«  b03-braise-20l » devient « B03-BRAISE-20L »"""
            assert nettoyer_etiquette("  b03-braise-20l ") == "B03-BRAISE-20L"

        def test_la_coulee():
            """« B01-Coulée-20L » devient « B01-COULÉE-20L »"""
            assert nettoyer_etiquette("B01-Coulée-20L") == "B01-COULÉE-20L"

        def bonus_etiquette_vide():
            """Une étiquette vide reste vide"""
            assert nettoyer_etiquette("   ") == ""

        def scenario_principal():
            """L'étiquette nettoyée est collée sur le fût, rangé ensuite au rayon de La Braise"""
            etiquette = nettoyer_etiquette("  b03-braise-20l ")
            juste = etiquette == "B03-BRAISE-20L"
            aller_chercher("FUT-1")
            etiqueter(f"[{etiquette}]", ok=juste)
            if juste:
                ranger("rayon-3", "La Braise : 1 fût rangé")
            else:
                livrer("R", ok=False)
        '''),
    indices=["strip() retire les espaces autour d'un texte, upper() le met en majuscules.", "Les deux méthodes s'enchaînent : saisie.strip().upper()."],
    scene={"objets": [{"id": "FUT-1", "type": "fut", "biere": "B03"}]}, duree=3)

mission(
    id="2.2-bon-livraison", serie=2, numero=2, surprise=True, titre="Une f-string compose le bon de livraison",
    notions=["f-strings", "format"], fonction="ligne_bon",
    enonce="Complétez ligne_bon() pour qu'elle renvoie la ligne du bon de livraison : le client, le nombre de casiers, la bière, puis le total avec deux décimales. Le modèle est dans le code de départ.",
    depart=d('''\
        def ligne_bon(client, nb_casiers, biere, prix_casier):
            """Renvoie une ligne du bon de livraison.

            Modèle : Café du Pont : 3 casiers de La Coulée - 86.40 €
            """
            total = nb_casiers * prix_casier
            # À vous de jouer : composez la ligne avec une f-string.
            return ""
        '''),
    solution=d('''\
        def ligne_bon(client, nb_casiers, biere, prix_casier):
            """Renvoie une ligne du bon de livraison."""
            total = nb_casiers * prix_casier
            client = client.strip()
            return f"{client} : {nb_casiers} casiers de {biere} - {total:.2f} €"
        '''),
    tests=d('''\
        def test_cafe_du_pont():
            """3 casiers de La Coulée pour le Café du Pont : 86.40 €"""
            assert ligne_bon("Café du Pont", 3, "La Coulée", 28.80) == "Café du Pont : 3 casiers de La Coulée - 86.40 €"

        def test_le_comptoir():
            """6 casiers de L'Étincelle pour Le Comptoir des Hauts-Fourneaux : 180.00 €"""
            assert ligne_bon("Le Comptoir des Hauts-Fourneaux", 6, "L'Étincelle", 30.00) == "Le Comptoir des Hauts-Fourneaux : 6 casiers de L'Étincelle - 180.00 €"

        def bonus_deux_decimales():
            """Le total garde deux décimales : 264.00 €, pas 264.0 €"""
            assert ligne_bon("Taverne Saint-Jean", 10, "Le Laitier", 26.40) == "Taverne Saint-Jean : 10 casiers de Le Laitier - 264.00 €"

        def cache_espaces_autour_du_client():
            """Contrôle surprise : le nom du client arrive avec des espaces autour"""
            assert ligne_bon("  Café du Pont ", 3, "La Coulée", 28.80) == "Café du Pont : 3 casiers de La Coulée - 86.40 €"

        def scenario_principal():
            """Les 3 casiers partent au Café du Pont avec le bon que votre fonction compose"""
            ligne = ligne_bon("Café du Pont", 3, "La Coulée", 28.80)
            juste = ligne == "Café du Pont : 3 casiers de La Coulée - 86.40 €"
            aller_chercher("LOT-3")
            etiqueter(ligne if ligne else "(bon vide)", ok=juste)
            livrer("Q1" if juste else "R", ok=juste)
        '''),
    indices=["Dans une f-string, {total:.2f} affiche total avec deux décimales.", "Recopiez le modèle et remplacez chaque valeur par son nom entre accolades."],
    scene={"objets": [{"id": "LOT-3", "type": "casier", "biere": "B01", "nombre": 3}]}, duree=6, marge=1)

# ------------------------------------------------------------------ série 3
mission(
    id="3.1-quai", serie=3, numero=1, titre="Le type de client décide du quai",
    notions=["if", "elif", "else"], fonction="quai_du_client",
    enonce="Chaque fût part au quai de son client : café au quai Q1, magasin au quai Q2, particulier au quai Q3, tout autre client au quai Q4. Complétez quai_du_client().",
    depart=d('''\
        def quai_du_client(type_client):
            """Renvoie le quai d'un client : "Q1", "Q2", "Q3" ou "Q4"."""
            quai = ""
            # À vous de jouer : if, elif, else
            return quai
        '''),
    solution=d('''\
        def quai_du_client(type_client):
            """Renvoie le quai d'un client : "Q1", "Q2", "Q3" ou "Q4"."""
            if type_client == "café":
                quai = "Q1"
            elif type_client == "magasin":
                quai = "Q2"
            elif type_client == "particulier":
                quai = "Q3"
            else:
                quai = "Q4"
            return quai
        '''),
    tests=d('''\
        def test_magasin():
            """Un magasin est livré au quai Q2"""
            assert quai_du_client("magasin") == "Q2"

        def test_cafe():
            """Un café est livré au quai Q1"""
            assert quai_du_client("café") == "Q1"

        def test_particulier():
            """Un particulier est livré au quai Q3"""
            assert quai_du_client("particulier") == "Q3"

        def bonus_tous_les_autres():
            """Tout autre client, un événement par exemple, part au quai Q4"""
            assert quai_du_client("événement") == "Q4"
            assert quai_du_client("association") == "Q4"

        def scenario_principal():
            """Trois fûts, trois clients : chacun part au quai que votre fonction choisit"""
            for identifiant, type_client in (("FUT-1", "café"), ("FUT-2", "magasin"), ("FUT-3", "particulier")):
                quai = quai_du_client(type_client)
                aller_chercher(identifiant)
                livrer(quai if quai in ("Q1", "Q2", "Q3", "Q4") else "R")
        '''),
    indices=["Python teste dans l'ordre et s'arrête au premier test vrai.", "else, sans test, prend tous les cas qui restent : c'est le quai Q4."],
    scene={"objets": [{"id": "FUT-1", "type": "fut", "biere": "B01", "destination": "Q1"},
                      {"id": "FUT-2", "type": "fut", "biere": "B03", "destination": "Q2"},
                      {"id": "FUT-3", "type": "fut", "biere": "B04", "destination": "Q3"}]}, duree=5)

mission(
    id="3.2-tarif", serie=3, numero=2, titre="La remise dépend du client",
    notions=["if", "calcul"], fonction="prix_futs",
    enonce="Un café a 10 % de remise sur les fûts. Les autres clients paient le plein tarif. Complétez prix_futs() pour qu'elle renvoie le prix de la commande.",
    depart=d('''\
        def prix_futs(type_client, nb_futs, prix_fut):
            """Renvoie le prix d'une commande de fûts, remise comprise."""
            total = nb_futs * prix_fut
            # À vous de jouer : 10 % de remise pour un café
            return total
        '''),
    solution=d('''\
        def prix_futs(type_client, nb_futs, prix_fut):
            """Renvoie le prix d'une commande de fûts, remise comprise."""
            total = nb_futs * prix_fut
            if type_client == "café":
                total = total * 0.90
            return total
        '''),
    tests=d('''\
        def test_cafe():
            """4 fûts de La Coulée pour un café : 223,20 € au lieu de 248,00 €"""
            assert round(prix_futs("café", 4, 62.00), 2) == 223.2

        def test_particulier():
            """Un particulier paie le plein tarif : 248,00 €"""
            assert round(prix_futs("particulier", 4, 62.00), 2) == 248.0

        def bonus_magasin():
            """Un magasin n'a pas de remise sur les fûts"""
            assert round(prix_futs("magasin", 2, 58.00), 2) == 116.0

        def scenario_principal():
            """Deux commandes de 4 fûts : le Café du Pont a sa remise, Marie Dumont paie le plein tarif"""
            for fut, client, type_client, quai, attendu in (("FUT-1", "Café du Pont", "café", "Q1", 223.2),
                                                           ("FUT-2", "Marie Dumont", "particulier", "Q3", 248.0)):
                prix = prix_futs(type_client, 4, 62.00)
                juste = isinstance(prix, (int, float)) and round(prix, 2) == attendu
                texte = f"{client} : {round(prix, 2)} €" if isinstance(prix, (int, float)) else f"{client} : {prix!r}"
                aller_chercher(fut)
                etiqueter(texte, ok=juste)
                livrer(quai if juste else "R", ok=juste)
        '''),
    indices=["Retirer 10 %, c'est garder 90 % : multipliez par 0.90.", "Le test porte sur le type de client : if type_client == \"café\":"],
    scene={"objets": [{"id": "FUT-1", "type": "fut", "biere": "B01"}, {"id": "FUT-2", "type": "fut", "biere": "B01"}]}, duree=5)

mission(
    id="3.3-stock-bas", serie=3, numero=3, surprise=True, titre="L'ordre des tests décide du résultat",
    notions=["elif", "ordre des tests"], fonction="etat_stock",
    enonce="Complétez etat_stock() : pour 0 casier, elle renvoie \"Rupture de stock\" ; sous 10 casiers, \"Stock bas\" ; sinon, \"Stock suffisant\".",
    depart=d('''\
        def etat_stock(casiers):
            """Renvoie l'état du stock d'une bière."""
            etat = "Stock suffisant"
            # À vous de jouer
            return etat
        '''),
    solution=d('''\
        def etat_stock(casiers):
            """Renvoie l'état du stock d'une bière."""
            if casiers == 0:
                etat = "Rupture de stock"
            elif casiers < 10:
                etat = "Stock bas"
            else:
                etat = "Stock suffisant"
            return etat
        '''),
    tests=d('''\
        def test_stock_suffisant():
            """40 casiers de La Coulée : stock suffisant"""
            assert etat_stock(40) == "Stock suffisant"

        def test_stock_bas():
            """9 casiers de Le Crassier : stock bas"""
            assert etat_stock(9) == "Stock bas"

        def test_rupture():
            """0 casier : rupture de stock, pas seulement stock bas"""
            assert etat_stock(0) == "Rupture de stock"

        def bonus_seuil():
            """10 casiers tout juste : le stock est suffisant"""
            assert etat_stock(10) == "Stock suffisant"

        def cache_un_casier():
            """Contrôle surprise : 1 casier, c'est un stock bas, pas une rupture"""
            assert etat_stock(1) == "Stock bas"

        def scenario_principal():
            """Le préparateur contrôle trois rayons"""
            rayons = (("rayon-1", "La Coulée", 40, "Stock suffisant"), ("rayon-2", "Le Crassier", 9, "Stock bas"), ("rayon-3", "La Braise", 0, "Rupture de stock"))
            for lieu, biere, casiers, attendu in rayons:
                etat = etat_stock(casiers)
                controler(lieu, f"{biere} : {etat}", ok=etat == attendu)
        '''),
    indices=["Testez le cas le plus exigeant en premier.", "0 est aussi plus petit que 10 : le test de la rupture doit passer avant celui du stock bas."],
    scene={"objets": []}, duree=6)

# ------------------------------------------------------------------ série 4
mission(
    id="4.1-trois-premieres", serie=4, numero=1, titre="Une tranche prend les trois premières commandes",
    notions=["listes", "tranches"], fonction="premieres_commandes",
    enonce="Les commandes du jour arrivent dans une liste, dans l'ordre. Complétez premieres_commandes() pour qu'elle renvoie les trois premières.",
    depart=d('''\
        def premieres_commandes(file):
            """Renvoie les trois premières commandes de la file."""
            # À vous de jouer
            return []
        '''),
    solution=d('''\
        def premieres_commandes(file):
            """Renvoie les trois premières commandes de la file."""
            return file[0:3]
        '''),
    tests=d('''\
        def test_cinq_commandes():
            """Sur cinq commandes, les trois premières sont renvoyées dans l'ordre"""
            file = ["Café du Pont", "Épicerie Vrac & Fils", "Marie Dumont", "Taverne Saint-Jean", "Lucas Bertrand"]
            assert premieres_commandes(file) == ["Café du Pont", "Épicerie Vrac & Fils", "Marie Dumont"]

        def test_deux_commandes():
            """Une file de deux commandes est renvoyée entière"""
            assert premieres_commandes(["Café du Pont", "Cave aux Bulles"]) == ["Café du Pont", "Cave aux Bulles"]

        def bonus_file_vide():
            """Une file vide donne une liste vide, sans planter"""
            assert premieres_commandes([]) == []

        def scenario_principal():
            """Le préparateur livre les commandes que votre fonction a choisies"""
            file = ["Café du Pont", "Épicerie Vrac & Fils", "Marie Dumont", "Taverne Saint-Jean", "Lucas Bertrand"]
            quais = {"Café du Pont": "Q1", "Épicerie Vrac & Fils": "Q2", "Marie Dumont": "Q3", "Taverne Saint-Jean": "Q1", "Lucas Bertrand": "Q3"}
            choisies = premieres_commandes(list(file))
            choisies = choisies if isinstance(choisies, list) else []
            afficher(f"{len(choisies)} commandes à préparer", ok=choisies == file[0:3])
            faites = set()
            for client in choisies:
                if client in quais and client not in faites:
                    faites.add(client)
                    aller_chercher(f"CAISSE-{file.index(client) + 1}")
                    livrer(quais[client], ok=client in file[0:3])
        '''),
    indices=["Le premier élément d'une liste est à l'indice 0.", "Une tranche file[debut:fin] s'arrête juste avant fin : file[0:3] donne les indices 0, 1 et 2."],
    scene={"objets": [{"id": f"CAISSE-{i}", "type": "caisse", "biere": b} for i, b in enumerate(["B01", "B02", "B03", "B04", "B05"], 1)]}, duree=4)

mission(
    id="4.2-derniere-livraison", serie=4, numero=2, surprise=True, titre="L'indice -1 donne la dernière livraison",
    notions=["listes", "indices négatifs", "liste vide"], fonction="derniere_livraison",
    enonce="Complétez derniere_livraison() pour qu'elle renvoie le dernier client livré de la liste.",
    depart=d('''\
        def derniere_livraison(livraisons):
            """Renvoie le dernier client livré."""
            # À vous de jouer
            return ""
        '''),
    solution=d('''\
        def derniere_livraison(livraisons):
            """Renvoie le dernier client livré."""
            if livraisons:
                return livraisons[-1]
            return "Aucune livraison"
        '''),
    tests=d('''\
        def test_trois_livraisons():
            """Après trois livraisons, la dernière est celle de Lucas Bertrand"""
            assert derniere_livraison(["Cave aux Bulles", "Café du Pont", "Lucas Bertrand"]) == "Lucas Bertrand"

        def test_une_livraison():
            """Avec une seule livraison, la dernière est aussi la première"""
            assert derniere_livraison(["Café du Pont"]) == "Café du Pont"

        def bonus_liste_intacte():
            """La liste des livraisons n'est pas modifiée"""
            livraisons = ["Cave aux Bulles", "Café du Pont", "Lucas Bertrand"]
            derniere_livraison(livraisons)
            assert livraisons == ["Cave aux Bulles", "Café du Pont", "Lucas Bertrand"]

        def cache_aucune_livraison():
            """Contrôle surprise : sans aucune livraison, la fonction renvoie « Aucune livraison »"""
            assert derniere_livraison([]) == "Aucune livraison"

        def scenario_principal():
            """Le préparateur retourne au quai de la dernière livraison"""
            client = derniere_livraison(["Cave aux Bulles", "Café du Pont", "Lucas Bertrand"])
            juste = client == "Lucas Bertrand"
            afficher(f"Dernière livraison : {client}", ok=juste)
            controler("Q3" if juste else "R", str(client), ok=juste)
        '''),
    indices=["L'indice -1 désigne le dernier élément d'une liste.", "Pour le contrôle surprise : une liste vide compte pour faux, if livraisons: le teste."],
    scene={"objets": []}, duree=5, marge=1)

mission(
    id="4.3-fut-tuple", serie=4, numero=3, titre="Un tuple se décompose en noms",
    notions=["tuples", "décomposition"], fonction="description_fut",
    enonce="Un fût arrive sous la forme d'un tuple : son numéro, puis sa bière. Complétez description_fut() pour qu'elle renvoie, par exemple, \"Fût 23 : Le Crassier\".",
    depart=d('''\
        def description_fut(fut):
            """Renvoie la description d'un fût, par exemple "Fût 23 : Le Crassier"."""
            # À vous de jouer : décomposez le tuple en deux noms.
            return ""
        '''),
    solution=d('''\
        def description_fut(fut):
            """Renvoie la description d'un fût, par exemple "Fût 23 : Le Crassier"."""
            numero, biere = fut
            return f"Fût {numero} : {biere}"
        '''),
    tests=d('''\
        def test_fut_23():
            """Le fût (23, "Le Crassier") se décrit « Fût 23 : Le Crassier »"""
            assert description_fut((23, "Le Crassier")) == "Fût 23 : Le Crassier"

        def test_fut_8():
            """Le fût (8, "L'Étincelle") se décrit « Fût 8 : L'Étincelle »"""
            assert description_fut((8, "L'Étincelle")) == "Fût 8 : L'Étincelle"

        def bonus_tuple_intact():
            """Le tuple reçu n'est pas transformé en autre chose"""
            fut = (17, "La Braise")
            description_fut(fut)
            assert fut == (17, "La Braise")

        def scenario_principal():
            """La description est collée sur le fût 23, rangé ensuite au rayon du Crassier"""
            texte = description_fut((23, "Le Crassier"))
            juste = texte == "Fût 23 : Le Crassier"
            aller_chercher("FUT-23")
            etiqueter(texte if texte else "(description vide)", ok=juste)
            if juste:
                ranger("rayon-2", "Le Crassier : fût 23 rangé")
            else:
                livrer("R", ok=False)
        '''),
    indices=["numero, biere = fut range les deux valeurs du tuple dans deux noms.", "Composez ensuite le texte avec une f-string."],
    scene={"objets": [{"id": "FUT-23", "type": "fut", "biere": "B04"}]}, duree=4, marge=1)

# ------------------------------------------------------------------ série 5
mission(
    id="5.1-tournee", serie=5, numero=1, titre="Une boucle numérote toute la tournée",
    notions=["for", "enumerate", "append"], fonction="feuille_de_route",
    enonce="Complétez feuille_de_route() : pour chaque arrêt de la tournée, elle ajoute à la liste une ligne comme \"Arrêt 1 : Café du Pont\", numérotée à partir de 1.",
    depart=d('''\
        def feuille_de_route(arrets):
            """Renvoie la liste des lignes de la feuille de route."""
            lignes = []
            # À vous de jouer : une boucle, et lignes.append(...) à chaque tour
            return lignes
        '''),
    solution=d('''\
        def feuille_de_route(arrets):
            """Renvoie la liste des lignes de la feuille de route."""
            lignes = []
            for numero, client in enumerate(arrets, start=1):
                lignes.append(f"Arrêt {numero} : {client}")
            return lignes
        '''),
    tests=d('''\
        def test_trois_arrets():
            """Trois arrêts donnent trois lignes, numérotées de 1 à 3"""
            arrets = ["Café du Pont", "Taverne Saint-Jean", "Cave aux Bulles"]
            assert feuille_de_route(arrets) == ["Arrêt 1 : Café du Pont", "Arrêt 2 : Taverne Saint-Jean", "Arrêt 3 : Cave aux Bulles"]

        def test_un_arret():
            """Un seul arrêt donne une seule ligne"""
            assert feuille_de_route(["Marie Dumont"]) == ["Arrêt 1 : Marie Dumont"]

        def bonus_aucun_arret():
            """Une tournée sans arrêt donne une liste vide"""
            assert feuille_de_route([]) == []

        def scenario_principal():
            """Le préparateur fait la tournée dans l'ordre de votre feuille de route"""
            arrets = ["Café du Pont", "Taverne Saint-Jean", "Cave aux Bulles"]
            quais = {"Café du Pont": "Q1", "Taverne Saint-Jean": "Q1", "Cave aux Bulles": "Q2"}
            lignes = feuille_de_route(list(arrets))
            lignes = lignes if isinstance(lignes, list) else []
            for i, client in enumerate(arrets):
                attendu = f"Arrêt {i + 1} : {client}"
                ligne = lignes[i] if i < len(lignes) else "(ligne absente)"
                juste = ligne == attendu
                afficher(ligne, ok=juste)
                aller_chercher(f"CAISSE-{i + 1}")
                livrer(quais[client] if juste else "R", ok=juste)
        '''),
    indices=["enumerate(arrets, start=1) donne le numéro et le client à chaque tour.", "Dans la boucle : lignes.append(f\"Arrêt {numero} : {client}\")."],
    scene={"objets": [{"id": f"CAISSE-{i}", "type": "caisse", "biere": b} for i, b in enumerate(["B01", "B04", "B02"], 1)]}, duree=6, marge=1)

mission(
    id="5.2-chariot", serie=5, numero=2, surprise=True, titre="while charge le chariot tant qu'il reste de la place",
    notions=["while", "and", "compteur"], fonction="charger_chariot", outils=["charger"],
    enonce="Le chariot porte 4 fûts au plus. Complétez charger_chariot() : elle appelle l'outil charger() pour chaque fût, tant que le chariot n'est pas plein et qu'il reste des fûts sur le quai, puis renvoie le nombre de fûts chargés.",
    depart=d('''\
        def charger_chariot(futs_sur_le_quai):
            """Charge le chariot fût par fût. Renvoie le nombre de fûts chargés."""
            charges = 0
            # À vous de jouer : une boucle while qui appelle charger()
            return charges
        '''),
    solution=d('''\
        def charger_chariot(futs_sur_le_quai):
            """Charge le chariot fût par fût. Renvoie le nombre de fûts chargés."""
            charges = 0
            while charges < 4 and futs_sur_le_quai > 0:
                charger()
                charges += 1
                futs_sur_le_quai -= 1
            return charges
        '''),
    tests=d('''\
        def test_neuf_futs():
            """Avec 9 fûts sur le quai, le chariot repart avec 4 fûts"""
            preparer_quai(9)
            assert charger_chariot(9) == 4
            assert nb_charges() == 4, "Le chariot doit porter 4 fûts : appelez charger() une fois par fût."

        def test_quatre_futs():
            """Avec 4 fûts sur le quai, le chariot repart plein"""
            preparer_quai(4)
            assert charger_chariot(4) == 4
            assert nb_charges() == 4, "Le chariot doit porter 4 fûts : appelez charger() une fois par fût."

        def bonus_quai_vide():
            """Sans fût sur le quai, rien n'est chargé"""
            preparer_quai(0)
            assert charger_chariot(0) == 0

        def cache_trois_futs():
            """Contrôle surprise : avec 3 fûts seulement, le chariot repart avec 3 fûts"""
            preparer_quai(3)
            assert charger_chariot(3) == 3
            assert nb_charges() == 3, "Le chariot doit porter 3 fûts."

        def scenario_principal():
            """9 fûts attendent sur le quai"""
            preparer_quai(9)
            charges = charger_chariot(9)
            afficher(f"{charges} fûts chargés, {9 - nb_charges()} restent sur le quai", ok=charges == 4 and nb_charges() == 4)
        '''),
    indices=["La boucle continue tant que deux conditions sont vraies : il reste de la place, et il reste des fûts.", "À chaque tour : charger(), un fût de plus sur le chariot, un fût de moins sur le quai."],
    scene={"objets": [], "futsQuai": 9, "chariot": True}, duree=8, marge=1)

mission(
    id="5.3-cuves", serie=5, numero=3, titre="Une boucle contrôle chaque cuve",
    notions=["for", "zip", "if", "or"], fonction="cuves_hors_plage",
    enonce="Le brasseur de la Fonderie veut ses cuves entre 18 et 22 °C, bornes incluses. Complétez cuves_hors_plage() pour qu'elle renvoie la liste des cuves hors de cette plage.",
    depart=d('''\
        def cuves_hors_plage(cuves, temperatures):
            """Renvoie la liste des cuves dont la température sort de 18 à 22 °C."""
            alertes = []
            # À vous de jouer : parcourez les deux listes en même temps
            return alertes
        '''),
    solution=d('''\
        def cuves_hors_plage(cuves, temperatures):
            """Renvoie la liste des cuves dont la température sort de 18 à 22 °C."""
            alertes = []
            for cuve, t in zip(cuves, temperatures):
                if t < 18 or t > 22:
                    alertes.append(cuve)
            return alertes
        '''),
    tests=d('''\
        def test_deux_cuves_en_alerte():
            """C2 à 22,6 °C et C4 à 17,1 °C sont hors plage"""
            assert cuves_hors_plage(["C1", "C2", "C3", "C4"], [19.2, 22.6, 18.0, 17.1]) == ["C2", "C4"]

        def test_tout_va_bien():
            """Quatre cuves dans la plage : aucune alerte"""
            assert cuves_hors_plage(["C1", "C2", "C3", "C4"], [19.0, 20.5, 21.0, 19.8]) == []

        def bonus_bornes_incluses():
            """18 °C et 22 °C tout juste sont dans la plage"""
            assert cuves_hors_plage(["C1", "C2"], [18.0, 22.0]) == []

        def scenario_principal():
            """Le préparateur passe devant chaque cuve"""
            cuves = ["C1", "C2", "C3", "C4"]
            temperatures = [19.2, 22.6, 18.0, 17.1]
            alertes = cuves_hors_plage(list(cuves), list(temperatures))
            alertes = alertes if isinstance(alertes, list) else []
            for cuve, t in zip(cuves, temperatures):
                signalee = cuve in alertes
                attendue = t < 18 or t > 22
                texte = f"{t} °C : alerte" if signalee else f"{t} °C"
                controler(cuve, texte, ok=signalee == attendue)
        '''),
    indices=["zip(cuves, temperatures) donne une cuve et sa température à chaque tour.", "Hors plage : plus petit que 18, ou plus grand que 22. Les bornes sont dans la plage."],
    scene={"objets": [], "cuves": {"C1": 19.2, "C2": 22.6, "C3": 18.0, "C4": 17.1}}, duree=7, marge=1)

# ------------------------------------------------------------------ série 6
mission(
    id="6.1-stock", serie=6, numero=1, surprise=True, titre="Une clé met à jour le stock d'une bière",
    notions=["dictionnaires", "for", "in"], fonction="sortir_du_stock",
    enonce="Chaque sortie est un tuple : le code de la bière, puis le nombre de fûts sortis. Complétez sortir_du_stock() pour qu'elle retire chaque sortie du stock, puis renvoie le stock.",
    depart=d('''\
        def sortir_du_stock(stock, sorties):
            """Retire les sorties du stock. Renvoie le stock mis à jour."""
            for code, nb in sorties:
                # À vous de jouer : retirez nb fûts de la bière code
                pass
            return stock
        '''),
    solution=d('''\
        def sortir_du_stock(stock, sorties):
            """Retire les sorties du stock. Renvoie le stock mis à jour."""
            for code, nb in sorties:
                if code in stock:
                    stock[code] -= nb
            return stock
        '''),
    tests=d('''\
        def test_deux_sorties():
            """4 fûts de B01 et 2 fûts de B03 sortent du stock"""
            stock = {"B01": 12, "B02": 6, "B03": 8}
            assert sortir_du_stock(stock, [("B01", 4), ("B03", 2)]) == {"B01": 8, "B02": 6, "B03": 6}

        def test_une_sortie():
            """6 fûts de B02 sortent : il n'en reste plus"""
            stock = {"B01": 12, "B02": 6, "B03": 8}
            assert sortir_du_stock(stock, [("B02", 6)]) == {"B01": 12, "B02": 0, "B03": 8}

        def bonus_aucune_sortie():
            """Sans sortie, le stock ne change pas"""
            assert sortir_du_stock({"B01": 12, "B02": 6}, []) == {"B01": 12, "B02": 6}

        def cache_biere_inconnue():
            """Contrôle surprise : une bière absente du stock (B07) est ignorée, sans erreur"""
            stock = {"B01": 12, "B02": 6, "B03": 8}
            assert sortir_du_stock(stock, [("B01", 4), ("B07", 1)]) == {"B01": 8, "B02": 6, "B03": 8}

        def scenario_principal():
            """Le préparateur met à jour l'écran des rayons des deux bières sorties, puis l'écran de contrôle"""
            stock = sortir_du_stock({"B01": 12, "B02": 6, "B03": 8}, [("B01", 4), ("B03", 2)])
            stock = stock if isinstance(stock, dict) else {}
            juste = stock == {"B01": 8, "B02": 6, "B03": 6}
            for rayon, code, nom, attendu in (("rayon-1", "B01", "La Coulée", 8), ("rayon-3", "B03", "La Braise", 6)):
                controler(rayon, f"{nom} : {stock.get(code, '?')} fûts", ok=stock.get(code) == attendu)
            afficher(f"Stock : {stock}", ok=juste)
        '''),
    indices=["stock[code] -= nb retire nb fûts de la bière dont le code est la clé.", "Pour le contrôle surprise : if code in stock: teste si la bière existe dans le stock."],
    scene={"objets": [], "stock": {"B01": 12, "B02": 6, "B03": 8}}, duree=7, marge=1)

mission(
    id="6.2-clients-livres", serie=6, numero=2, titre="Un set retire les doublons",
    notions=["set", "sorted"], fonction="clients_livres",
    enonce="La liste des livraisons du jour contient plusieurs fois les mêmes clients. Complétez clients_livres() pour qu'elle renvoie la liste des clients, sans doublon, triée par ordre alphabétique.",
    depart=d('''\
        def clients_livres(livraisons):
            """Renvoie la liste triée des clients livrés, sans doublon."""
            # À vous de jouer
            return []
        '''),
    solution=d('''\
        def clients_livres(livraisons):
            """Renvoie la liste triée des clients livrés, sans doublon."""
            return sorted(set(livraisons))
        '''),
    tests=d('''\
        def test_six_livraisons():
            """Six livraisons, trois clients différents"""
            livraisons = ["Café du Pont", "Cave aux Bulles", "Café du Pont", "Marie Dumont", "Cave aux Bulles", "Café du Pont"]
            assert clients_livres(livraisons) == ["Café du Pont", "Cave aux Bulles", "Marie Dumont"]

        def test_une_livraison():
            """Une seule livraison, un seul client"""
            assert clients_livres(["Taverne Saint-Jean"]) == ["Taverne Saint-Jean"]

        def bonus_aucune_livraison():
            """Sans livraison, la liste est vide"""
            assert clients_livres([]) == []

        def scenario_principal():
            """Le préparateur repasse une seule fois devant le quai de chaque client"""
            livraisons = ["Café du Pont", "Cave aux Bulles", "Café du Pont", "Marie Dumont", "Cave aux Bulles", "Café du Pont"]
            clients = clients_livres(list(livraisons))
            clients = clients if isinstance(clients, list) else []
            juste = clients == ["Café du Pont", "Cave aux Bulles", "Marie Dumont"]
            afficher(f"{len(clients)} clients livrés", ok=juste)
            for client, quai in (("Café du Pont", "Q1"), ("Cave aux Bulles", "Q2"), ("Marie Dumont", "Q3")):
                controler(quai, client, ok=clients.count(client) == 1)
        '''),
    indices=["set(livraisons) ne garde qu'un exemplaire de chaque client.", "Un set n'a pas d'ordre : sorted() renvoie une liste triée."],
    scene={"objets": []}, duree=4)

mission(
    id="6.3-futs-par-quai", serie=6, numero=3, bonus=True, titre="Un dictionnaire compte les fûts par quai",
    notions=["dictionnaires", "get", "compteur"], fonction="futs_par_quai",
    enonce="Mission bonus. Chaque élément de la liste est le quai d'un fût. Complétez futs_par_quai() pour qu'elle renvoie un dictionnaire : le quai pour clé, le nombre de fûts pour valeur.",
    depart=d('''\
        def futs_par_quai(futs):
            """Renvoie le nombre de fûts de chaque quai, dans un dictionnaire."""
            par_quai = {}
            # À vous de jouer
            return par_quai
        '''),
    solution=d('''\
        def futs_par_quai(futs):
            """Renvoie le nombre de fûts de chaque quai, dans un dictionnaire."""
            par_quai = {}
            for quai in futs:
                par_quai[quai] = par_quai.get(quai, 0) + 1
            return par_quai
        '''),
    tests=d('''\
        def test_sept_futs():
            """Sept fûts : 3 pour Q1, 1 pour Q3, 2 pour Q2, 1 pour Q4"""
            assert futs_par_quai(["Q1", "Q3", "Q1", "Q2", "Q1", "Q4", "Q2"]) == {"Q1": 3, "Q3": 1, "Q2": 2, "Q4": 1}

        def test_un_fut():
            """Un seul fût pour Q2"""
            assert futs_par_quai(["Q2"]) == {"Q2": 1}

        def bonus_aucun_fut():
            """Sans fût, le dictionnaire est vide"""
            assert futs_par_quai([]) == {}

        def scenario_principal():
            """Quatre fûts partent, l'écran affiche votre comptage"""
            futs = ["Q1", "Q2", "Q1", "Q4"]
            comptage = futs_par_quai(list(futs))
            juste = comptage == {"Q1": 2, "Q2": 1, "Q4": 1}
            for i, quai in enumerate(futs, start=1):
                aller_chercher(f"FUT-{i}")
                livrer(quai)
            afficher(f"{comptage}", ok=juste)
        '''),
    indices=["par_quai.get(quai, 0) renvoie le compte actuel, ou 0 si le quai n'est pas encore dans le dictionnaire.", "À chaque tour : par_quai[quai] = par_quai.get(quai, 0) + 1."],
    scene={"objets": [{"id": f"FUT-{i}", "type": "fut", "biere": b, "destination": q} for i, (b, q) in enumerate([("B01", "Q1"), ("B03", "Q2"), ("B02", "Q1"), ("B05", "Q4")], 1)]}, duree=8, marge=1)


# Séries 3 à 6 : jouées dans l'atelier de construction (atelier.html), à partir des textes, départs et solutions ci-dessus.
# faire_atelier.py les convertit (cas de test, palette) ; ce script n'écrit plus leurs fichiers du jeu 1.
SERIES_ATELIER = {3, 4, 5, 6}


def ecrire_index():
    """Un seul index pour la carte : missions du jeu 1 (séries 1 et 2), puis missions de l'atelier (site/atelier/missions/index.json)."""
    index = {"series": [{"numero": n, **s} for n, s in SERIES.items()], "missions": []}
    for m in M:
        if m["serie"] not in SERIES_ATELIER:
            index["missions"].append({"id": m["id"], "serie": m["serie"], "numero": m["numero"], "titre": m["titre"],
                                      "surprise": bool(m.get("surprise")), "bonus": bool(m.get("bonus")), "dureeIndicativeMin": m["duree"]})
    chemin = SITE / "atelier" / "missions" / "index.json"
    if chemin.exists():
        for a in json.loads(chemin.read_text(encoding="utf-8"))["missions"]:
            index["missions"].append({**{c: a[c] for c in ("id", "serie", "numero", "titre", "surprise", "bonus", "dureeIndicativeMin")}, "atelier": True})
    else:
        print("ATTENTION : site/atelier/missions/index.json absent ; lancez faire_atelier.py, il réécrit l'index.")
    (SITE / "missions" / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ------------------------------------------------------------------ écriture et vérification
def ecrire():
    echecs = 0
    for m in [m for m in M if m["serie"] not in SERIES_ATELIER]:
        nb_visibles = m["tests"].count("def test_")
        lignes_solution = runner.compter_lignes(m["solution"])
        maxi = lignes_solution + m.get("marge", 0)
        critere = "actions" if m.get("critere") == "actions" else "lignes"
        fiche = {
            "id": m["id"], "serie": m["serie"], "numero": m["numero"], "titre": m["titre"], "notions": m["notions"],
            "enonce": m["enonce"], "fonctionAttendue": m["fonction"], "scene": m["scene"],
            "scenarioPrincipal": "scenario_principal",
            "etoiles": {"critere": critere, "max": maxi,
                        "description1": "Tous les tests visibles passent",
                        "description2": f"Votre code tient en {maxi} lignes ou moins (sans les commentaires)",
                        "description3": "Le test bonus passe aussi"},
            "indices": m["indices"],
            "reussiSi": f"Les {nb_visibles} tests visibles passent.",
            "surprise": bool(m.get("surprise")), "bonus": bool(m.get("bonus")),
            "dureeIndicativeMin": m["duree"],
        }
        if m.get("outils"):
            fiche["outilsMission"] = m["outils"]
        dossier = SITE / "missions" / m["id"]
        dossier.mkdir(parents=True, exist_ok=True)
        (dossier / "mission.json").write_text(json.dumps(fiche, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (dossier / "depart.py").write_text(m["depart"], encoding="utf-8")
        (dossier / "tests.py").write_text(m["tests"], encoding="utf-8")
        (RACINE / "solutions").mkdir(exist_ok=True)
        (RACINE / "solutions" / f"{m['id']}.py").write_text(m["solution"], encoding="utf-8")

        # vérification avec le runner
        r = runner.executer(m["solution"], m["tests"], fiche)
        caches = [t for t in r["tests"] if t["groupe"] == "cache"]
        ok_solution = r["erreur"] is None and r["etoiles"] == [True, True, True] and all(t["ok"] for t in caches) \
            and all(a["ok"] for a in r["journal"]) and len(r["journal"]) > 0
        r0 = runner.executer(m["depart"], m["tests"], fiche)
        ok_depart = r0["etoiles"][0] is False and r0["erreur"] is None
        etat = "ok " if ok_solution and ok_depart else "ÉCHEC"
        if etat != "ok ":
            echecs += 1
            print(json.dumps({"solution": {"erreur": r["erreur"], "etoiles": r["etoiles"], "tests": [(t["nom"], t["ok"], t["message"]) for t in r["tests"]], "journal": r["journal"]},
                              "depart": {"erreur": r0["erreur"], "etoiles": r0["etoiles"]}}, ensure_ascii=False, indent=1))
        print(f"{etat} {m['id']:26s} solution : {lignes_solution} lignes (max {maxi}), {len(r['journal'])} actions ; départ : "
              f"{sum(t['ok'] for t in r0['tests'] if t['groupe'] == 'visible')}/{nb_visibles} tests visibles, {len(r0['journal'])} actions")
    ecrire_index()
    print(f"{len([m for m in M if m['serie'] not in SERIES_ATELIER])} missions écrites, {echecs} échec(s)")
    return echecs


if __name__ == "__main__":
    sys.exit(1 if ecrire() else 0)
