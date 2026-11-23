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
            assert c is not None, "Aucune variable commandes : créez une liste nommée commandes."
            assert isinstance(c, list), f"commandes est un {type(c).__name__}, pas une liste : une liste s'écrit entre crochets."
            assert c == ATTENDU, f"Attendu : {ATTENDU}. Obtenu : {c}."

        def test_camion(r):
            \"\"\"camion contient les deux premières commandes\"\"\"
            camion = r.variables.get("camion")
            assert camion is not None, "Aucune variable camion : prenez une tranche de commandes et rangez-la dans camion."
            assert camion == ATTENDU[:2], f"Attendu dans camion : {ATTENDU[:2]}. Obtenu : {camion}."

        def test_tableau(r):
            \"\"\"L'affichage montre camion, puis le nombre de commandes : 4\"\"\"
            attendu = [str(ATTENDU[:2]), "4"]
            reste = list(r.sorties)
            for ligne in attendu:
                assert ligne in reste, f"L'affichage ne montre pas {ligne}. Il montre : {r.sorties or 'rien'}."
                reste = reste[reste.index(ligne) + 1:]

        def bonus_tri(r):
            \"\"\"L'affichage montre aussi les commandes par ordre alphabétique, et commandes garde son ordre\"\"\"
            assert "None" not in r.sorties, "L'affichage montre None : .sort() trie la liste elle-même et renvoie None. Essayez sorted()."
            assert str(sorted(ATTENDU)) in r.sorties, f"Attendu à l'affichage : {sorted(ATTENDU)}."
            assert r.variables.get("commandes") == ATTENDU, "commandes a changé d'ordre : .sort() trie la liste elle-même. sorted() en fait une copie triée."
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


# 5.2 et 5.4 refaites le 20/11/2026 (retour des stagiaires : « un seul chariot, ça frustre » ; la 5.4 se résolvait par un arrondi).
# Fil rouge : chariot de 6 casiers ; une commande ne se coupe pas. La boucle while a un sens : on ne sait pas d'avance combien de commandes tiennent.
MISSIONS.append(dict(
    id="5.2-chargement", serie=5, numero=2, bonus=False, surprise=True, dureeIndicativeMin=7,
    titre="Le chariot se charge tant que la commande suivante tient", notion="while, deux conditions avec and",
    enonce="Le chariot du préparateur porte 6 casiers. Les commandes attendent sur le quai, dans l'ordre, et une commande ne se coupe pas : "
           "elle part entière ou elle attend. Le préparateur charge les commandes dans l'ordre, tant que la suivante tient dans la place qui reste. "
           "Complétez charger_chariot() avec une boucle while : elle reçoit la liste des casiers de chaque commande et renvoie le nombre de commandes chargées.",
    exemple="charger_chariot([2, 3, 4, 1])  →  2\n(2 + 3 = 5 casiers ; la commande de 4 ne tient plus)",
    reussiSi="les 2 cas de test renvoient le bon nombre de commandes.",
    fonction={"nom": "charger_chariot", "parametres": ["commandes"], "types": {"commandes": "list"},
              "doc": "Renvoie le nombre de commandes chargées dans le chariot de 6 casiers, dans l'ordre de la file."},
    cas=[cas("2, 3, 4 et 1 casiers : les deux premières commandes partent (5 casiers)", [[2, 3, 4, 1]], 2),
         cas("1, 2 et 3 casiers : tout part, le chariot est plein tout juste", [[1, 2, 3]], 3),
         cas("Quai vide : aucune commande", [[]], 0, "bonus"),
         cas("Une commande de 6 casiers remplit le chariot : la suivante attend", [[6, 1]], 1, "bonus"),
         cas("4, puis 3 casiers : la commande de 3 ne tient pas, le préparateur s'arrête même si la suivante (2) tiendrait", [[4, 3, 2]], 1, "cache")],
    palette=PALETTES[5],
    etoiles={"description1": "Les 2 cas de test passent", "description3": "Le quai vide, et une commande de 6 casiers tout juste"},
    indices=["La boucle continue tant que deux conditions sont vraies : il reste une commande sur le quai, et elle tient dans la place qui reste. "
             "Elles se combinent avec and.",
             "chargees sert aussi d'indice : commandes[chargees] est la prochaine commande. À chaque tour : place -= commandes[chargees], puis chargees += 1."],
    tests="",
    depart='def charger_chariot(commandes):\n    """Renvoie le nombre de commandes chargées dans le chariot de 6 casiers, dans l\'ordre de la file."""\n'
           '    chargees = 0\n    place = 6\n    # À vous : une boucle while\n    return chargees\n',
    solution='def charger_chariot(commandes):\n    """Renvoie le nombre de commandes chargées dans le chariot de 6 casiers, dans l\'ordre de la file."""\n'
             '    chargees = 0\n    place = 6\n    while chargees < len(commandes) and commandes[chargees] <= place:\n'
             '        place -= commandes[chargees]\n        chargees += 1\n    return chargees\n',
    variantes=[
        {"nom": "< au lieu de <= : un chariot plein tout juste refuse la dernière commande", "remplacer": ["commandes[chargees] <= place", "commandes[chargees] < place"], "attendu": {"etoiles": [False, None, None]}},
        {"nom": "sans le test de fin de file : IndexError", "remplacer": ["chargees < len(commandes) and ", ""], "attendu": {"erreurCas": "IndexError"}},
        {"nom": "place ne diminue pas : tout est chargé", "remplacer": ["        place -= commandes[chargees]\n", ""], "attendu": {"etoiles": [False, None, None]}},
    ],
    raccourcis=[{"nom": "for et break au lieu de while", "code": 'def charger_chariot(commandes):\n    chargees = 0\n    place = 6\n    for c in commandes:\n'
                 '        if c > place:\n            break\n        place -= c\n        chargees += 1\n    return chargees\n', "attendu": [True, False, True]}],
))

