// L'écran de sélection du robot, façon jeu de combat : une grille de portraits, le robot survolé en grand avec son nom,
// les flèches pour parcourir, Entrée pour choisir. Le choix ne change que l'apparence du robot, jamais le combat.
import * as sons from "../commun/sons.js";

const $ = (id) => document.getElementById(id);

export function creerSelection({ styles, actuel, choisir }) {
  const fond = $("selection-robot"), grille = $("selection-grille");
  let survol = Math.max(0, styles.findIndex((s) => s.id === actuel)), ouvert = false, retour = null;
  const colonnes = () => Math.max(1, Math.round(grille.clientWidth / (grille.firstElementChild?.offsetWidth || 150)));

  function vedette(i) {
    survol = (i + styles.length) % styles.length;
    const s = styles[survol];
    $("vedette-image").src = s.portrait || ""; $("vedette-image").alt = `Le robot ${s.nom}`;
    $("vedette-image").hidden = !s.portrait;
    $("vedette-nom").textContent = s.nom; $("vedette-credit").textContent = s.credit || "";
    [...grille.children].forEach((t, k) => { t.classList.toggle("survol", k === survol); t.setAttribute("aria-selected", String(k === survol)); });
    grille.children[survol]?.focus({ preventScroll: false });
  }

  function dessiner() {
    grille.innerHTML = "";
    styles.forEach((s, i) => {
      const t = document.createElement("button");
      t.type = "button"; t.className = "tuile" + (s.id === actuel ? " choisi" : ""); t.setAttribute("role", "option");
      if (s.portrait) { const img = document.createElement("img"); img.src = s.portrait; img.alt = ""; img.loading = "lazy"; t.append(img); }
      else t.append(Object.assign(document.createElement("span"), { className: "sans-portrait", textContent: "?" }));
      t.append(Object.assign(document.createElement("span"), { className: "tuile-nom", textContent: s.nom }));
      t.addEventListener("mouseenter", () => vedette(i));
      t.addEventListener("focus", () => { if (survol !== i) vedette(i); });
      t.addEventListener("click", () => { vedette(i); valider(); });
      grille.append(t);
    });
  }

  function valider() {
    const s = styles[survol];
    actuel = s.id; sons.jouer("victoire");
    fond.classList.add("valide"); $("vedette-nom").textContent = `${s.nom} !`;
    setTimeout(() => { fond.classList.remove("valide"); fermer(); choisir(s.id); }, 650);
  }
  function ouvrir() {
    retour = document.activeElement; ouvert = true; dessiner(); fond.hidden = false;
    vedette(Math.max(0, styles.findIndex((s) => s.id === actuel)));
  }
  function fermer() { ouvert = false; fond.hidden = true; retour?.focus?.(); }

  document.addEventListener("keydown", (e) => {
    if (!ouvert) return;
    const n = colonnes();
    const pas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: n, ArrowUp: -n }[e.key];
    if (pas) { e.preventDefault(); vedette(survol + pas); }
    else if (e.key === "Enter") { e.preventDefault(); valider(); }
    else if (e.key === "Escape") { e.preventDefault(); fermer(); }
  });
  $("selection-fermer").addEventListener("click", fermer);
  $("selection-valider").addEventListener("click", valider);
  fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
  return { ouvrir, fermer, majStyles(liste) { styles = liste; } };
}
