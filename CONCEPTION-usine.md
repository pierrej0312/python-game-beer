# L'usine de la Fonderie : refonte de l'atelier (proposition du 19/11/2026)

> Demande du formateur (19/11) : un jeu aussi agréable que Satisfactory, en vue isométrique (pas à la première personne), qui apprend le Python des séries 4 à 8, avec la 3D et le code synchronisés dans les deux sens, dans l'univers de la brasserie. Constat : avec l'atelier actuel, construire en 3D est plus pénible que taper le Python.
> Décisions du 19/11 : la refonte avance en parallèle du J3, un prototype est soumis au formateur avant d'aller plus loin ; chaque stagiaire construit à la souris ou tape le code, au choix, les deux restant synchronisés.

## 1. Pourquoi l'atelier actuel frustre

| Frustration | Cause | Ce que la refonte change |
|---|---|---|
| Poser un poste demande de choisir une case, puis de remplir une bulle | Le stagiaire place chaque poste sur une grille libre | Le stagiaire ne place rien : l'usine se range toute seule, de gauche à droite, dans l'ordre du programme. Il insère une machine **sur le convoyeur**, à un point « + » |
| Les tapis se tracent à la main | Le chemin du chariot est dessiné par le stagiaire | Les convoyeurs se raccordent seuls, comme dans Satisfactory |
| Un poste ajouté part après le return (corrigé le 19/11) | Le return est un poste comme les autres | Le return devient le **quai de sortie** de la fonction : il est toujours au bout, on ne peut rien poser après |
| Une ligne mal indentée disparaît du hall (corrigé le 19/11) | L'indentation n'est pas visible en 3D | Chaque bloc est une **zone au sol** de couleur : une ligne indentée est dans la zone, une ligne au bord gauche en sort, visiblement |
| Plus rapide de taper le code que de construire | Trop de clics par instruction | Une machine = un clic sur le convoyeur, une saisie dans le champ de la machine, Entrée. Raccourcis clavier |

## 2. Le principe : un programme est une ligne de production

Les données sont des objets qui roulent sur des convoyeurs (fûts, casiers, bons de commande) ; les instructions sont des machines qu'ils traversent. Le chariot de l'atelier actuel disparaît : ce sont les objets qui avancent.

| Python | Dans l'usine | Ce que le stagiaire voit en marche |
|---|---|---|
| Variable | Un bac étiqueté, au bord de la ligne | La valeur posée dans le bac, son étiquette au-dessus |
| Calcul, affectation | Une machine de calcul : entrées, sortie vers un bac | Les valeurs entrent, le résultat sort et va dans le bac |
| `print` | Un écran au-dessus de la ligne | Le texte s'affiche sur l'écran |
| `if` / `elif` / `else` | Un **répartiteur** : une sortie par condition, une sortie « sinon » | L'objet part sur le convoyeur de la première condition vraie |
| Liste | Un **rayonnage** à cases numérotées à partir de 0 | Les objets rangés dans l'ordre ; `append` en ajoute un au bout |
| Tuple | Une caisse plombée | Elle se lit, elle ne s'ouvre pas : une machine qui tente de la modifier s'arrête en rouge |
| `for` | Une **boucle de convoyeur** : chaque élément du rayonnage fait un tour | On voit le tour 1, le tour 2… et la variable de boucle sur l'objet qui passe |
| `while` | Une boucle gardée par un **capteur** | La boucle tourne tant que le capteur est vert |
| Dictionnaire | Une armoire à tiroirs étiquetés | Ouvrir un tiroir par son étiquette ; un tiroir absent : `KeyError` en rouge |
| Set | Un bac de tri qui rejette les doublons | Le doublon rebondit et tombe au rebut |
| Fonction (série 7) | Un **plan** (blueprint) : une petite usine avec des ports d'entrée (paramètres) et un quai de sortie (`return`) | Appeler la fonction pose une copie du plan ; on peut entrer dedans |
| `return` | Le quai de sortie du plan | Toujours au bout de la ligne ; ce qui arrive au quai sort de la fonction |
| Fichier, `with open` (série 8) | Un camion qui décharge le CSV au quai de réception, ligne par ligne, puis repart | Chaque ligne du fichier arrive en bon de commande (une liste de textes) |
| `try` / `except` | Un **contrôle qualité** avec une goulotte de rebut | Une ligne sale part au rebut avec son étiquette d'erreur, la ligne continue |
| `import` | Une machine commandée au catalogue du fournisseur | Elle apparaît dans la barre de construction |

## 3. Ce qui rend le jeu agréable (repris de Satisfactory, sans le copier)

- **Vue isométrique** : caméra orthographique, rotation par quarts de tour, zoom à la molette, cadrage automatique sur la partie construite.
- **Construire vite** : un fantôme de la machine suit la souris sur le convoyeur ; un clic la pose ; le champ de la machine est déjà actif ; Entrée valide. Raccourcis : chiffres pour la barre, Suppr pour détruire, Ctrl+Z / Ctrl+Y.
- **Pas de placement libre** : la mise en page est calculée à partir du programme (blocs empilés, boucles en anneau). Le stagiaire réfléchit à la logique, pas à la place des machines.
- **Voir le flux** : objets qui roulent, compteurs au-dessus des machines, vitesse réglable (pause, ×1, ×4), pas à pas avec la ligne du code surlignée.
- **Le code toujours juste** : le code est la référence ; construire réécrit le code, taper le code reconstruit l'usine. Une erreur de code met l'usine en pause, sans rien effacer.
- **Retour immédiat** : une machine mal réglée s'allume en rouge avant même la mise en marche (erreur de syntaxe, nom inconnu).
- **Récompense** : l'expédition au quai final est le test ; trois étoiles (juste, compact, robuste aux cas cachés), comme aujourd'hui.

## 4. Ce qui est repris de l'atelier actuel

Missions (énoncés, cas de test, étoiles), analyse Python → postes (`site/python/atelier.py`, étendue à `def`, `with`, `try`), exécution suivie pour le rejeu, progression, formulaire de résultats, mode sans 3D, version VS Code. Ce qui change : la scène, la mise en page, la façon de construire.

## 5. Le prototype soumis au formateur

- **Deux missions** : 4.4 « la file des commandes » (liste, programme) et une mission de la série 7 (une fonction devient un plan, avec son quai de sortie).
- **À juger** : est-ce plus agréable que l'atelier actuel ? Construire à la souris est-il aussi rapide que taper ? Les analogies (répartiteur, boucle de convoyeur, plan) aident-elles à comprendre le Python ?
- **Hors prototype** : les séries 5, 6 et 8, les sons, les décors, le mode sans 3D.

## 5 bis. Validation et généralisation (23/11/2026)

- Le formateur valide l'usine sur la mission 4.4 (« la file des commandes »). Décisions : retirer l'ancien atelier ; amener toutes les missions des séries 3 à 8 au niveau de la 4.4 ; des consignes qui parlent de construire ; corriger ce que l'audit trouve.
- Audit automatique (`qa/audit_usine.py`) : chaque mission construite avec sa solution, mise en marche, captures dans `qa/captures-usine-audit/`.
- Plan de construction : champ `construire` des missions (`outils-construction/consignes_atelier.py`, `CONSTRUIRE`), affiché replié sous la consigne, masqué en mode code seul. Il dit quelles machines poser, pas quoi régler.

## 6. Points ouverts

- Les séries 7 et 8 du J3 (mardi 24/11) : dans l'atelier corrigé ou dans VS Code si le prototype n'est pas validé à temps.
- Le jeu 1 (séries 1 et 2, l'entrepôt) reste tel quel.
