// L'entraînement par renforcement du robot 3, à part de la page (la page reste fluide pendant les combats d'essai).
// Messages : { type: "init", cachees, graine } puis { type: "generation" } autant de fois qu'on veut ; { type: "bilan" }.
import { nouveauReseau, creerEntraineur, strategieDe } from "./renforcement.js";
import { combattre } from "./moteur.js";
import { adversaires } from "./robots.js";

let reseau = null, entraineur = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    reseau = nouveauReseau(m.cachees, m.graine || 2026);
    entraineur = creerEntraineur(reseau, { paires: m.paires || 12 });
    self.postMessage({ type: "pret", tailles: reseau.tailles, poids: Array.from(reseau.poids) });
  } else if (m.type === "generation") {
    const debut = performance.now(), s = entraineur.generation();
    self.postMessage({ type: "generation", ...s, duree: performance.now() - debut, poids: Array.from(reseau.poids) });
  } else if (m.type === "bilan") {
    const s = strategieDe(reseau), lignes = [];
    for (const nom of Object.keys(adversaires())) {
      const r1 = combattre(s, adversaires()[nom], "robot 3", nom), r2 = combattre(adversaires()[nom], s, nom, "robot 3");
      const f1 = r1.journal.at(-1), f2 = r2.journal.at(-1);
      lignes.push({ adversaire: nom, enA: r1.vainqueur === "a" ? "gagné" : r1.vainqueur === "b" ? "perdu" : "égalité", vieA: [f1.vie_a, f1.vie_b],
        enB: r2.vainqueur === "b" ? "gagné" : r2.vainqueur === "a" ? "perdu" : "égalité", vieB: [f2.vie_b, f2.vie_a] });
    }
    self.postMessage({ type: "bilan", lignes });
  }
};
