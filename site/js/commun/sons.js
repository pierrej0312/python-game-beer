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

// Les coups du championnat des robots : un bruit filtré (l'impact) et un son grave (le poids du coup).
// force : 0.6 (direct) à 1.6 (spécial) ; metal : un coup bloqué sonne clair, comme sur une plaque.
export function impact(force = 1, metal = false) {
  if (!actif || !contexte || contexte.state !== "running") return;
  const t = contexte.currentTime, duree = 0.12 + 0.12 * force;
  const tampon = contexte.createBuffer(1, Math.floor(contexte.sampleRate * duree), contexte.sampleRate);
  const d = tampon.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const bruit = contexte.createBufferSource(); bruit.buffer = tampon;
  const filtre = contexte.createBiquadFilter(); filtre.type = metal ? "bandpass" : "lowpass"; filtre.frequency.value = metal ? 3200 : 900 + 600 * force;
  const g = contexte.createGain(); g.gain.setValueAtTime(VOLUME * 2.2 * Math.min(1.4, force), t); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  bruit.connect(filtre).connect(g).connect(contexte.destination); bruit.start(t);
  const o = contexte.createOscillator(), go = contexte.createGain();
  o.type = metal ? "triangle" : "sine"; o.frequency.setValueAtTime(metal ? 1400 : 140 / force, t); o.frequency.exponentialRampToValueAtTime(metal ? 900 : 50, t + duree);
  go.gain.setValueAtTime(VOLUME * 1.8, t); go.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(go).connect(contexte.destination); o.start(t); o.stop(t + duree);
}
