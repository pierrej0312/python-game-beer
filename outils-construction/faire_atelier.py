"""Écrit les missions prototypes de l'atelier de construction et les vérifie.

Deux sortes de missions : « programme » (le code s'exécute de haut en bas, tests sur les variables et le tableau de bord)
et « fonction » (ligne def donnée, la fonction est appelée sur des cas : paramètres -> résultat attendu).

Usage : python outils-construction/faire_atelier.py
Produit :
- site/atelier/missions/<id>/mission.json, tests.py   (déployés)
- site/atelier/missions/index.json
- solutions-atelier/<id>.json                         (solution et variantes fausses, jamais déployées)
Vérifie : la solution obtient 3 étoiles ; le départ et chaque variante échouent comme prévu ;
chaque instruction de la solution devient un poste (aucun « code libre »).

Données : fiche du fil rouge (remises des magasins : 2 % dès 5 casiers, 5 % dès 10 ; plage des cuves 18 à 22 °C ;
chariot : 6 casiers au plus par tournée ; clients imposés : Café du Pont, Cave aux Bulles, Marie Dumont, Taverne Saint-Jean ; puis Lucas Bertrand),
storyboard J2-21 à J2-27 (indices, tranches, len, append, remove, sorted, piège de .sort()).
"""
import ast
import json
import pathlib
import sys
import textwrap

RACINE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "site" / "python"))
import atelier  # noqa: E402

SITE = RACINE / "site" / "atelier" / "missions"
SOLUTIONS = RACINE / "solutions-atelier"

MISSIONS = []

MISSIONS.append(dict(
    id="4.4-file-commandes", serie=4, numero=4, bonus=True, surprise=False, dureeIndicativeMin=8,
    titre="Une liste garde les commandes dans l'ordre", notion="Les listes : indices, tranches, append, remove",
    enonce="Le standard a noté les commandes du jour, dans l'ordre : Café du Pont, Cave aux Bulles, Marie Dumont, Taverne Saint-Jean. "
           "Rangez-les dans un rayonnage nommé commandes. Lucas Bertrand commande à son tour ; Marie Dumont annule. "
           "Le premier camion emporte les deux premières commandes : rangez-les dans camion, puis affichez camion et le nombre de commandes au tableau de bord.",
    reussiSi="commandes contient les 4 commandes à préparer, camion les deux premières, et le tableau de bord affiche camion puis 4.",
    palette=["creer_liste", "creer_tuple", "variable", "lire_case", "tranche", "longueur", "ajouter", "retirer", "contient",
             "trier_copie", "trier_sur_place", "remplacer_case", "decomposer", "afficher"],
    etoiles={"critere": "postes", "description1": "commandes, camion et le tableau de bord sont justes",
             "description2": "Programme court : {max} postes au plus",
             "description3": "Le tableau de bord affiche aussi les commandes par ordre alphabétique, sans changer l'ordre de commandes"},
    indices=["Une tranche s'arrête juste avant la case de fin : [0:2] prend les cases 0 et 1.",
             "Pour trier sans toucher au rayonnage, sorted() en fait une copie triée ; .sort() range le rayonnage lui-même et ne renvoie rien (None)."],
    tests="""
        ATTENDU = ["Café du Pont", "Cave aux Bulles", "Taverne Saint-Jean", "Lucas Bertrand"]

        def test_commandes(r):
            \"\"\"commandes contient les 4 commandes à préparer, dans l'ordre\"\"\"
            c = r.variables.get("commandes")
            assert c is not None, "Aucune variable commandes : posez un rayonnage (Liste, Créer) et nommez-le commandes."
            assert isinstance(c, list), f"commandes est un {type(c).__name__}, pas une liste : un rayonnage s'écrit entre crochets."
            assert c == ATTENDU, f"Attendu : {ATTENDU}. Obtenu : {c}."

        def test_camion(r):
            \"\"\"camion contient les deux premières commandes\"\"\"
            camion = r.variables.get("camion")
            assert camion is not None, "Aucune variable camion : prenez une tranche de commandes et rangez-la dans camion."
            assert camion == ATTENDU[:2], f"Attendu dans camion : {ATTENDU[:2]}. Obtenu : {camion}."

        def test_tableau(r):
            \"\"\"Le tableau de bord affiche camion, puis le nombre de commandes : 4\"\"\"
            attendu = [str(ATTENDU[:2]), "4"]
            reste = list(r.sorties)
            for ligne in attendu:
                assert ligne in reste, f"Le tableau de bord n'affiche pas {ligne}. Il affiche : {r.sorties or 'rien'}."
                reste = reste[reste.index(ligne) + 1:]

        def bonus_tri(r):
            \"\"\"Le tableau de bord affiche aussi les commandes par ordre alphabétique, et commandes garde son ordre\"\"\"
            assert "None" not in r.sorties, "Le tableau de bord affiche None : .sort() trie le rayonnage lui-même et ne renvoie rien. Essayez sorted()."
            assert str(sorted(ATTENDU)) in r.sorties, f"Attendu au tableau de bord : {sorted(ATTENDU)}."
            assert r.variables.get("commandes") == ATTENDU, "commandes a changé d'ordre : .sort() trie le rayonnage lui-même. sorted() en fait une copie triée."
    """,
    solution="""commandes = ["Café du Pont", "Cave aux Bulles", "Marie Dumont", "Taverne Saint-Jean"]
commandes.append("Lucas Bertrand")
commandes.remove("Marie Dumont")
camion = commandes[0:2]
print(camion)
print(len(commandes))
print(sorted(commandes))
""",
    variantes=[
        {"nom": "tranche [0:1] (la case de fin n'est pas prise)", "remplacer": ["commandes[0:2]", "commandes[0:1]"], "attendu": {"etoiles": [False, None, False]}},
        {"nom": ".sort() au lieu de sorted()", "remplacer": ["print(sorted(commandes))", "commandes.sort()\nprint(commandes)"], "attendu": {"etoiles": [False, None, False]}},
        {"nom": "print(commandes.sort()) affiche None", "remplacer": ["print(sorted(commandes))", "print(commandes.sort())"], "attendu": {"etoiles": [False, None, False]}},
        {"nom": "case 4 d'une liste de 4 : IndexError", "remplacer": ["camion = commandes[0:2]", "camion = commandes[4]"], "attendu": {"erreur": "IndexError"}},
        {"nom": "Marie Dupont n'est pas dans la liste : ValueError", "remplacer": ['commandes.remove("Marie Dumont")', 'commandes.remove("Marie Dupont")'], "attendu": {"erreur": "ValueError"}},
    ],
    depart="",
))