MISSIONS.append(dict(
    id="5.4-tournees-file", serie=5, numero=4, bonus=True, surprise=False, dureeIndicativeMin=8,
    titre="Toute la file part, en autant de tournées qu'il faut", notion="boucle, compteur, if",
    enonce="Même chariot, même règle : 6 casiers, et une commande ne se coupe pas. Quand la commande suivante ne tient plus, le chariot part "
           "en tournée et revient vide. Complétez nombre_de_tournees() : elle reçoit les casiers de chaque commande de la file, dans l'ordre, "
           "et renvoie le nombre de tournées pour tout sortir. Aucune commande ne dépasse 6 casiers.",
    exemple="nombre_de_tournees([2, 3, 4, 1, 5])  →  3\n(2 + 3, puis 4 + 1, puis 5)",
    reussiSi="les 3 cas de test renvoient le bon nombre de tournées.",
    fonction={"nom": "nombre_de_tournees", "parametres": ["commandes"], "types": {"commandes": "list"},
              "doc": "Renvoie le nombre de tournées du chariot de 6 casiers pour sortir toute la file, une commande ne se coupe pas."},
    cas=[cas("2, 3, 4, 1 et 5 casiers : 3 tournées", [[2, 3, 4, 1, 5]], 3),
         cas("Deux commandes de 6 casiers : 2 tournées", [[6, 6]], 2),
         cas("3 et 3 casiers : 1 tournée, le chariot est plein tout juste", [[3, 3]], 1),
         cas("File vide : aucune tournée", [[]], 0, "bonus"),
         cas("Sept commandes d'un casier : 2 tournées", [[1, 1, 1, 1, 1, 1, 1]], 2, "bonus"),
         cas("5, 2, 5 et 2 casiers : 4 tournées, car une commande ne se coupe pas", [[5, 2, 5, 2]], 4, "bonus")],
    palette=PALETTES[5],
    etoiles={"description1": "Les 3 cas de test passent", "description3": "La file vide, sept commandes d'un casier, et 5, 2, 5, 2 casiers"},
    indices=["Une tournée de plus quand la commande ne tient pas dans la place qui reste : le chariot revient vide, avec 6 places.",
             "Au départ, place = 0 : la première commande ne tient pas, ce qui compte la première tournée."],
    tests="",
    depart='def nombre_de_tournees(commandes):\n    """Renvoie le nombre de tournées du chariot de 6 casiers pour sortir toute la file, une commande ne se coupe pas."""\n    pass\n',
    solution='def nombre_de_tournees(commandes):\n    """Renvoie le nombre de tournées du chariot de 6 casiers pour sortir toute la file, une commande ne se coupe pas."""\n'
             '    tournees = 0\n    place = 0\n    for casiers in commandes:\n        if casiers > place:\n            tournees += 1\n'
             '            place = 6\n        place -= casiers\n    return tournees\n',
    variantes=[
        {"nom": ">= au lieu de > : un chariot plein tout juste repart à vide", "remplacer": ["casiers > place", "casiers >= place"], "attendu": {"etoiles": [False, None, None]}},
        {"nom": "place jamais remise à 6 : une tournée par commande", "remplacer": ["            place = 6\n", ""], "attendu": {"etoiles": [False, None, None]}},
    ],
    raccourcis=[{"nom": "arrondi du total (math.ceil)", "code": 'import math\n\ndef nombre_de_tournees(commandes):\n    return math.ceil(sum(commandes) / 6)\n',
                 "attendu": [True, False, False]}],
))

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


# Séries 7 et 8 (usine, 20/11/2026) ---------------------------------------------------------------------
# Données : fil rouge (bières et prix de bieres.csv, clients C01 à C08), exercices J3 7.1 à 7.4 (consigne : 3,00 € par casier,
# 30,00 € par fût), lot du vendredi du J3 (04-ateliers/J3/donnees/lot_vendredi.csv, recopié ici tel quel).
# Ces missions sont faites pour l'usine : leur analyse se fait avec modules=True (def, import, try, with deviennent des machines).
PALETTES[7] = PALETTES[6] + ["fonction", "appel"]
PALETTES[8] = PALETTES[7] + ["importer", "essayer", "avec", "suivant", "sortir"]
LOT_VENDREDI = """date;client;biere;format;quantite
2026-11-20;C02;B01;fut;5
2026-11-20;C04;B03;casier;8
2026-11-20;C05;B01;casier;10
2026-11-20;C06;B02;casier;2
2026-11-20;C01;B04;fut;3
2026-11-20;C08;B05;casier;douze
2026-11-20;C04;B01;casier;4
2026-11-20;C11;B03;casier;6
2026-11-20;C05;B05;casier;-2
2026-11-31;C06;B04;casier;1
2026-11-20;C07;B01;fut;10
2026-11-20;C05;B03;casier;5
2026-11-20;C03;B02;fut;2
2026-11-20;C08;B02;casier;
2026-11-20;C04;B04;casier;3
2026-11-20;C02;B05;fut;4
"""

