// Atelier de construction : ce que le stagiaire peut poser dans le hall.
// Chaque pièce a un nom de la brasserie, son nom Python, une catégorie, une icône et les champs de sa bulle de saisie.
// Module sans DOM : il sert aussi aux vérifications avec Node.

// ----- Réglages -----
export const GRILLE = { colonnes: 14, rangees: 11, stockage: 3 };  // rangées 0 à 2 : contre le mur, les données ; 3 à 10 : les postes
export const DEPART = { x: 0, z: 3 };                             // début du programme, ou réception des paramètres d'une fonction
export const FIN = { x: 13, z: 10 };                              // fin du programme, ou expédition du résultat (return)
export const BLOCS = new Set(["si", "pour", "tantque"]);         // postes qui contiennent d'autres postes

// Icônes : tracés SVG 24 × 24, dessinés au trait (aucune image importée).
export const ICONES = {
  choisir: "M5 3l14 8-6 2-3 6z",
  detruire: "M12 3l7 7-3 3-7-7z M10.5 8.5L3 16l3 3 7.5-7.5 M17 17l4 4",
  tapis: "M2 16h20v4H2z M5 16l2-3 M10 16l2-3 M15 16l2-3 M4 9c3-5 8-6 12-3 M14 3l3 3-3 3",
  ranger: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  liste: "M3 4v16 M21 4v16 M3 10h18 M3 16h18 M6 6.5h3v3.5 M11 6.5h3v3.5 M6 12.5h3v3.5 M15 12.5h3v3.5",
  tuple: "M3 8h18v12H3z M3 8l3-4h12l3 4 M10 8v12 M15 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  variable: "M4 9h16l-2 10H6z M8 9V5h8v4",
  afficher: "M3 4h18v12H3z M8 20h8 M12 16v4 M7 9h6 M7 12h9",
  lire_case: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  tranche: "M8 4H5v16h3 M16 4h3v16h-3 M9 12h6",
  longueur: "M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2",
  contient: "M4 10a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M15 15l6 6",
  trier_copie: "M4 6h8 M4 12h6 M4 18h4 M17 4v15 M14 16l3 3 3-3",
  trier_sur_place: "M4 6h12 M4 12h9 M4 18h6 M19 20V5 M16 8l3-3 3 3",
  ajouter: "M3 6h12 M3 12h12 M3 18h8 M18 15v6 M15 18h6",
  retirer: "M3 6h12 M3 12h12 M3 18h8 M15 18h6",
  remplacer_case: "M4 8h14l-3-3 M20 16H6l3 3",
  decomposer: "M3 11h18v9H3z M3 11l4-6 M21 11l-4-6 M8 15h3 M13 15h3",
  code_libre: "M8 6l-6 6 6 6 M16 6l6 6-6 6",
  depart: "M7 4l13 8-13 8z",
  reception: "M2 7h12v9H2z M14 10h4l3 3v3h-7 M6 19a1.6 1.6 0 1 0 0.01 0 M17 19a1.6 1.6 0 1 0 0.01 0",
  fin: "M5 21V4 M5 4h12l-3 4 3 4H5",
  calcul: "M4 7h6 M7 4v6 M14 7h6 M4 14l5 5 M9 14l-5 5 M14 15h6 M14 19h6",
  si: "M12 2l6 6-6 6-6-6z M12 14v7 M6 8H3v9 M18 8h3v9",
  elif: "M10 2l6 6-6 6-6-6z M10 14v6 M19 13v8 M15 17h8",
  else: "M3 12h7l4-6h7 M10 12l4 6h7 M18 3l3 3-3 3",
  pour: "M20 12a8 8 0 1 1-2.5-5.8 M20 3v5h-5 M8 12h8 M12 8v8",
  tantque: "M20 12a8 8 0 1 1-2.5-5.8 M20 3v5h-5 M12 8v5 M12 16v.5",
  renvoyer: "M3 12h12 M11 7l5 5-5 5 M20 4v16",
  dict: "M4 3h16v18H4z M4 9h16 M4 15h16 M10 6h4 M10 12h4 M10 18h4",
  set: "M3 9h18l-2 11H5z M7 13a1.5 1.5 0 1 0 0.01 0 M12 15a1.5 1.5 0 1 0 0.01 0 M16 12a1.5 1.5 0 1 0 0.01 0",
  lire_cle: "M4 4h16v8H4z M10 8h4 M12 12v8 M8 16l4 4 4-4",
  lire_get: "M4 4h16v8H4z M10 8h4 M12 12v5 M8 20h8",
  ecrire_cle: "M4 12h16v8H4z M10 16h4 M12 3v8 M8 7l4 4 4-4",
  ajouter_set: "M3 11h18l-2 9H5z M12 2v7 M9 6l3 3 3-3",
};

