"""Écrit les 6 niveaux du jeu 2 « la ligne de production » et leurs solutions (05-jeu2-builder.md § 3).

Usage : python faire_niveaux.py
Produit :
- site/ligne/niveaux/<id>/niveau.json, tests.py   (déployés)
- site/ligne/niveaux/index.json                   (liste des niveaux, lue par le jeu)
- solutions-ligne/<id>.json                       (plateau de référence et variantes fausses, jamais déployés)
Ensuite : node outils-construction/verifier_niveaux.mjs (génère le Python de chaque solution et l'exécute).

Données : fiche du fil rouge (01-notes/fil-rouge-brasserie.md) : bières, cuves C1 à C4, quais Q1 à Q4, bouteille de 33 cl, casier de 24.
Les quantités et les défauts de remplissage sont fictifs, choisis pour les exercices.
"""
import json
import pathlib
import textwrap

RACINE = pathlib.Path(__file__).resolve().parent.parent
SITE = RACINE / "site" / "ligne" / "niveaux"
SOLUTIONS = RACINE / "solutions-ligne"

COULEE, LAITIER, BRAISE, CRASSIER = "La Coulée", "Le Laitier", "La Braise", "Le Crassier"
BIERES_MENU = ["La Coulée", "Le Laitier", "La Braise", "Le Crassier", "L'Étincelle"]


def vides(biere, remplissages, dose=None, volumes=None):
    """Bouteilles d'une cuve.

    remplissages : niveau atteint quand la remplisseuse a fini (33 cl, ou moins pour un défaut) ;
    dose : ce que la remplisseuse verse à chaque passage (par défaut tout d'un coup) ;
    volumes : ce que contient déjà chaque bouteille (par défaut 0, bouteille vide).
    """
    sortie = []
    for i, v in enumerate(remplissages):
        b = {"numero": i + 1, "biere": biere, "volume_cl": volumes[i] if volumes else 0, "capsule": False, "etiquette": None, "_cible": v}
        if dose:
            b["_dose"] = dose
        sortie.append(b)
    return sortie


def pleines(bieres, etiquette=False):
    """Bouteilles remplies et capsulées, qui attendent dans la zone de stock."""
    return [{"numero": i + 1, "biere": b, "volume_cl": 33, "capsule": True, "etiquette": b if etiquette else None}
            for i, b in enumerate(bieres)]


def fixe(pid, type_, x, z, **params):
    return {"id": pid, "type": type_, "x": x, "z": z, "params": params}


def piece(pid, type_, x, z, **params):
    return {"id": pid, "type": type_, "x": x, "z": z, "params": params}


def ligne_droite(de, sortie, vers, x0, x1, z):
    return {"id": "t-" + de + "-" + sortie + "-" + vers, "de": de, "sortie": sortie, "vers": vers, "cases": [[x, z] for x in range(x0, x1 + 1)]}


def tapis(de, sortie, vers, cases):
    return {"id": "t-" + de + "-" + sortie + "-" + vers, "de": de, "sortie": sortie, "vers": vers, "cases": [list(c) for c in cases]}


NIVEAUX = []


def niveau(**n):
    n["tests"] = textwrap.dedent(n["tests"]).strip() + "\n"
    NIVEAUX.append(n)