MISSIONS.append(dict(
    id="7.1-prix-renvoye", serie=7, numero=1, bonus=False, surprise=False, dureeIndicativeMin=5,
    titre="Une fonction renvoie le prix, elle ne l'affiche pas", notion="def, return, print",
    enonce="Le bureau calcule le prix des casiers de chaque commande, puis l'ajoute à la facture. La fonction prix_casiers() de départ "
           "affiche le prix au lieu de le renvoyer : le bureau ne reçoit rien. Corrigez-la : elle reçoit le nombre de casiers et le prix "
           "d'un casier, et renvoie le prix total.",
    exemple="prix_casiers(12, 28.80)  →  345.6",
    reussiSi="les 2 cas de test renvoient le bon prix.",
    fonction={"nom": "prix_casiers", "parametres": ["nb_casiers", "prix_casier"], "types": {"nb_casiers": "int", "prix_casier": "float"},
              "doc": "Renvoie le prix de nb_casiers casiers, consigne non comprise."},
    cas=[cas("12 casiers de La Coulée à 28,80 € : 345,60 €", [12, 28.80], 345.6),
         cas("3 casiers de La Braise à 31,20 € : 93,60 €", [3, 31.20], 93.6),
         cas("Aucun casier : 0 €", [0, 28.80], 0.0, "bonus")],
    palette=PALETTES[7],
    etoiles={"critere": "postes", "description1": "Les 2 cas de test passent : la fonction renvoie le prix",
             "description2": "En {max} instructions au plus", "description3": "Aucun casier donne 0"},
    indices=["print() montre une valeur à l'écran ; return la rend au programme qui a appelé la fonction.",
             "Une fonction sans return renvoie None : c'est ce que reçoit le bureau avec la version de départ."],
    tests="", depart='def prix_casiers(nb_casiers, prix_casier):\n    """Renvoie le prix de nb_casiers casiers, consigne non comprise."""\n    print(nb_casiers * prix_casier)\n',
    solution='def prix_casiers(nb_casiers, prix_casier):\n    """Renvoie le prix de nb_casiers casiers, consigne non comprise."""\n    return nb_casiers * prix_casier\n',
    variantes=[{"nom": "addition au lieu de multiplication", "remplacer": ["nb_casiers * prix_casier", "nb_casiers + prix_casier"], "attendu": {"etoiles": [False, None, None]}}],
))

MISSIONS.append(dict(
    id="7.2-remise-par-defaut", serie=7, numero=2, bonus=False, surprise=False, dureeIndicativeMin=6,
    titre="Une valeur par défaut rend la remise facultative", notion="paramètres, valeur par défaut",
    enonce="La plupart des commandes n'ont pas de remise ; celles des magasins en ont une. Ajoutez à prix_casiers() un troisième paramètre, "
           "remise, qui vaut 0 quand l'appel ne le donne pas. La remise s'écrit en décimal : 0.05 pour 5 %. La fonction renvoie le prix, "
           "remise déduite.",
    exemple="prix_casiers(12, 26.40)        →  316.8\nprix_casiers(12, 26.40, 0.05)  →  300.96",
    reussiSi="le prix est juste sans remise et avec 5 % de remise.",
    fonction={"nom": "prix_casiers", "parametres": ["nb_casiers", "prix_casier", "remise"], "types": {"nb_casiers": "int", "prix_casier": "float", "remise": "float"},
              "doc": "Renvoie le prix de nb_casiers casiers, remise déduite (0.05 pour 5 %), consigne non comprise."},
    cas=[cas("Sans remise : 12 casiers du Laitier à 26,40 €, 316,80 €", [12, 26.40], 316.8),
         cas("Avec 5 % de remise : 300,96 €", [12, 26.40, 0.05], 300.96),
         cas("10 casiers de L'Étincelle avec 2 % de remise : 294,00 €", [10, 30.00, 0.02], 294.0, "bonus")],
    palette=PALETTES[7],
    etoiles={"critere": "postes", "description1": "Le prix est juste sans remise et avec 5 % de remise",
             "description2": "En {max} instructions au plus", "description3": "Le prix est juste avec 2 % de remise"},
    indices=["Une valeur par défaut s'écrit dans la ligne def : remise=0.", "Le prix remisé, c'est total - total * remise."],
    # le départ part d'une fonction qui marche, écrite autrement que le corrigé de 7.1 (aucune solution de référence dans le site)
    tests="", depart='def prix_casiers(nb_casiers, prix_casier):\n    """Renvoie le prix de nb_casiers casiers, remise déduite (0.05 pour 5 %), consigne non comprise."""\n    total = nb_casiers * prix_casier\n    return total\n',
    solution='def prix_casiers(nb_casiers, prix_casier, remise=0):\n    """Renvoie le prix de nb_casiers casiers, remise déduite (0.05 pour 5 %), consigne non comprise."""\n'
             '    total = nb_casiers * prix_casier\n    return total - total * remise\n',
    variantes=[{"nom": "sans valeur par défaut : l'appel à deux valeurs plante", "remplacer": ["remise=0)", "remise)"], "attendu": {"erreurCas": "TypeError"}},
               {"nom": "total * remise : le client paie la remise", "remplacer": ["total - total * remise", "total * remise"], "attendu": {"etoiles": [False, None, None]}}],
))

