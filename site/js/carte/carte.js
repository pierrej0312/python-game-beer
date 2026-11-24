// La carte de progression des missions : un hall peint par série, une route, une dalle par mission.
// Le décor est une peinture (decors.js) ; par-dessus, en HTML : les dalles cliquables, leurs lueurs, les étoiles,
// les lampes et les petites animations ; en 3D (Three.js) : le fût qui avance de mission en mission et la poussière
// dans la lumière. Sans WebGL, ou en qualité basse, la carte reste entière, sans le fût ni la poussière.
import { DECORS, LARGEUR, HAUTEUR, ENTREE, SORTIE } from "./decors.js";

const CLE_FUT = "jeux-python.carte.fut";                 // où le fût était la dernière fois, par série
const pct = (v, total) => `${(v / total) * 100}%`;
const mouvementReduit = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function creer(balise, classe, texte) { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; }
function lireFut() { try { return JSON.parse(localStorage.getItem(CLE_FUT)) || {}; } catch (e) { return {}; } }
function ecrireFut(serie, position) { try { const f = lireFut(); f[serie] = position; localStorage.setItem(CLE_FUT, JSON.stringify(f)); } catch (e) { /* stockage indisponible */ } }

/**
 * outils : { index, fiche(id), serieOuverte(n), serieReussie(n), ouvrir(mission), dessinerEtoiles(conteneur, etoiles), qualite: "haute"|"basse" }
 */
