# Jeu 1 « les missions » : ce qui est construit (version 1, 18/11/2026)

> Complète `README.md` et les spécifications 01 à 08. Ce fichier dit ce qui existe réellement, les points [À VÉRIFIER] des spécifications qui sont levés, les écarts avec les spécifications et ce qui reste à faire. Les décisions sont aussi dans `journal.md`.

## 1. Où sont les fichiers

Le dossier `04-ateliers/jeux/jeux-python/` est le dépôt GitHub du jeu (privé : il contient les solutions).

| Dossier ou fichier | Contenu |
|---|---|
| `site/` | Le site, seul dossier mis en ligne (16,3 Mo, dont Pyodide 13,5 Mo) |
| `netlify.toml` | Dit à Netlify de publier `site/` seulement |
| `LISEZ-MOI.md` | Mise en ligne, test, réglages, versions, données personnelles |
| `lancer-en-local.bat`, `serveur_local.py` | Tester le jeu sur le PC sans Netlify |
| `solutions/` | Les 17 solutions de référence, jamais en ligne |
| `version-locale/` | Les mêmes missions pour VS Code, sans navigateur : `python lancer_tests.py 3.1-quai` |
| `outils-construction/` | `faire_missions.py` (écrit et vérifie les missions et les solutions : contient donc les solutions), `faire_version_locale.py`, `cm-entree.js` et `package.json` (construction unique du fichier CodeMirror) |
| `qa/` | `controle.py` (contrôle automatique), `serveur.py`, `captures/v1/` (captures de référence), `rapports/` |

## 2. Ce que fait le jeu

- 6 séries, 17 missions (3 par série, 2 pour la série 2), calées sur les modules 1 à 6 : variables et calculs, texte, conditions, listes et tuples, boucles, dictionnaires et sets. Une mission « contrôle surprise » par série (un test caché), une mission bonus (6.3).
- Chaque mission fait compléter une fonction dont la ligne `def` est fournie. Les tests appellent la fonction ; un scénario appelle la même fonction et fait agir le préparateur dans l'entrepôt.
- La scène rejoue le journal des actions produit par le code du stagiaire : un code faux donne une scène fausse (fût livré au mauvais quai et refusé, chariot trop chargé, cuve mal signalée). Pendant le rejeu, la ligne de code à l'origine de l'action est surlignée.
- Étoiles : 1 = tests visibles ; 2 = nombre de lignes sous un seuil ; 3 = test bonus. Les étoiles gagnées restent acquises.
- Indices après 2 puis 4 exécutions en échec. Erreurs Python expliquées en français, message original conservé.
- Boucle sans fin : arrêtée après 5 secondes ; au-delà de 500 actions, arrêt avec « Trop d'actions ».
- Mode sans 3D (journal en texte), qualité haute ou basse, bouton A+, raccourcis Ctrl+Entrée, F10, P, M.
- Progression dans le stockage du navigateur ; envoi des résultats par le formulaire Netlify `resultat-missions` (pseudo et progression, jamais le code).

## 3. Points [À VÉRIFIER] des spécifications qui sont levés

| Spécification | Point | Réponse | Preuve |
|---|---|---|---|
| 02 § 1, CONCEPTION | Version de Python dans Pyodide | Pyodide 314.0.8 embarque Python 3.14.2 (postes : 3.14.10) | Lu dans le navigateur pendant le contrôle |
| 01 § 9, 02 § 1 | Poids de Pyodide | 13,5 Mo sur le disque (5 fichiers) | `qa/rapports` |
| 02 § 5 | Obtenir la ligne du code du stagiaire | Lue dans la pile d'appels au moment de l'action | Rejeu : ligne surlignée |
| 02 § 8, 06 § 4 | En-têtes pour `SharedArrayBuffer` | `Cross-Origin-Opener-Policy: same-origin` et `Cross-Origin-Embedder-Policy: require-corp` | Sources 11, 80, 81 ; page isolée constatée avec ces en-têtes |
| 02 § 8 | Repli sans `SharedArrayBuffer` | Arrêt du worker après 5 s, Python rechargé | Contrôle : rechargement et solution relancée en moins de 2 s en local |
| 03 § 4 | F10 | Utilisé par le jeu, aucun conflit constaté dans Chrome | Contrôle automatique. À confirmer sur le navigateur des postes |
| 03 § 5, 06 § 2, CONCEPTION | CodeMirror | Paquets `codemirror` 6.0.2 et `@codemirror/lang-python` 6.2.1, réunis une fois en un fichier avec esbuild ; le dossier se dépose ensuite tel quel | `assets/LICENCES.md` |
| CONCEPTION | Version de Three.js | 0.187.0 | `assets/LICENCES.md` |
| 06 § 3 | Serveur local | `qa/serveur.py` envoie les en-têtes d'isolement ; `python -m http.server` ne les envoie pas | Contrôle avec et sans en-têtes |
| 08 § 1 | Outil de contrôle | Playwright pour Python et Google Chrome | `qa/controle.py` |