MISSIONS.append(dict(
    id="7.3-facture", serie=7, numero=3, bonus=False, surprise=False, dureeIndicativeMin=7,
    titre="Une fonction en appelle une autre", notion="appel de fonction, return",
    enonce="La facture d'un client, c'est le prix des boissons plus la consigne des casiers et des fûts. La fonction consigne() est déjà "
           "écrite : 3,00 € par casier, 30,00 € par fût. Complétez facture() : elle calcule le prix des boissons et y ajoute la consigne "
           "en appelant consigne(), sans recopier son calcul.",
    exemple="facture(10, 28.80, 2, 62.00)  →  502.0",
    reussiSi="les 2 cas de test renvoient le bon montant.",
    fonction={"nom": "facture", "parametres": ["nb_casiers", "prix_casier", "nb_futs", "prix_fut"],
              "types": {"nb_casiers": "int", "prix_casier": "float", "nb_futs": "int", "prix_fut": "float"},
              "doc": "Renvoie le montant de la facture : les boissons, plus la consigne."},
    cas=[cas("Café du Pont : 10 casiers et 2 fûts de La Coulée, 502,00 €", [10, 28.80, 2, 62.00], 502.0),
         cas("Marie Dumont : 4 casiers de La Braise, 136,80 €", [4, 31.20, 0, 68.00], 136.8),
         cas("Un fût seul de L'Étincelle : 96,00 €", [0, 30.00, 1, 66.00], 96.0, "bonus")],
    palette=PALETTES[7],
    etoiles={"critere": "postes", "description1": "Les 2 cas de test passent : consigne comprise",
             "description2": "En {max} instructions au plus", "description3": "Un fût seul est facturé avec sa consigne"},
    indices=["consigne(nb_casiers, nb_futs) renvoie un nombre : vous pouvez l'additionner au prix des boissons.",
             "Les boissons : nb_casiers * prix_casier + nb_futs * prix_fut."],
    tests="",
    depart='def consigne(nb_casiers, nb_futs):\n    """Renvoie la consigne : 3,00 € par casier, 30,00 € par fût."""\n    return nb_casiers * 3.00 + nb_futs * 30.00\n\n\n'
           'def facture(nb_casiers, prix_casier, nb_futs, prix_fut):\n    """Renvoie le montant de la facture : les boissons, plus la consigne."""\n    pass\n',
    solution='def consigne(nb_casiers, nb_futs):\n    """Renvoie la consigne : 3,00 € par casier, 30,00 € par fût."""\n    return nb_casiers * 3.00 + nb_futs * 30.00\n\n\n'
             'def facture(nb_casiers, prix_casier, nb_futs, prix_fut):\n    """Renvoie le montant de la facture : les boissons, plus la consigne."""\n'
             '    boissons = nb_casiers * prix_casier + nb_futs * prix_fut\n    return boissons + consigne(nb_casiers, nb_futs)\n',
    variantes=[{"nom": "sans la consigne", "remplacer": ["return boissons + consigne(nb_casiers, nb_futs)", "return boissons"], "attendu": {"etoiles": [False, None, None]}},
               {"nom": "casiers et fûts inversés dans l'appel", "remplacer": ["consigne(nb_casiers, nb_futs)\n", "consigne(nb_futs, nb_casiers)\n"], "attendu": {"etoiles": [False, None, None]}}],
))

MISSIONS.append(dict(
    id="7.4-file-intacte", serie=7, numero=4, bonus=False, surprise=True, dureeIndicativeMin=7,
    titre="La file du préparateur doit rester intacte", notion="paramètres, une liste passée à une fonction",
    enonce="Le chariot part avec les premières commandes de la file, autant qu'il a de place. Complétez prochaine_tournee() : "
           "elle reçoit la file des commandes et le nombre de places du chariot, et renvoie la liste des commandes de la tournée. "
           "La file appartient au préparateur : il s'en sert encore après l'appel.",
    exemple='prochaine_tournee(["Café du Pont", "Cave aux Bulles", "Marie Dumont"], 2)\n  →  ["Café du Pont", "Cave aux Bulles"]',
    reussiSi="les 2 cas de test renvoient la bonne tournée.",
    fonction={"nom": "prochaine_tournee", "parametres": ["file", "places"], "types": {"file": "list", "places": "int"},
              "doc": "Renvoie les commandes de la prochaine tournée : les premières de la file, autant que le chariot a de places."},
    cas=[cas("Trois commandes, deux places : les deux premières partent", [["Café du Pont", "Cave aux Bulles", "Marie Dumont"], 2], ["Café du Pont", "Cave aux Bulles"]),
         cas("Une commande, quatre places : elle part seule", [["Taverne Saint-Jean"], 4], ["Taverne Saint-Jean"]),
         cas("File vide : la tournée est vide", [[], 4], [], "bonus"),
         cas("Après l'appel, la file du préparateur est intacte", [["Café du Pont", "Cave aux Bulles", "Marie Dumont"], 2], ["Café du Pont", "Cave aux Bulles"], "cache", inchange=True)],
    palette=PALETTES[7],
    etoiles={"critere": "postes", "description1": "Les 2 cas de test passent", "description2": "En {max} instructions au plus",
             "description3": "Une file vide donne une tournée vide"},
    indices=["file est la liste du préparateur, pas une copie : ce que la fonction lui retire, il ne l'a plus.",
             "Une tranche, file[:places], crée une nouvelle liste sans toucher à file."],
    tests="", depart='def prochaine_tournee(file, places):\n    """Renvoie les commandes de la prochaine tournée : les premières de la file, autant que le chariot a de places."""\n    pass\n',
    solution='def prochaine_tournee(file, places):\n    """Renvoie les commandes de la prochaine tournée : les premières de la file, autant que le chariot a de places."""\n    return file[:places]\n',
    variantes=[{"nom": "pop(0) dans une boucle : la file est vidée (test caché)", "remplacer": ["    return file[:places]\n",
                "    tournee = []\n    while file and len(tournee) < places:\n        tournee.append(file.pop(0))\n    return tournee\n"], "attendu": {"etoiles": [True, None, True]}}],
))

