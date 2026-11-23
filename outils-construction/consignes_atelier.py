"""Consignes des missions de l'atelier et de l'usine (séries 3 à 8), réécrites le 20/11/2026 à la demande du formateur.

Chaque consigne suit le même ordre : la situation à la brasserie, ce que reçoit et renvoie la fonction (ou ce que fait le programme),
un exemple d'appel, des étoiles qui disent exactement ce que vérifient les tests, deux indices (une piste, puis la syntaxe).
Les données viennent du fil rouge (bières B01 à B05, clients C01 à C08, lot du vendredi du J3). Aucune valeur au hasard.
faire_atelier.py applique ces textes par-dessus les définitions des missions, puis vérifie solutions, départs et variantes.
"""

CONSIGNES = {
    "3.1-quai": dict(
        titre="Chaque client a son quai de chargement",
        enonce="Au quai d'expédition, les fûts sont rangés par type de client : les cafés au quai Q1, les magasins au quai Q2, "
               "les particuliers au quai Q3. Tous les autres clients (un comité des fêtes, une association) partent du quai Q4. "
               "Complétez quai_du_client() : elle reçoit le type de client et renvoie le code de son quai.",
        exemple='quai_du_client("magasin")  →  "Q2"',
        reussiSi="les 3 cas de test renvoient le bon quai.",
        etoiles=("Les 3 cas de test passent : un café, un magasin, un particulier", "Un événement et une association partent du quai Q4"),
        indices=["Python teste les conditions dans l'ordre et s'arrête à la première qui est vraie.",
                 "else n'a pas de condition : il prend tous les clients qui restent. C'est le quai Q4."]),
    "3.2-tarif": dict(
        titre="Les cafés ont 10 % de remise sur les fûts",
        enonce="Le prix d'une commande de fûts, c'est le nombre de fûts multiplié par le prix d'un fût. Les cafés ont 10 % de remise ; "
               "les autres clients paient le plein tarif. La fonction calcule déjà le plein tarif dans total : ajoutez la remise des cafés.",
        exemple='prix_futs("café", 4, 62.0)  →  223.2',
        reussiSi="les 2 cas de test renvoient le bon prix.",
        etoiles=("Les 2 cas de test passent : un café, un particulier", "Un magasin paie le plein tarif"),
        indices=["Retirer 10 %, c'est garder 90 % : multipliez par 0.90.", 'Le test porte sur le type de client : if type_client == "café":']),
    "3.3-stock-bas": dict(
        titre="L'ordre des tests décide de l'état du stock",
        enonce="Le préparateur veut savoir d'un coup d'œil où en est le stock d'une bière. À 0 casier, c'est une rupture de stock ; "
               "sous 10 casiers, le stock est bas ; à partir de 10 casiers, il est suffisant. Complétez etat_stock() : elle reçoit "
               "le nombre de casiers en stock et renvoie \"Rupture de stock\", \"Stock bas\" ou \"Stock suffisant\".",
        exemple='etat_stock(9)  →  "Stock bas"',
        reussiSi="les 3 cas de test renvoient le bon état.",
        etoiles=("Les 3 cas de test passent : 40, 9 et 0 casiers", "10 casiers tout juste donnent un stock suffisant"),
        indices=["0 est aussi plus petit que 10 : quel test doit passer en premier ?",
                 "Testez la rupture (casiers == 0) avant le stock bas (casiers < 10)."],
        libelles={4: "1 casier : c'est un stock bas, pas une rupture"}),
    "3.4-remise-magasin": dict(
        titre="La remise d'un magasin dépend du nombre de casiers",
        enonce="Les magasins (Épicerie Vrac & Fils, Cave aux Bulles) ont une remise sur les casiers : 2 % à partir de 5 casiers, "
               "5 % à partir de 10 casiers, rien en dessous de 5. Complétez remise_magasin() : elle reçoit le nombre de casiers "
               "commandés et renvoie le taux de remise en pour cent : 0, 2 ou 5.",
        exemple="remise_magasin(7)  →  2",
        reussiSi="3, 7 et 12 casiers donnent 0, 2 et 5.",
        etoiles=("Les cas 3, 7 et 12 casiers renvoient la bonne remise", "Les limites aussi : 4, 5, 9 et 10 casiers"),
        indices=["12 casiers, c'est aussi « au moins 5 ». Quelle condition faut-il tester d'abord ?",
                 "« À partir de 10 » : 10 compte. Comparez avec >= plutôt qu'avec >."],
        doc="Renvoie le taux de remise d'un magasin, en pour cent : 0, 2 ou 5.",
        libelles={0: "3 casiers : pas de remise", 1: "7 casiers : 2 % de remise", 2: "12 casiers : 5 % de remise",
                  3: "5 casiers tout juste : 2 %", 4: "10 casiers tout juste : 5 %", 5: "4 casiers : pas encore de remise", 6: "9 casiers : toujours 2 %"}),
    "4.1-trois-premieres": dict(
        titre="Le premier camion prend les trois premières commandes",
        enonce="Les commandes du jour arrivent dans une liste, dans l'ordre où le standard les a notées. Le premier camion part avec "
               "les trois premières. Complétez premieres_commandes() : elle reçoit la file des commandes et renvoie la liste des trois "
               "premières, dans l'ordre. S'il y en a moins de trois, elle les renvoie toutes.",
        exemple='premieres_commandes(["Café du Pont", "Cave aux Bulles", "Marie Dumont", "Lucas Bertrand"])\n  →  ["Café du Pont", "Cave aux Bulles", "Marie Dumont"]',
        reussiSi="les 2 cas de test renvoient les bonnes commandes.",
        etoiles=("Les 2 cas de test passent : cinq commandes, puis deux", "Une file vide donne une liste vide"),
        indices=["Le premier élément d'une liste est à l'indice 0.",
                 "Une tranche file[debut:fin] s'arrête juste avant fin : file[0:3] donne les indices 0, 1 et 2."]),
    "4.2-derniere-livraison": dict(
        titre="L'indice -1 donne la dernière livraison",
        enonce="Le chauffeur note chaque livraison à la suite dans une liste. Le bureau veut savoir qui a été livré en dernier. "
               "Complétez derniere_livraison() : elle reçoit la liste des clients livrés et renvoie le dernier, sans modifier la liste.",
        exemple='derniere_livraison(["Cave aux Bulles", "Café du Pont", "Lucas Bertrand"])  →  "Lucas Bertrand"',
        reussiSi="les 2 cas de test renvoient le bon client.",
        etoiles=("Les 2 cas de test passent : trois livraisons, puis une", "La liste reçue reste intacte"),
        indices=["L'indice -1 désigne le dernier élément d'une liste.",
                 "Une liste vide compte pour faux : if livraisons: la teste avant d'y lire quoi que ce soit."],
        libelles={3: "Sans aucune livraison, la fonction renvoie « Aucune livraison »"}),
    "4.3-fut-tuple": dict(
        titre="Un fût se décrit par son numéro et sa bière",
        enonce="Chaque fût porte une étiquette : son numéro et le nom de sa bière, rangés dans un tuple, par exemple (23, \"Le Crassier\"). "
               "Complétez description_fut() : elle reçoit ce tuple et renvoie le texte de l'étiquette.",
        exemple='description_fut((23, "Le Crassier"))  →  "Fût 23 : Le Crassier"',
        reussiSi="les 2 cas de test renvoient la bonne description.",
        etoiles=("Les 2 cas de test passent : le fût 23, puis le fût 8", "Le tuple reçu reste intact"),
        indices=["numero, biere = fut range les deux valeurs du tuple dans deux noms.",
                 'Composez ensuite le texte avec une f-string : f"Fût {numero} : {biere}".'],
        libelles={2: "Le fût (17, \"La Braise\") est décrit sans que le tuple change"}),
    "4.4-file-commandes": dict(
        titre="Une liste garde les commandes dans l'ordre",
        enonce="Le standard a noté quatre commandes, dans cet ordre : Café du Pont, Cave aux Bulles, Marie Dumont, Taverne Saint-Jean. "
               "Rangez-les dans une liste nommée commandes. Ensuite, Lucas Bertrand commande à son tour et Marie Dumont annule. "
               "Le premier camion emporte les deux premières commandes : mettez-les dans une liste nommée camion. "
               "Pour finir, affichez camion, puis le nombre de commandes.",
        exemple="Affichage attendu : ['Café du Pont', 'Cave aux Bulles'], puis 4",
        reussiSi="commandes contient les 4 commandes à préparer, camion les deux premières, et l'affichage montre camion puis 4.",
        etoiles=("commandes, camion et l'affichage sont justes",
                 "Affichez aussi les commandes par ordre alphabétique, sans changer l'ordre de commandes"),
        indices=["Une tranche s'arrête juste avant la case de fin : [0:2] prend les cases 0 et 1.",
                 "Pour trier sans toucher à la liste, sorted() en fait une copie triée ; .sort() trie la liste elle-même et renvoie None."]),
    "5.1-tournee": dict(
        titre="Une boucle numérote la tournée",
        enonce="Le préparateur imprime une feuille de route : une ligne par arrêt, numérotée à partir de 1, par exemple "
               "\"Arrêt 1 : Café du Pont\". Complétez feuille_de_route() : elle reçoit la liste des arrêts, dans l'ordre de la tournée, "
               "et renvoie la liste des lignes.",
        exemple='feuille_de_route(["Café du Pont", "Marie Dumont"])\n  →  ["Arrêt 1 : Café du Pont", "Arrêt 2 : Marie Dumont"]',
        reussiSi="les 2 cas de test renvoient la bonne feuille de route.",
        etoiles=("Les 2 cas de test passent : trois arrêts, puis un", "Une tournée sans arrêt donne une liste vide"),
        indices=["enumerate(arrets, start=1) donne le numéro et le client à chaque tour.",
                 'Dans la boucle : lignes.append(f"Arrêt {numero} : {client}").']),
    "5.3-cuves": dict(
        titre="Une boucle contrôle chaque cuve",
        enonce="Le brasseur veut ses cuves de fermentation entre 18 et 22 °C, bornes comprises. Complétez cuves_hors_plage() : "
               "elle reçoit la liste des cuves et la liste de leurs températures, dans le même ordre, et renvoie la liste des cuves "
               "hors de cette plage.",
        exemple='cuves_hors_plage(["C1", "C2", "C3"], [19.2, 22.6, 17.1])  →  ["C2", "C3"]',
        reussiSi="les 2 cas de test renvoient les bonnes cuves.",
        etoiles=("Les 2 cas de test passent", "18 °C et 22 °C tout juste sont dans la plage"),
        indices=["zip(cuves, temperatures) donne une cuve et sa température à chaque tour.",
                 "Hors plage : plus petit que 18, ou plus grand que 22. Les deux tests se combinent avec or."]),
    "6.1-stock": dict(
        titre="Le stock se met à jour bière par bière",
        enonce="Le stock est un dictionnaire : le code de la bière pour clé, le nombre de fûts pour valeur, par exemple {\"B01\": 12}. "
               "Chaque sortie est un tuple : le code de la bière, puis le nombre de fûts sortis. Complétez sortir_du_stock() : "
               "elle retire chaque sortie du stock, puis renvoie le stock.",
        exemple='sortir_du_stock({"B01": 12, "B03": 8}, [("B01", 4)])  →  {"B01": 8, "B03": 8}',
        reussiSi="les 2 cas de test renvoient le bon stock.",
        etoiles=("Les 2 cas de test passent", "Sans sortie, le stock ne change pas"),
        indices=["stock[code] -= nb retire nb fûts de la bière dont le code est la clé.",
                 "Le mot in teste si une clé existe dans un dictionnaire, avant d'y toucher."],
        libelles={3: "Une bière absente du stock (B07) est ignorée, sans erreur"}),
    "6.2-clients-livres": dict(
        titre="Un set retire les doublons",
        enonce="La liste des livraisons du jour cite un client à chaque passage du camion : certains clients y sont plusieurs fois. "
               "Complétez clients_livres() : elle renvoie la liste des clients livrés, chacun une seule fois, par ordre alphabétique.",
        exemple='clients_livres(["Café du Pont", "Cave aux Bulles", "Café du Pont"])  →  ["Café du Pont", "Cave aux Bulles"]',
        reussiSi="les 2 cas de test renvoient la bonne liste.",
        etoiles=("Les 2 cas de test passent", "Sans livraison, la liste est vide"),
        indices=["set(livraisons) ne garde qu'un exemplaire de chaque client.", "Un set n'a pas d'ordre : sorted() en fait une liste triée."]),
    "6.3-futs-par-quai": dict(
        titre="Un dictionnaire compte les fûts par quai",
        enonce="Chaque fût qui sort porte le code de son quai : la liste futs en contient un par fût, par exemple [\"Q1\", \"Q3\", \"Q1\"]. "
               "Complétez futs_par_quai() : elle renvoie un dictionnaire, avec le quai pour clé et le nombre de fûts pour valeur.",
        exemple='futs_par_quai(["Q1", "Q3", "Q1"])  →  {"Q1": 2, "Q3": 1}',
        reussiSi="les 2 cas de test renvoient le bon dictionnaire.",
        etoiles=("Les 2 cas de test passent", "Sans fût, le dictionnaire est vide"),
        indices=["par_quai.get(quai, 0) renvoie le compte actuel, ou 0 si le quai n'est pas encore dans le dictionnaire.",
                 "À chaque tour : par_quai[quai] = par_quai.get(quai, 0) + 1."]),
}


