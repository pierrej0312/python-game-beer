// L'usine de la Fonderie : les modifications de l'usine, écrites dans le code.
// Le code est la seule référence : poser, régler ou retirer une machine modifie le texte Python,
// puis l'analyse redessine l'usine. Aucune machine n'existe sans sa ligne de code.

// Les machines de la barre de construction. ⟦…⟧ : la partie sélectionnée à la pose, à remplacer par le stagiaire.
export const GABARITS = {
  variable:        { nom: "Bac étiqueté", famille: "variable", lignes: ["⟦nom⟧ = 0"] },
  calcul:          { nom: "Machine de calcul", famille: "variable", lignes: ["⟦total⟧ = a * b"] },
  creer_liste:     { nom: "Rayonnage", famille: "liste", lignes: ["⟦commandes⟧ = []"] },
  ajouter:         { nom: "Ajouter au bout", famille: "liste", lignes: ["⟦commandes⟧.append(valeur)"] },
  retirer:         { nom: "Retirer", famille: "liste", lignes: ["⟦commandes⟧.remove(valeur)"] },
  lire_case:       { nom: "Lire une case", famille: "liste", lignes: ["⟦premiere⟧ = commandes[0]"] },
  tranche:         { nom: "Prendre une tranche", famille: "liste", lignes: ["⟦camion⟧ = commandes[0:2]"] },
  longueur:        { nom: "Compter", famille: "liste", lignes: ["⟦nombre⟧ = len(commandes)"] },
  contient:        { nom: "Chercher", famille: "liste", lignes: ["⟦present⟧ = valeur in commandes"] },
  trier_copie:     { nom: "Copie triée", famille: "liste", lignes: ["⟦triees⟧ = sorted(commandes)"] },
  trier_sur_place: { nom: "Trier sur place", famille: "liste", lignes: ["⟦commandes⟧.sort()"] },
  remplacer_case:  { nom: "Remplacer une case", famille: "liste", lignes: ["⟦commandes⟧[0] = valeur"] },
  creer_tuple:     { nom: "Caisse plombée", famille: "tuple", lignes: ["⟦fut⟧ = (17, \"La Braise\")"] },
  decomposer:      { nom: "Déballer la caisse", famille: "tuple", lignes: ["⟦numero, biere⟧ = fut"] },
  creer_dict:      { nom: "Armoire à tiroirs", famille: "dict", lignes: ["⟦stock⟧ = {}"] },
  lire_cle:        { nom: "Ouvrir un tiroir", famille: "dict", lignes: ["⟦valeur⟧ = stock[cle]"] },
  lire_get:        { nom: "Ouvrir sans risque", famille: "dict", lignes: ["⟦valeur⟧ = stock.get(cle, 0)"] },
  ecrire_cle:      { nom: "Remplir un tiroir", famille: "dict", lignes: ["⟦stock⟧[cle] = valeur"] },
  creer_set:       { nom: "Bac de tri", famille: "set", lignes: ["⟦livres⟧ = set()"] },
  ajouter_set:     { nom: "Jeter dans le bac", famille: "set", lignes: ["⟦livres⟧.add(valeur)"] },
  si:              { nom: "Répartiteur", famille: "condition", lignes: ["if ⟦condition⟧:", "    pass"] },
  si_sinon:        { nom: "Répartiteur à deux voies", famille: "condition", lignes: ["if ⟦condition⟧:", "    pass", "else:", "    pass"] },
  pour:            { nom: "Carrousel (for)", famille: "boucle", lignes: ["for ⟦element⟧ in liste:", "    pass"] },
  tantque:         { nom: "Boucle à capteur (while)", famille: "boucle", lignes: ["while ⟦condition⟧:", "    pass"] },
  afficher:        { nom: "Écran", famille: "sortie", lignes: ["print(⟦valeur⟧)"] },
  renvoyer:        { nom: "Quai de sortie (return)", famille: "sortie", lignes: ["return ⟦resultat⟧"] },
};