TESTS_LOT = """
    ENTETE = ["date", "client", "biere", "format", "quantite"]

    def _champs(ligne):
        # une commande lue avec csv.DictReader (dictionnaire) ou avec split (liste) : on lit les deux
        return ligne if isinstance(ligne, dict) else dict(zip(ENTETE, ligne))

    def _liste(r, nom):
        v = r.variables.get(nom)
        assert v is not None, f"Aucune variable {nom} : rangez les commandes dans une liste nommée {nom}."
        assert isinstance(v, list), f"{nom} est un {type(v).__name__}, pas une liste."
        return [_champs(x) for x in v]
"""

MISSIONS.append(dict(
    id="8.1-lignes-du-lot", serie=8, numero=1, bonus=False, surprise=False, dureeIndicativeMin=6,
    titre="Un fichier se lit ligne par ligne", notion="with open, encoding, lignes d'un fichier",
    enonce="Le lot de commandes du vendredi soir est arrivé dans le fichier lot_vendredi.csv : une ligne d'en-tête, puis une commande "
           "par ligne. Ouvrez le fichier avec with open, rangez le nombre de commandes (l'en-tête ne compte pas) dans nb_commandes, "
           "puis affichez-le.",
    exemple="Affichage attendu : 16",
    reussiSi="nb_commandes vaut 16 et l'affichage le montre.",
    fichiers={"lot_vendredi.csv": LOT_VENDREDI},
    palette=PALETTES[8],
    etoiles={"critere": "postes", "description1": "nb_commandes vaut 16 et l'affichage le montre",
             "description2": "En {max} instructions au plus", "description3": "Comptez aussi les commandes en fûts dans nb_futs"},
    indices=['with open("lot_vendredi.csv", encoding="utf-8") as f: ouvre le fichier et le referme à la fin du bloc.',
             "f.read().splitlines() donne la liste des lignes ; la première est l'en-tête."],
    tests="""
        def test_nombre(r):
            \"\"\"nb_commandes vaut 16 : l'en-tête n'est pas une commande\"\"\"
            n = r.variables.get("nb_commandes")
            assert n is not None, "Aucune variable nb_commandes."
            assert n != 17, "17 : l'en-tête a été compté comme une commande."
            assert n == 16, f"Attendu : 16 commandes. Obtenu : {n}."

        def test_affichage(r):
            \"\"\"L'affichage montre le nombre de commandes\"\"\"
            assert any("16" in ligne for ligne in r.sorties), f"L'affichage ne montre pas 16. Il montre : {r.sorties or 'rien'}."

        def bonus_futs(r):
            \"\"\"nb_futs vaut 5 : cinq commandes sont en fûts\"\"\"
            assert r.variables.get("nb_futs") == 5, f"Attendu : 5 commandes en fûts. Obtenu : {r.variables.get('nb_futs')}."
    """,
    depart="", solution='with open("lot_vendredi.csv", encoding="utf-8") as f:\n    lignes = f.read().splitlines()\n'
                        'nb_commandes = len(lignes) - 1\nprint(nb_commandes)\nnb_futs = 0\nfor ligne in lignes:\n    if ";fut;" in ligne:\n        nb_futs += 1\n',
    variantes=[{"nom": "l'en-tête compté", "remplacer": ["nb_commandes = len(lignes) - 1", "nb_commandes = len(lignes)"], "attendu": {"etoiles": [False, None, None]}}],
))

MISSIONS.append(dict(
    id="8.2-quantite-lisible", serie=8, numero=2, bonus=False, surprise=True, dureeIndicativeMin=7,
    titre="try / except met une quantité illisible de côté", notion="try, except ValueError, None",
    enonce="Dans le lot du vendredi, la quantité de chaque commande est un texte : \"5\", mais aussi \"douze\", \"-2\" ou rien du tout. "
           "Complétez quantite_valide() : elle reçoit ce texte et renvoie la quantité en nombre entier. Si le texte n'est pas un nombre, "
           "ou si la quantité n'est pas positive, elle renvoie None, sans planter.",
    exemple='quantite_valide("5")      →  5\nquantite_valide("douze")  →  None',
    reussiSi="les 3 cas de test renvoient la bonne valeur.",
    fonction={"nom": "quantite_valide", "parametres": ["texte"], "types": {"texte": "str"},
              "doc": "Renvoie la quantité lue dans le texte, ou None si elle est illisible, nulle ou négative."},
    cas=[cas("« 5 » : 5 casiers", ["5"], 5),
         cas("« douze » est illisible : None", ["douze"], None),
         cas("« -2 » : une quantité négative est refusée, None", ["-2"], None),
         cas("Une quantité vide : None", [""], None, "bonus"),
         cas("« 0 » : zéro casier n'est pas une commande, None", ["0"], None, "cache")],
    palette=PALETTES[8],
    etoiles={"critere": "postes", "description1": "Les 3 cas de test passent : 5, douze, -2", "description2": "En {max} instructions au plus",
             "description3": "Une quantité vide renvoie aussi None"},
    indices=['int("douze") lève une erreur ValueError : placez la conversion dans un try, et renvoyez None dans le except.',
             "Une quantité de 0 ou moins n'est pas une commande."],
    tests="", depart='def quantite_valide(texte):\n    """Renvoie la quantité lue dans le texte, ou None si elle est illisible, nulle ou négative."""\n    return int(texte)\n',
    solution='def quantite_valide(texte):\n    """Renvoie la quantité lue dans le texte, ou None si elle est illisible, nulle ou négative."""\n'
             '    try:\n        quantite = int(texte)\n    except ValueError:\n        return None\n    if quantite <= 0:\n        return None\n    return quantite\n',
    variantes=[{"nom": "< 0 au lieu de <= 0 : zéro passe (contrôle surprise)", "remplacer": ["quantite <= 0", "quantite < 0"], "attendu": {"etoiles": [True, None, True]}}],
))

