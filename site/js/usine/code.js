// L'usine de la Fonderie : les modifications de l'usine, écrites dans le code.
// Le code est la seule référence : poser, régler ou retirer une machine modifie le texte Python,
// puis l'analyse redessine l'usine. Aucune machine n'existe sans sa ligne de code.

// Les machines de la barre de construction. ⟦…⟧ : la partie sélectionnée à la pose, à remplacer par le stagiaire.
// nom : celui du modèle 3D (machines-usine.js) ; aide : ce que fait la machine, en une phrase ; modele : le type montré en vignette.
export const GABARITS = {
  variable:        { nom: "Étiqueteuse", aide: "Range une valeur sous un nom.", famille: "variable", lignes: ["⟦nom⟧ = 0"] },
  calcul:          { nom: "Calculatrice", aide: "Calcule une valeur et la range sous un nom.", famille: "variable", lignes: ["⟦total⟧ = a * b"] },
  creer_liste:     { nom: "Rayonnage", aide: "Crée une liste : des cases numérotées 0, 1, 2…", famille: "liste", lignes: ["⟦commandes⟧ = []"] },
  ajouter:         { nom: "Chargeur", aide: "Ajoute un élément au bout de la liste (append).", famille: "liste", lignes: ["⟦commandes⟧.append(valeur)"] },
  retirer:         { nom: "Extracteur", aide: "Retire un élément de la liste (remove).", famille: "liste", lignes: ["⟦commandes⟧.remove(valeur)"] },
  lire_case:       { nom: "Scanner : une case", aide: "Lit la case d'un indice.", famille: "liste", lignes: ["⟦premiere⟧ = commandes[0]"] },
  tranche:         { nom: "Scanner : une tranche", aide: "Copie une suite de cases.", famille: "liste", lignes: ["⟦camion⟧ = commandes[0:2]"] },
  longueur:        { nom: "Scanner : compter", aide: "Compte les éléments (len).", famille: "liste", lignes: ["⟦nombre⟧ = len(commandes)"] },
  contient:        { nom: "Scanner : chercher", aide: "Vérifie si un élément est présent (in).", famille: "liste", lignes: ["⟦present⟧ = valeur in commandes"] },
  trier_copie:     { nom: "Copieur trié", aide: "Fait une copie triée (sorted).", famille: "liste", lignes: ["⟦triees⟧ = sorted(commandes)"] },
  trier_sur_place: { nom: "Trieur de rayon", aide: "Trie la liste elle-même (sort).", famille: "liste", lignes: ["⟦commandes⟧.sort()"] },
  remplacer_case:  { nom: "Inséreuse", aide: "Remplace le contenu d'une case.", famille: "liste", lignes: ["⟦commandes⟧[0] = valeur"] },
  creer_tuple:     { nom: "Vitrine scellée", aide: "Crée un tuple : des valeurs qu'on ne change plus.", famille: "tuple", lignes: ["⟦fut⟧ = (17, \"La Braise\")"] },
  decomposer:      { nom: "Vitrine ouverte", aide: "Range chaque valeur d'un tuple sous un nom.", famille: "tuple", lignes: ["⟦numero, biere⟧ = fut"] },
  creer_dict:      { nom: "Casiers", aide: "Crée un dictionnaire : une valeur par clé.", famille: "dict", lignes: ["⟦stock⟧ = {}"] },
  lire_cle:        { nom: "Casiers : lire", aide: "Lit la valeur d'une clé.", famille: "dict", lignes: ["⟦valeur⟧ = stock[cle]"] },
  lire_get:        { nom: "Casiers : lire sans risque", aide: "Lit une clé, ou une valeur par défaut si elle manque (get).", famille: "dict", lignes: ["⟦valeur⟧ = stock.get(cle, 0)"] },
  ecrire_cle:      { nom: "Casiers : écrire", aide: "Range une valeur sous une clé.", famille: "dict", lignes: ["⟦stock⟧[cle] = valeur"] },
  creer_set:       { nom: "Cuve à capsules", aide: "Crée un set : des éléments sans doublon.", famille: "set", lignes: ["⟦livres⟧ = set()"] },
  ajouter_set:     { nom: "Cuve à capsules : ajouter", aide: "Ajoute un élément au set (add).", famille: "set", lignes: ["⟦livres⟧.add(valeur)"] },
  si:              { nom: "Trieur (if)", aide: "Dévie la bouteille si la condition est vraie.", famille: "condition", lignes: ["if ⟦condition⟧:", "    pass"] },
  si_sinon:        { nom: "Trieur et voie sinon (if / else)", aide: "Une voie si c'est vrai, l'autre sinon.", famille: "condition", modele: "si", lignes: ["if ⟦condition⟧:", "    pass", "else:", "    pass"] },
  pour:            { nom: "Distributeur (for)", aide: "Envoie les éléments un par un.", famille: "boucle", lignes: ["for ⟦element⟧ in liste:", "    pass"] },
  tantque:         { nom: "Cuve à boucle (while)", aide: "Refait un tour tant que la condition est vraie.", famille: "boucle", lignes: ["while ⟦condition⟧:", "    pass"] },
  sortir:          { nom: "Arrêt de boucle (break)", aide: "Sort de la boucle tout de suite.", famille: "boucle", lignes: ["⟦break⟧"] },
  suivant:         { nom: "Tremplin (continue)", aide: "Passe au tour suivant.", famille: "boucle", lignes: ["⟦continue⟧"] },
  fonction:        { nom: "Module (def)", aide: "Crée une fonction : un bâtiment avec sa propre ligne.", famille: "fonction", modele: "appel", lignes: ["def ⟦nom⟧(valeur):", "    return valeur"] },
  appel:           { nom: "Poste d'appel", aide: "Appelle une fonction et range son résultat.", famille: "fonction", lignes: ["⟦resultat⟧ = nom(valeur)"] },
  renvoyer:        { nom: "Retour (return)", aide: "Renvoie le résultat de la fonction.", famille: "fonction", lignes: ["return ⟦resultat⟧"] },
  afficher:        { nom: "Imprimante (print)", aide: "Affiche une valeur.", famille: "sortie", lignes: ["print(⟦valeur⟧)"] },
  importer:        { nom: "Livraison (import)", aide: "Fait venir une bibliothèque.", famille: "fichier", lignes: ["import ⟦math⟧"] },
  avec:            { nom: "Sas de fichier (with open)", aide: "Ouvre un fichier et le referme à la fin du bloc.", famille: "fichier", modele: "bloc", genre: "with",
                     lignes: ["with open(⟦\"fichier.csv\"⟧, encoding=\"utf-8\") as f:", "    pass"] },
  essayer:         { nom: "Sas de sécurité (try / except)", aide: "Essaie ; en cas d'erreur, prend la voie except.", famille: "fichier", modele: "bloc", genre: "try",
                     lignes: ["try:", "    pass", "except ⟦ValueError⟧:", "    pass"] },
};

