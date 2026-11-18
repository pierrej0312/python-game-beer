"""Explications en clair des erreurs Python (jeu des missions).

Le formateur peut modifier les textes : chaque entrée donne une explication et un conseil.
Le message original de Python reste toujours affiché, pour apprendre à le lire.
"""

ERREURS = {
    "SyntaxError": ("Python ne comprend pas cette ligne : il manque un signe, ou il y en a un en trop.",
                    "Regardez la ligne indiquée et celle d'avant : deux-points, parenthèses, guillemets."),
    "IndentationError": ("Le décalage en début de ligne ne correspond pas au bloc attendu.",
                         "Après une ligne qui finit par deux-points, le bloc est décalé de 4 espaces."),
    "TabError": ("Cette ligne mélange des tabulations et des espaces.",
                 "Décalez les lignes avec des espaces seulement : 4 par niveau."),
    "NameError": ("Vous utilisez un nom que Python ne connaît pas encore.",
                  "Vérifiez l'orthographe, et que la variable est créée avant cette ligne."),
    "TypeError": ("Vous combinez deux valeurs de types incompatibles, ou vous appelez une fonction avec un mauvais nombre de valeurs.",
                  "Affichez le type avec type(...) ; convertissez avec int(), float() ou str()."),
    "IndexError": ("Vous demandez une position qui n'existe pas dans la liste.",
                   "Une liste de 3 éléments va de l'indice 0 à l'indice 2."),
    "KeyError": ("Cette clé n'existe pas dans le dictionnaire.",
                 "Vérifiez la clé, ou testez sa présence avec in avant de l'utiliser."),
    "ValueError": ("La valeur a le bon type mais un contenu impossible, par exemple int(\"abc\").",
                   "Vérifiez les données avant de les convertir."),
    "ZeroDivisionError": ("Votre calcul divise par zéro.",
                          "Testez le diviseur avant de diviser."),
    "AttributeError": ("Cette valeur n'a pas la méthode ou l'attribut demandé.",
                       "Vérifiez le type de la valeur et le nom de la méthode."),
    "UnboundLocalError": ("Vous lisez une variable avant de lui avoir donné une valeur dans la fonction.",
                          "Donnez-lui une valeur de départ en haut de la fonction."),
    "RecursionError": ("Une fonction s'appelle elle-même sans fin.",
                       "Vérifiez la condition d'arrêt."),
    "ActionImpossible": ("Le préparateur ne peut pas faire cette action maintenant.",
                         "Lisez le message : il dit ce qui bloque."),
    "BoucleSansFin": ("La limite d'actions est atteinte : votre boucle ne s'arrête probablement pas.",
                      "Vérifiez la condition de sortie de la boucle."),
    "OutilVerrouille": ("Cet outil n'est pas encore disponible dans cette série.",
                        "Utilisez les outils cités dans l'énoncé."),
    "KeyboardInterrupt": ("L'exécution a été arrêtée : elle durait trop longtemps.",
                          "Une boucle while ne s'arrête probablement jamais : vérifiez sa condition."),
    "FonctionAbsente": ("La fonction attendue n'existe pas dans votre code.",
                        "Gardez la ligne def du code de départ, avec le même nom."),
}

PAR_DEFAUT = ("Python a rencontré une erreur pendant l'exécution.",
              "Lisez le message de Python : sa dernière ligne dit ce qui ne va pas.")


def expliquer(nom_type):
    """Renvoie (explication, conseil) pour un type d'erreur."""
    return ERREURS.get(nom_type, PAR_DEFAUT)
