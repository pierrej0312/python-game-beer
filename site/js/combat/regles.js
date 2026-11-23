// Les règles du championnat : copie exacte de regles.py (vérifiée par qa/verifie_moteur_combat.py).
export const R = {
  TICKS_PAR_SECONDE: 10,
  DUREE_MAX: 600,
  RING: 1000, DEPART_A: 350, DEPART_B: 650, CONTACT: 80,
  VIE: 100, ENERGIE_MAX: 100, ENERGIE_DEPART: 50, RECUPERATION_ENERGIE: 1,
  AVANCE: 30, RECUL: 25,
  COUPS: {
    direct: { preparation: 2, recuperation: 3, portee: 160, degats: 6, energie: 8, sonne: 3, recul: 30 },
    crochet: { preparation: 5, recuperation: 6, portee: 140, degats: 15, energie: 18, sonne: 6, recul: 70 },
    coup_bas: { preparation: 3, recuperation: 5, portee: 150, degats: 9, energie: 10, sonne: 5, recul: 40 },
    projection: { preparation: 3, recuperation: 7, portee: 110, degats: 12, energie: 15, sonne: 9, recul: 150 },
    special: { preparation: 7, recuperation: 9, portee: 150, degats: 28, energie: 60, sonne: 12, recul: 200 },
  },
  // Deux gardes, et aucune n'arrête tout (voir regles.py).
  BLOQUE_PAR: { garde: ["direct", "crochet", "special"], garde_basse: ["coup_bas", "projection"] },
  GARDE_DIVISE: 5, GARDE_SONNE: 2, CONTRE: [3, 2],
  ESQUIVE: { duree: 4, energie: 12, recul: 40 },
  ACTIONS: ["attendre", "avancer", "reculer", "garde", "garde_basse", "direct", "crochet", "coup_bas", "projection", "esquive", "special"],
};