# Pièces de la barre d'outils, série par série : une série ajoute ses pièces à celles des séries précédentes.
PALETTES = {3: ["variable", "calcul", "si", "elif", "else", "afficher", "renvoyer"]}
PALETTES[4] = PALETTES[3] + ["creer_liste", "creer_tuple", "lire_case", "tranche", "longueur", "ajouter", "retirer", "contient",
                             "trier_copie", "trier_sur_place", "remplacer_case", "decomposer"]
PALETTES[5] = PALETTES[4] + ["pour", "tantque"]
PALETTES[6] = PALETTES[5] + ["creer_dict", "creer_set", "lire_cle", "lire_get", "ecrire_cle", "ajouter_set"]

MISSIONS.append(dict(
    id="3.4-remise-magasin", serie=3, numero=4, bonus=True, surprise=False, dureeIndicativeMin=6,
    titre="L'ordre des elif décide de la remise", notion="if, elif, else dans une fonction",
    enonce="Les magasins ont une remise sur les casiers : 2 % à partir de 5 casiers, 5 % à partir de 10 casiers, rien en dessous. "
           "Complétez la fonction : elle reçoit le nombre de casiers commandés et renvoie le taux de remise en pour cent (0, 2 ou 5).",
    reussiSi="les trois cas de test renvoient la bonne remise.",
    fonction={"nom": "remise_magasin", "parametres": ["nb_casiers"], "types": {"nb_casiers": "int"}},
    cas=[{"args": [3], "attendu": 0}, {"args": [7], "attendu": 2}, {"args": [12], "attendu": 5},
         {"args": [5], "attendu": 2, "groupe": "bonus"}, {"args": [10], "attendu": 5, "groupe": "bonus"},
         {"args": [4], "attendu": 0, "groupe": "bonus"}, {"args": [9], "attendu": 2, "groupe": "bonus"}],
    palette=PALETTES[3],
    etoiles={"critere": "postes", "description1": "Les cas 3, 7 et 12 casiers renvoient la bonne remise",
             "description2": "Fonction courte : {max} postes (instructions) au plus",
             "description3": "Les cas aux limites (4, 5, 9 et 10 casiers) aussi"},
    indices=["Python teste les conditions dans l'ordre et s'arrête à la première vraie : 12 casiers, c'est aussi « au moins 5 ». Quelle condition faut-il tester d'abord ?",
             "« À partir de 10 » : 10 compte. Comparez avec >= plutôt qu'avec >."],
    tests="",
    solution="""def remise_magasin(nb_casiers):
    if nb_casiers >= 10:
        return 5
    elif nb_casiers >= 5:
        return 2
    else:
        return 0
""",
    variantes=[
        {"nom": "elif dans le mauvais ordre", "remplacer": ["    if nb_casiers >= 10:\n        return 5\n    elif nb_casiers >= 5:\n        return 2", "    if nb_casiers >= 5:\n        return 2\n    elif nb_casiers >= 10:\n        return 5"], "attendu": {"etoiles": [False, None, False]}},
        {"nom": "> 10 au lieu de >= 10", "remplacer": ["nb_casiers >= 10", "nb_casiers > 10"], "attendu": {"etoiles": [True, None, False]}},
        {"nom": "sans else : None", "remplacer": ["    else:\n        return 0\n", ""], "attendu": {"etoiles": [False, None, False]}},
    ],
    depart="def remise_magasin(nb_casiers):\n    pass\n",
))

