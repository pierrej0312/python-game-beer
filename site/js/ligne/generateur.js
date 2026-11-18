// Jeu 2 : traduit le plateau en Python lisible (05-jeu2-builder.md § 5).
// Chaque ligne produite garde l'identifiant de la pièce qui l'a fait naître : pendant l'exécution,
// la scène sait quelle pièce s'allume et l'éditeur quelle ligne surligner.
// Module sans DOM : il sert aussi à vérifier les solutions avec Node (outils-construction/verifier_niveaux.mjs).

import { PIECES } from "./modele.js";

// ----- Réglages -----
const INDENT = "    ";

const QUAIS = { Q1: "cafés", Q2: "magasins", Q3: "particuliers", Q4: "événements" };

function valeurPython(champ, valeur) {
  if (champ === "volume_cl") return String(Number(valeur));
  return JSON.stringify(String(valeur));
}

export function conditionTexte(params, variable = "bouteille") {
  return `${variable}["${params.champ}"] ${params.comparateur} ${valeurPython(params.champ, params.valeur)}`;
}

export function generer(plateau) {
  const lignes = [];                       // { texte, piece, commentaire }
  const suivre = [];                       // variables dont la scène affiche la valeur (bacs, casiers)
  const nomsCasiers = new Map();
  const machine = plateau.machine;
  const avecBiere = machine.etapes.includes("etiqueter");
  const emettre = (niveau, texte, piece = null, commentaire = "", role = "corps") => lignes.push({ texte: INDENT.repeat(niveau) + texte, piece, commentaire, role });
  // commentaire seul sur sa ligne (pas d'instruction) : la trappe au bout d'un tapis
  const noter = (niveau, texte, piece) => lignes.push({ texte: INDENT.repeat(niveau) + "# " + texte, piece, commentaire: "", role: "trappe", seul: true });

  emettre(0, "# Écrit à partir de votre plateau : il change à chaque pièce posée.", null, "", "entete");

  // la machine du stagiaire : une fonction définie une fois, appelée à chaque passage
  if (plateau.pieces.some((p) => p.type === "machine")) {
    emettre(0, "");
    emettre(0, `def ${machine.nom}(bouteille${avecBiere ? ", biere" : ""}):`, "machine-def", "votre machine : une fonction, définie une seule fois", "def");
    for (const etape of machine.etapes) {
      if (etape === "etiqueter") emettre(1, "bouteille = etiqueter(bouteille, biere)", "machine-def", "", "def");
      else emettre(1, `bouteille = ${etape}(bouteille)`, "machine-def", "", "def");
    }
    emettre(1, "return bouteille", "machine-def", "", "def");
  }

  // valeurs de départ des bacs et des carrousels de mise en casiers
  const ordre = parcours(plateau);
  const inits = [];
  for (const id of ordre) {
    const p = plateau.piece(id);
    if (p.type === "compteur") { inits.push([`${p.params.nom} = 0`, p.id, `le bac ${p.params.nom} : une variable qui vaut 0 au départ`]); suivre.push(p.params.nom); }
    if (p.type === "casiers") {
      const nom = nomsCasiers.size ? `casier_${nomsCasiers.size + 1}` : "casier";
      nomsCasiers.set(p.id, nom); suivre.push(nom);
      inits.push([`${nom} = []`, p.id, "le carrousel : une liste vide au départ"]);
    }
  }
  if (inits.length) { emettre(0, ""); for (const [t, id, c] of inits) emettre(0, t, id, c, "init"); }

  // une boucle par source : le tapis amène les bouteilles une par une
  // une source sans tapis garde sa boucle : ses bouteilles tombent dans la trappe, à la sortie de la cuve
  const sources = plateau.pieces.filter((p) => PIECES[p.type].source)
    .sort((a, b) => (a.type === b.type ? String(a.params.cuve || "").localeCompare(String(b.params.cuve || "")) : a.type === "cuve" ? -1 : 1));
  for (const s of sources) {
    emettre(0, "");
    if (s.type === "cuve") emettre(0, `for bouteille in cuve("${s.params.cuve}"):`, s.id, `le tapis amène les bouteilles de la cuve ${s.params.cuve}, une par une`, "source");
    else emettre(0, "for bouteille in stock():", s.id, "le tapis amène les bouteilles du stock, une par une", "source");
    chaine(plateau.suivant(s.id, "suite"), null, 1, "bouteille");
  }

  // tableaux de bord : après le passage de toutes les bouteilles
  const tableaux = plateau.pieces.filter((p) => p.type === "tableau" && p.params.bac);
  if (tableaux.length) {
    emettre(0, "");
    for (const t of tableaux) emettre(0, `print(${t.params.bac})`, t.id, "le tableau de bord, une fois toutes les bouteilles passées", "print");
  }

  // chemin : pièces déjà traversées sur ce chemin ; y revenir sans détecteur ferait une boucle sans fin (refusée par valider)
  function chaine(id, arret, niveau, item, chemin = new Set()) {
    const debut = lignes.length;
    let precedent = null;
    while (id && id !== arret) {
      if (chemin.has(id)) { noter(niveau, "Ce tapis revient en arrière sans détecteur de boucle : la ligne tournerait sans fin.", id); emettre(niveau, "pass", null, "", "pass"); return; }
      chemin.add(id);
      const p = plateau.piece(id);
      precedent = id;
      switch (p.type) {
        case "remplisseuse": emettre(niveau, "bouteille = remplir(bouteille)", id); break;
        case "capsuleuse": emettre(niveau, "bouteille = capsuler(bouteille)", id); break;
        case "etiqueteuse": emettre(niveau, `bouteille = etiqueter(bouteille, ${JSON.stringify(p.params.biere || "")})`, id); break;
        case "machine": emettre(niveau, `bouteille = ${machine.nom}(bouteille${avecBiere ? ", " + JSON.stringify(p.params.biere || "") : ""})`, id); break;
        case "compteur": emettre(niveau, `${p.params.nom} = ${p.params.nom} + 1`, id, item === "bouteille" ? "le bac compte une bouteille de plus" : "le bac compte un casier de plus"); break;
        case "quai": emettre(niveau, `expedier(${item}, "${p.params.quai}")`, id, ""); return;
        case "rebut": emettre(niveau, `rebut(${item})`, id); return;
        case "casiers": {
          const nom = nomsCasiers.get(id);
          emettre(niveau, `${nom}.append(bouteille)`, id, "", "casier-ajout");
          emettre(niveau, `if len(${nom}) == ${p.params.taille}:`, id, "le casier est plein : il part, un casier vide prend sa place", "casier-test");
          chaine(plateau.suivant(id, "pleins"), arret, niveau + 1, nom, new Set(chemin));
          emettre(niveau + 1, `${nom} = []`, id, "", "casier-vider");
          return;
        }
        case "detecteur": {
          // le détecteur est à l'entrée de l'anneau : il teste avant chaque tour, comme while
          emettre(niveau, `while ${conditionTexte(p.params)}:`, id, "détecteur de boucle : encore un tour tant que la condition est vraie", "detecteur");
          chaine(plateau.suivant(id, "encore"), id, niveau + 1, item, new Set(chemin));
          id = plateau.suivant(id, "sortie");
          continue;
        }
        case "controle": {
          const oui = plateau.suivant(id, "oui"), non = plateau.suivant(id, "non");
          const jonction = rejoindre(plateau, oui, non);
          emettre(niveau, `if ${conditionTexte(p.params)}:`, id, "contrôle qualité : sortie « oui » si la condition est vraie", "controle");
          chaine(oui, jonction, niveau + 1, item, new Set(chemin));
          // un deuxième contrôle sur la sortie « non » devient un elif
          let suivantNon = non, controle = p;
          for (;;) {
            const q = suivantNon && plateau.piece(suivantNon);
            if (q && q.type === "controle" && plateau.entrants(q.id).length === 1 && rejoindre(plateau, plateau.suivant(q.id, "oui"), plateau.suivant(q.id, "non")) === jonction) {
              emettre(niveau, `elif ${conditionTexte(q.params)}:`, q.id, "", "controle");
              chaine(plateau.suivant(q.id, "oui"), jonction, niveau + 1, item, new Set(chemin));
              controle = q; suivantNon = plateau.suivant(q.id, "non");
            } else break;
          }
          // sans jonction, chaque branche va au bout de son propre chemin (quai, benne ou trappe)
          if (suivantNon !== jonction || !jonction) {
            emettre(niveau, "else:", controle.id, "", "else");
            chaine(suivantNon, jonction, niveau + 1, item, new Set(chemin));
          }
          if (!jonction) return;
          id = jonction;
          continue;
        }
        default: break;
      }
      id = plateau.suivant(id, "suite");
    }
    // le chemin s'arrête sans quai ni benne : la bouteille (ou le casier) tombe dans la trappe
    if (!id) noter(niveau, item === "bouteille" ? "Au bout de ce tapis, la bouteille tombe dans la trappe." : "Au bout de ce tapis, le casier tombe dans la trappe.", precedent);
    if (!lignes.slice(debut).some((l) => !l.seul)) emettre(niveau, "pass", null, "rien à faire sur ce chemin (pass)", "pass");
  }

  // texte final : un commentaire se place sur sa propre ligne, au-dessus de l'instruction qu'il explique,
  // pour rester lisible dans un panneau étroit (pas de commentaire en bout de ligne)
  const sortie = [], pieces = [], roles = [];
  for (const l of lignes) {
    if (l.seul) { sortie.push(l.texte); pieces.push(l.piece); roles.push(l.role); continue; }
    if (l.commentaire) {
      const indent = l.texte.match(/^ */)[0];
      sortie.push(indent + "# " + l.commentaire.charAt(0).toUpperCase() + l.commentaire.slice(1)); pieces.push(null); roles.push("commentaire");
    }
    sortie.push(l.texte); pieces.push(l.piece); roles.push(l.role);
  }
  return { code: sortie.join("\n") + "\n", pieces, roles, suivre, casiers: Object.fromEntries(nomsCasiers) };
}