# Étoile 2 (décidé le 20/11/2026 après le retour des stagiaires) : la notion de la série est utilisée.
# Une solution juste qui la contourne (une formule, la liste finale écrite d'avance, un compteur tout fait) garde l'étoile 1,
# et le jeu dit pourquoi l'étoile 2 reste éteinte. Plus de limite du nombre d'instructions : elle poussait vers les raccourcis.
# Étiquettes : voir atelier.notions() ; « a|b » : l'une ou l'autre suffit.
NOTIONS = {
    "3.1-quai": (["if", "elif", "else"], "Avec if, elif et else"),
    "3.2-tarif": (["if"], "Avec un if"),
    "3.3-stock-bas": (["if", "elif", "else"], "Avec if, elif et else"),
    "3.4-remise-magasin": (["if", "elif", "else"], "Avec if, elif et else"),
    "4.1-trois-premieres": (["tranche"], "Avec une tranche"),
    "4.2-derniere-livraison": (["indice"], "Avec un indice"),
    "4.3-fut-tuple": (["decomposition", "fstring"], "En décomposant le tuple (numero, biere = fut) et avec une f-string"),
    "4.4-file-commandes": (["methode:append", "methode:remove", "tranche"], "Avec append, remove et une tranche"),
    "5.1-tournee": (["for|comprehension"], "Avec une boucle for"),
    "5.2-chargement": (["while"], "Avec une boucle while"),
    "5.3-cuves": (["for|comprehension"], "Avec une boucle for"),
    "5.4-tournees-file": (["for|while", "if"], "Avec une boucle et un if"),
    "6.1-stock": (["for", "ecrire_cle"], "Avec une boucle for qui met à jour le dictionnaire"),
    "6.2-clients-livres": (["set"], "Avec un set"),
    "6.3-futs-par-quai": (["for", "ecrire_cle"], "En remplissant le dictionnaire clé par clé dans une boucle for"),
    "7.1-prix-renvoye": (["return"], "Avec return"),
    "7.2-remise-par-defaut": (["defaut"], "Avec une valeur par défaut dans la ligne def"),
    "7.3-facture": (["appel:consigne"], "En appelant consigne()"),
    "7.4-file-intacte": (["tranche"], "Avec une tranche, qui ne touche pas à la file"),
    "8.1-lignes-du-lot": (["with", "open"], "Avec with open"),
    "8.2-quantite-lisible": (["try"], "Avec try et except"),
    "8.3-lot-trie": (["import:csv", "try"], "Avec le module csv, et try / except"),
    "8.4-casiers-par-biere": (["for", "ecrire_cle"], "En remplissant le dictionnaire clé par clé dans une boucle for"),
}



