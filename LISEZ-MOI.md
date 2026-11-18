# Les jeux Python de la Brasserie de la Fonderie : mise en ligne et réglages

Ce dépôt contient les missions (séries 1 et 2 dans l'entrepôt, séries 3 à 6 dans l'atelier de construction), l'ancienne ligne de production (sans lien) et tout ce qui sert à les construire et à les vérifier. Seul le dossier `site/` est mis en ligne : il ne contient ni solution ni secret. Les solutions sont dans `solutions/`, `solutions-atelier/` et `solutions-ligne/`, qui ne sont jamais publiés. Garde le dépôt GitHub **privé** : il contient les solutions.

## 1. Mettre en ligne sur Netlify

Deux façons, au choix :

- **Site relié au dépôt GitHub** : dans Netlify, importe le dépôt. Le fichier `netlify.toml` à la racine dit à Netlify de publier seulement `site/`, sans commande de construction (sources 84, 85). Ne change pas le dossier de publication dans l'interface : `netlify.toml` l'emporte de toute façon (source 84).
- **Dépôt manuel**, comme pour tes jeux existants : glisse le dossier **`site/`** (et non le dossier du dépôt), sinon les solutions seraient en ligne.

Ensuite, dans les deux cas :

1. Le fichier `_headers` doit rester dans `site/`, le dossier publié (source 85).
2. Dans l'interface Netlify, ouvre **Forms** et choisis **Enable form detection**. La détection ne prend effet qu'au dépôt suivant : redéploie une fois après l'avoir activée (source 79).
3. Pour recevoir chaque envoi par e-mail : **Forms > Submission notifications** (source 79). Ton adresse se règle là, jamais dans le code.
4. Le formulaire `resultat-missions` : `pseudo`, `date`, `serie_max_atteinte`, `missions_reussies`, `etoiles_total`, `missions_a_revoir`, `mode`, `qualite`. Il compte toutes les missions de la carte, celles de l'atelier comprises. Aucun code ni plateau de stagiaire n'est envoyé.
   Le formulaire `resultat-ligne` (ancien jeu 2) reste déclaré dans `ligne.html` ; plus aucun stagiaire n'y arrive par un lien.

## 2. Tester avant de donner le lien

- Ouvre le site, tape le pseudo « Test », joue la mission 1.1, puis clique sur « Envoyer mes résultats » sur la carte : l'envoi doit apparaître dans l'onglet Forms de Netlify. Ouvre ensuite `missions.html?formateur=1` et joue la mission 3.1 : elle s'ouvre dans l'atelier, et ses étoiles reviennent sur la carte.
- Dans la console du navigateur (F12), tape `crossOriginIsolated` : la réponse doit être `true`. C'est le fichier `_headers` qui l'obtient (sources 10, 11, 80, 81). Si la réponse est `false`, le jeu fonctionne quand même : une boucle sans fin est arrêtée en rechargeant Python, ce qui prend quelques secondes de plus.
- Écris `while True: pass` dans une mission : l'exécution doit s'arrêter après 5 secondes avec une explication.
- Note le temps de chargement de Python sur un poste de la salle (indicateur « Python est prêt »).
- L'envoi des résultats ne fonctionne que sur le site Netlify, pas en local.

### Tester sur ton PC, sans Netlify

Un double-clic sur `site/index.html` ne marche pas : le navigateur refuse de charger les scripts du jeu depuis le disque. Double-clique sur `lancer-en-local.bat`, à la racine du dépôt (il démarre `serveur_local.py`, qui sert `site/`, et ouvre `http://127.0.0.1:8765/index.html`), ou tape `python serveur_local.py`. Laisse la fenêtre noire ouverte pendant le test.

## 3. Pendant la séance

- Adresse à donner : celle de ton site Netlify. La page d'accueil demande un pseudo, la qualité de la 3D et propose le mode sans 3D.
- `missions.html?formateur=1` ouvre toutes les séries, dans l'entrepôt comme dans l'atelier, pour ta démonstration. Ce n'est pas une sécurité : un stagiaire qui connaît l'adresse peut l'utiliser.
- Raccourcis : Ctrl+Entrée exécute, F10 rejoue une action à la fois, P met le rejeu en pause, M coupe le son. Le bouton A+ agrandit le texte de l'éditeur (16, 19 puis 23 px). Dans l'atelier, hors de l'éditeur : Ctrl+Z annule la dernière modification du hall et du code, Ctrl+Y la rétablit, Suppr détruit le poste choisi, Échap repose l'outil.
- Poste lent : bouton « Qualité » sur la carte, ou mode sans 3D. Le jeu propose lui-même la qualité basse quand l'affichage reste sous 25 images par seconde pendant 5 secondes.
- La progression est gardée dans le navigateur du poste (clé `jeux-python.progression.v1`). Si le stockage est vidé à la fermeture, la progression est perdue : c'est à vérifier sur un poste de la salle.

## 4. Réglages que tu peux modifier

### Missions des séries 1 et 2 (entrepôt)

| Réglage | Fichier | Constante |
|---|---|---|
| Durée avant l'arrêt d'une exécution (5 s) | `site/js/commun/python.js` | `DELAI_MAX_MS` |
| Nombre d'actions maximum par exécution (500), capacité du chariot (4) | `site/python/api_robot.py` | `MAX_ACTIONS`, `CAPACITE_CHARIOT` |
| Échecs avant chaque indice (2 puis 4) | `site/js/missions.js` | `ECHECS_AVANT_INDICE` |
| Essais avant qu'une mission soit signalée « à revoir » (5) | `site/js/missions.js` | `ESSAIS_A_REVOIR` |
| Vitesses du rejeu (1 et 3) | `site/js/commun/rejeu.js` | `VITESSES` |
| Explications des erreurs Python | `site/python/erreurs_fr.py` | `ERREURS` |
| Énoncé, indices, seuil de l'étoile 2 d'une mission | `site/missions/<mission>/mission.json` | |
| Tests d'une mission | `site/missions/<mission>/tests.py` | |