MISSIONS.append(dict(
    id="5.4-tournees-chariot", serie=5, numero=4, bonus=True, surprise=False, dureeIndicativeMin=6,
    titre="Une boucle while tourne tant qu'il reste des casiers", notion="while dans une fonction",
    enonce="Le chariot du préparateur emporte 6 casiers au plus par tournée. Complétez la fonction : elle reçoit le nombre de casiers à sortir "
           "et renvoie le nombre de tournées. Utilisez une boucle while : une tournée de plus tant qu'il reste des casiers.",
    reussiSi="6, 7 et 13 casiers donnent 1, 2 et 3 tournées.",
    fonction={"nom": "nombre_de_tournees", "parametres": ["casiers"], "types": {"casiers": "int"}},
    cas=[{"args": [6], "attendu": 1}, {"args": [7], "attendu": 2}, {"args": [13], "attendu": 3},
         {"args": [0], "attendu": 0, "groupe": "bonus"}, {"args": [1], "attendu": 1, "groupe": "bonus"}, {"args": [18], "attendu": 3, "groupe": "bonus"}],
    palette=PALETTES[5],
    etoiles={"critere": "postes", "description1": "6, 7 et 13 casiers donnent 1, 2 et 3 tournées",
             "description2": "Fonction courte : {max} postes (instructions) au plus",
             "description3": "0, 1 et 18 casiers aussi"},
    indices=["Un compteur de tournées à 0, puis while casiers > 0 : le chariot part avec 6 casiers (casiers -= 6) et le compteur augmente de 1.",
             "Si la boucle ne s'arrête jamais, c'est que casiers ne diminue pas dans le corps de la boucle."],
    tests="",
    solution="""def nombre_de_tournees(casiers):
    tournees = 0
    while casiers > 0:
        casiers -= 6
        tournees += 1
    return tournees
""",
    variantes=[
        {"nom": "while casiers >= 0 (une tournée de trop)", "remplacer": ["while casiers > 0", "while casiers >= 0"], "attendu": {"etoiles": [False, None, False]}},
        {"nom": "casiers ne diminue pas : boucle sans fin", "remplacer": ["        casiers -= 6\n", ""], "attendu": {"erreurCas": "BoucleSansFin"}},
        {"nom": "while casiers > 6", "remplacer": ["while casiers > 0", "while casiers > 6"], "attendu": {"etoiles": [False, None, False]}},
    ],
    depart="def nombre_de_tournees(casiers):\n    pass\n",
))


# ------------------------------------------------------------------ missions du jeu 1, séries 3 à 6, passées à l'atelier
# Textes (titre, énoncé, indices), code de départ et solution : repris de faire_missions.py, la source du jeu 1.
# Ici : les cas de test (paramètres -> résultat attendu, repris des tests du jeu 1), la palette, les variantes fausses.
# Valeurs des cas : un tuple s'écrit T(...) ; il est enregistré {"__tuple__": [...]} dans mission.json.
sys.path.insert(0, str(RACINE / "outils-construction"))
import faire_missions  # noqa: E402