MISSIONS.append(dict(
    id="8.3-lot-trie", serie=8, numero=3, bonus=False, surprise=False, dureeIndicativeMin=10,
    titre="Les commandes fausses sont mises de côté", notion="import csv, DictReader, try / except, in",
    enonce="Le lot du vendredi (lot_vendredi.csv) contient 16 commandes, et toutes ne sont pas justes. Lisez le fichier avec le module csv "
           "et rangez chaque commande dans la liste acceptees ou dans la liste rejetees. Une commande est rejetée si sa quantité n'est "
           "pas un nombre entier positif, ou si son client n'existe pas : les clients vont de C01 à C08. Affichez ensuite le nombre de "
           "commandes de chaque liste.",
    exemple="Affichage attendu : 12 acceptées, 4 rejetées\n(11 et 5 quand la date impossible est rejetée aussi : étoile 3)",
    reussiSi="les quatre commandes fausses sont dans rejetees, les autres dans acceptees.",
    fichiers={"lot_vendredi.csv": LOT_VENDREDI},
    palette=PALETTES[8],
    etoiles={"critere": "postes", "description1": "Les quatre commandes fausses sont rejetées, les autres acceptées",
             "description2": "En {max} instructions au plus", "description3": "La date impossible (31 novembre) est rejetée aussi"},
    indices=['csv.DictReader(f, delimiter=";") donne chaque commande sous forme de dictionnaire : ligne["quantite"], ligne["client"].',
             "int() lève ValueError sur un texte illisible : un try / except autour de la conversion, et la commande va dans rejetees."],
    tests=TESTS_LOT + """
    def test_total(r):
        \"\"\"Les 16 commandes sont rangées : acceptées ou rejetées\"\"\"
        a, j = _liste(r, "acceptees"), _liste(r, "rejetees")
        assert len(a) + len(j) == 16, f"{len(a)} acceptées et {len(j)} rejetées : {len(a) + len(j)} commandes au lieu de 16."

    def test_rejets(r):
        \"\"\"Les quantités illisibles, négatives ou vides et le client inconnu sont rejetés\"\"\"
        j = _liste(r, "rejetees")
        for motif, essai in [("la quantité « douze »", lambda c: c["quantite"] == "douze"), ("la quantité -2", lambda c: c["quantite"] == "-2"),
                             ("la quantité vide", lambda c: c["quantite"] == ""), ("le client C11", lambda c: c["client"] == "C11")]:
            assert any(essai(c) for c in j), f"La commande avec {motif} n'est pas dans rejetees."

    def test_acceptees(r):
        \"\"\"Les commandes acceptées sont toutes justes\"\"\"
        for c in _liste(r, "acceptees"):
            assert c["client"] in {f"C0{i}" for i in range(1, 9)}, f"Client inconnu accepté : {c['client']}."
            assert c["quantite"].strip().isdigit() and int(c["quantite"]) > 0, f"Quantité fausse acceptée : {c['quantite']!r}."

    def bonus_date(r):
        \"\"\"La commande du 31 novembre est rejetée : cette date n'existe pas\"\"\"
        assert any(c["date"] == "2026-11-31" for c in _liste(r, "rejetees")), "La commande datée du 2026-11-31 n'est pas dans rejetees."
    """,
    depart="",
    solution='import csv\nfrom datetime import date\n\nCLIENTS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]\nacceptees = []\nrejetees = []\n'
             'with open("lot_vendredi.csv", encoding="utf-8", newline="") as f:\n    for ligne in csv.DictReader(f, delimiter=";"):\n'
             '        try:\n            quantite = int(ligne["quantite"])\n            date.fromisoformat(ligne["date"])\n        except ValueError:\n'
             '            rejetees.append(ligne)\n            continue\n        if quantite > 0 and ligne["client"] in CLIENTS:\n            acceptees.append(ligne)\n'
             '        else:\n            rejetees.append(ligne)\nprint(len(acceptees), "acceptées,", len(rejetees), "rejetées")\n',
    variantes=[{"nom": "sans try : ValueError sur « douze »", "remplacer": ['        try:\n            quantite = int(ligne["quantite"])\n            date.fromisoformat(ligne["date"])\n        except ValueError:\n            rejetees.append(ligne)\n            continue\n',
                '        quantite = int(ligne["quantite"])\n'], "attendu": {"erreur": "ValueError"}},
               {"nom": "sans la date : 12 acceptées, étoile 3 perdue", "remplacer": ['            date.fromisoformat(ligne["date"])\n', ""], "attendu": {"etoiles": [True, None, False]}}],
))

