# L'atelier de construction : missions des séries 3 à 6 (18/11/2026)

> Remplace `PROTOTYPE-atelier.md` (ce fichier peut être supprimé). Décisions du formateur dans `journal.md` du cours, 18/11/2026.

## Où le trouver

- Carte des missions (`missions.html`) : les séries 1 et 2 se jouent comme avant, dans l'entrepôt ; les missions des séries 3 à 6 (bord bleu à gauche de la carte) ouvrent l'atelier (`atelier.html#mission=<id>`).
- Même progression : les étoiles de l'atelier comptent sur la carte, pour l'ouverture des séries, pour « Envoyer mes résultats » (formulaire `resultat-missions`, inchangé) et pour « Recommencer à zéro ».
- La ligne de production (jeu 2) n'est plus proposée : l'accueil n'a plus qu'un bouton, la carte plus de lien. `ligne.html` et ses fichiers restent dans le site, sans lien.
- `?formateur=1` ouvre toutes les séries, sur la carte comme dans l'atelier.

## Les missions

| Série | Missions | Pièces de la barre |
|---|---|---|
| 3. Les conditions | 3.1 quai du client, 3.2 tarif, 3.3 stock bas (contrôle surprise), 3.4 remise magasin (bonus) | variable, calcul, if / elif / else, print, return |
| 4. Les listes et les tuples | 4.1 trois premières, 4.2 dernière livraison (contrôle surprise), 4.3 fût en tuple, 4.4 file des commandes (bonus, programme) | + rayonnage (list), caisse plombée (tuple) |
| 5. Les boucles | 5.1 tournée, 5.2 chariot (contrôle surprise), 5.3 cuves, 5.4 tournées du chariot (bonus) | + carrousel (for), boucle tant que (while) |
| 6. Les dictionnaires et les sets | 6.1 stock (contrôle surprise), 6.2 clients livrés, 6.3 fûts par quai (bonus) | + armoire à tiroirs (dict), bac de tri (set) |

- Les 12 missions du jeu 1 gardent leur identifiant, leur énoncé, leurs indices, leur code de départ et leurs tests, devenus des **cas** : paramètres -> résultat attendu, avec le libellé du test du jeu 1. Un test « bonus » donne l'étoile 3, un test « cache » reste le contrôle surprise (hors étoiles). Les tests « liste intacte » et « tuple intact » vérifient que le paramètre n'est pas modifié.
- **5.2** : l'outil `charger()` n'existe que dans la scène de l'entrepôt ; dans l'atelier, la boucle compte les fûts chargés (`charges += 1`, `futs_sur_le_quai -= 1`). Énoncé et indice 2 réécrits en conséquence.
- **6.1** : l'indice 2 ne donne plus la ligne `if code in stock:` (avec le code de départ, toute la solution aurait été dans `mission.json`) ; il dit à quoi sert `in`.
- Les quatre missions du prototype : 3.4, 4.4 et 5.5 (renommée **5.4**) deviennent les missions bonus de leur série ; l'ancienne 5.4 (compter les cuves hors plage) est retirée, elle doublait 5.3.
- Étoile 2 : nombre de postes (une instruction = un poste) au plus égal à celui de la solution.
- Tout est produit et vérifié par `outils-construction/faire_atelier.py` (textes, départs et solutions repris de `faire_missions.py`) : chaque solution obtient 3 étoiles, devient des postes sans « code libre », chaque piège échoue comme prévu (37 variantes fausses sur 15 missions, 0 échec).

## Ce qui a changé depuis le prototype

- **Dictionnaires et sets** : armoire à tiroirs (une étiquette par tiroir : la clé ; la valeur dedans), « Ouvrir un tiroir » (`d[k]`), « Ouvrir sans risque » (`d.get(k, défaut)`), « Remplir un tiroir » (`d[k] = v`, `+=`, `-=`), bac de tri (`set`, valeurs sans numéro de place), « Jeter dans le bac » (`s.add(v)`), `in` et `len` sur les deux. Une `KeyError` montre un tiroir rouge vide marqué de la clé demandée.
- **Boucle for** : la source s'écrit librement (`range(5)`, `enumerate(arrets, start=1)`, `zip(cuves, temperatures)`), et la variable peut être double (`numero, client`). Au rejeu : `tour 2 : numero, client = 2, "Taverne Saint-Jean"`.
- **Docstring** : la ligne `"""…"""` donnée par la mission reste sous le `def`, elle n'est pas un poste.
- **Annuler / Rétablir** (boutons en haut, Ctrl+Z / Ctrl+Y hors de l'éditeur) : le hall et le code reviennent ensemble. Dans l'éditeur, Ctrl+Z reste celui de l'éditeur.
- **Rejeu rapide** (bouton sous le hall, réglage gardé).
- **Mode sans 3D** (bouton « 3D / Sans 3D », ou case de l'accueil) : le hall en cases-boutons (numéro et mot-clé du poste, puis la donnée visée ; flèches et Entrée au clavier), les données en texte au-dessus, le rejeu dans un journal. Il prend aussi le relais si la 3D ne démarre pas. Le tracé d'un tapis à la main reste propre à la 3D ; en mode sans 3D, l'ordre se change avec « Plus tôt / Plus tard » (onglet Pièce).
- **Bilan** : « Améliorer », puis « Mission suivante » (dans l'atelier ou sur la carte) ou « Retour à la carte » ; fin de série et ouverture de la suivante annoncées comme dans le jeu 1.
- **Plan B VS Code** (`version-locale/`) : les missions de l'atelier y sont aussi, avec `depart.py` ; `python lancer_tests.py 6.1-stock` joue les mêmes cas et donne les mêmes étoiles.

## Contrôles du 18/11/2026

- `python outils-construction/faire_atelier.py` : 15 missions, 0 échec.
- `python qa/controle_atelier.py` : chaque mission dans Chrome (départ, solution, pièges), construction à la souris (programme sur les listes, while, if / elif / else), annuler et rétablir, mode sans 3D, carte -> atelier -> mission suivante -> carte avec les étoiles, accueil sans le jeu 2, série fermée refusée, aucune erreur JavaScript : 98 sur 98. Captures `qa/captures/v1/atelier-*.png`.
- `python qa/controle.py --section statique` : textes (émojis, formules, vouvoiement) et fuites de solutions vérifiés aussi sur l'atelier : 12 sur 12.
- `python qa/controle.py --section fonctionnement` : jeu 1 recentré sur les séries 1 et 2 : 42 sur 42.

## Reste à faire

- Essai en salle, sur un poste de stagiaire (temps de chargement, lisibilité de la 3D en qualité basse).
- Passer les missions de l'atelier aux stagiaires simulés (débutant, déjà programmé) avant la séance.
- La caméra ne zoome pas sur la partie construite du hall.
- Les commentaires tapés dans l'éditeur disparaissent quand on modifie le hall (le code est réécrit à partir des postes).