JEU1 = {m["id"]: m for m in faire_missions.M}


class T(tuple):
    """Un tuple dans un cas de test."""


def en_json(v):
    if isinstance(v, tuple):
        return {"__tuple__": [en_json(x) for x in v]}
    if isinstance(v, list):
        return [en_json(x) for x in v]
    if isinstance(v, dict):
        return {k: en_json(x) for k, x in v.items()}
    return v


def cas(libelle, args, attendu, groupe="visible", inchange=False):
    c = {"libelle": libelle, "args": en_json(list(args)), "attendu": en_json(attendu)}
    if groupe != "visible":
        c["groupe"] = groupe
    if inchange:
        c["inchange"] = True
    return c


def depuis_jeu1(id, types, cas_, variantes, remplacer=None, etoile3=None):
    """Mission d'atelier à fonction à partir d'une mission du jeu 1. remplacer : champs du jeu 1 réécrits pour l'atelier."""
    j = dict(JEU1[id], **(remplacer or {}))
    arbre = ast.parse(j["solution"]).body[0]
    doc = ast.get_docstring(arbre)
    visibles = sum(1 for c in cas_ if c.get("groupe", "visible") == "visible")
    MISSIONS.append(dict(
        id=id, serie=j["serie"], numero=j["numero"], bonus=bool(j.get("bonus")), surprise=bool(j.get("surprise")),
        dureeIndicativeMin=j["duree"], titre=j["titre"], notion=", ".join(j["notions"]), enonce=j["enonce"],
        reussiSi=f"les {visibles} cas de test renvoient le bon résultat.",
        fonction={"nom": arbre.name, "parametres": [a.arg for a in arbre.args.args], "types": types, "doc": doc},
        cas=cas_, palette=PALETTES[j["serie"]],
        etoiles={"critere": "postes", "description1": "Les cas de test renvoient le bon résultat",
                 "description2": "Fonction courte : {max} postes (instructions) au plus",
                 "description3": etoile3 or "Le cas bonus aussi"},
        indices=j["indices"], tests="", solution=j["solution"], variantes=variantes, depart=j["depart"],
    ))


# Série 3 -----------------------------------------------------------------------------------------------
depuis_jeu1("3.1-quai", {"type_client": "str"}, [
    cas("Un magasin est livré au quai Q2", ["magasin"], "Q2"),
    cas("Un café est livré au quai Q1", ["café"], "Q1"),
    cas("Un particulier est livré au quai Q3", ["particulier"], "Q3"),
    cas("Un événement part au quai Q4", ["événement"], "Q4", "bonus"),
    cas("Une association part au quai Q4", ["association"], "Q4", "bonus"),
], [
    {"nom": "sans else : les autres clients n'ont pas de quai", "remplacer": ['    else:\n        quai = "Q4"\n', ""], "attendu": {"etoiles": [True, None, False]}},
    {"nom": "if au lieu de elif : le café repart au quai Q4", "remplacer": ['    elif type_client == "particulier":', '    if type_client == "particulier":'], "attendu": {"etoiles": [False, None, False]}},
], etoile3="Tout autre client, un événement ou une association, part au quai Q4")

depuis_jeu1("3.2-tarif", {"type_client": "str", "nb_futs": "int", "prix_fut": "float"}, [
    cas("4 fûts de La Coulée pour un café : 223,20 € au lieu de 248,00 €", ["café", 4, 62.00], 223.2),
    cas("Un particulier paie le plein tarif : 248,00 €", ["particulier", 4, 62.00], 248.0),
    cas("Un magasin n'a pas de remise sur les fûts", ["magasin", 2, 58.00], 116.0, "bonus"),
], [
    {"nom": "total * 0.10 : le café paie la remise, pas le prix", "remplacer": ["total * 0.90", "total * 0.10"], "attendu": {"etoiles": [False, None, False]}},
    {"nom": "remise de 10 € au lieu de 10 %", "remplacer": ["total * 0.90", "total - 10"], "attendu": {"etoiles": [False, None, False]}},
], etoile3="Un magasin paie le plein tarif")