export const CATEGORIES = {
  outils:   { nom: "Outils", couleur: "#b9bdc9" },
  liste:    { nom: "Liste", python: "list", couleur: "#f5b82e", icone: "liste" },
  tuple:    { nom: "Tuple", python: "tuple", couleur: "#ef8a6a", icone: "tuple" },
  variable: { nom: "Variable", python: "=", couleur: "#4fc4a0", icone: "variable" },
  sortie:   { nom: "Tableau de bord", python: "print", couleur: "#8fb3ff", icone: "afficher" },
  dict:     { nom: "Dictionnaire", python: "dict", couleur: "#f39ac0", icone: "dict" },
  set:      { nom: "Set", python: "set", couleur: "#9be08a", icone: "set" },
  condition: { nom: "Conditions", python: "if · elif · else", couleur: "#c9a3f5", icone: "si" },
  boucle:   { nom: "Boucles", python: "for · while", couleur: "#5ad1e0", icone: "pour" },
  libre:    { nom: "Code libre", python: "", couleur: "#9aa0ad", icone: "code_libre" },
};

// Les pièces. « nature » : ce que c'est en Python (création, méthode, fonction intégrée…), affiché dans l'infobulle.
export const PIECES = {
  creer_liste: { nom: "Rayonnage", python: "nom = [ … ]", categorie: "liste", nature: "création d'une liste", icone: "liste",
    aide: "Une suite ordonnée et modifiable de valeurs, entre crochets. Chaque case a un numéro : 0 pour la première, -1 pour la dernière.",
    champs: ["nom", "elements"] },
  creer_tuple: { nom: "Caisse plombée", python: "nom = ( … )", categorie: "tuple", nature: "création d'un tuple", icone: "tuple",
    aide: "Des valeurs qui vont ensemble, entre parenthèses. La caisse est plombée : on lit, on ne modifie pas.",
    champs: ["nom", "elements"] },
  variable: { nom: "Bac étiqueté", python: "nom = valeur", categorie: "variable", nature: "variable", icone: "variable",
    aide: "Un nom pour une seule valeur : un texte, un nombre.", champs: ["nom", "valeur"] },
  lire_case: { nom: "Lire une case", python: "x = liste[i]", categorie: "liste", nature: "indice", icone: "lire_case",
    aide: "0 est la première case, -1 la dernière. Une case qui n'existe pas arrête le programme : IndexError.",
    champs: ["source", "indice", "dest"] },
  tranche: { nom: "Prendre une tranche", python: "x = liste[a:b]", categorie: "liste", nature: "tranche", icone: "tranche",
    aide: "Prend les cases de a jusqu'à b, sans la case b. Une tranche qui dépasse le rayonnage ne plante pas.",
    champs: ["source", "debut", "fin", "dest"] },
  longueur: { nom: "Compter les cases", python: "n = len(liste)", categorie: "liste", nature: "fonction intégrée", icone: "longueur",
    aide: "Le nombre de cases du rayonnage ou de la caisse.", champs: ["source", "dest"] },
  contient: { nom: "Chercher une valeur", python: "ok = valeur in liste", categorie: "liste", nature: "opérateur in", icone: "contient",
    aide: "True si la valeur est sur le rayonnage, sinon False.", champs: ["valeur", "source", "dest"] },
  trier_copie: { nom: "Copie triée", python: "x = sorted(liste)", categorie: "liste", nature: "fonction intégrée", icone: "trier_copie",
    aide: "Une nouvelle liste, triée. Le rayonnage d'origine garde son ordre.", champs: ["source", "dest"] },
  ajouter: { nom: "Ajouter au bout", python: "liste.append(valeur)", categorie: "liste", nature: "méthode des listes", icone: "ajouter",
    aide: "Une case de plus, à la fin du rayonnage. Une caisse plombée n'a pas cette méthode.", champs: ["cible", "valeur"] },
  retirer: { nom: "Retirer une valeur", python: "liste.remove(valeur)", categorie: "liste", nature: "méthode des listes", icone: "retirer",
    aide: "Retire la première case qui contient cette valeur ; les suivantes se resserrent. Valeur absente : ValueError.", champs: ["cible", "valeur"] },
  remplacer_case: { nom: "Remplacer une case", python: "liste[i] = valeur", categorie: "liste", nature: "affectation par indice", icone: "remplacer_case",
    aide: "Change le contenu d'une case. Sur une caisse plombée, Python refuse : TypeError.", champs: ["cible", "indice", "valeur"] },
  trier_sur_place: { nom: "Trier sur place", python: "liste.sort()", categorie: "liste", nature: "méthode des listes", icone: "trier_sur_place",
    aide: "Range le rayonnage lui-même, par ordre croissant. Ne renvoie rien : None.", champs: ["cible", "dest_facultatif"] },
  decomposer: { nom: "Ouvrir la caisse", python: "a, b = caisse", categorie: "tuple", nature: "décomposition d'un tuple", icone: "decomposer",
    aide: "Un nom par valeur de la caisse, dans l'ordre. Autant de noms que de valeurs.", champs: ["source", "noms"] },
  creer_dict: { nom: "Armoire à tiroirs", python: "nom = {clé: valeur}", categorie: "dict", nature: "création d'un dictionnaire", icone: "dict",
    aide: "Chaque tiroir porte une étiquette (la clé) et contient une valeur. On ouvre un tiroir par son étiquette, pas par un numéro. {} crée une armoire vide.",
    champs: ["nom", "paires"] },
  creer_set: { nom: "Bac de tri", python: "nom = {a, b}", categorie: "set", nature: "création d'un set", icone: "set",
    aide: "Un bac sans numéros de place : chaque valeur n'y est qu'une fois, un doublon disparaît. Un bac vide s'écrit set(), car {} est une armoire vide.",
    champs: ["nom", "elements"] },
  lire_cle: { nom: "Ouvrir un tiroir", python: "x = armoire[clé]", categorie: "dict", nature: "lecture par clé", icone: "lire_cle",
    aide: "Lit la valeur du tiroir de cette étiquette. Une étiquette absente arrête le programme : KeyError.", champs: ["source", "cle", "dest"] },
  lire_get: { nom: "Ouvrir sans risque", python: "x = armoire.get(clé, défaut)", categorie: "dict", nature: "méthode des dictionnaires", icone: "lire_get",
    aide: "Lit la valeur du tiroir ; si l'étiquette est absente, renvoie la valeur par défaut au lieu d'arrêter le programme.", champs: ["source", "cle", "defaut", "dest"] },
  ecrire_cle: { nom: "Remplir un tiroir", python: "armoire[clé] = valeur", categorie: "dict", nature: "écriture par clé", icone: "ecrire_cle",
    aide: "Range une valeur dans le tiroir de cette étiquette ; le tiroir est créé s'il n'existe pas. Avec += ou -=, il doit déjà exister.",
    champs: ["cible", "cle", "op", "valeur"] },
  ajouter_set: { nom: "Jeter dans le bac", python: "bac.add(valeur)", categorie: "set", nature: "méthode des sets", icone: "ajouter_set",
    aide: "Ajoute une valeur au bac ; si elle y est déjà, rien ne change.", champs: ["cible", "valeur"] },
  calcul: { nom: "Calcul", python: "nom = expression", categorie: "variable", nature: "affectation calculée", icone: "calcul",
    aide: "Range le résultat d'un calcul dans une variable : total = prix * 2. Avec += , la variable augmente : compteur += 1.", champs: ["nom", "op", "expression"] },
  si: { nom: "Contrôle qualité", python: "if condition:", categorie: "condition", nature: "condition", icone: "si", bloc: true,
    aide: "Le chariot prend la voie « vrai » si la condition est vraie ; sinon il passe au contrôle suivant (elif), à la voie « sinon » (else), ou à la suite.",
    champs: ["conditions", "sinon"] },
  elif: { nom: "Second contrôle", python: "elif condition:", categorie: "condition", nature: "condition de plus", icone: "elif", surBloc: "si",
    aide: "Cliquez sur un contrôle qualité (if) déjà posé : il reçoit une condition de plus, testée seulement si les précédentes sont fausses.", champs: [] },
  else: { nom: "Voie « sinon »", python: "else:", categorie: "condition", nature: "dernière voie", icone: "else", surBloc: "si",
    aide: "Cliquez sur un contrôle qualité (if) déjà posé : il reçoit une voie pour le cas où aucune condition n'est vraie.", champs: [] },
  pour: { nom: "Carrousel", python: "for x in liste:", categorie: "boucle", nature: "boucle for", icone: "pour", bloc: true,
    aide: "Le chariot fait un tour par élément de la liste : à chaque tour, la variable prend l'élément suivant. Les postes de l'anneau se répètent.",
    champs: ["variable", "source_expr"] },
  tantque: { nom: "Détecteur de boucle", python: "while condition:", categorie: "boucle", nature: "boucle while", icone: "tantque", bloc: true,
    aide: "Tant que la condition est vraie, le chariot refait un tour de l'anneau. Dans l'anneau, quelque chose doit rendre la condition fausse.",
    champs: ["condition"] },
  renvoyer: { nom: "Expédition", python: "return valeur", categorie: "sortie", nature: "résultat de la fonction", icone: "renvoyer",
    aide: "Renvoie le résultat de la fonction : le chariot part au quai d'expédition et la fonction s'arrête là.", champs: ["expression_retour"] },
  afficher: { nom: "Tableau de bord", python: "print( … )", categorie: "sortie", nature: "fonction intégrée", icone: "afficher",
    aide: "Affiche une valeur au tableau de bord.", champs: ["expression"] },
  code_libre: { nom: "Code libre", python: "", categorie: "libre", nature: "instruction Python", icone: "code_libre",
    aide: "Une instruction écrite dans l'éditeur, qui n'a pas de pièce dans la barre : elle s'exécute, elle se modifie dans le code.", champs: ["code"] },
};