export function creerCarte(conteneur, outils) {
  const scene = creer("div", "hall-scene");
  const plateau = creer("div", "hall-plateau");
  const fond = creer("img", "hall-fond"); fond.alt = ""; fond.decoding = "async";
  const calque3d = creer("div", "hall-3d");
  const calque = creer("div", "hall-calque");
  const voile = creer("div", "hall-voile");                  // la lumière de l'arche pendant le passage d'un hall à l'autre
  const plaque = creer("div", "hall-plaque");
  const bulle = creer("div", "hall-bulle"); bulle.hidden = true; bulle.setAttribute("role", "status");
  plateau.append(fond, calque, calque3d, plaque, bulle, voile);   // le fût (3D) passe devant les lueurs des dalles
  scene.append(plateau);
  const puces = creer("nav", "hall-series"); puces.setAttribute("aria-label", "Séries");
  conteneur.append(puces, scene);

  let serie = null, trois = null, enPassage = false;

  // ---------- la 3D : le fût et la poussière ----------
  if (outils.qualite !== "basse") {
    import("./fut3d.js").then(({ creerFut3d }) => {
      try { trois = creerFut3d(calque3d, { largeur: LARGEUR, hauteur: HAUTEUR }); ajuster(); if (serie) placerFut(false); }
      catch (e) { console.warn("Carte : la 3D n'a pas pu démarrer, la carte reste sans fût.", e); trois = null; }
    }).catch((e) => console.warn("Carte : module 3D indisponible.", e));
  }

  // ---------- taille du plateau : 16:9 de la peinture, le plus grand possible ----------
  const ajuster = () => {
    const r = scene.getBoundingClientRect(), ratio = LARGEUR / HAUTEUR;
    let l = r.width, h = l / ratio;
    if (h > r.height) { h = r.height; l = h * ratio; }
    plateau.style.width = `${Math.floor(l)}px`; plateau.style.height = `${Math.floor(h)}px`;
    plateau.style.fontSize = `${Math.max(12, l / 78)}px`;      // les étiquettes suivent la taille du hall
    if (trois) trois.redimensionner(Math.floor(l), Math.floor(h));
  };
  const observateur = new ResizeObserver(ajuster); observateur.observe(scene);

  // ---------- les données d'une série ----------
  const missionsDe = (n) => outils.index.missions.filter((m) => m.serie === n);
  const principales = (n) => missionsDe(n).filter((m) => !m.bonus);
  const reussie = (m) => outils.fiche(m.id).etoiles[0];
  // la position du fût : la première mission principale pas encore réussie, ou la sortie si tout est fait
  const positionFut = (n) => { const i = principales(n).findIndex((m) => !reussie(m)); return i === -1 ? "sortie" : i; };
  const NIVEAU_ARCHES = 590;                                 // la route au pied des arches, en pixels de la peinture
  const pointFut = (n, pos) => pos === "sortie" ? { x: SORTIE.x + 10, y: NIVEAU_ARCHES } : pos === "entree" ? { x: ENTREE.x - 10, y: NIVEAU_ARCHES }
    : { x: DECORS[n].arrets[pos][0], y: DECORS[n].arrets[pos][1] };

  function dessinerPuces() {
    puces.innerHTML = "";
    for (const s of outils.index.series) {
      const ouverte = outils.serieOuverte(s.numero), b = creer("button", "hall-puce", String(s.numero).padStart(2, "0"));
      b.type = "button"; b.disabled = !ouverte;
      b.title = ouverte ? `Série ${s.numero} · ${s.titre}` : `Série ${s.numero} · s'ouvre quand la série ${s.numero - 1} est réussie`;
      b.setAttribute("aria-label", b.title);
      if (s.numero === serie) b.setAttribute("aria-current", "true");
      if (outils.serieReussie(s.numero)) b.classList.add("reussie");
      b.addEventListener("click", () => { if (s.numero !== serie) passer(s.numero, s.numero > serie ? "avant" : "arriere"); });
      puces.append(b);
    }
  }

  function dessinerSerie(n) {
    const decor = DECORS[n], info = outils.index.series.find((s) => s.numero === n);
    fond.src = decor.image;
    calque.innerHTML = "";
    // la plaque du hall
    const etoiles = missionsDe(n).reduce((s, m) => s + outils.fiche(m.id).etoiles.filter(Boolean).length, 0);
    plaque.innerHTML = "";
    plaque.append(creer("div", "hall-plaque-numero", `${String(n).padStart(2, "0")} · ${info.titre}`),
      creer("div", "hall-plaque-etat", `${etoiles} étoile(s) sur ${missionsDe(n).length * 3}`));
    // l'ambiance : lampes et effets propres au hall
    for (const [x, y] of decor.lampes) {
      const l = creer("div", "hall-lampe"); l.style.left = pct(x, LARGEUR); l.style.top = pct(y, HAUTEUR);
      l.style.animationDelay = `${(x % 7) * -0.37}s`; calque.append(l);
    }
    for (const ef of decor.effets || []) {
      const e = creer("div", `hall-effet ${ef.type}`); e.style.left = pct(ef.x, LARGEUR); e.style.top = pct(ef.y, HAUTEUR);
      if (ef.couleur) e.style.setProperty("--couleur", ef.couleur);
      if (ef.decalage) e.style.animationDelay = `${-ef.decalage}s`;
      if (ef.type === "vapeur") for (let i = 0; i < 4; i++) { const b = creer("span"); b.style.animationDelay = `${-i * 1.1}s`; e.append(b); }
      calque.append(e);
    }
    // les dalles
    const liste = principales(n), prochaine = positionFut(n);
    liste.forEach((m, i) => calque.append(dalle(m, decor.arrets[i], i === prochaine ? "prochaine" : reussie(m) ? "faite" : "a-faire")));
    const bonus = missionsDe(n).find((m) => m.bonus);
    if (bonus && decor.bonus) calque.append(dalle(bonus, decor.bonus, reussie(bonus) ? "faite bonus" : "a-faire bonus"));
    // les arches
    const suivante = outils.index.series.find((s) => s.numero === n + 1);
    if (suivante) {
      const ouverte = outils.serieReussie(n) && outils.serieOuverte(n + 1);
      const a = arche(SORTIE, "sortie" + (ouverte ? " ouverte" : ""), ouverte ? `Série ${n + 1} : ${suivante.titre}` : `Réussissez les missions de la série ${n} pour ouvrir la suite`);
      a.disabled = !ouverte;
      a.addEventListener("click", () => passer(n + 1, "avant"));
      calque.append(a);
    }
    if (n > 1) {
      const a = arche(ENTREE, "entree", `Revenir à la série ${n - 1}`);
      a.addEventListener("click", () => passer(n - 1, "arriere"));
      calque.append(a);
    }
  }

  function arche(p, classe, texte) {
    const a = creer("button", `hall-arche ${classe}`); a.type = "button";
    a.style.left = pct(p.x, LARGEUR); a.style.top = pct(p.y, HAUTEUR);
    a.setAttribute("aria-label", texte); a.append(creer("span", "hall-arche-texte", texte));
    return a;
  }

  function dalle(m, [x, y, l, h], etat) {
    const f = outils.fiche(m.id), b = creer("button", `hall-dalle ${etat}`);
    b.type = "button";
    b.style.left = pct(x, LARGEUR); b.style.top = pct(y, HAUTEUR); b.style.width = pct(l, LARGEUR); b.style.height = pct(h, HAUTEUR);
    const badges = [m.surprise ? "contrôle surprise" : "", m.bonus ? "bonus" : ""].filter(Boolean).join(", ");
    b.setAttribute("aria-label", `Mission ${m.serie}.${m.numero} : ${m.titre}. ${f.etoiles.filter(Boolean).length} étoile(s) sur 3${badges ? ". " + badges : ""}`);
    b.append(creer("span", "hall-dalle-lueur"));
    if (etat.startsWith("prochaine")) b.append(creer("span", "hall-faisceau"));
    // l'étiquette au-dessus de la dalle : le numéro et les étoiles
    const etiquette = creer("span", "hall-etiquette");
    etiquette.append(creer("span", "hall-etiquette-numero", `${m.serie}.${m.numero}`));
    const etoiles = creer("span", "etoiles"); outils.dessinerEtoiles(etoiles, f.etoiles); etiquette.append(etoiles);
    if (m.surprise) etiquette.append(creer("span", "hall-marque surprise", "Contrôle"));
    if (m.bonus) etiquette.append(creer("span", "hall-marque bonus", "Bonus"));
    b.append(etiquette);
    const montrer = () => montrerBulle(m, f, x, y - h / 2);
    b.addEventListener("mouseenter", montrer); b.addEventListener("focus", montrer);
    b.addEventListener("mouseleave", cacherBulle); b.addEventListener("blur", cacherBulle);
    b.addEventListener("click", () => { try { sessionStorage.setItem("jeux-python.carte.serie", String(m.serie)); } catch (e) { /* rien */ } outils.ouvrir(m); });
    return b;
  }

  function montrerBulle(m, f, x, y) {
    bulle.innerHTML = "";
    const titre = creer("div", "hall-bulle-surtitre", `Mission ${m.serie}.${m.numero}` + (m.surprise ? " · Contrôle surprise" : "") + (m.bonus ? " · Bonus" : ""));
    const etoiles = creer("span", "etoiles"); outils.dessinerEtoiles(etoiles, f.etoiles);
    const action = f.etoiles.every(Boolean) ? "Trois étoiles : vous pouvez la rejouer." : f.etoiles[0] ? "Réussie : rejouez-la pour gagner les étoiles qui manquent." : m.bonus ? "Facultative : un détour, la route continue sans elle." : "Cliquez pour jouer.";
    bulle.append(titre, creer("div", "hall-bulle-titre", m.titre), etoiles, creer("div", "hall-bulle-action", action));
    bulle.style.left = pct(Math.min(Math.max(x, 190), LARGEUR - 190), LARGEUR); bulle.style.top = pct(y, HAUTEUR);
    bulle.hidden = false;
  }
  function cacherBulle() { bulle.hidden = true; }

  // ---------- le fût ----------
  function placerFut(animer, depuis) {
    if (!trois || !serie) return;
    const memo = lireFut(), cible = positionFut(serie);
    let origine = depuis !== undefined ? depuis : memo[serie];
    if (origine === undefined || origine === null) origine = cible;
    const a = pointFut(serie, origine), b = pointFut(serie, cible);
    const largeur = DECORS[serie].arrets[0][2];
    if (animer !== false && !mouvementReduit() && (a.x !== b.x || a.y !== b.y)) trois.deplacer(a, b, largeur, cible === "sortie");
    else trois.poser(b, largeur, cible === "sortie");
    ecrireFut(serie, cible);
  }

  // ---------- passer d'un hall à l'autre, par l'arche ----------
  async function passer(n, sens) {
    if (enPassage || !outils.serieOuverte(n)) return;
    cacherBulle();
    if (mouvementReduit()) { afficher(n, sens === "avant" ? "entree" : undefined); return; }
    enPassage = true;
    const arch = sens === "avant" ? SORTIE : ENTREE;
    plateau.style.setProperty("--ox", pct(arch.x, LARGEUR)); plateau.style.setProperty("--oy", pct(arch.y, HAUTEUR));
    plateau.classList.add("passage-sortie");
    await new Promise((r) => setTimeout(r, 650));
    const nouvelle = new Image(); nouvelle.src = DECORS[n].image;
    try { await nouvelle.decode(); } catch (e) { /* l'image s'affichera à son arrivée */ }
    const arrivee = sens === "avant" ? ENTREE : SORTIE;
    plateau.style.setProperty("--ox", pct(arrivee.x, LARGEUR)); plateau.style.setProperty("--oy", pct(arrivee.y, HAUTEUR));
    plateau.classList.remove("passage-sortie"); plateau.classList.add("passage-entree");
    afficher(n, sens === "avant" ? "entree" : undefined);
    requestAnimationFrame(() => requestAnimationFrame(() => plateau.classList.remove("passage-entree")));
    setTimeout(() => { enPassage = false; }, 700);
  }

  function afficher(n, depuis) {
    serie = n;
    try { sessionStorage.setItem("jeux-python.carte.serie", String(n)); } catch (e) { /* rien */ }
    dessinerPuces(); dessinerSerie(n); ajuster();
    placerFut(true, depuis);
  }

  // la série affichée au départ : celle de la dernière mission ouverte depuis la carte, sinon la première série pas encore réussie
  function serieDeDepart() {
    let n = null;
    try { n = Number(sessionStorage.getItem("jeux-python.carte.serie")) || null; } catch (e) { /* rien */ }
    if (n && DECORS[n] && outils.serieOuverte(n)) return n;
    const ouvertes = outils.index.series.map((s) => s.numero).filter((k) => outils.serieOuverte(k) && DECORS[k]);
    return ouvertes.find((k) => !outils.serieReussie(k)) || ouvertes[ouvertes.length - 1] || 1;
  }

  afficher(serieDeDepart());
  return {
    afficher, rafraichir: () => afficher(serie),
    detruire() { observateur.disconnect(); if (trois) trois.detruire(); conteneur.innerHTML = ""; },
  };
}