# ---------------------------------------------------------------- 1. séquence
niveau(
    id="ligne-1", numero=1, titre="Remplir, capsuler, expédier", notion="L'ordre des instructions",
    enonce="Les 12 bouteilles vides du brassin de La Coulée attendent dans la cuve C1. Posez une remplisseuse et une capsuleuse, "
           "puis tracez les tapis de la cuve jusqu'au quai Q1 (cafés). À droite, le Python de votre ligne s'écrit pendant que vous construisez.",
    reussiSi="les 12 bouteilles arrivent au quai Q1, remplies et capsulées.",
    palette=["remplisseuse", "capsuleuse"],
    fixes=[fixe("cuve", "cuve", 0, 3, cuve="C1"), fixe("q1", "quai", 11, 3, quai="Q1")],
    depart={"pieces": [], "tapis": []},
    donnees={"C1": vides(COULEE, [33] * 12)},
    donneesLendemain={"C1": vides(COULEE, [33] * 20)},
    etoiles={"critere": "tapis", "description1": "Les 12 bouteilles arrivent au quai, remplies et capsulées",
             "description2": "Ligne compacte : {max} cases de tapis au plus",
             "description3": "Le brassin du lendemain (20 bouteilles) passe aussi"},
    indices=["Une bouteille se remplit avant d'être capsulée : l'ordre des machines sur le tapis est l'ordre des lignes du code.",
             "Pour tracer un tapis : outil Tapis, appuyez sur la pièce de départ, glissez case par case, relâchez sur la pièce d'arrivée."],
    tests="""
        def test_toutes_au_quai(r):
            \"\"\"Les 12 bouteilles arrivent au quai Q1\"\"\"
            n = len(r.bouteilles("Q1"))
            assert n == 12, f"Attendu : 12 bouteilles au quai Q1. Obtenu : {n}."

        def test_remplies(r):
            \"\"\"Chaque bouteille expédiée est remplie\"\"\"
            vides = [b["numero"] for b in r.bouteilles("Q1") if b["volume_cl"] == 0]
            assert not vides, f"Les bouteilles {vides} sont arrivées vides : la remplisseuse est-elle sur leur chemin ?"

        def test_capsulees(r):
            \"\"\"Chaque bouteille expédiée est capsulée\"\"\"
            ouvertes = [b["numero"] for b in r.bouteilles("Q1") if not b["capsule"]]
            assert not ouvertes, f"Les bouteilles {ouvertes} sont arrivées sans capsule."

        def bonus_lendemain(r):
            \"\"\"Le brassin du lendemain (20 bouteilles) arrive aussi au quai, rempli et capsulé\"\"\"
            b = r.bouteilles("Q1")
            assert len(b) == 20 and all(x["capsule"] and x["volume_cl"] for x in b), f"Attendu : 20 bouteilles prêtes au quai Q1. Obtenu : {len(b)}."
    """,
    solution={"pieces": [piece("rem", "remplisseuse", 3, 3), piece("cap", "capsuleuse", 7, 3)],
              "tapis": [ligne_droite("cuve", "suite", "rem", 1, 2, 3), ligne_droite("rem", "suite", "cap", 4, 6, 3), ligne_droite("cap", "suite", "q1", 8, 10, 3)]},
    variantes=[{"nom": "capsuleuse avant la remplisseuse", "inverser": ["rem", "cap"], "attendu": {"erreur": True}}],
)