Restent ouverts : le temps de chargement de Python et la fluidité sur un poste de la salle, la conservation du stockage du navigateur d'un jour à l'autre, la relecture par toi des explications d'erreur (`python/erreurs_fr.py`), l'orthographe (aucun correcteur automatique utilisé, relecture seulement).

## 4. Écarts avec les spécifications (à valider ou à refuser)

1. **Palette de la scène** : graphite, orange de sécurité, kraft et inox, d'après tes moodboards, au lieu de la palette pastel de `01-direction-artistique.md`. Le vert menthe reste la réussite et le corail l'échec, toujours avec un symbole.
2. **Interface** : couleurs de la charte BStorm à droite (énoncé, tests). Le côté scène est sombre. Trois teintes hors charte servent au contraste des messages d'échec (rouges foncés sur fond rouge clair) et aux accents orange et jaune du côté scène.
3. **Polices** : celles du poste (Barlow et JetBrains Mono si elles y sont installées, sinon Segoe UI et Consolas). Les polices de la charte ne sont pas embarquées : leurs licences de diffusion sur le web ne sont pas vérifiées.
4. **Aucun modèle importé** : personnage, fûts, cuves, rayonnages sont construits par le code, les textures sont dessinées par le code. Pas de fichier `.glb`, pas de HDRI : l'environnement des reflets est celui fourni par Three.js (`RoomEnvironment`).
5. **Missions à fonction** : le stagiaire complète une fonction, alors que les fonctions ne sont vues qu'au jour 3. La ligne `def` et le `return` sont fournis, il n'écrit que le corps. À dire en une phrase au lancement du jeu.
6. **Étoile 2** : nombre de lignes de code, et non nombre d'actions. Presque toutes les missions n'ont qu'une façon d'agir dans l'entrepôt.
7. **Outils du préparateur** : seul `charger()` est appelé par le stagiaire (mission 5.2). Les autres gestes sont joués par le scénario de chaque mission à partir de ce que renvoie sa fonction : prendre, étiqueter au pupitre, livrer à un quai ou au rebut, ranger dans un rayon, embouteiller sur le chariot, contrôler un rayon, une cuve ou un quai. `avancer()`, `tourner_gauche()` existent dans le moteur mais aucune mission ne les demande.
10. **Une scène par exercice** (demande du formateur du 18/11) : chaque mission a son scénario. 1.1 étiquette de prix puis quai des magasins ; 1.2 le fût est vidé en bouteilles sur le chariot, autant que la fonction en compte (60,6 donne 60 bouteilles et une à moitié pleine) ; 1.3 lot de 5 casiers avec sa facture ; 2.1 étiquette nettoyée puis rangement au rayon de La Braise ; 2.2 lot de 3 casiers avec son bon ; 3.1 trois fûts vers trois quais ; 3.2 deux commandes, deux prix, deux quais ; 3.3 contrôle de trois rayons ; 4.1 trois caisses de la file ; 4.2 retour au quai de la dernière livraison ; 4.3 description collée puis rangement au rayon du Crassier ; 5.1 tournée dans l'ordre ; 5.2 chargement du chariot ; 5.3 contrôle des cuves ; 6.1 mise à jour des écrans de rayons ; 6.2 un passage par client ; 6.3 quatre fûts puis le comptage.
8. **Fichiers regroupés** : pas de `lumieres.js` séparé (les lumières sont dans `scene.js` et `decor.js`).
9. **Pastille verte sur une cuve en alerte** : le symbole dit « votre code a bien jugé cette cuve », pas « la cuve va bien ». À toi de dire si ça se lit.

## 5. Reste à faire

- Ta relecture des captures (`qa/captures/v1/`) et du rapport (`qa/rapports/`).
- Mise en ligne sur ton compte Netlify et test d'envoi (`LISEZ-MOI.md` § 1 et 2).
- Test sur un poste de Technifutur et partie d'essai par une autre personne (`06-deploiement-et-recette.md` § 5).
- Jeux 2 (builder) et 3 (tournoi) : non commencés.