MISSIONS.append(dict(
    id="8.4-casiers-par-biere", serie=8, numero=4, bonus=True, surprise=False, dureeIndicativeMin=8,
    titre="Un dictionnaire totalise les casiers de chaque bière", notion="dictionnaire, get, fichier trié",
    enonce="Le tri du lot est fait : le programme de départ range les commandes justes dans acceptees. Le préparateur veut maintenant "
           "savoir combien de casiers sortir pour chaque bière. Ajoutez un dictionnaire casiers : le code de la bière pour clé, "
           "le total des casiers acceptés pour valeur. Les commandes en fûts ne comptent pas.",
    exemple='casiers  →  {"B03": 13, "B01": 14, "B02": 2, "B04": 4}',
    reussiSi="casiers donne le bon total pour chaque bière.",
    fichiers={"lot_vendredi.csv": LOT_VENDREDI},
    palette=PALETTES[8],
    etoiles={"critere": "postes", "description1": "casiers donne le bon total pour chaque bière",
             "description2": "En {max} instructions au plus", "description3": "Totalisez aussi les fûts dans un dictionnaire futs"},
    indices=["Parcourez acceptees et ne gardez que les commandes dont le format est \"casier\".",
             'casiers[biere] = casiers.get(biere, 0) + int(ligne["quantite"]) ajoute la quantité au total de la bière.'],
    tests="""
        def test_casiers(r):
            \"\"\"Casiers par bière : B01 14, B02 2, B03 13, B04 4\"\"\"
            c = r.variables.get("casiers")
            assert c is not None, "Aucune variable casiers : créez un dictionnaire nommé casiers."
            assert c == {"B01": 14, "B02": 2, "B03": 13, "B04": 4}, f"Attendu : B01 14, B02 2, B03 13, B04 4. Obtenu : {c}."

        def bonus_futs(r):
            \"\"\"Fûts par bière : B01 15, B02 2, B04 3, B05 4\"\"\"
            assert r.variables.get("futs") == {"B01": 15, "B02": 2, "B04": 3, "B05": 4}, f"Obtenu pour futs : {r.variables.get('futs')}."
    """,
    depart='import csv\n\nCLIENTS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]\nacceptees = []\n'
           'with open("lot_vendredi.csv", encoding="utf-8", newline="") as f:\n    for ligne in csv.DictReader(f, delimiter=";"):\n'
           '        try:\n            quantite = int(ligne["quantite"])\n        except ValueError:\n            continue\n'
           '        if quantite > 0 and ligne["client"] in CLIENTS:\n            acceptees.append(ligne)\n',
    solution='import csv\n\nCLIENTS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]\nacceptees = []\n'
             'with open("lot_vendredi.csv", encoding="utf-8", newline="") as f:\n    for ligne in csv.DictReader(f, delimiter=";"):\n'
             '        try:\n            quantite = int(ligne["quantite"])\n        except ValueError:\n            continue\n'
             '        if quantite > 0 and ligne["client"] in CLIENTS:\n            acceptees.append(ligne)\n'
             'casiers = {}\nfuts = {}\nfor ligne in acceptees:\n    biere = ligne["biere"]\n    if ligne["format"] == "casier":\n'
             '        casiers[biere] = casiers.get(biere, 0) + int(ligne["quantite"])\n    else:\n        futs[biere] = futs.get(biere, 0) + int(ligne["quantite"])\n',
    variantes=[{"nom": "fûts comptés avec les casiers", "remplacer": ['    if ligne["format"] == "casier":\n', '    if True:\n'], "attendu": {"etoiles": [False, None, None]}}],
))


# Raccourcis : des solutions justes qui contournent la notion de la mission. Elles doivent garder l'étoile 1 et perdre l'étoile 2.
# (5.4 : la solution de Khun, math.ceil, le 20/11/2026.) Vérifiés à chaque génération.
def _r(nom, code, attendu):
    return {"nom": nom, "code": textwrap.dedent(code).lstrip(), "attendu": attendu}