// La barre d'outils : les outils, puis une icône par type de données, chacune avec son sous-menu.
// « type » : le type de données que la pièce attend ; elle reste grisée tant qu'aucune donnée de ce type n'est posée.
export const BARRE = [
  { categorie: "outils", elements: [
    { outil: "choisir", nom: "Choisir, régler, déplacer", python: "", nature: "outil", aide: "Cliquez sur un poste (ou sur une donnée contre le mur) pour ouvrir sa bulle et changer son nom ou son contenu ; glissez un poste pour le déplacer.", icone: "choisir" },
    { outil: "tapis", nom: "Tapis", python: "ordre des lignes", nature: "outil", aide: "Tracez le tapis d'un poste à un autre, case par case : le poste d'arrivée s'exécute juste après le poste de départ. Sans tracé, les tapis suivent l'ordre du programme tout seuls.", icone: "tapis" },
    { outil: "detruire", nom: "Marteau", python: "", nature: "outil", aide: "Cliquez sur un poste pour le détruire : sa ligne disparaît du code. Sur un tapis tracé à la main : il redevient automatique.", icone: "detruire" },
    { outil: "ranger", nom: "Ranger le hall", python: "", nature: "outil", aide: "Replace les postes dans l'ordre du programme, en serpentin.", icone: "ranger", action: true },
  ] },
  { categorie: "liste", sousMenu: ["creer_liste", "lire_case", "tranche", "longueur", "contient", "trier_copie", "ajouter", "retirer", "remplacer_case", "trier_sur_place"] },
  { categorie: "tuple", sousMenu: ["creer_tuple", "decomposer", { piece: "lire_case", type: "tuple" }, { piece: "longueur", type: "tuple" }, { piece: "contient", type: "tuple" }] },
  { categorie: "dict", sousMenu: ["creer_dict", "lire_cle", "lire_get", "ecrire_cle", { piece: "contient", type: "dict" }, { piece: "longueur", type: "dict" }] },
  { categorie: "set", sousMenu: ["creer_set", "ajouter_set", { piece: "contient", type: "set" }, { piece: "longueur", type: "set" }] },
  { categorie: "variable", sousMenu: ["variable", "calcul"] },
  { categorie: "condition", sousMenu: ["si", "elif", "else"] },
  { categorie: "boucle", sousMenu: ["pour", "tantque"] },
  { categorie: "sortie", sousMenu: ["afficher", "renvoyer"] },
];