# Le plan de construction dans l'usine (ajouté le 23/11/2026, à la demande du formateur, après validation de l'usine sur la mission 4.4) :
# quelles machines poser, avec leur nom de la barre de construction (site/js/usine/code.js). Affiché replié sous la consigne,
# masqué en mode « code seul ». Il dit quoi poser, pas quoi régler : les conditions et les valeurs restent à trouver.
CONSTRUIRE = {
    "3.1-quai": "Dans le bâtiment quai_du_client, posez un « Trieur (if) ». Dans son réglage, ajoutez une voie elif par type de client, puis la voie sinon. Sur chaque voie, une « Étiqueteuse » range le quai dans quai. Le « Retour (return) », au bout de la ligne, renvoie quai.",
    "3.2-tarif": "La « Calculatrice » de départ calcule total. Posez après elle un « Trieur (if) » pour les cafés : sur sa voie, une « Calculatrice » applique la remise à total. Le « Retour (return) » reste au bout de la ligne.",
    "3.3-stock-bas": "Posez un « Trieur (if) » à trois voies : if, une voie elif, puis la voie sinon. Sur chaque voie, une « Étiqueteuse » range l'état dans etat. Le « Retour (return) » renvoie etat.",
    "3.4-remise-magasin": "Posez un « Trieur (if) » à trois voies : if, une voie elif, puis la voie sinon. L'ordre des voies compte : la bouteille prend la première voie dont la condition est vraie. Sur chaque voie, un « Retour (return) » renvoie le taux.",
    "4.1-trois-premieres": "Dans le bâtiment premieres_commandes, un « Scanner : une tranche » copie les premières cases du rayonnage file. Le « Retour (return) » renvoie cette tranche.",
    "4.2-derniere-livraison": "Un « Scanner : une case » lit la dernière case du rayonnage livraisons. Le « Retour (return) » la renvoie. Ne posez ni « Extracteur » ni « Trieur de rayon » : le rayonnage reçu doit rester tel quel.",
    "4.3-fut-tuple": "Une « Vitrine ouverte » range le numéro et la bière du tuple fut sous deux noms. Le « Retour (return) » renvoie le texte de l'étiquette.",
    "4.4-file-commandes": "Un « Rayonnage » pour commandes, un « Chargeur » pour la nouvelle commande, un « Extracteur » pour l'annulation, un « Scanner : une tranche » pour camion, puis deux « Imprimante (print) ».",
    "5.1-tournee": "Un « Rayonnage » vide pour les lignes. Un « Distributeur (for) » envoie les arrêts un par un, avec leur numéro. Dans la boucle, un « Chargeur » ajoute chaque ligne au rayonnage. Le « Retour (return) » renvoie le rayonnage.",
    "5.2-chargement": "Deux « Étiqueteuse » : les commandes chargées (0 au départ) et la place qui reste (6). Une « Cuve à boucle (while) » tourne tant que la commande suivante existe et tient dans la place. Dans la cuve, deux « Calculatrice » mettent à jour la place et le compteur. Le « Retour (return) » renvoie le compteur.",
    "5.3-cuves": "Un « Rayonnage » vide pour les alertes. Un « Distributeur (for) » envoie chaque cuve avec sa température. Dans la boucle, un « Trieur (if) » garde les températures hors de la plage, et sur sa voie un « Chargeur » ajoute la cuve. Le « Retour (return) » renvoie les alertes.",
    "5.4-tournees-file": "Deux « Étiqueteuse » : les tournées et la place dans le chariot. Un « Distributeur (for) » envoie les commandes une par une. Dans la boucle, un « Trieur (if) » : si la commande ne tient pas, une tournée de plus et le chariot revient vide. Après le trieur, une « Calculatrice » retire les casiers de la place.",
    "6.1-stock": "Un « Distributeur (for) » envoie les sorties une par une (le code, puis le nombre). Dans la boucle, un « Trieur (if) » vérifie que le code est dans les casiers du stock ; sur sa voie, un « Casiers : écrire » retire les fûts. Le « Retour (return) » renvoie le stock.",
    "6.2-clients-livres": "Une « Cuve à capsules » (set) rejette les doublons. Un « Copieur trié » (sorted) en fait une liste par ordre alphabétique. Le « Retour (return) » la renvoie.",
    "6.3-futs-par-quai": "Des « Casiers » vides pour le résultat. Un « Distributeur (for) » envoie les fûts un par un. Dans la boucle, un « Casiers : écrire » ajoute 1 au casier du quai, en lisant l'ancien total sans risque (get, 0 si le quai est nouveau). Le « Retour (return) » renvoie les casiers.",
    "7.1-prix-renvoye": "Dans le bâtiment prix_casiers, l'« Imprimante (print) » montre le prix à l'écran, mais rien ne sort du bâtiment. Remplacez-la par un « Retour (return) » : c'est le quai de sortie, ce qui y arrive revient au bureau.",
    "7.2-remise-par-defaut": "Le nouveau paramètre se règle dans la ligne def, dans le code à droite : ajoutez remise, avec 0 pour valeur par défaut ; le bâtiment prix_casiers reçoit alors une entrée de plus. Une « Calculatrice » calcule le total ; le « Retour (return) » renvoie le prix, remise déduite.",
    "7.3-facture": "Le bâtiment consigne est déjà construit. Dans le bâtiment facture, une « Calculatrice » calcule le prix des boissons. Le « Retour (return) » renvoie ce prix plus le résultat de consigne() : appelez le bâtiment consigne, ne recopiez pas son calcul.",
    "7.4-file-intacte": "Dans le bâtiment prochaine_tournee, un « Scanner : une tranche » copie les premières cases du rayonnage file, autant que de places. Le « Retour (return) » renvoie la tranche. Ni « Extracteur » ni « Trieur de rayon » : la file doit ressortir intacte.",
    "8.1-lignes-du-lot": "Un « Sas de fichier (with open) » ouvre lot_vendredi.csv. Dans le sas, une « Étiqueteuse » range ses lignes. Après le sas, une « Calculatrice » compte les commandes, sans l'en-tête, et une « Imprimante (print) » affiche le nombre.",
    "8.2-quantite-lisible": "Un « Sas de sécurité (try / except) » : dans la voie try, une « Calculatrice » convertit le texte avec int() ; dans la voie except ValueError, un « Retour (return) » renvoie None. Après le sas, un « Trieur (if) » écarte les quantités qui ne sont pas positives, puis le « Retour (return) » renvoie la quantité.",
    "8.3-lot-trie": "Une « Livraison (import) » apporte csv. Un « Sas de fichier (with open) » ouvre le lot, un « Distributeur (for) » en envoie les lignes une par une. Dans la boucle, un « Sas de sécurité (try / except) » convertit la quantité, puis un « Trieur (if) » envoie chaque commande vers un « Chargeur » : acceptees ou rejetees. Deux « Imprimante (print) » à la fin.",
    "8.4-casiers-par-biere": "Après le tri de départ, des « Casiers » vides pour casiers. Un « Distributeur (for) » envoie les commandes acceptées une par une. Dans la boucle, un « Trieur (if) » ne garde que les casiers, et sur sa voie un « Casiers : écrire » ajoute la quantité au total de la bière (lu sans risque avec get).",
}

