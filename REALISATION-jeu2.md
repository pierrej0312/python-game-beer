# Jeu 2 « la ligne de production » : ce qui est construit (version 1, 18/11/2026)

> Complète `REALISATION-jeu1.md` et la spécification `05-jeu2-builder.md`. Ce fichier dit ce qui existe réellement, les écarts avec la spécification et ce qui reste à faire. Les décisions sont aussi dans `journal.md` du cours.

## 1. Où sont les fichiers

| Dossier ou fichier | Contenu |
|---|---|
| `site/ligne.html`, `site/css/ligne.css` | La page du jeu 2 (même accueil que le jeu 1 : un bouton par jeu) |
| `site/js/ligne/` | `modele.js` (pièces, plateau, validation), `generateur.js` (plateau vers Python), `rejeu-ligne.js` (exécution vers étapes de la scène), `scene-ligne.js` (hall 3D), `vue2d.js` (mode sans 3D), `etoiles.js`, `ligne.js` (contrôleur) |
| `site/python/ligne.py` | Les machines de la brasserie en Python et l'exécution suivie ligne par ligne |
| `site/ligne/niveaux/` | Les 6 niveaux : `niveau.json` (énoncé, pièces fixes, données, étoiles, indices) et `tests.py` |
| `solutions-ligne/` | Plateau de référence et variantes fausses de chaque niveau, jamais en ligne |
| `outils-construction/faire_niveaux.py` | Écrit les niveaux et les solutions (contient donc les solutions) |
| `outils-construction/verifier_niveaux.mjs` | Génère le Python de chaque solution et de chaque variante, l'exécute et contrôle les étoiles |
| `qa/controle_ligne.py` | Contrôle automatique du jeu 2 dans Chrome (fonctionnement et rendu) |

## 2. Ce que fait le jeu

- Le stagiaire construit sa ligne sur une grille de 12 cases sur 8 : il pose des pièces et trace les tapis à la souris (glisser case par case) ou au clic (mode sans 3D). Le code Python s'écrit à droite pendant qu'il construit, en lecture seule.
- Le code est exécuté par Pyodide, comme le jeu 1. La scène rejoue ce qui s'est réellement exécuté : une ligne fausse donne une scène fausse (bouteille vide à la capsuleuse, bouteille qui tombe dans une trappe, mauvaise bière au quai).
- Pièces et Python :

| Pièce | Python écrit |
|---|---|
| Cuve, stock (source) | `for bouteille in cuve("C1"):` ou `for bouteille in stock():` |
| Remplisseuse, capsuleuse, étiqueteuse | `bouteille = remplir(bouteille)`, etc. |
| Bac compteur | `nom = nom + 1` (et `nom = 0` avant la boucle) |
| Contrôle qualité | `if` (sortie « oui ») / `else` (sortie « non ») ; un deuxième contrôle sur « non » donne `elif` |
| Détecteur de boucle | `while condition:` ; sortie « encore un tour » (corps de la boucle, un anneau de tapis qui revient au détecteur), sortie « sortie » (la suite) |
| Votre machine (niveau 6) | `def nom(bouteille, biere):` écrit une fois en haut, appelé sur chaque ligne |
| Tableau de bord | `print(bac)` après la boucle |
| Quai (camion à quai) | `expedier(bouteille, "Q2")` |
| Rebut (benne) | `rebut(bouteille)` |
| Tapis ouvert ou sortie sans tapis | Un commentaire « la bouteille tombe dans la trappe » et `pass` si le bloc est vide |

- Niveaux : 1 séquence, 2 variable, 3 condition, 4 `elif`, 5 boucle `while` (remplisseuse de 11 cl par passage, anneau de tapis), 6 fonction. Le niveau suivant s'ouvre avec l'étoile 1 du précédent ; `ligne.html?formateur=1` ouvre tout.
- Étoiles : 1 = tests du brassin du jour ; 2 = ligne compacte (cases de tapis, ou pièces posées au niveau 6, au plus autant que la solution de référence) ; 3 = test du brassin du lendemain.
- Validation avant de lancer : ce qui empêche la ligne de tourner bloque le lancement (entouré en rouge) ; ce qui fait seulement tomber des bouteilles est une remarque en jaune, la ligne tourne quand même.
- Indices après 2 puis 4 lancements sans l'étoile 1. Pas à pas (F10), pause (P), son (M), rejeu rapide. Mode sans 3D : grille de boutons utilisable au clavier et journal en texte.
- Le plateau de chaque niveau est gardé dans le navigateur ; envoi des résultats par le formulaire Netlify `resultat-ligne` (pseudo et progression, jamais le plateau).

