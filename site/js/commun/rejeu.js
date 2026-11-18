// Rejeu d'un journal d'actions : dans la scène 3D, ou en texte (mode sans 3D).
import { decrire } from "./sans3d.js";

// ----- Réglages -----
export const VITESSES = [1, 3];            // rejeu normal, rejeu rapide
const PAUSE_TEXTE_MS = 260;                // délai entre deux lignes en mode sans 3D

export function creerRejeu({ scene, texte, surAction = () => {}, surFin = () => {} }) {
  let journal = [], indice = 0, jeton = 0, mission = null, bilan = null, enCours = false, vitesse = 1, enPause = false;

  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  function preparer(nouvelleMission, nouveauJournal, nouveauBilan) {
    jeton += 1; indice = 0; enCours = false;
    mission = nouvelleMission; journal = nouveauJournal || []; bilan = nouveauBilan || null;
    if (scene) { scene.sauter = true; scene.reinitialiser(mission); scene.sauter = false; scene.enPause = enPause; scene.vitesse = vitesse; }
    if (texte) texte.vider(journal.length ? null : "Aucune action à rejouer pour l'instant.");
    surAction(null, 0, journal.length);
  }

  async function jouerUne(monJeton) {
    const action = journal[indice];
    surAction(action, indice + 1, journal.length);
    if (texte) { texte.ajouter(action); await attendre(PAUSE_TEXTE_MS / vitesse); }
    if (scene) await scene.jouerAction(action);
    if (monJeton !== jeton) return false;
    indice += 1;
    return true;
  }

  async function terminer(monJeton) {
    if (scene && bilan) await scene.terminer(bilan);
    if (monJeton === jeton) { enCours = false; surFin(bilan); }
  }

  // Joue toutes les actions restantes.
  async function lancer() {
    if (enCours) return;
    enCours = true;
    const monJeton = jeton;
    while (indice < journal.length) { if (!(await jouerUne(monJeton))) return; }
    await terminer(monJeton);
  }

  // Joue une seule action, puis s'arrête.
  async function pas() {
    if (enCours) return;
    if (indice >= journal.length) { preparer(mission, journal, bilan); return; }
    enCours = true;
    const monJeton = jeton;
    const ok = await jouerUne(monJeton);
    if (!ok) return;
    if (indice >= journal.length) await terminer(monJeton); else enCours = false;
  }

  return {
    preparer, lancer, pas,
    rejouer() { preparer(mission, journal, bilan); return lancer(); },
    vitesse(v) { vitesse = v; if (scene) scene.vitesse = v; },
    pause(oui) { enPause = oui; if (scene) scene.enPause = oui; },
    estEnPause: () => enPause,
    arreter() { jeton += 1; enCours = false; },
    decrire,
  };
}