# ---------------------------------------------------------------- 2. variable
niveau(
    id="ligne-2", numero=2, titre="Compter la production", notion="Une variable",
    enonce="Le brasseur veut savoir combien de bouteilles de La Braise la ligne a produites. Ajoutez sur le tapis un bac compteur : "
           "chaque bouteille qui passe y ajoute 1. Donnez-lui un nom de variable, puis posez un tableau de bord qui affiche ce bac à la fin.",
    reussiSi="les 18 bouteilles arrivent au quai Q2 et le tableau de bord affiche 18.",
    palette=["remplisseuse", "capsuleuse", "compteur", "tableau"],
    fixes=[fixe("cuve", "cuve", 0, 2, cuve="C3"), fixe("q2", "quai", 11, 2, quai="Q2")],
    depart={"pieces": [piece("rem", "remplisseuse", 3, 2), piece("cap", "capsuleuse", 8, 2)],
            "tapis": [ligne_droite("cuve", "suite", "rem", 1, 2, 2), ligne_droite("rem", "suite", "cap", 4, 7, 2), ligne_droite("cap", "suite", "q2", 9, 10, 2)]},
    donnees={"C3": vides(BRAISE, [33] * 18)},
    donneesLendemain={"C3": vides(BRAISE, [33] * 24)},
    etoiles={"critere": "tapis", "description1": "Le tableau de bord affiche le nombre de bouteilles produites",
             "description2": "Ligne compacte : {max} cases de tapis au plus",
             "description3": "Le bac compte juste aussi pour le brassin du lendemain (24 bouteilles)"},
    indices=["Pour poser le bac sur le tapis, retirez un morceau de tapis (outil Retirer), posez le bac à sa place, puis retracez les deux tapis.",
             "Le tableau de bord n'a pas besoin de tapis : réglez-le pour qu'il affiche votre bac. Le print() s'écrit après la boucle."],
    tests="""
        def test_quai(r):
            \"\"\"Les 18 bouteilles arrivent au quai Q2\"\"\"
            n = len(r.bouteilles("Q2"))
            assert n == 18, f"Attendu : 18 bouteilles au quai Q2. Obtenu : {n}."

        def test_tableau(r):
            \"\"\"Le tableau de bord affiche 18\"\"\"
            assert r.sorties, "Le tableau de bord n'affiche rien : posez-en un et réglez-le sur votre bac."
            assert r.sorties[-1] == "18", f"Attendu : le tableau de bord affiche 18. Il affiche : {r.sorties[-1]}."

        def bonus_lendemain(r):
            \"\"\"Avec 24 bouteilles le lendemain, le tableau de bord affiche 24\"\"\"
            assert r.sorties and r.sorties[-1] == "24", f"Attendu : 24. Obtenu : {r.sorties[-1] if r.sorties else 'rien'}."
    """,
    solution={"pieces": [piece("rem", "remplisseuse", 3, 2), piece("bac", "compteur", 5, 2, nom="nb_bouteilles"),
                         piece("cap", "capsuleuse", 8, 2), piece("tdb", "tableau", 5, 5, bac="nb_bouteilles")],
              "tapis": [ligne_droite("cuve", "suite", "rem", 1, 2, 2), ligne_droite("rem", "suite", "bac", 4, 4, 2),
                        ligne_droite("bac", "suite", "cap", 6, 7, 2), ligne_droite("cap", "suite", "q2", 9, 10, 2)]},
    variantes=[{"nom": "sans tableau de bord", "retirer": ["tdb"], "attendu": {"etoiles": [False, None, False]}}],
)