### Atelier (séries 3 à 6)

| Réglage | Fichier | Constante |
|---|---|---|
| Lancements sans étoile 1 avant chaque indice (2 puis 4) | `site/js/atelier/atelier.js` | `ECHECS_AVANT_INDICE` |
| Délai avant que le hall suive le code tapé (0,5 s), vitesse du rejeu rapide (2,5) | `site/js/atelier/atelier.js` | `DELAI_ANALYSE_MS`, `VITESSE_RAPIDE` |
| Tours de boucle montrés avant l'arrêt d'une boucle sans fin (40) | `site/js/atelier/atelier.js` | `MAX_ETAPES_BOUCLE` |
| Lignes exécutées suivies au plus (5 000) | `site/python/atelier.py` | `MAX_EVENEMENTS` |
| Durée d'un pas du rejeu (0,7 s en 3D, 0,55 s sans 3D) | `site/js/atelier/scene-atelier.js`, `site/js/atelier/vue2d-atelier.js` | `DUREE_PAS` |
| Taille des cases sans 3D (78 × 48 px) | `site/js/atelier/vue2d-atelier.js` | `LARGEUR_CASE`, `HAUTEUR_CASE` |
| Taille du hall (14 × 11, dont 3 rangées de données) | `site/js/atelier/catalogue.js` | `GRILLE` |
| Énoncé, cas de test, pièces de la barre, indices d'une mission | produits par `outils-construction/faire_atelier.py` | |

Les missions de l'atelier sont produites par `outils-construction/faire_atelier.py` (textes, départs et solutions repris de `faire_missions.py` ; il écrit `site/atelier/missions/`, `solutions-atelier/` et l'index de la carte). Après une modification : `python outils-construction/faire_atelier.py` (chaque solution doit obtenir 3 étoiles, chaque piège échouer), `python outils-construction/faire_version_locale.py`, puis `python qa/controle_atelier.py`.

### Ligne de production (ancien jeu 2, sans lien)

| Réglage | Fichier | Constante |
|---|---|---|
| Lancements sans étoile 1 avant chaque indice (2 puis 4) | `site/js/ligne/ligne.js` | `ECHECS_AVANT_INDICE` |
| Lancements avant qu'un niveau soit signalé « à revoir » (5) | `site/js/ligne/ligne.js` | `ESSAIS_A_REVOIR` |
| Rythme du rejeu (lent pour les 3 premières bouteilles, puis plus vite), rejeu rapide | `site/js/ligne/ligne.js` | `ACCELERATION`, `FACTEUR_RAPIDE` |
| Durée d'un pas de la scène (0,42 s) | `site/js/ligne/scene-ligne.js`, `site/js/ligne/vue2d.js` | `DUREE_PAS` |
| Taille de la grille (12 × 8) | `site/js/ligne/modele.js` | `GRILLE` |
| Lignes exécutées suivies au plus (30 000) | `site/python/ligne.py` | `MAX_EVENEMENTS` |
| Énoncé, pièces, données, indices d'un niveau | `site/ligne/niveaux/<niveau>/niveau.json` | |

Les niveaux du jeu 2 sont produits par `outils-construction/faire_niveaux.py` (écrit aussi `solutions-ligne/`). Après une modification : `python outils-construction/faire_niveaux.py`, puis `node outils-construction/verifier_niveaux.mjs <chemin de python 3.14>` (chaque solution doit obtenir 3 étoiles, chaque variante fausse échouer), puis `python qa/controle_ligne.py`.

### Construire les missions

Les missions des séries 1 et 2 sont produites par `outils-construction/faire_missions.py`, qui écrit aussi `solutions/` et vérifie que chaque solution obtient 3 étoiles ; il garde aussi les textes, départs et solutions des séries 3 à 6, que `faire_atelier.py` reprend. Si tu modifies une mission, relance `python outils-construction/faire_missions.py`, puis `python outils-construction/faire_atelier.py`, `python outils-construction/faire_version_locale.py` et les contrôles `python qa/controle.py` et `python qa/controle_atelier.py` (ils demandent Playwright et Google Chrome).

## 5. Versions figées

| Bibliothèque | Version | Licence | Dossier |
|---|---|---|---|
| Three.js | 0.187.0 | MIT | `site/vendor/three/` |
| Pyodide (Python 3.14.2 dans le navigateur) | 314.0.8 | MPL-2.0 | `site/vendor/pyodide/` |
| CodeMirror (paquets `codemirror` 6.0.2, `@codemirror/lang-python` 6.2.1, `view` 6.43.15, `state` 6.7.6, `commands` 6.11.1, `language` 6.13.1) | voir ci-contre | MIT | `site/vendor/codemirror/codemirror.js` |

Les postes ont Python 3.14.10 dans VS Code ; le jeu tourne avec Python 3.14.2. Les missions n'utilisent que des notions communes aux deux.

Rien n'est chargé depuis un autre site : le jeu fonctionne sans accès à d'autres domaines que le tien.

## 6. Données personnelles

- Seul le pseudo est envoyé, avec la progression. Demande un pseudo ou un prénom, pas un nom complet.
- Après la formation, supprime les envois dans l'onglet Forms de Netlify.
