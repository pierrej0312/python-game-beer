// Les dix-neuf nombres que voit un robot : copie de apprentissage.py (même ordre, mêmes échelles).
export const CARACTERISTIQUES = ["distance", "vie_moi", "vie_adversaire", "energie_moi", "energie_adversaire", "bord_moi", "bord_adversaire",
  "adv_prepare", "adv_frappe", "adv_recupere", "adv_garde", "adv_garde_basse", "adv_sonne", "adv_reste",
  "adv_direct", "adv_crochet", "adv_coup_bas", "adv_projection", "adv_special"];
export const ECHELLES = [1000, 100, 100, 100, 100, 1000, 1000, 1, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 1];
export const COUPS_VUS = ["direct", "crochet", "coup_bas", "projection", "special"];
export function caracteristiques(etat) {
  const adv = etat.adversaire, p = adv.phase;
  return [etat.distance, etat.moi.vie, adv.vie, etat.moi.energie, adv.energie, etat.moi.bord_derriere, adv.bord_derriere,
    +(p === "preparation"), +(p === "frappe"), +(p === "recuperation"), +(p === "garde"), +(p === "garde_basse"), +(p === "sonne"), adv.reste,
    ...COUPS_VUS.map((c) => +(adv.action === c))];
}
// Les décisions, au format de decisions.csv (donnees_apprentissage.py) : une ligne par décision d'un robot ou d'un joueur.
export const COLONNES_DECISIONS = ["combat_id", "tick", "robot", "adversaire", ...CARACTERISTIQUES, "action", "valide", "issue", "fin", "joueur"];
