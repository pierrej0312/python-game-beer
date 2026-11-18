// Atelier : la barre d'outils flottante, verticale, en icônes seules.
// Au survol ou au focus, une infobulle donne le nom de la brasserie, le nom Python et la catégorie.
// Une icône de type de données (liste, tuple…) ouvre son sous-menu : ce qu'on peut faire avec ce type.
import { BARRE, CATEGORIES, PIECES, ICONES, TYPE_ATTENDU } from "./catalogue.js";

const SVG = "http://www.w3.org/2000/svg";

export function icone(nom) {
  const svg = document.createElementNS(SVG, "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG, "path"); p.setAttribute("d", ICONES[nom]); svg.append(p);
  return svg;
}

// palette : pièces du niveau ; typesPresents() : types de données déjà posés ; surChoix({ outil } | { piece, type })
export function creerBarre(racine, infobulle, { palette, typesPresents, surChoix }) {
  let ouvert = null, actif = { outil: "choisir" };
  const boutons = [];

  function montrerInfo(bouton, info) {
    const cat = CATEGORIES[info.categorie] || CATEGORIES.outils;
    infobulle.style.setProperty("--couleur", cat.couleur);
    infobulle.innerHTML = "";
    const ligne = (classe, texte, balise = "p") => { const e = document.createElement(balise); e.className = classe; e.textContent = texte; infobulle.append(e); return e; };
    ligne("ib-nom", info.nom, "div");
    if (info.python) ligne("ib-python", info.python, "div");
    ligne("ib-categorie", info.categorieTexte, "span");
    if (info.aide) ligne("ib-aide", info.aide);
    if (info.grise) ligne("ib-grise", info.grise);
    infobulle.hidden = false;
    const vue = racine.parentElement.getBoundingClientRect(), b = bouton.getBoundingClientRect();
    const x = b.right - vue.left + 10, y = Math.min(b.top - vue.top, vue.height - infobulle.offsetHeight - 8);
    infobulle.style.left = x + "px"; infobulle.style.top = Math.max(6, y) + "px";
  }
  const cacherInfo = () => { infobulle.hidden = true; };

  function bouton(info, { surClic, sousMenu = false }) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "icone-outil"; b.setAttribute("aria-label", `${info.nom}${info.python ? " (" + info.python + ")" : ""}`);
    b.style.setProperty("--couleur", (CATEGORIES[info.categorie] || CATEGORIES.outils).couleur);
    b.dataset.categorie = info.categorie || "outils";
    b.append(icone(info.icone));
    if (sousMenu) { b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false"); const f = document.createElement("span"); f.className = "fleche-sous-menu"; f.setAttribute("aria-hidden", "true"); b.append(f); }
    b.addEventListener("mouseenter", () => montrerInfo(b, info.dynamique ? info.dynamique() : info));
    b.addEventListener("focus", () => montrerInfo(b, info.dynamique ? info.dynamique() : info));
    b.addEventListener("mouseleave", cacherInfo);
    b.addEventListener("blur", cacherInfo);
    b.addEventListener("click", () => { cacherInfo(); surClic(b); });
    return b;
  }

  function infoPiece(id, type = null) {
    const p = PIECES[id], attendu = type || TYPE_ATTENDU[id];
    const cat = CATEGORIES[type || p.categorie];
    const info = { nom: p.nom, python: type === "tuple" ? p.python.replace("liste", "caisse") : p.python, categorie: type || p.categorie, icone: p.icone, aide: p.aide,
      categorieTexte: `${cat.nom}${cat.python ? " · " + cat.python : ""} · ${p.nature}` };
    const quoi = { tuple: "une caisse plombée (tuple) : ce poste travaille sur une donnée de ce type", list: "un rayonnage (list) : ce poste travaille sur une donnée de ce type",
      dict: "une armoire à tiroirs (dict) : ce poste travaille sur une donnée de ce type", set: "un bac de tri (set) : ce poste travaille sur une donnée de ce type",
      si: "un contrôle qualité (if) : cet outil s'applique à un if déjà posé" }[attendu];
    info.dynamique = () => ({ ...info, grise: attendu && !typesPresents().has(attendu) ? `Posez d'abord ${quoi}.` : null });
    return info;
  }

  function fermerSousMenu() {
    if (!ouvert) return;
    ouvert.menu.remove(); ouvert.bouton.setAttribute("aria-expanded", "false"); ouvert = null;
  }

  function ouvrirSousMenu(b, groupe) {
    const deja = ouvert && ouvert.bouton === b;
    fermerSousMenu();
    if (deja) return;
    const cat = CATEGORIES[groupe.categorie];
    const menu = document.createElement("div"); menu.className = "sous-menu"; menu.setAttribute("role", "menu");
    menu.style.setProperty("--couleur", cat.couleur);
    const titre = document.createElement("div"); titre.className = "titre-sous-menu"; titre.textContent = cat.nom;
    if (cat.python) { const c = document.createElement("code"); c.textContent = cat.python; titre.append(c); }
    menu.append(titre);
    const elements = groupe.sousMenu.map((x) => (typeof x === "string" ? { piece: x, type: null } : x)).filter((x) => palette.includes(x.piece));
    for (const el of elements) {
      const info = infoPiece(el.piece, el.type);
      const e = bouton(info, { surClic: (bb) => {
        const d = info.dynamique();
        if (d.grise) { montrerInfo(bb, d); return; }
        fermerSousMenu(); choisir({ piece: el.piece, type: el.type });
      } });
      e.setAttribute("role", "menuitem");
      if (info.dynamique().grise) e.setAttribute("aria-disabled", "true");
      e.addEventListener("keydown", (ev) => {
        const liste = [...menu.querySelectorAll(".icone-outil")], i = liste.indexOf(e);
        if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { ev.preventDefault(); liste[(i + 1) % liste.length].focus(); }
        if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { ev.preventDefault(); liste[(i - 1 + liste.length) % liste.length].focus(); }
        if (ev.key === "Escape") { ev.preventDefault(); fermerSousMenu(); b.focus(); }
      });
      menu.append(e);
    }
    racine.parentElement.append(menu);
    const vue = racine.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect();
    menu.style.top = Math.max(6, Math.min(r.top - vue.top - 30, vue.height - menu.offsetHeight - 8)) + "px";
    b.setAttribute("aria-expanded", "true");
    ouvert = { bouton: b, menu };
    return menu;
  }

  function choisir(choix) {
    actif = choix;
    for (const x of boutons) x.b.setAttribute("aria-pressed", String(Boolean(choix.outil && x.outil === choix.outil)));
    surChoix(choix);
  }

  BARRE.forEach((groupe, gi) => {
    // trois familles séparées : les outils ; les données ; le contrôle (conditions, boucles) ; les sorties
    if (["liste", "condition", "sortie"].includes(groupe.categorie) && racine.lastElementChild && !racine.lastElementChild.classList.contains("separateur")) {
      const s = document.createElement("div"); s.className = "separateur"; racine.append(s);
    }
    if (groupe.categorie === "outils") {
      for (const o of groupe.elements) {
        const b = bouton({ ...o, categorie: "outils", categorieTexte: "Outil" }, { surClic: () => { fermerSousMenu(); if (o.action) surChoix({ action: o.outil }); else choisir({ outil: o.outil }); } });
        if (!o.action) b.setAttribute("aria-pressed", String(o.outil === "choisir"));
        boutons.push({ b, outil: o.action ? null : o.outil }); racine.append(b);
      }
      return;
    }
    const elements = groupe.sousMenu.map((x) => (typeof x === "string" ? x : x.piece)).filter((x) => palette.includes(x));
    if (!elements.length) return;
    const cat = CATEGORIES[groupe.categorie];
    const info = { nom: cat.nom, python: cat.python, categorie: groupe.categorie, icone: cat.icone, categorieTexte: "Type de données",
      aide: groupe.categorie === "liste" ? "Le rayonnage et tout ce qu'on peut faire avec : lire une case, une tranche, ajouter, retirer, trier…"
        : groupe.categorie === "tuple" ? "La caisse plombée et ce qu'on peut faire avec : lire, ouvrir. Pas de modification."
        : groupe.categorie === "variable" ? "Un nom pour une valeur, ou pour le résultat d'un calcul."
        : groupe.categorie === "condition" ? "Aiguiller le chariot selon une condition : if, puis elif et else sur un if déjà posé."
        : groupe.categorie === "dict" ? "L'armoire à tiroirs : une étiquette (la clé) par tiroir, une valeur dedans. Lire, remplir, tester un tiroir."
        : groupe.categorie === "set" ? "Le bac de tri : chaque valeur une seule fois, sans ordre ni numéro de place. Jeter dedans, tester."
        : groupe.categorie === "boucle" ? "Faire tourner le chariot dans un anneau : for, un tour par élément ; while, tant qu'une condition est vraie."
        : "Afficher une valeur (print) ou renvoyer le résultat de la fonction (return)." };
    if (groupe.categorie === "tuple") info.categorieTexte = "Type de données";
    if (groupe.categorie === "sortie") info.categorieTexte = "Sorties";
    if (groupe.categorie === "condition" || groupe.categorie === "boucle") info.categorieTexte = "Structure de contrôle";
    // une catégorie à une seule pièce se pose directement
    const direct = groupe.sousMenu.length === 1;
    const b = bouton(direct ? infoPiece(elements[0]) : info, { sousMenu: !direct, surClic: (bb) => {
      if (direct) { fermerSousMenu(); choisir({ piece: elements[0], type: null }); return; }
      const menu = ouvrirSousMenu(bb, groupe);
      if (menu) menu.querySelector(".icone-outil")?.focus({ preventScroll: true });
    } });
    b.addEventListener("keydown", (ev) => { if (!direct && ev.key === "ArrowRight") { ev.preventDefault(); b.click(); } });
    boutons.push({ b, outil: null }); racine.append(b);
  });

  // flèches haut et bas dans la barre
  racine.addEventListener("keydown", (ev) => {
    if (!["ArrowDown", "ArrowUp"].includes(ev.key) || !racine.contains(ev.target)) return;
    const liste = [...racine.querySelectorAll(".icone-outil")], i = liste.indexOf(ev.target);
    if (i < 0) return;
    ev.preventDefault(); liste[(i + (ev.key === "ArrowDown" ? 1 : -1) + liste.length) % liste.length].focus();
  });
  document.addEventListener("pointerdown", (ev) => { if (ouvert && !ouvert.menu.contains(ev.target) && !ouvert.bouton.contains(ev.target)) fermerSousMenu(); });

  return { choisir, fermerSousMenu, actif: () => actif };
}