// Ordre de découverte des pièces, depuis les sources (pour l'ordre des valeurs de départ).
function parcours(plateau) {
  const vus = [], file = plateau.pieces.filter((p) => PIECES[p.type].source).map((p) => p.id);
  while (file.length) {
    const id = file.shift();
    if (vus.includes(id)) continue;
    vus.push(id);
    for (const t of plateau.sortantsRelies(id)) file.push(t.vers);
  }
  return vus;
}

// Pièce où les deux branches d'un contrôle se rejoignent à coup sûr : la ligne reprend là après le if / else.
// Elle doit être sur tous les chemins des deux branches ; sinon chaque branche va jusqu'à son quai (pas de jonction).
export function rejoindre(plateau, a, b) {
  if (!a || !b) return null;
  const distances = (depart) => {
    const d = new Map(), file = [[depart, 0]];
    while (file.length) {
      const [id, n] = file.shift();
      if (d.has(id)) continue;
      d.set(id, n);
      for (const t of plateau.sortantsRelies(id)) file.push([t.vers, n + 1]);
    }
    return d;
  };
  // vrai si tout chemin parti de « depart » passe par « j » avant de finir
  const passePar = (depart, j) => {
    const vus = new Set(), pile = [depart];
    while (pile.length) {
      const id = pile.pop();
      if (id === j) continue;
      if (vus.has(id)) continue;
      vus.add(id);
      // une sortie sans tapis relié : ce chemin finit dans la trappe sans passer par j
      const p = plateau.piece(id), sorties = PIECES[p.type].sorties;
      if (!sorties.length) return false;
      for (const s of sorties) { const n = plateau.suivant(id, s); if (!n) return false; pile.push(n); }
    }
    return true;
  };
  const da = distances(a), db = distances(b);
  const candidats = [...da.keys()].filter((id) => db.has(id)).sort((x, y) => (da.get(x) + db.get(x)) - (da.get(y) + db.get(y)));
  for (const j of candidats) if (passePar(a, j) && passePar(b, j)) return j;
  return null;
}