RACCOURCIS = {
    "3.1-quai": [_r("dictionnaire et get", """
        def quai_du_client(type_client):
            return {"café": "Q1", "magasin": "Q2", "particulier": "Q3"}.get(type_client, "Q4")
        """, [True, False, True])],
    "3.2-tarif": [_r("expression conditionnelle", """
        def prix_futs(type_client, nb_futs, prix_fut):
            return nb_futs * prix_fut * (0.90 if type_client == "café" else 1)
        """, [True, False, True])],
    "3.3-stock-bas": [_r("expressions conditionnelles enchaînées", """
        def etat_stock(casiers):
            return "Rupture de stock" if casiers == 0 else "Stock bas" if casiers < 10 else "Stock suffisant"
        """, [True, False, True])],
    "3.4-remise-magasin": [_r("expressions conditionnelles enchaînées", """
        def remise_magasin(nb_casiers):
            return 5 if nb_casiers >= 10 else 2 if nb_casiers >= 5 else 0
        """, [True, False, True])],
    "4.1-trois-premieres": [_r("indices dans une compréhension", """
        def premieres_commandes(file):
            return [file[i] for i in range(min(3, len(file)))]
        """, [True, False, True])],
    "4.2-derniere-livraison": [_r("boucle qui garde la dernière", """
        def derniere_livraison(livraisons):
            derniere = "Aucune livraison"
            for client in livraisons:
                derniere = client
            return derniere
        """, [True, False, True])],
    "4.3-fut-tuple": [_r("indices au lieu de la décomposition", """
        def description_fut(fut):
            return f"Fût {fut[0]} : {fut[1]}"
        """, [True, False, True])],
    "4.4-file-commandes": [_r("la liste finale écrite d'avance", """
        commandes = ["Café du Pont", "Cave aux Bulles", "Taverne Saint-Jean", "Lucas Bertrand"]
        camion = commandes[0:2]
        print(camion)
        print(len(commandes))
        print(sorted(commandes))
        """, [True, False, True])],
    "5.1-tournee": [_r("map et lambda", """
        def feuille_de_route(arrets):
            return list(map(lambda p: f"Arrêt {p[0]} : {p[1]}", enumerate(arrets, start=1)))
        """, [True, False, True])],
    "5.3-cuves": [_r("filter et map", """
        def cuves_hors_plage(cuves, temperatures):
            return list(map(lambda p: p[0], filter(lambda p: p[1] < 18 or p[1] > 22, zip(cuves, temperatures))))
        """, [True, False, True])],
    "6.1-stock": [_r("nouveau dictionnaire par compréhension", """
        def sortir_du_stock(stock, sorties):
            return {code: nb - sum(n for c, n in sorties if c == code) for code, nb in stock.items()}
        """, [True, False, True])],
    "6.2-clients-livres": [_r("dict.fromkeys au lieu d'un set", """
        def clients_livres(livraisons):
            return sorted(dict.fromkeys(livraisons))
        """, [True, False, True])],
    "6.3-futs-par-quai": [_r("count dans une compréhension", """
        def futs_par_quai(futs):
            return {quai: futs.count(quai) for quai in futs}
        """, [True, False, True])],
    "7.3-facture": [_r("le calcul de la consigne recopié", """
        def consigne(nb_casiers, nb_futs):
            return nb_casiers * 3.00 + nb_futs * 30.00


        def facture(nb_casiers, prix_casier, nb_futs, prix_fut):
            return nb_casiers * prix_casier + nb_futs * prix_fut + nb_casiers * 3.00 + nb_futs * 30.00
        """, [True, False, True])],
    "7.4-file-intacte": [_r("copie par une boucle", """
        def prochaine_tournee(file, places):
            tournee = []
            for commande in file:
                if len(tournee) < places:
                    tournee.append(commande)
            return tournee
        """, [True, False, True])],
    "8.1-lignes-du-lot": [_r("open sans with", """
        lignes = open("lot_vendredi.csv", encoding="utf-8").read().splitlines()
        nb_commandes = len(lignes) - 1
        print(nb_commandes)
        nb_futs = 0
        for ligne in lignes:
            if ";fut;" in ligne:
                nb_futs += 1
        """, [True, False, True])],
    "8.2-quantite-lisible": [_r("isdigit au lieu de try", """
        def quantite_valide(texte):
            if texte.isdigit() and int(texte) > 0:
                return int(texte)
            return None
        """, [True, False, True])],
    "8.3-lot-trie": [_r("split et isdigit, sans csv ni try", """
        CLIENTS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]
        acceptees = []
        rejetees = []
        with open("lot_vendredi.csv", encoding="utf-8") as f:
            lignes = f.read().splitlines()[1:]
        for texte in lignes:
            date_, client, biere, format_, quantite = texte.split(";")
            commande = {"date": date_, "client": client, "biere": biere, "format": format_, "quantite": quantite}
            if quantite.isdigit() and int(quantite) > 0 and client in CLIENTS:
                acceptees.append(commande)
            else:
                rejetees.append(commande)
        print(len(acceptees), "acceptées,", len(rejetees), "rejetées")
        """, [True, False, False])],
}

import consignes_atelier  # noqa: E402
for _m in MISSIONS:
    consignes_atelier.appliquer(_m)

MISSIONS.sort(key=lambda m: (m["serie"], m["numero"]))


def etoiles(mission, resultat, code):
    """Même règle que le site (usine.js, atelier.js) : 1 = tests visibles ; 2 = étoile 1 et notion de la série utilisée ; 3 = étoile 1 et bonus."""
    if resultat["erreur"]:
        return [False, False, False]
    vis = [t for t in resultat["tests"] if t["groupe"] == "visible"]
    bon = [t for t in resultat["tests"] if t["groupe"] == "bonus"]
    e1 = bool(vis) and all(t["ok"] for t in vis)
    return [e1, e1 and resultat["notionOk"], e1 and bool(bon) and all(t["ok"] for t in bon)]


def main():
    SITE.mkdir(parents=True, exist_ok=True)
    SOLUTIONS.mkdir(parents=True, exist_ok=True)
    index, echecs = [], 0
    for m in MISSIONS:
        m = dict(m)
        tests = textwrap.dedent(m.pop("tests")).strip() + "\n"
        solution, variantes, raccourcis = m.pop("solution"), m.pop("variantes"), m.pop("raccourcis", []) + RACCOURCIS.get(m["id"], [])
        analyse = atelier.analyser(solution, m.get("fonction"), modules=m["serie"] >= 7)
        def aplatir(postes):
            for p in postes:
                yield p
                for b in p.get("branches", []):
                    yield from aplatir(b)
        # séries 3 à 6 : chaque instruction a sa machine ; séries 7 et 8 : break, continue et un appel seul passent par l'établi
        libres = [p for p in aplatir(analyse["postes"]) if p["type"] == "code_libre"
                  and not (m["serie"] >= 7 and (p["params"]["code"].strip() in ("break", "continue") or p["params"]["code"].rstrip().endswith(")")))]
        if libres:
            echecs += 1; print("ÉCHEC", m["id"], "instructions sans poste :", libres)
        r = atelier.executer_atelier(solution, tests, m)
        e = etoiles(m, r, solution)
        print(m["id"], "solution :", e, r.get("sortie"), r["erreur"])
        if e != [True, True, True]:
            echecs += 1; print("ÉCHEC solution", [t for t in r["tests"] if not t["ok"]])
        d = atelier.executer_atelier(m["depart"] or "pass\n", tests, m)
        if etoiles(m, d, m["depart"] or "pass\n")[0]:
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
        for rc in raccourcis:
            rr = atelier.executer_atelier(rc["code"], tests, m)
            er = etoiles(m, rr, rc["code"])
            ok = er == rc["attendu"]
            print("   raccourci", rc["nom"], "->", "ok" if ok else "ÉCHEC", "|", er, rr.get("notionManque"))
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