# ---------------------------------------------------------------- 3. condition
REMPLIS_3 = [33, 33, 31, 33, 33, 30, 33, 33, 33, 29, 33, 33, 31, 33, 33, 33]
REMPLIS_3_LENDEMAIN = [33, 32, 33, 31, 33, 32, 33, 33, 30, 33]
niveau(
    id="ligne-3", numero=3, titre="Écarter les bouteilles mal remplies", notion="Une condition (if / else)",
    enonce="La remplisseuse a des ratés : certaines bouteilles de La Coulée contiennent moins de 33 cl. Une bouteille de moins de 32 cl "
           "part au rebut ; les autres sont capsulées puis expédiées au quai Q2 (magasins). Posez un contrôle qualité et réglez sa condition.",
    reussiSi="les 12 bouteilles d'au moins 32 cl arrivent capsulées au quai Q2, les 4 autres au rebut.",
    palette=["capsuleuse", "controle"],
    champs=["volume_cl"], valeurs={"volume_cl": [29, 30, 31, 32, 33]},
    fixes=[fixe("cuve", "cuve", 0, 3, cuve="C1"), fixe("q2", "quai", 11, 3, quai="Q2"), fixe("rebut", "rebut", 6, 6)],
    depart={"pieces": [piece("rem", "remplisseuse", 2, 3)], "tapis": [ligne_droite("cuve", "suite", "rem", 1, 1, 3)]},
    donnees={"C1": vides(COULEE, REMPLIS_3)},
    donneesLendemain={"C1": vides(COULEE, REMPLIS_3_LENDEMAIN)},
    etoiles={"critere": "tapis", "description1": "Les bonnes bouteilles au quai, les mal remplies au rebut",
             "description2": "Ligne compacte : {max} cases de tapis au plus",
             "description3": "Le lendemain, une bouteille de 32 cl tout juste part bien au quai"},
    indices=["Le contrôle qualité mesure le volume : il doit se trouver après la remplisseuse, sinon toutes les bouteilles mesurent 0 cl.",
             "« Moins de 32 cl » s'écrit < 32. Avec <= 32, une bouteille de 32 cl partirait au rebut alors qu'elle est bonne."],
    tests="""
        def test_quai(r):
            \"\"\"Les 12 bouteilles d'au moins 32 cl arrivent au quai Q2\"\"\"
            b = r.bouteilles("Q2")
            assert len(b) == 12, f"Attendu : 12 bouteilles au quai Q2. Obtenu : {len(b)}."
            mauvaises = [x["volume_cl"] for x in b if x["volume_cl"] < 32]
            assert not mauvaises, f"Des bouteilles de {mauvaises} cl sont parties au quai : elles devaient aller au rebut."

        def test_rebut(r):
            \"\"\"Les 4 bouteilles de moins de 32 cl partent au rebut\"\"\"
            v = sorted(x["volume_cl"] for x in r.rebut)
            assert v == [29, 30, 31, 31], f"Attendu au rebut : 29, 30, 31 et 31 cl. Obtenu : {v or 'rien'}."

        def test_capsulees(r):
            \"\"\"Les bouteilles expédiées sont capsulées\"\"\"
            ouvertes = [x["numero"] for x in r.bouteilles("Q2") if not x["capsule"]]
            assert not ouvertes, f"Les bouteilles {ouvertes} sont parties sans capsule."

        def bonus_lendemain(r):
            \"\"\"Le lendemain, les bouteilles de 32 cl tout juste partent au quai\"\"\"
            v = sorted(x["volume_cl"] for x in r.bouteilles("Q2"))
            assert v.count(32) == 2, "Les deux bouteilles de 32 cl du lendemain devaient partir au quai : relisez la comparaison de votre contrôle."
            assert len(r.rebut) == 2, f"Attendu au rebut le lendemain : 2 bouteilles. Obtenu : {len(r.rebut)}."
    """,
    solution={"pieces": [piece("rem", "remplisseuse", 2, 3), piece("cq", "controle", 5, 3, champ="volume_cl", comparateur="<", valeur=32),
                         piece("cap", "capsuleuse", 8, 3)],
              "tapis": [ligne_droite("cuve", "suite", "rem", 1, 1, 3), ligne_droite("rem", "suite", "cq", 3, 4, 3),
                        tapis("cq", "oui", "rebut", [(5, 4), (5, 5), (5, 6)]), ligne_droite("cq", "non", "cap", 6, 7, 3),
                        ligne_droite("cap", "suite", "q2", 9, 10, 3)]},
    variantes=[{"nom": "comparaison <= 32", "regler": {"cq": {"comparateur": "<="}}, "attendu": {"etoiles": [True, None, False]}},
               {"nom": "condition inversée (>= 32 vers le rebut)", "regler": {"cq": {"comparateur": ">="}}, "attendu": {"etoiles": [False, None, False]}}],
)

