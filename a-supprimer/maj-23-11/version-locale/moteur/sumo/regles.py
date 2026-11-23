"""Les règles du sumo des robots de la Brasserie de la Fonderie.

Lisez ce fichier : il dit tout ce que votre robot doit savoir. Ne le modifiez pas,
le tournoi se joue avec ces valeurs.

La plateforme de chargement est une rangée de cases numérotées de 0 à TAILLE_PLATEFORME - 1.
Le robot A part à gauche et regarde vers la droite ; le robot B part à droite et regarde vers la gauche.
Un robot qui sort de la plateforme perd le combat.

Un tour se joue en même temps pour les deux robots : chacun choisit son action sans connaître
celle de l'autre. Puis, dans cet ordre :
  1. les actions impossibles (énergie insuffisante, action inconnue) sont annulées : le robot ne fait rien ;
  2. l'énergie des actions est dépensée ;
  3. les ancrages : un robot qui choisit "ancrer" est ancré pour ce tour ;
  4. les déplacements : "avancer" et "reculer" ; on ne peut pas avancer sur la case de l'autre robot ;
  5. les poussées : au contact (distance 1), l'adversaire recule de POUSSEE cases, ou de POUSSEE_ANCRE s'il est ancré ;
     avec POUSSEE_ANCRE = 0, un robot ancré ne bouge pas ; deux robots qui poussent en même temps au contact
     s'annulent ; une poussée à distance ne fait rien ;
  6. les recharges : "recharger" rend RECHARGE points d'énergie, sans dépasser ENERGIE_MAX.

Fin du combat : un robot sort de la plateforme et perd (les deux au même tour : égalité).
Après TOURS_MAX tours, le robot le plus proche du centre gagne ; à égalité, celui qui a le plus d'énergie ;
sinon, égalité.
"""

TAILLE_PLATEFORME = 9
DEPART_A = 3
DEPART_B = 5
ENERGIE_DEPART = 5
ENERGIE_MAX = 10
RECHARGE = 2
POUSSEE = 2
POUSSEE_ANCRE = 0
TOURS_MAX = 40
GRAINE = 2026          # le hasard est le même d'un combat à l'autre : les combats sont reproductibles

# Valeurs équilibrées le 20/11/2026 (equilibrage.py) : chaque robot d'entraînement en bat d'autres,
# aucun ne gagne tout. Pousser bat recharger, s'ancrer bat pousser, recharger bat s'ancrer.
ACTIONS = ("avancer", "reculer", "pousser", "ancrer", "recharger")
COUT = {"avancer": 1, "reculer": 1, "pousser": 3, "ancrer": 1, "recharger": 0}