depuis_jeu1("3.3-stock-bas", {"casiers": "int"}, [
    cas("40 casiers de La Coulée : stock suffisant", [40], "Stock suffisant"),
    cas("9 casiers de Le Crassier : stock bas", [9], "Stock bas"),
    cas("0 casier : rupture de stock, pas seulement stock bas", [0], "Rupture de stock"),
    cas("10 casiers tout juste : le stock est suffisant", [10], "Stock suffisant", "bonus"),
    cas("Contrôle surprise : 1 casier, c'est un stock bas, pas une rupture", [1], "Stock bas", "cache"),
], [
    {"nom": "stock bas testé avant la rupture", "remplacer": ["    if casiers == 0:\n        etat = \"Rupture de stock\"\n    elif casiers < 10:\n        etat = \"Stock bas\"",
                                                            "    if casiers < 10:\n        etat = \"Stock bas\"\n    elif casiers == 0:\n        etat = \"Rupture de stock\""], "attendu": {"etoiles": [False, None, False]}},
    {"nom": "casiers <= 10 : 10 casiers donnent un stock bas", "remplacer": ["casiers < 10", "casiers <= 10"], "attendu": {"etoiles": [True, None, False]}},
], etoile3="10 casiers tout juste donnent un stock suffisant")

# Série 4 -----------------------------------------------------------------------------------------------
FILE = ["Café du Pont", "Épicerie Vrac & Fils", "Marie Dumont", "Taverne Saint-Jean", "Lucas Bertrand"]
depuis_jeu1("4.1-trois-premieres", {"file": "list"}, [
    cas("Sur cinq commandes, les trois premières sont renvoyées dans l'ordre", [FILE], FILE[0:3]),
    cas("Une file de deux commandes est renvoyée entière", [["Café du Pont", "Cave aux Bulles"]], ["Café du Pont", "Cave aux Bulles"]),
    cas("Une file vide donne une liste vide, sans planter", [[]], [], "bonus"),
], [
    {"nom": "file[1:4] : la première commande est à l'indice 0", "remplacer": ["file[0:3]", "file[1:4]"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "file[0:2] : la tranche s'arrête avant la fin", "remplacer": ["file[0:3]", "file[0:2]"], "attendu": {"etoiles": [False, None, None]}},
], etoile3="Une file vide donne une liste vide")

LIVRAISONS = ["Cave aux Bulles", "Café du Pont", "Lucas Bertrand"]
depuis_jeu1("4.2-derniere-livraison", {"livraisons": "list"}, [
    cas("Après trois livraisons, la dernière est celle de Lucas Bertrand", [LIVRAISONS], "Lucas Bertrand"),
    cas("Avec une seule livraison, la dernière est aussi la première", [["Café du Pont"]], "Café du Pont"),
    cas("La liste des livraisons n'est pas modifiée", [LIVRAISONS], "Lucas Bertrand", "bonus", inchange=True),
    cas("Contrôle surprise : sans aucune livraison, la fonction renvoie « Aucune livraison »", [[]], "Aucune livraison", "cache"),
], [
    {"nom": "pop() retire la dernière livraison de la liste", "remplacer": ["return livraisons[-1]", "return livraisons.pop()"], "attendu": {"etoiles": [True, None, False]}},
    {"nom": "indice 0 : la première livraison", "remplacer": ["livraisons[-1]", "livraisons[0]"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "sans le test de la liste vide : IndexError", "remplacer": ["    if livraisons:\n        return livraisons[-1]\n    return \"Aucune livraison\"", "    return livraisons[-1]"], "attendu": {"erreurCas": "IndexError"}},
], etoile3="La liste reçue n'est pas modifiée")

depuis_jeu1("4.3-fut-tuple", {"fut": "tuple"}, [
    cas("Le fût (23, \"Le Crassier\") se décrit « Fût 23 : Le Crassier »", [T((23, "Le Crassier"))], "Fût 23 : Le Crassier"),
    cas("Le fût (8, \"L'Étincelle\") se décrit « Fût 8 : L'Étincelle »", [T((8, "L'Étincelle"))], "Fût 8 : L'Étincelle"),
    cas("Le tuple reçu n'est pas transformé en autre chose", [T((17, "La Braise"))], "Fût 17 : La Braise", "bonus", inchange=True),
], [
    {"nom": "noms inversés", "remplacer": ["numero, biere = fut", "biere, numero = fut"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "texte sans f : les accolades restent", "remplacer": ['f"Fût {numero} : {biere}"', '"Fût {numero} : {biere}"'], "attendu": {"etoiles": [False, None, None]}},
], etoile3="Le tuple reçu n'est pas transformé")

# Série 5 -----------------------------------------------------------------------------------------------
depuis_jeu1("5.1-tournee", {"arrets": "list"}, [
    cas("Trois arrêts donnent trois lignes, numérotées de 1 à 3", [["Café du Pont", "Taverne Saint-Jean", "Cave aux Bulles"]],
        ["Arrêt 1 : Café du Pont", "Arrêt 2 : Taverne Saint-Jean", "Arrêt 3 : Cave aux Bulles"]),
    cas("Un seul arrêt donne une seule ligne", [["Marie Dumont"]], ["Arrêt 1 : Marie Dumont"]),
    cas("Une tournée sans arrêt donne une liste vide", [[]], [], "bonus"),
], [
    {"nom": "enumerate sans start=1 : la tournée commence à l'arrêt 0", "remplacer": ["enumerate(arrets, start=1)", "enumerate(arrets)"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "return dans la boucle : une seule ligne", "remplacer": ["        lignes.append(f\"Arrêt {numero} : {client}\")\n    return lignes", "        lignes.append(f\"Arrêt {numero} : {client}\")\n        return lignes"], "attendu": {"etoiles": [False, None, None]}},
], etoile3="Une tournée sans arrêt donne une liste vide")

# 5.2 : dans l'atelier, pas d'outil charger() (il n'existe que dans la scène du jeu 1) ; la boucle compte les fûts chargés.
depuis_jeu1("5.2-chariot", {"futs_sur_le_quai": "int"}, [
    cas("Avec 9 fûts sur le quai, le chariot repart avec 4 fûts", [9], 4),
    cas("Avec 4 fûts sur le quai, le chariot repart plein", [4], 4),
    cas("Sans fût sur le quai, rien n'est chargé", [0], 0, "bonus"),
    cas("Contrôle surprise : avec 3 fûts seulement, le chariot repart avec 3 fûts", [3], 3, "cache"),
], [
    {"nom": "or au lieu de and : le chariot déborde", "remplacer": [" and ", " or "], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "sans le test du quai : 4 fûts chargés sur un quai vide", "remplacer": ["while charges < 4 and futs_sur_le_quai > 0:", "while charges < 4:"], "attendu": {"etoiles": [True, None, False]}},
    {"nom": "charges <= 4 : un fût de trop", "remplacer": ["charges < 4", "charges <= 4"], "attendu": {"etoiles": [False, None, None]}},
], remplacer={
    "enonce": "Le chariot porte 4 fûts au plus. Complétez charger_chariot() : une boucle while charge un fût à chaque tour, "
              "tant que le chariot n'est pas plein et qu'il reste des fûts sur le quai. La fonction renvoie le nombre de fûts chargés.",
    "indices": ["La boucle continue tant que deux conditions sont vraies : il reste de la place, et il reste des fûts.",
                "À chaque tour : un fût de plus sur le chariot (charges += 1), un fût de moins sur le quai (futs_sur_le_quai -= 1)."],
    "depart": 'def charger_chariot(futs_sur_le_quai):\n    """Charge le chariot fût par fût. Renvoie le nombre de fûts chargés."""\n    charges = 0\n'
              '    # À vous de jouer : une boucle while\n    return charges\n',
    "solution": 'def charger_chariot(futs_sur_le_quai):\n    """Charge le chariot fût par fût. Renvoie le nombre de fûts chargés."""\n    charges = 0\n'
                '    while charges < 4 and futs_sur_le_quai > 0:\n        charges += 1\n        futs_sur_le_quai -= 1\n    return charges\n',
}, etoile3="Sans fût sur le quai, rien n'est chargé")

depuis_jeu1("5.3-cuves", {"cuves": "list", "temperatures": "list"}, [
    cas("C2 à 22,6 °C et C4 à 17,1 °C sont hors plage", [["C1", "C2", "C3", "C4"], [19.2, 22.6, 18.0, 17.1]], ["C2", "C4"]),
    cas("Quatre cuves dans la plage : aucune alerte", [["C1", "C2", "C3", "C4"], [19.0, 20.5, 21.0, 19.8]], []),
    cas("18 °C et 22 °C tout juste sont dans la plage", [["C1", "C2"], [18.0, 22.0]], [], "bonus"),
], [
    {"nom": "<= et >= : les bornes comptées hors plage", "remplacer": ["t < 18 or t > 22", "t <= 18 or t >= 22"], "attendu": {"etoiles": [False, None, False]}},
    {"nom": "and au lieu de or : aucune cuve n'est jamais hors plage", "remplacer": ["t < 18 or t > 22", "t < 18 and t > 22"], "attendu": {"etoiles": [False, None, None]}},
], etoile3="18 °C et 22 °C tout juste sont dans la plage")

# Série 6 -----------------------------------------------------------------------------------------------
STOCK = {"B01": 12, "B02": 6, "B03": 8}
depuis_jeu1("6.1-stock", {"stock": "dict", "sorties": "list"}, [
    cas("4 fûts de B01 et 2 fûts de B03 sortent du stock", [STOCK, [T(("B01", 4)), T(("B03", 2))]], {"B01": 8, "B02": 6, "B03": 6}),
    cas("6 fûts de B02 sortent : il n'en reste plus", [STOCK, [T(("B02", 6))]], {"B01": 12, "B02": 0, "B03": 8}),
    cas("Sans sortie, le stock ne change pas", [{"B01": 12, "B02": 6}, []], {"B01": 12, "B02": 6}, "bonus"),
    cas("Contrôle surprise : une bière absente du stock (B07) est ignorée, sans erreur", [STOCK, [T(("B01", 4)), T(("B07", 1))]], {"B01": 8, "B02": 6, "B03": 8}, "cache"),
], [
    {"nom": "= au lieu de -= : le stock prend le nombre sorti", "remplacer": ["stock[code] -= nb", "stock[code] = nb"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "sans le test de la clé : KeyError sur B07", "remplacer": ["        if code in stock:\n            stock[code] -= nb", "        stock[code] -= nb"], "attendu": {"erreurCas": "KeyError"}},
], remplacer={
    # l'indice du jeu 1 donnait la ligne « if code in stock: » : avec le code de départ, toute la solution aurait été dans mission.json
    "indices": ["stock[code] -= nb retire nb fûts de la bière dont le code est la clé.",
                "Pour le contrôle surprise : le mot in teste si une clé existe dans un dictionnaire, avant d'y toucher."],
}, etoile3="Sans sortie, le stock ne change pas")

depuis_jeu1("6.2-clients-livres", {"livraisons": "list"}, [
    cas("Six livraisons, trois clients différents", [["Café du Pont", "Cave aux Bulles", "Café du Pont", "Marie Dumont", "Cave aux Bulles", "Café du Pont"]],
        ["Café du Pont", "Cave aux Bulles", "Marie Dumont"]),
    cas("Une seule livraison, un seul client", [["Taverne Saint-Jean"]], ["Taverne Saint-Jean"]),
    cas("Sans livraison, la liste est vide", [[]], [], "bonus"),
], [
    {"nom": "sorted sans set : les doublons restent", "remplacer": ["sorted(set(livraisons))", "sorted(livraisons)"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "set sans sorted : un set, pas une liste", "remplacer": ["sorted(set(livraisons))", "set(livraisons)"], "attendu": {"etoiles": [False, None, None]}},
], etoile3="Sans livraison, la liste est vide")

depuis_jeu1("6.3-futs-par-quai", {"futs": "list"}, [
    cas("Sept fûts : 3 pour Q1, 1 pour Q3, 2 pour Q2, 1 pour Q4", [["Q1", "Q3", "Q1", "Q2", "Q1", "Q4", "Q2"]], {"Q1": 3, "Q3": 1, "Q2": 2, "Q4": 1}),
    cas("Un seul fût pour Q2", [["Q2"]], {"Q2": 1}),
    cas("Sans fût, le dictionnaire est vide", [[]], {}, "bonus"),
], [
    {"nom": "= 1 : le compte repart à 1", "remplacer": ["par_quai.get(quai, 0) + 1", "1"], "attendu": {"etoiles": [False, None, None]}},
    {"nom": "+= 1 sur une clé absente : KeyError", "remplacer": ["par_quai[quai] = par_quai.get(quai, 0) + 1", "par_quai[quai] += 1"], "attendu": {"erreurCas": "KeyError"}},
], etoile3="Sans fût, le dictionnaire est vide")

MISSIONS.sort(key=lambda m: (m["serie"], m["numero"]))


def compter(postes):
    return sum(1 + sum(compter(b) for b in p.get("branches", [])) for p in postes)


def etoiles(mission, resultat, code):
    if resultat["erreur"]:
        return [False, False, False]
    vis = [t for t in resultat["tests"] if t["groupe"] == "visible"]
    bon = [t for t in resultat["tests"] if t["groupe"] == "bonus"]
    analyse = atelier.analyser(code, mission.get("fonction"))
    postes = compter(analyse["postes"]) if analyse["ok"] else 99
    e1 = bool(vis) and all(t["ok"] for t in vis)
    return [e1, e1 and postes <= mission["etoiles"]["max"], e1 and bool(bon) and all(t["ok"] for t in bon)]


def main():
    SITE.mkdir(parents=True, exist_ok=True)
    SOLUTIONS.mkdir(parents=True, exist_ok=True)
    index, echecs = [], 0
    for m in MISSIONS:
        m = dict(m)
        tests = textwrap.dedent(m.pop("tests")).strip() + "\n"
        solution, variantes = m.pop("solution"), m.pop("variantes")
        analyse = atelier.analyser(solution, m.get("fonction"))
        def aplatir(postes):
            for p in postes:
                yield p
                for b in p.get("branches", []):
                    yield from aplatir(b)
        libres = [p for p in aplatir(analyse["postes"]) if p["type"] == "code_libre"]
        if libres:
            echecs += 1; print("ÉCHEC", m["id"], "instructions sans poste :", libres)
        m["etoiles"]["max"] = compter(analyse["postes"])
        m["etoiles"]["description2"] = m["etoiles"]["description2"].format(max=m["etoiles"]["max"])
        r = atelier.executer_atelier(solution, tests, m)
        e = etoiles(m, r, solution)
        print(m["id"], "solution :", e, r.get("sortie"), r["erreur"])
        if e != [True, True, True]:
            echecs += 1; print("ÉCHEC solution", [t for t in r["tests"] if not t["ok"]])
        d = atelier.executer_atelier(m["depart"], tests, m)
        if etoiles(m, d, m["depart"])[0]:
            echecs += 1; print("ÉCHEC : le départ obtient l'étoile 1")
        for v in variantes:
            code = solution.replace(*v["remplacer"])
            assert code != solution, v["nom"]
            rv = atelier.executer_atelier(code, tests, m)
            if "erreurCas" in v["attendu"]:
                types = [c["erreur"]["type"] for c in rv.get("cas", []) if c["erreur"]]
                ok = v["attendu"]["erreurCas"] in types
                detail = types
            elif "erreur" in v["attendu"]:
                ok = rv["erreur"] and rv["erreur"]["type"] == v["attendu"]["erreur"]
                detail = rv["erreur"]["messageOriginal"] if rv["erreur"] else "pas d'erreur"
            else:
                ev = etoiles(m, rv, code)
                ok = all(a is None or a == b for a, b in zip(v["attendu"]["etoiles"], ev))
                detail = f"{ev} {[t['message'] for t in rv['tests'] if not t['ok']][:2]}"
            print("   variante", v["nom"], "->", "ok" if ok else "ÉCHEC", "|", detail)
            echecs += 0 if ok else 1
        dossier = SITE / m["id"]
        dossier.mkdir(exist_ok=True)
        (dossier / "mission.json").write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
        (dossier / "tests.py").write_text(f"# Tests de la mission {m['serie']}.{m['numero']} (atelier). « test_ » : étoile 1 ; « bonus_ » : étoile 3.\n"
                                          + ("# Mission à fonction : les cas de test sont dans mission.json (« cas »).\n" if m.get("fonction") else "\n" + tests), encoding="utf-8")
        (SOLUTIONS / f"{m['id']}.json").write_text(json.dumps({"solution": solution, "variantes": variantes}, ensure_ascii=False, indent=1), encoding="utf-8")
        index.append({c: m[c] for c in ("id", "serie", "numero", "titre", "notion", "surprise", "bonus", "dureeIndicativeMin")})
    (SITE / "index.json").write_text(json.dumps({"missions": index}, ensure_ascii=False, indent=1), encoding="utf-8")
    faire_missions.ecrire_index()      # la carte des missions lit un seul index : jeu 1 (séries 1 et 2) + atelier (séries 3 à 6)
    print(len(MISSIONS), "mission(s) écrite(s),", echecs, "échec(s)")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