# ---------------------------------------------------------------- 4. conditions multiples
BIERES_4 = [COULEE, BRAISE, CRASSIER, COULEE, COULEE, CRASSIER, BRAISE, COULEE, BRAISE, CRASSIER, COULEE, BRAISE, COULEE, CRASSIER, BRAISE]
BIERES_4_LENDEMAIN = [BRAISE, COULEE, LAITIER, CRASSIER, COULEE, BRAISE, LAITIER, COULEE]
niveau(
    id="ligne-4", numero=4, titre="Trier trois bières", notion="Plusieurs conditions (elif)",
    enonce="Les bouteilles de La Coulée, de La Braise et du Crassier arrivent mélangées de la zone de stock, remplies et capsulées, sans étiquette. "
           "Chaque bière a son étiqueteuse : triez les bouteilles avec des contrôles qualité, étiquetez-les, puis envoyez-les au quai Q2 (magasins).",
    reussiSi="les 15 bouteilles arrivent au quai Q2, chacune avec l'étiquette de sa bière.",
    palette=["controle", "etiqueteuse"],
    champs=["biere"], valeurs={"biere": BIERES_MENU},
    fixes=[fixe("stock", "stock", 0, 3), fixe("q2", "quai", 11, 3, quai="Q2"), fixe("rebut", "rebut", 11, 7)],
    depart={"pieces": [], "tapis": []},
    donnees={"stock": pleines(BIERES_4)},
    donneesLendemain={"stock": pleines(BIERES_4_LENDEMAIN)},
    etoiles={"critere": "tapis", "description1": "Chaque bouteille porte l'étiquette de sa bière",
             "description2": "Ligne compacte : {max} cases de tapis au plus",
             "description3": "Le lendemain, une bière sans étiqueteuse (Le Laitier) part au rebut au lieu d'être mal étiquetée"},
    indices=["Un contrôle qualité a deux sorties. Posez un deuxième contrôle sur la sortie « non » du premier : le code écrit alors elif.",
             "La dernière sortie « non » reçoit toutes les bouteilles qu'aucun contrôle n'a reconnues : c'est le else. Où doit aller une bière inattendue ?"],
    tests="""
        def test_toutes_au_quai(r):
            \"\"\"Les 15 bouteilles arrivent au quai Q2\"\"\"
            n = len(r.bouteilles("Q2"))
            assert n == 15, f"Attendu : 15 bouteilles au quai Q2. Obtenu : {n}."

        def test_bonnes_etiquettes(r):
            \"\"\"Chaque bouteille porte l'étiquette de sa bière\"\"\"
            fausses = [f"n° {b['numero']} ({b['biere']}, étiquette {b['etiquette'] or 'aucune'})" for b in r.bouteilles("Q2") if b["etiquette"] != b["biere"]]
            assert not fausses, "Bouteilles mal étiquetées : " + ", ".join(fausses[:4]) + ("…" if len(fausses) > 4 else "")

        def bonus_lendemain(r):
            \"\"\"Le lendemain, les deux bouteilles du Laitier partent au rebut, les autres sont bien étiquetées\"\"\"
            laitier = [b for b in r.rebut if b["biere"] == "Le Laitier" and not b["etiquette"]]
            assert len(laitier) == 2, "Les bouteilles du Laitier n'ont pas d'étiqueteuse : elles devaient partir au rebut, sans étiquette. Que fait votre dernier else ?"
            assert all(b["etiquette"] == b["biere"] for b in r.bouteilles("Q2")), "Une bouteille du lendemain est arrivée au quai avec une mauvaise étiquette."
    """,
    solution={"pieces": [piece("c1", "controle", 2, 3, champ="biere", comparateur="==", valeur=COULEE),
                         piece("e1", "etiqueteuse", 5, 1, biere=COULEE),
                         piece("c2", "controle", 4, 3, champ="biere", comparateur="==", valeur=BRAISE),
                         piece("e2", "etiqueteuse", 6, 3, biere=BRAISE),
                         piece("c3", "controle", 4, 5, champ="biere", comparateur="==", valeur=CRASSIER),
                         piece("e3", "etiqueteuse", 6, 5, biere=CRASSIER)],
              "tapis": [ligne_droite("stock", "suite", "c1", 1, 1, 3),
                        tapis("c1", "oui", "e1", [(2, 2), (2, 1), (3, 1), (4, 1)]),
                        tapis("e1", "suite", "q2", [(6, 1), (7, 1), (8, 1), (9, 1), (10, 1), (11, 1), (11, 2)]),
                        ligne_droite("c1", "non", "c2", 3, 3, 3), ligne_droite("c2", "oui", "e2", 5, 5, 3),
                        ligne_droite("e2", "suite", "q2", 7, 10, 3),
                        tapis("c2", "non", "c3", [(4, 4)]), ligne_droite("c3", "oui", "e3", 5, 5, 5),
                        tapis("e3", "suite", "q2", [(7, 5), (8, 5), (9, 5), (10, 5), (11, 5), (11, 4)]),
                        tapis("c3", "non", "rebut", [(4, 6), (4, 7), (5, 7), (6, 7), (7, 7), (8, 7), (9, 7), (10, 7)])]},
    variantes=[{"nom": "Le Crassier dans le else", "retirer": ["c3"], "tapis": [tapis("c2", "non", "e3", [(4, 4), (4, 5), (5, 5)])], "attendu": {"etoiles": [True, None, False]}}],
)