// Type attendu par chaque pièce, pour griser le sous-menu (null : toujours disponible).
export const TYPE_ATTENDU = { creer_liste: null, creer_tuple: null, variable: null, afficher: null, code_libre: null, decomposer: "tuple",
  calcul: null, si: null, pour: null, tantque: null, renvoyer: null, elif: "si", else: "si",
  creer_dict: null, creer_set: null, lire_cle: "dict", lire_get: "dict", ecrire_cle: "dict", ajouter_set: "set" };
for (const [id, p] of Object.entries(PIECES)) if (!(id in TYPE_ATTENDU)) TYPE_ATTENDU[id] = p.categorie === "liste" ? "list" : p.categorie;

const MOTS_RESERVES = new Set(["False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif",
  "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield", "print", "len", "sorted", "list", "tuple", "dict", "set", "str", "int", "float", "type", "input"]);

// for numero, client in … : la boucle peut ranger chaque élément dans plusieurs noms
export function nomsDeBoucle(texte) {
  return String(texte || "").split(",").map((n) => n.trim()).filter(Boolean);
}

export function verifierNom(nom) {
  if (!nom) return "Donnez un nom (exemple : commandes).";
  if (!/^[a-z_][a-z0-9_]*$/.test(nom)) return `« ${nom} » n'est pas un nom de variable valide : minuscules, chiffres et _ seulement, sans accent ni espace, sans commencer par un chiffre.`;
  if (MOTS_RESERVES.has(nom)) return `« ${nom} » est déjà un mot de Python : choisissez un autre nom.`;
  return null;
}