## 3. Écarts avec la spécification `05-jeu2-builder.md`

| Spécification | Construit | Raison |
|---|---|---|
| § 1 : public du jour 1, la logique avant la syntaxe | Niveaux calés sur les notions des jours 1 et 2 (jusqu'à `while` et `def`) | Les notions des niveaux 4 à 6 sont vues au jour 2 ; le formateur choisit quand le proposer (pas pour le 19/11) |
| § 2 : tapis = ordre d'exécution | Le tapis qui part d'une source est la boucle `for` (une bouteille après l'autre) ; l'ordre des pièces sur le tapis est l'ordre des lignes | Une cuve contient plusieurs bouteilles : sans boucle, le code ne traiterait qu'une bouteille |
| § 2 et § 3 niveau 5 : mise en casiers de 24, `while` « tant que le casier n'est pas plein » | Niveau 5 remplacé : anneau de tapis et détecteur de boucle, `while bouteille["volume_cl"] < 33:` (11 cl par passage) ; la pièce « mise en casiers » reste dans le moteur mais n'est utilisée par aucun niveau | Demande du formateur du 18/11 : une boucle se voit mieux comme un tapis qui tourne en rond ; le brassin du lendemain (bouteilles déjà entamées à 11 ou 22 cl) fait échouer trois remplisseuses à la suite, l'anneau s'adapte |
| § 2 : quai = `return` | Quai = `expedier(bouteille, quai)` ; dessiné comme un camion à plateau garé contre le hall ; rebut = benne | Le code du jeu est une boucle au niveau du module, pas une fonction : il n'y a rien à retourner. Camions et benne : demande du formateur |
| § 2 : rebut = branche `else` | Le rebut est une pièce comme une autre ; un chemin qui ne mène ni à un quai ni à la benne fait tomber la bouteille dans une trappe | Demande du formateur : un sous-tapis qui ne rejoint rien fait tomber la bouteille |
| § 3 niveau 4 : blonde, ambrée, brune | La Coulée, La Braise, Le Crassier (bières de la fiche du fil rouge) ; Le Laitier arrive le lendemain sans étiqueteuse : il doit aller à la benne | Cohérence avec le fil rouge |
| § 4 : palette en bas | Palette en haut du hall (outils puis pièces du niveau) ; réglages d'une pièce dans l'onglet « Pièce » à droite | Un panneau posé sur le hall cachait des cases |
| § 5 : validation « boucle sans fin possible » | Un tapis qui revient en arrière n'est permis que depuis la sortie « encore un tour » d'un détecteur, et cet anneau doit revenir au détecteur | Seule boucle que le code peut écrire comme un `while` |
| § 6 : caméra orthographique et sélection des cases [À VÉRIFIER] | Levé : `OrthographicCamera(left, right, top, bottom, near, far)` puis `updateProjectionMatrix()`, `Raycaster.setFromCamera` (coordonnées −1 à 1), `Ray.intersectPlane` | Source 86 (sources de Three.js r187 embarquées) |
| § 6 : conditions sans clavier | Trois menus : ce qu'on mesure, comparaison, valeur (valeurs proposées par le niveau) | |

## 4. Contrôles faits le 18/11/2026

- `node outils-construction/verifier_niveaux.mjs <python 3.14>` : 6 niveaux, chaque solution obtient 3 étoiles, chaque plateau de départ échoue, chaque variante fausse échoue comme prévu (dont, au niveau 5 : trois remplisseuses à la suite cassent le lendemain, `<= 33` provoque l'erreur « déjà pleine », une sortie à 22 cl échoue).
- `python qa/controle_ligne.py --section fonctionnement` : 52 contrôles sur 52 (6 niveaux en 3D et sans 3D, variantes, remarques et refus de la validation, tapis ouvert à la souris et au clic, F10, P, création de la machine, onglet Pièce, déblocage, sauvegarde, envoi).
- `python qa/controle_ligne.py --section rendu` : 97 contrôles sur 97, en 1366 × 768 et 1920 × 1080, qualité haute, basse et sans 3D ; captures dans `qa/captures/v1/ligne-*.png`.
- `python qa/controle.py --section statique` : 12 sur 12.

## 5. Reste à faire

- Activer la détection des formulaires sur Netlify si ce n'est pas fait, redéployer, et vérifier qu'un envoi `resultat-ligne` arrive (LISEZ-MOI § 1).
- Partie d'essai par le formateur, puis test sur un poste de la salle (fluidité de la 3D, F10).
- Note du cahier formateur sur le moment où proposer le jeu 2.