// La palette d'une mission (pièces de l'atelier) devient la barre de l'usine.
export function gabaritsDe(palette, fonction) {
  const voulus = new Set(palette || Object.keys(GABARITS));
  if (voulus.has("si")) voulus.add("si_sinon");
  if (!fonction) voulus.delete("renvoyer");
  return Object.keys(GABARITS).filter((id) => voulus.has(id));
}

const retrait = (n) => " ".repeat(n);
const retraitDe = (ligne) => ligne.length - ligne.trimStart().length;

// Insère une machine. cible : { postes, corps, index } (une fente de la disposition).
// Renvoie { code, ligne, debut, fin } : la ligne posée et la partie à sélectionner.
export function inserer(code, cible, idGabarit) {
  const g = GABARITS[idGabarit];
  const lignes = code === "" ? [] : code.split("\n");
  const corps = cible.corps || { indent: 0, fin: lignes.length, pass: null };
  let nouvelles = g.lignes.map((l) => retrait(corps.indent) + l);
  const premiere = nouvelles[0];
  const debut = premiere.indexOf("⟦"), fin = premiere.indexOf("⟧") - 1;
  nouvelles = nouvelles.map((l) => l.replace("⟦", "").replace("⟧", ""));
  let numero;                                  // numéro (à partir de 1) de la ligne posée
  if (cible.index < cible.postes.length) {
    numero = cible.postes[cible.index].lignes[0];
    lignes.splice(numero - 1, 0, ...nouvelles);
  } else if (corps.pass) {
    numero = corps.pass;
    lignes.splice(numero - 1, 1, ...nouvelles);    // le pass d'une voie vide est remplacé
  } else {
    numero = corps.fin + 1;
    lignes.splice(corps.fin, 0, ...nouvelles);
  }
  let texte = lignes.join("\n");
  if (!texte.endsWith("\n")) texte += "\n";
  return { code: texte, ligne: numero, debut: debut - corps.indent, fin: fin - corps.indent };
}

export function lireLigne(code, numero) { return (code.split("\n")[numero - 1] || "").trim(); }

// Remplace le texte d'une ligne en gardant son retrait.
export function remplacerLigne(code, numero, texte) {
  const lignes = code.split("\n");
  const ancienne = lignes[numero - 1] ?? "";
  lignes[numero - 1] = retrait(retraitDe(ancienne)) + texte.trim();
  return lignes.join("\n");
}

// Retire une machine et tout son bloc. Une voie qui devient vide reçoit un pass, pour que le code reste du Python.
export function retirer(code, poste, cible) {
  const lignes = code.split("\n");
  const [debut, fin] = poste.lignes;
  const indent = retraitDe(lignes[debut - 1] || "");
  lignes.splice(debut - 1, fin - debut + 1);
  const resteVide = cible && cible.postes.length === 1 && cible.contexte && !cible.contexte.racine;
  if (resteVide) lignes.splice(debut - 1, 0, retrait(indent) + "pass");
  return lignes.join("\n");
}

// Échange une machine avec sa voisine dans la même liste (Alt + flèche).
export function deplacer(code, postes, index, sens) {
  const autre = index + sens;
  if (autre < 0 || autre >= postes.length) return null;
  const [a, b] = sens > 0 ? [postes[index], postes[autre]] : [postes[autre], postes[index]];
  const lignes = code.split("\n");
  const blocA = lignes.slice(a.lignes[0] - 1, a.lignes[1]);
  const blocB = lignes.slice(b.lignes[0] - 1, b.lignes[1]);
  const entre = lignes.slice(a.lignes[1], b.lignes[0] - 1);
  lignes.splice(a.lignes[0] - 1, b.lignes[1] - a.lignes[0] + 1, ...blocB, ...entre, ...blocA);
  return lignes.join("\n");
}

// Donne à chaque machine un identifiant stable tiré de sa place dans le programme.
export function numeroter(postes, prefixe = "m") {
  postes.forEach((p, i) => {
    p.id = `${prefixe}${i}`;
    if (p.branches) p.branches.forEach((b, k) => numeroter(b, `${p.id}.${k}.`));
  });
  return postes;
}