// Une valeur écrite dans le code : texte (entre guillemets), nombre, ou nom de variable.
export function valeurPython(v) {
  if (!v) return "";
  if (v.type === "expression") return String(v.valeur);
  if (v.type === "texte") return JSON.stringify(String(v.valeur));
  if (v.type === "nombre") return String(v.valeur);
  return String(v.valeur);
}

export function verifierValeur(v) {
  if (!v || v.valeur === "" || v.valeur === null || v.valeur === undefined) return "Indiquez une valeur.";
  if (v.type === "nombre" && !Number.isFinite(Number(v.valeur))) return `« ${v.valeur} » n'est pas un nombre : choisissez « texte » si c'est un mot.`;
  if (v.type === "variable") return verifierNom(String(v.valeur));
  return null;
}

export function conditionSi(poste) { return poste.params.conditions; }

// La ligne d'en-tête d'un bloc, ou la ligne d'un poste simple.
export function enteteDe(poste) {
  const q = poste.params;
  switch (poste.type) {
    case "si": return `if ${q.conditions[0]}:`;
    case "pour": return `for ${q.variable} in ${q.source}:`;
    case "tantque": return `while ${q.condition}:`;
    default: return ligneDe(poste);
  }
}

// La ligne Python d'un poste.
export function ligneDe(poste) {
  const q = poste.params, v = valeurPython;
  switch (poste.type) {
    case "creer_liste": return `${q.nom} = [${q.elements.map(v).join(", ")}]`;
    case "creer_tuple": return `${q.nom} = (${q.elements.map(v).join(", ")}${q.elements.length === 1 ? "," : ""})`;
    case "variable": return `${q.nom} = ${v(q.valeur)}`;
    case "lire_case": return `${q.dest} = ${q.source}[${q.indice}]`;
    case "tranche": return `${q.dest} = ${q.source}[${q.debut ?? ""}:${q.fin ?? ""}]`;
    case "longueur": return `${q.dest} = len(${q.source})`;
    case "contient": return `${q.dest} = ${v(q.valeur)} in ${q.source}`;
    case "trier_copie": return `${q.dest} = sorted(${q.source})`;
    case "ajouter": return `${q.cible}.append(${v(q.valeur)})`;
    case "retirer": return `${q.cible}.remove(${v(q.valeur)})`;
    case "remplacer_case": return `${q.cible}[${q.indice}] = ${v(q.valeur)}`;
    case "trier_sur_place": return q.dest ? `${q.dest} = ${q.cible}.sort()` : `${q.cible}.sort()`;
    case "decomposer": return `${q.noms.join(", ")} = ${q.source}`;
    case "afficher": return `print(${q.expression})`;
    case "calcul": return `${q.nom} ${q.op || "="} ${q.expression}`;
    case "creer_dict": return `${q.nom} = {${q.paires.map(([k, w]) => `${v(k)}: ${v(w)}`).join(", ")}}`;
    case "creer_set": return q.elements.length ? `${q.nom} = {${q.elements.map(v).join(", ")}}` : `${q.nom} = set()`;
    case "lire_cle": return `${q.dest} = ${q.source}[${v(q.cle)}]`;
    case "lire_get": return `${q.dest} = ${q.source}.get(${v(q.cle)}${q.defaut ? ", " + v(q.defaut) : ""})`;
    case "ecrire_cle": return `${q.cible}[${v(q.cle)}] ${q.op || "="} ${v(q.valeur)}`;
    case "ajouter_set": return `${q.cible}.add(${v(q.valeur)})`;
    case "renvoyer": return q.expression ? `return ${q.expression}` : "return";
    case "si": return `if ${q.conditions[0]}:`;
    case "pour": return `for ${q.variable} in ${q.source}:`;
    case "tantque": return `while ${q.condition}:`;
    case "code_libre": return q.code;
    default: return "";
  }
}