# ---------------------------------------------------------------- 5. boucle while
VOLUMES_5_LENDEMAIN = [0, 11, 0, 22, 0, 0, 11, 0, 22, 0]
niveau(
    id="ligne-5", numero=5, titre="Remplir en plusieurs passages", notion="La boucle while",
    enonce="La nouvelle remplisseuse verse 11 cl à chaque passage : une bouteille de 33 cl doit passer plusieurs fois dessous. "
           "Construisez un anneau de tapis. À son entrée, un détecteur de boucle renvoie la bouteille faire un tour par la remplisseuse "
           "tant qu'elle n'est pas pleine, puis la laisse sortir vers la capsuleuse et le camion du quai Q2 (magasins).",
    reussiSi="les 8 bouteilles de La Coulée arrivent au quai Q2 pleines (33 cl) et capsulées.",
    palette=["detecteur", "remplisseuse", "capsuleuse"],
    champs=["volume_cl"], valeurs={"volume_cl": [11, 22, 30, 33]},
    fixes=[fixe("cuve", "cuve", 0, 3, cuve="C1"), fixe("q2", "quai", 11, 5, quai="Q2")],
    depart={"pieces": [], "tapis": []},
    donnees={"C1": vides(COULEE, [33] * 8, dose=11)},
    donneesLendemain={"C1": vides(COULEE, [33] * 10, dose=11, volumes=VOLUMES_5_LENDEMAIN)},
    etoiles={"critere": "tapis", "description1": "Les 8 bouteilles arrivent au quai pleines (33 cl) et capsulées",
             "description2": "Ligne compacte : {max} cases de tapis au plus",
             "description3": "Le lendemain, des bouteilles déjà entamées (11 ou 22 cl) font juste les tours qu'il leur faut"},
    indices=["Le détecteur se pose à l'entrée de l'anneau : il regarde la bouteille avant chaque tour. Sa sortie « encore un tour » mène à la remplisseuse, "
             "et un tapis ramène la bouteille de la remplisseuse au détecteur.",
             "La bouteille quitte l'anneau dès que la condition devient fausse. Avec < 33, elle tourne tant qu'elle n'est pas pleine ; "
             "avec <= 33, elle repasserait pleine sous la remplisseuse."],
    tests="""
        def test_quai(r):
            \"\"\"Les 8 bouteilles arrivent au quai Q2\"\"\"
            n = len(r.bouteilles("Q2"))
            assert n == 8, f"Attendu : 8 bouteilles au quai Q2. Obtenu : {n}."

        def test_pleines(r):
            \"\"\"Chaque bouteille expédiée contient 33 cl\"\"\"
            v = [b["volume_cl"] for b in r.bouteilles("Q2") if b["volume_cl"] != 33]
            assert not v, f"Des bouteilles sont parties avec {sorted(set(v))} cl : elles quittent l'anneau trop tôt."

        def test_capsulees(r):
            \"\"\"Chaque bouteille expédiée est capsulée\"\"\"
            ouvertes = [b["numero"] for b in r.bouteilles("Q2") if not b["capsule"]]
            assert not ouvertes, f"Les bouteilles {ouvertes} sont parties sans capsule."

        def bonus_lendemain(r):
            \"\"\"Le lendemain, les 10 bouteilles (certaines déjà entamées) arrivent pleines et capsulées\"\"\"
            b = r.bouteilles("Q2")
            assert len(b) == 10 and all(x["volume_cl"] == 33 and x["capsule"] for x in b), f"Attendu : 10 bouteilles de 33 cl, capsulées, au quai Q2. Obtenu : {len(b)}."
    """,
    solution={"pieces": [piece("det", "detecteur", 3, 3, champ="volume_cl", comparateur="<", valeur=33),
                         piece("rem", "remplisseuse", 3, 1), piece("cap", "capsuleuse", 5, 5)],
              "tapis": [ligne_droite("cuve", "suite", "det", 1, 2, 3), tapis("det", "encore", "rem", [(3, 2)]),
                        tapis("rem", "suite", "det", [(4, 1), (4, 2), (4, 3)]),
                        tapis("det", "sortie", "cap", [(3, 4), (3, 5), (4, 5)]), ligne_droite("cap", "suite", "q2", 6, 10, 5)]},
    variantes=[{"nom": "trois remplisseuses à la suite, sans anneau", "retirer": ["det", "rem"],
                "pieces": [piece("r1", "remplisseuse", 2, 3), piece("r2", "remplisseuse", 4, 3), piece("r3", "remplisseuse", 3, 5)],
                "tapis": [tapis("cuve", "suite", "r1", [(1, 3)]), tapis("r1", "suite", "r2", [(3, 3)]), tapis("r2", "suite", "r3", [(4, 4), (3, 4)]),
                          tapis("r3", "suite", "cap", [(4, 5)])],
                "attendu": {"etoiles": [True, None, False]}},
               {"nom": "comparaison <= 33", "regler": {"det": {"comparateur": "<="}}, "attendu": {"erreur": True}},
               {"nom": "sortie à 22 cl", "regler": {"det": {"valeur": 22}}, "attendu": {"etoiles": [False, None, False]}}],
)

