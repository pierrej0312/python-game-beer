// Sons synthétisés par la Web Audio API : aucun fichier audio (01-direction-artistique.md § 8).

// ----- Réglages -----
const VOLUME = 0.06;                       // bas : une salle de postes qui sonnent ensemble devient vite pénible
const SONS = {
  clic: [[220, 0.06, "triangle"]],
  reussi: [[523, 0.09, "sine"], [784, 0.14, "sine"]],
  rate: [[330, 0.1, "sawtooth"], [208, 0.18, "sawtooth"]],
  choc: [[110, 0.12, "square"]],
  etoile: [[880, 0.08, "sine"], [1175, 0.16, "sine"]],
  victoire: [[523, 0.1, "sine"], [659, 0.1, "sine"], [784, 0.1, "sine"], [1047, 0.22, "sine"]],
  alerte: [[440, 0.12, "square"], [330, 0.12, "square"], [440, 0.12, "square"]],
  neutre: [[262, 0.12, "triangle"]],
};

let contexte = null;
let actif = true;

export function activer(oui) { actif = oui; }
export function estActif() { return actif; }

// Le contexte audio ne démarre qu'après une première action du stagiaire (règle des navigateurs).
export function reveiller() {
  try {
    if (!contexte) contexte = new (window.AudioContext || window.webkitAudioContext)();
    if (contexte.state === "suspended") contexte.resume();
  } catch (e) { contexte = null; }
}

export function jouer(nom) {
  if (!actif || !contexte || contexte.state !== "running" || !SONS[nom]) return;
  let t = contexte.currentTime;
  for (const [frequence, duree, forme] of SONS[nom]) {
    const oscillateur = contexte.createOscillator();
    const gain = contexte.createGain();
    oscillateur.type = forme;
    oscillateur.frequency.value = frequence;
    gain.gain.setValueAtTime(VOLUME, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    oscillateur.connect(gain).connect(contexte.destination);
    oscillateur.start(t);
    oscillateur.stop(t + duree);
    t += duree * 0.8;
  }
}