// Ce qu'un poste crée ou remplace (noms de variables), et le type qu'on peut en prévoir sans exécuter.
export function nomsCrees(poste) {
  const q = poste.params;
  switch (poste.type) {
    case "creer_liste": return [[q.nom, "list"]];
    case "creer_tuple": return [[q.nom, "tuple"]];
    case "variable": return [[q.nom, q.valeur?.type === "texte" ? "str" : q.valeur?.type === "nombre" ? "nombre" : "?"]];
    case "tranche": return [[q.dest, "meme"]];
    case "lire_case": return [[q.dest, "?"]];
    case "longueur": return [[q.dest, "nombre"]];
    case "contient": return [[q.dest, "bool"]];
    case "trier_copie": return [[q.dest, "list"]];
    case "trier_sur_place": return q.dest ? [[q.dest, "None"]] : [];
    case "decomposer": return q.noms.map((n) => [n, "?"]);
    case "calcul": return q.op && q.op !== "=" ? [] : [[q.nom, "?"]];
    case "creer_dict": return [[q.nom, "dict"]];
    case "creer_set": return [[q.nom, "set"]];
    case "lire_cle": case "lire_get": return [[q.dest, "?"]];
    case "pour": return nomsDeBoucle(q.variable).map((n) => [n, "?"]);
    default: return [];
  }
}

// Variable lue ou modifiée par un poste (pour relier le poste à son rayonnage dans la scène).
export function donneeDe(poste) {
  const q = poste.params;
  return q.source || q.cible || (poste.type.startsWith("creer_") || poste.type === "variable" || poste.type === "calcul" ? q.nom : null);
}