# ---------------------------------------------------------------- 6. fonction
niveau(
    id="ligne-6", numero=6, titre="Une machine, deux lignes", notion="Une fonction",
    enonce="Deux brassins sont prêts : La Coulée dans la cuve C1, pour le quai Q1 (cafés), et La Braise dans la cuve C3, pour le quai Q2 (magasins). "
           "Chaque bouteille doit être remplie, capsulée et étiquetée. Créez une seule fois votre machine de conditionnement, puis posez-la sur les deux lignes.",
    reussiSi="chaque quai reçoit ses bouteilles remplies, capsulées et étiquetées au nom de leur bière.",
    palette=["machine", "remplisseuse", "capsuleuse", "etiqueteuse"],
    fixes=[fixe("cuve1", "cuve", 0, 1, cuve="C1"), fixe("cuve3", "cuve", 0, 5, cuve="C3"),
           fixe("q1", "quai", 11, 1, quai="Q1"), fixe("q2", "quai", 11, 5, quai="Q2")],
    depart={"pieces": [], "tapis": [], "machine": {"nom": "conditionner", "etapes": []}},
    donnees={"C1": vides(COULEE, [33] * 10), "C3": vides(BRAISE, [33] * 8)},
    donneesLendemain={"C1": vides(COULEE, [33] * 6), "C3": vides(BRAISE, [33] * 12)},
    etoiles={"critere": "pieces", "description1": "Les deux quais reçoivent des bouteilles prêtes et bien étiquetées",
             "description2": "Une machine par ligne : {max} pièces posées au plus",
             "description3": "Le lendemain (6 et 12 bouteilles), les deux lignes tournent aussi"},
    indices=["Ouvrez « Créer la machine » : choisissez ses étapes dans l'ordre. Le code écrit un def, une seule fois, en haut.",
             "Posez la même machine sur chaque ligne et choisissez sur chacune la bière à étiqueter : c'est l'argument passé à la fonction."],
    tests="""
        def _pretes(bouteilles, biere):
            return [b for b in bouteilles if b["volume_cl"] and b["capsule"] and b["etiquette"] == biere and b["biere"] == biere]

        def test_quai_q1(r):
            \"\"\"Le quai Q1 reçoit 10 bouteilles de La Coulée, prêtes et étiquetées\"\"\"
            b = r.bouteilles("Q1")
            assert len(b) == 10, f"Attendu : 10 bouteilles au quai Q1. Obtenu : {len(b)}."
            assert len(_pretes(b, "La Coulée")) == 10, "Au quai Q1, des bouteilles ne sont pas remplies, capsulées et étiquetées « La Coulée »."

        def test_quai_q2(r):
            \"\"\"Le quai Q2 reçoit 8 bouteilles de La Braise, prêtes et étiquetées\"\"\"
            b = r.bouteilles("Q2")
            assert len(b) == 8, f"Attendu : 8 bouteilles au quai Q2. Obtenu : {len(b)}."
            assert len(_pretes(b, "La Braise")) == 8, "Au quai Q2, des bouteilles ne sont pas remplies, capsulées et étiquetées « La Braise »."

        def bonus_lendemain(r):
            \"\"\"Le lendemain, 6 bouteilles au quai Q1 et 12 au quai Q2, toutes prêtes\"\"\"
            assert len(_pretes(r.bouteilles("Q1"), "La Coulée")) == 6 and len(_pretes(r.bouteilles("Q2"), "La Braise")) == 12, "Le brassin du lendemain n'arrive pas complet et prêt aux deux quais."
    """,
    solution={"pieces": [piece("m1", "machine", 5, 1, biere=COULEE), piece("m3", "machine", 5, 5, biere=BRAISE)],
              "tapis": [ligne_droite("cuve1", "suite", "m1", 1, 4, 1), ligne_droite("m1", "suite", "q1", 6, 10, 1),
                        ligne_droite("cuve3", "suite", "m3", 1, 4, 5), ligne_droite("m3", "suite", "q2", 6, 10, 5)],
              "machine": {"nom": "conditionner", "etapes": ["remplir", "capsuler", "etiqueter"]}},
    variantes=[{"nom": "machine sans étiquetage", "machine": {"nom": "conditionner", "etapes": ["remplir", "capsuler"]}, "attendu": {"etoiles": [False, None, False]}}],
)