def appliquer(m):
    """Applique la notion de l'étoile 2, puis la consigne réécrite (si la mission en a une), à une mission de faire_atelier.py."""
    exige, texte = NOTIONS[m["id"]]
    m["etoiles"].pop("critere", None)
    m["etoiles"]["notion"] = {"exige": exige, "texte": texte}
    m["etoiles"]["description2"] = texte
    if m["id"] in CONSTRUIRE:
        m["construire"] = CONSTRUIRE[m["id"]]
    c = CONSIGNES.get(m["id"])
    if not c:
        return m
    for champ in ("titre", "enonce", "exemple", "reussiSi", "indices"):
        m[champ] = c[champ]
    m["etoiles"]["description1"] = c["etoiles"][0]
    m["etoiles"]["description3"] = c["etoiles"][1]
    if "doc" in c:
        f = m["fonction"]
        f["doc"] = c["doc"]
        m["depart"] = f'def {f["nom"]}({", ".join(f["parametres"])}):\n    """{c["doc"]}"""\n    pass\n'
        m["solution"] = m["solution"].replace(f'def {f["nom"]}({", ".join(f["parametres"])}):\n', f'def {f["nom"]}({", ".join(f["parametres"])}):\n    """{c["doc"]}"""\n', 1)
    for i, libelle in c.get("libelles", {}).items():
        m["cas"][i]["libelle"] = libelle
    return m