// Le poste est-il complet ? Renvoie le premier problème, ou null.
export function verifierPoste(poste, typesConnus = new Map()) {
  const q = poste.params, champs = PIECES[poste.type].champs;
  for (const c of champs) {
    if (c === "nom") { const e = verifierNom(q.nom); if (e) return e; }
    if (c === "dest") { const e = verifierNom(q.dest); if (e) return e.replace("Donnez un nom", "Donnez le nom de la variable qui reçoit le résultat"); }
    if (c === "dest_facultatif" && q.dest) { const e = verifierNom(q.dest); if (e) return e; }
    if (c === "elements") { for (const el of q.elements) { const e = verifierValeur(el); if (e) return `Élément ${q.elements.indexOf(el) + 1} : ${e}`; } }
    if (c === "valeur") { const e = verifierValeur(q.valeur); if (e) return e; }
    if (c === "source" || c === "cible") { if (!q[c]) return "Choisissez la donnée sur laquelle ce poste travaille."; }
    if (c === "indice" && !Number.isInteger(Number(q.indice))) return "Le numéro de case est un nombre entier (0, 1, 2… ou -1, -2…).";
    if ((c === "debut" || c === "fin") && q[c] !== null && q[c] !== "" && !Number.isInteger(Number(q[c]))) return "Le début et la fin d'une tranche sont des nombres entiers, ou vides.";
    if (c === "noms") { if (!q.noms.length) return "Donnez au moins un nom."; for (const n of q.noms) { const e = verifierNom(n); if (e) return e; } }
    if (c === "expression" && poste.type === "afficher" && !String(q.expression || "").trim()) return "Indiquez ce que le tableau de bord affiche.";
    if (c === "code" && !String(q.code || "").trim()) return "Le code libre est vide.";
    if (c === "paires") for (const [k, w] of q.paires) { const e = verifierValeur(k) || verifierValeur(w); if (e) return `Tiroir ${q.paires.findIndex((x) => x[0] === k) + 1} : ${e}`; }
    if (c === "cle") { const e = verifierValeur(q.cle); if (e) return "Étiquette du tiroir : " + e; }
    if (c === "conditions") { if (!q.conditions.length) return "Un contrôle a au moins une condition."; for (const t of q.conditions) if (!String(t).trim()) return "Écrivez chaque condition (exemple : nb_casiers >= 10)."; }
    if (c === "condition" && !String(q.condition || "").trim()) return "Écrivez la condition de la boucle (exemple : casiers > 0).";
    if (c === "variable") {
      const noms = nomsDeBoucle(q.variable);
      if (!noms.length) return "Donnez le nom de la variable qui prend chaque élément (exemple : t).";
      for (const n of noms) { const e = verifierNom(n); if (e) return e; }
    }
    if (c === "source_expr" && !String(q.source || "").trim()) return "Indiquez ce que la boucle parcourt : une liste, ou range(…), enumerate(…), zip(…).";
    if (c === "expression" && poste.type === "calcul" && !String(q.expression || "").trim()) return "Écrivez le calcul (exemple : hors + 1).";
  }
  return null;
}

export function paramsParDefaut(type) {
  switch (type) {
    case "creer_liste": case "creer_tuple": return { nom: "", elements: [] };
    case "variable": return { nom: "", valeur: { type: "texte", valeur: "" } };
    case "lire_case": return { source: "", indice: 0, dest: "" };
    case "tranche": return { source: "", debut: 0, fin: 2, dest: "" };
    case "longueur": case "trier_copie": return { source: "", dest: "" };
    case "contient": return { source: "", dest: "", valeur: { type: "texte", valeur: "" } };
    case "ajouter": case "retirer": return { cible: "", valeur: { type: "texte", valeur: "" } };
    case "remplacer_case": return { cible: "", indice: 0, valeur: { type: "texte", valeur: "" } };
    case "trier_sur_place": return { cible: "", dest: null };
    case "decomposer": return { source: "", noms: [] };
    case "afficher": return { expression: "" };
    case "calcul": return { nom: "", op: "=", expression: "" };
    case "creer_dict": return { nom: "", paires: [] };
    case "creer_set": return { nom: "", elements: [] };
    case "lire_cle": return { source: "", cle: { type: "texte", valeur: "" }, dest: "" };
    case "lire_get": return { source: "", cle: { type: "texte", valeur: "" }, defaut: { type: "nombre", valeur: 0 }, dest: "" };
    case "ecrire_cle": return { cible: "", cle: { type: "texte", valeur: "" }, op: "=", valeur: { type: "nombre", valeur: 0 } };
    case "ajouter_set": return { cible: "", valeur: { type: "texte", valeur: "" } };
    case "si": return { conditions: [""], sinon: false };
    case "pour": return { variable: "", source: "" };
    case "tantque": return { condition: "" };
    case "renvoyer": return { expression: "" };
    default: return { code: "" };
  }
}