def main():
    SITE.mkdir(parents=True, exist_ok=True)
    SOLUTIONS.mkdir(parents=True, exist_ok=True)
    index = []
    for n in NIVEAUX:
        n = dict(n)
        solution, variantes, tests = n.pop("solution"), n.pop("variantes"), n.pop("tests")
        n.setdefault("bieres", BIERES_MENU)
        # seuil de l'étoile 2 : la mesure de la solution de référence (cases de tapis, ou pièces posées)
        if n["etoiles"]["critere"] == "tapis":
            n["etoiles"]["max"] = sum(len(t["cases"]) for t in solution["tapis"])
        else:
            n["etoiles"]["max"] = sum(1 for x in solution["pieces"] if x["type"] != "tableau")
        n["etoiles"]["description2"] = n["etoiles"]["description2"].format(max=n["etoiles"]["max"])
        dossier = SITE / n["id"]
        dossier.mkdir(exist_ok=True)
        (dossier / "niveau.json").write_text(json.dumps(n, ensure_ascii=False, indent=1), encoding="utf-8")
        (dossier / "tests.py").write_text(f"# Tests du niveau {n['numero']} : {n['titre']}. « test_ » : brassin du jour ; « bonus_ » : brassin du lendemain.\n\n" + tests, encoding="utf-8")
        (SOLUTIONS / f"{n['id']}.json").write_text(json.dumps({"solution": solution, "variantes": variantes}, ensure_ascii=False, indent=1), encoding="utf-8")
        index.append({"id": n["id"], "numero": n["numero"], "titre": n["titre"], "notion": n["notion"]})
    (SITE / "index.json").write_text(json.dumps({"niveaux": index}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(NIVEAUX), "niveaux écrits")


if __name__ == "__main__":
    main()