// Les catégories de la barre (comme le menu « Ajouter » de Blender) : une vignette, puis le sous-menu de ses machines.
export const CATEGORIES = [
  { id: "valeurs", nom: "Valeurs", machines: ["variable", "calcul"] },
  { id: "listes", nom: "Listes et tuples", machines: ["creer_liste", "ajouter", "retirer", "lire_case", "tranche", "longueur", "contient", "trier_copie", "trier_sur_place", "remplacer_case", "creer_tuple", "decomposer"] },
  { id: "dicos", nom: "Dictionnaires et sets", machines: ["creer_dict", "lire_cle", "lire_get", "ecrire_cle", "creer_set", "ajouter_set"] },
  { id: "conditions", nom: "Conditions", machines: ["si", "si_sinon"] },
  { id: "boucles", nom: "Boucles", machines: ["pour", "tantque", "sortir", "suivant"] },
  { id: "fonctions", nom: "Fonctions", machines: ["fonction", "appel", "renvoyer"] },
  { id: "fichiers", nom: "Fichiers et erreurs", machines: ["importer", "avec", "essayer"] },
  { id: "affichage", nom: "Affichage", machines: ["afficher"] },
];

// La palette d'une mission devient la barre de l'usine.
export function gabaritsDe(palette, fonction) {
  const voulus = new Set(palette || Object.keys(GABARITS));
  if (voulus.has("si")) voulus.add("si_sinon");
  if (voulus.has("pour") || voulus.has("tantque")) { voulus.add("sortir"); voulus.add("suivant"); }
  if (!fonction && !voulus.has("fonction")) voulus.delete("renvoyer");
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

// ---- le répartiteur (if / elif / else) : ses voies se règlent comme dans un répartiteur programmable ----
const retraitLigne = (code, n) => retraitDe(code.split("\n")[n - 1] || "");

// Ajoute une voie elif, juste avant la voie sinon (ou à la fin s'il n'y en a pas).
export function ajouterElif(code, poste, condition = "condition") {
  const lignes = code.split("\n"), n = poste.params.conditions.length;
  const indent = retraitLigne(code, poste.lignes[0]), corps = poste.corps[0].indent;
  const apres = poste.corps[n - 1].fin;
  lignes.splice(apres, 0, retrait(indent) + `elif ${condition}:`, retrait(corps) + "pass");
  return { code: lignes.join("\n"), ligne: apres + 1 };
}

// Ajoute la voie sinon (else), à la fin du répartiteur.
export function ajouterSinon(code, poste) {
  const lignes = code.split("\n");
  const indent = retraitLigne(code, poste.lignes[0]), corps = poste.corps[0].indent;
  lignes.splice(poste.lignes[1], 0, retrait(indent) + "else:", retrait(corps) + "pass");
  return { code: lignes.join("\n"), ligne: poste.lignes[1] + 1 };
}

// La ligne d'en-tête de la voie k : if ou elif, ou la ligne else.
export function enteteVoie(poste, k) {
  if (k < poste.params.conditions.length) return poste.entetes[k];
  const c = poste.corps[k];
  return (c.pass ?? poste.branches[k][0].lignes[0]) - 1;
}

// Retire la voie k (pas la première : retirer la première, c'est retirer le répartiteur).
export function retirerVoie(code, poste, k) {
  if (k === 0) return null;
  const n = poste.params.conditions.length, nb = poste.branches.length;
  const debut = enteteVoie(poste, k);
  const fin = k + 1 < nb ? enteteVoie(poste, k + 1) - 1 : poste.lignes[1];
  const lignes = code.split("\n");
  lignes.splice(debut - 1, fin - debut + 1);
  return lignes.join("\n");
}
