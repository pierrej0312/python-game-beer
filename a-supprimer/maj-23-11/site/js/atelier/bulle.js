// Atelier : la bulle de saisie accrochée au poste qu'on vient de poser (ou qu'on rouvre d'un double-clic).
// Elle demande le nom, le contenu ou la donnée visée, et montre la ligne Python pendant la saisie.
import { PIECES, CATEGORIES, ligneDe, verifierPoste } from "./catalogue.js";

const TYPES_VALEUR = [["texte", "texte"], ["nombre", "nombre"], ["variable", "variable"], ["expression", "calcul"]];
const COMPARAISONS = ["==", "!=", "<", "<=", ">", ">=", "in", "not in"];

function creer(balise, classe, texte) { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; }

// vue : conteneur de la scène ; ancre : { x, y } en pixels dans la vue ; variables : Map nom -> type, connues avant ce poste
export function ouvrirBulle(vue, { poste, ancre, variables, nouveau, surValider, surAnnuler }) {
  document.querySelector(".bulle")?.remove();
  const c = PIECES[poste.type], couleur = CATEGORIES[c.categorie].couleur;
  const q = structuredClone(poste.params);
  const bulle = creer("div", "bulle"); bulle.setAttribute("role", "dialog"); bulle.setAttribute("aria-label", `Réglages : ${c.nom}`);
  bulle.style.setProperty("--couleur", couleur);
  bulle.append(creer("h2", "", c.nom), creer("p", "b-python", c.python));
  const corps = creer("div"); bulle.append(corps);
  const apercu = creer("div", "apercu"); apercu.setAttribute("aria-live", "polite");
  const message = creer("p", "message-erreur"); message.setAttribute("role", "alert");
  const actions = creer("div", "actions");
  const annuler = creer("button", "bouton", nouveau ? "Ne pas poser" : "Annuler"); annuler.type = "button";
  const valider = creer("button", "bouton principal", nouveau ? "Poser" : "Enregistrer"); valider.type = "button";
  actions.append(annuler, valider);
  bulle.append(apercu, message, actions);

  const champ = (libelle, element, aide) => {
    const l = creer("label", "reglage"); l.append(creer("span", "", libelle), element);
    corps.append(l); if (aide) corps.append(creer("p", "aide", aide)); return element;
  };
  const texte = (valeur, placeholder = "") => { const i = document.createElement("input"); i.type = "text"; i.value = valeur ?? ""; i.placeholder = placeholder; i.autocomplete = "off"; i.spellcheck = false; return i; };
  const nombre = (valeur) => { const i = document.createElement("input"); i.type = "number"; i.step = "1"; i.value = valeur ?? ""; return i; };
  const choixDonnee = (actuelle, filtre) => {
    const s = document.createElement("select");
    const noms = [...variables].filter(([, t]) => !filtre || filtre.includes(t) || t === "?");
    const vide = creer("option", "", noms.length ? "Choisir…" : "Aucune donnée posée avant ce poste"); vide.value = ""; vide.disabled = true; s.append(vide);
    for (const [nom, t] of noms) { const o = creer("option", "", `${nom} (${t === "?" ? "type connu à l'exécution" : t})`); o.value = nom; s.append(o); }
    s.value = actuelle || "";
    if (!s.value) vide.selected = true;
    return s;
  };
  const listeNoms = () => { const d = document.createElement("datalist"); d.id = "noms-" + Math.random().toString(36).slice(2); for (const [n] of variables) { const o = document.createElement("option"); o.value = n; d.append(o); } bulle.append(d); return d.id; };
  const editeurValeur = (v, maj) => {
    const ligne = creer("div", "element"); ligne.style.gridTemplateColumns = "96px 1fr";
    const t = document.createElement("select");
    for (const [val, lib] of TYPES_VALEUR) { const o = creer("option", "", lib); o.value = val; t.append(o); }
    t.value = v.type;
    const i = texte(v.valeur, "valeur"); i.setAttribute("list", listeNoms());
    t.addEventListener("change", () => { v.type = t.value; maj(); });
    i.addEventListener("input", () => { v.valeur = v.type === "nombre" && i.value !== "" && Number.isFinite(Number(i.value)) ? Number(i.value) : i.value; maj(); });
    ligne.append(t, i);
    return ligne;
  };

  // Une condition : le texte (modifiable, pour and / or), et trois menus qui l'écrivent : ce qu'on compare, la comparaison, la valeur.
  const editeurCondition = (texteInitial, surTexte) => {
    const bloc = creer("div", "condition");
    const champTexte = texte(texteInitial, "exemple : nb_casiers >= 10"); champTexte.classList.add("code");
    const assistant = creer("div", "assistant");
    const gauche = document.createElement("select"), op = document.createElement("select"), droite = texte("", "valeur");
    gauche.setAttribute("aria-label", "Ce qu'on compare"); op.setAttribute("aria-label", "Comparaison"); droite.setAttribute("aria-label", "Valeur comparée");
    const vide = creer("option", "", "comparer…"); vide.value = ""; gauche.append(vide);
    for (const [n, t] of variables) for (const e of t === "list" || t === "tuple" ? [n, `len(${n})`] : [n]) { const o = creer("option", "", e); o.value = e; gauche.append(o); }
    for (const c of COMPARAISONS) { const o = creer("option", "", c); o.value = c; op.append(o); }
    op.value = ">=";
    const ecrireCondition = () => { if (gauche.value && droite.value.trim()) { champTexte.value = `${gauche.value} ${op.value} ${droite.value.trim()}`; surTexte(champTexte.value); } };
    for (const e of [gauche, op]) e.addEventListener("change", ecrireCondition);
    droite.addEventListener("input", ecrireCondition);
    champTexte.addEventListener("input", () => surTexte(champTexte.value));
    assistant.append(gauche, op, droite);
    bloc.append(champTexte, assistant);
    return bloc;
  };

  function maj() {
    const e = verifierPoste({ type: poste.type, params: q });
    message.textContent = e || "";
    apercu.textContent = poste.type === "si"
      ? [...q.conditions.map((c, k) => `${k ? "elif" : "if"} ${c || "…"}:`), ...(q.sinon ? ["else:"] : [])].join("\n")
      : ligneDe({ type: poste.type, params: q });
    valider.disabled = Boolean(e);
  }

  for (const nomChamp of c.champs) {
    if (nomChamp === "nom") {
      const i = champ(poste.type === "creer_liste" ? "Nom du rayonnage (nom de variable)" : poste.type === "creer_tuple" ? "Nom de la caisse (nom de variable)" : poste.type === "calcul" ? "Variable qui reçoit le résultat" : "Nom du bac (nom de variable)",
        texte(q.nom, poste.type === "creer_liste" ? "exemple : commandes" : poste.type === "creer_tuple" ? "exemple : fut" : "exemple : total"));
      i.addEventListener("input", () => { q.nom = i.value.trim(); maj(); });
      if (!nouveau) corps.append(creer("p", "aide", "Les postes suivants qui utilisent ce nom suivront le nouveau nom."));
    }
    if (nomChamp === "elements") {
      const titre = creer("span", "", poste.type === "creer_liste" ? "Cases du rayonnage, dans l'ordre" : poste.type === "creer_set" ? "Valeurs du bac (sans ordre ; un doublon ne compte qu'une fois)" : "Valeurs de la caisse, dans l'ordre");
      titre.style.cssText = "display:block;font-size:14px;font-weight:600;color:var(--violet);margin-top:6px";
      const zone = creer("div", "elements"), ajouter = creer("button", "bouton discret", "+ Ajouter une case"); ajouter.type = "button";
      corps.append(titre, zone, ajouter);
      if (poste.type === "creer_set") corps.append(creer("p", "aide", "Sans valeur, le bac s'écrit set() : {} serait une armoire vide (un dictionnaire)."));
      if (poste.type === "creer_tuple") corps.append(creer("p", "aide", "Une caisse d'une seule valeur s'écrit avec une virgule : (17,). Sans virgule, (17) n'est qu'un nombre."));
      const dessinerElements = () => {
        zone.innerHTML = "";
        q.elements.forEach((v, k) => {
          const ligne = creer("div", "element");
          const rang = creer("span", "rang", String(k));
          rang.title = `case ${k}, ou ${k - q.elements.length} en partant de la fin`;
          const t = document.createElement("select"); t.setAttribute("aria-label", `Type de la case ${k}`);
          for (const [val, lib] of TYPES_VALEUR) { const o = creer("option", "", lib); o.value = val; t.append(o); }
          t.value = v.type;
          const i = texte(v.valeur, "valeur"); i.setAttribute("aria-label", `Valeur de la case ${k}`);
          const haut = creer("button", "mini", "↑"), bas = creer("button", "mini", "↓"), retirer = creer("button", "mini", "×");
          for (const [b, lib] of [[haut, "Monter"], [bas, "Descendre"], [retirer, "Retirer"]]) { b.type = "button"; b.title = `${lib} la case ${k}`; b.setAttribute("aria-label", b.title); }
          t.addEventListener("change", () => { v.type = t.value; maj(); });
          i.addEventListener("input", () => { v.valeur = v.type === "nombre" && i.value !== "" && Number.isFinite(Number(i.value)) ? Number(i.value) : i.value; maj(); });
          haut.addEventListener("click", () => { if (k > 0) { [q.elements[k - 1], q.elements[k]] = [q.elements[k], q.elements[k - 1]]; dessinerElements(); maj(); } });
          bas.addEventListener("click", () => { if (k < q.elements.length - 1) { [q.elements[k + 1], q.elements[k]] = [q.elements[k], q.elements[k + 1]]; dessinerElements(); maj(); } });
          retirer.addEventListener("click", () => { q.elements.splice(k, 1); dessinerElements(); maj(); });
          ligne.append(rang, t, i, haut, bas, retirer); zone.append(ligne);
        });
      };
      ajouter.addEventListener("click", () => {
        const dernier = q.elements[q.elements.length - 1];
        q.elements.push({ type: dernier ? dernier.type : "texte", valeur: "" }); dessinerElements(); maj();
        zone.querySelector(".element:last-child input")?.focus();
      });
      dessinerElements();
    }
    if (nomChamp === "paires") {
      const titre = creer("span", "", "Tiroirs : une étiquette (clé), une valeur"); titre.style.cssText = "display:block;font-size:14px;font-weight:600;color:var(--violet);margin-top:6px";
      const zone = creer("div", "elements"), ajouter = creer("button", "bouton discret", "+ Ajouter un tiroir"); ajouter.type = "button";
      corps.append(titre, zone, ajouter, creer("p", "aide", "Deux tiroirs ne peuvent pas porter la même étiquette : le second remplace le premier."));
      const dessinerPaires = () => {
        zone.innerHTML = "";
        q.paires.forEach((paire, k) => {
          const ligne = creer("div", "paire");
          const retirer = creer("button", "mini", "×"); retirer.type = "button"; retirer.title = `Retirer le tiroir ${k + 1}`; retirer.setAttribute("aria-label", retirer.title);
          retirer.addEventListener("click", () => { q.paires.splice(k, 1); dessinerPaires(); maj(); });
          ligne.append(editeurValeur(paire[0], maj), creer("span", "fleche", ":"), editeurValeur(paire[1], maj), retirer);
          zone.append(ligne);
        });
      };
      ajouter.addEventListener("click", () => { q.paires.push([{ type: "texte", valeur: "" }, { type: "nombre", valeur: 0 }]); dessinerPaires(); maj(); zone.querySelector(".paire:last-child input")?.focus(); });
      dessinerPaires();
    }
    if (nomChamp === "cle") { const l = creer("div", "reglage"); l.append(creer("span", "", "Étiquette du tiroir (clé)")); l.append(editeurValeur(q.cle, maj)); corps.append(l); }
    if (nomChamp === "defaut") {
      const l = creer("div", "reglage"); l.append(creer("span", "", "Valeur si le tiroir n'existe pas"));
      if (!q.defaut) q.defaut = { type: "nombre", valeur: 0 };
      l.append(editeurValeur(q.defaut, maj)); corps.append(l);
    }
    if (nomChamp === "valeur") { const l = creer("div", "reglage"); l.append(creer("span", "", "Valeur")); l.append(editeurValeur(q.valeur, maj)); corps.append(l); }
    if ((nomChamp === "source" || nomChamp === "cible") && poste.type !== "pour") {
      const filtre = poste.type === "decomposer" ? ["tuple"] : ["lire_cle", "lire_get", "ecrire_cle"].includes(poste.type) ? ["dict"] : poste.type === "ajouter_set" ? ["set"]
        : ["contient", "longueur"].includes(poste.type) ? ["list", "tuple", "dict", "set", "str"] : ["list", "tuple"];
      const s = champ(nomChamp === "source" ? "Donnée lue" : "Donnée modifiée", choixDonnee(q[nomChamp], filtre));
      s.addEventListener("change", () => { q[nomChamp] = s.value; maj(); });
    }
    if (nomChamp === "indice") {
      const i = champ("Numéro de la case", nombre(q.indice), "0 = la première case, 1 = la deuxième… ; -1 = la dernière, -2 = l'avant-dernière.");
      i.addEventListener("input", () => { q.indice = i.value === "" ? "" : Number(i.value); maj(); });
    }
    if (nomChamp === "debut") {
      const i = champ("Début (case prise)", nombre(q.debut), "Vide = depuis la première case.");
      i.addEventListener("input", () => { q.debut = i.value === "" ? null : Number(i.value); maj(); });
    }
    if (nomChamp === "fin") {
      const i = champ("Fin (case non prise)", nombre(q.fin), "La tranche s'arrête juste avant cette case. Vide = jusqu'au bout.");
      i.addEventListener("input", () => { q.fin = i.value === "" ? null : Number(i.value); maj(); });
    }
    if (nomChamp === "dest") {
      const i = champ("Ranger le résultat dans (nom de variable)", texte(q.dest, "exemple : camion"));
      i.addEventListener("input", () => { q.dest = i.value.trim(); maj(); });
    }
    if (nomChamp === "dest_facultatif") {
      const i = champ("Ranger le résultat dans (facultatif)", texte(q.dest || "", "laisser vide"), "Attention : .sort() ne renvoie rien, la variable vaudrait None.");
      i.addEventListener("input", () => { q.dest = i.value.trim() || null; maj(); });
    }
    if (nomChamp === "noms") {
      const i = champ("Noms, dans l'ordre des valeurs, séparés par des virgules", texte(q.noms.join(", "), "exemple : numero, biere"));
      i.addEventListener("input", () => { q.noms = i.value.split(",").map((x) => x.trim()).filter(Boolean); maj(); });
    }
    if (nomChamp === "expression") {
      const calcul = poste.type === "calcul";
      const i = champ(calcul ? "Calcul" : "Ce que le tableau de bord affiche", texte(q.expression, calcul ? "exemple : hors + 1, prix * 2" : "exemple : camion"),
        calcul ? "Des nombres, des noms de variables, + - * /, len(…)." : "Un nom de variable, ou par exemple len(commandes), sorted(commandes).");
      const d = document.createElement("datalist"); d.id = "expressions-bulle";
      for (const [n, t] of variables) for (const e of t === "list" || t === "tuple" ? [n, `len(${n})`, `sorted(${n})`, `${n}[0]`, `${n}[-1]`] : [n]) { const o = document.createElement("option"); o.value = e; d.append(o); }
      bulle.append(d); i.setAttribute("list", d.id);
      i.addEventListener("input", () => { q.expression = i.value.trim(); maj(); });
    }
    if (nomChamp === "op") {
      const s = document.createElement("select");
      for (const [v, lib] of [["=", "= (remplacer)"], ["+=", "+= (ajouter)"], ["-=", "-= (retirer)"], ...(poste.type === "calcul" ? [["*=", "*= (multiplier)"]] : [])]) { const o = creer("option", "", lib); o.value = v; s.append(o); }
      s.value = q.op || "=";
      champ("Opération", s, poste.type === "calcul" ? "compteur += 1 ajoute 1 à compteur ; total = prix * 2 remplace total par le calcul." : "stock[code] -= nb retire nb du tiroir ; il doit déjà exister.");
      s.addEventListener("change", () => { q.op = s.value; maj(); });
    }
    if (nomChamp === "expression" && poste.type === "calcul") { /* écrit plus bas, avec ses suggestions */ }
    if (nomChamp === "conditions") {
      const titre = creer("span", "", "Conditions, testées dans l'ordre"); titre.style.cssText = "display:block;font-size:14px;font-weight:600;color:var(--violet);margin-top:6px";
      const zone = creer("div", "elements"), plus = creer("button", "bouton discret", "+ elif (une condition de plus)"); plus.type = "button";
      corps.append(titre, zone, plus);
      q._origines = q._origines || q.conditions.map((_, k) => k);
      const dessinerConditions = () => {
        zone.innerHTML = "";
        q.conditions.forEach((c, k) => {
          const ligne = creer("div", "ligne-condition");
          ligne.append(creer("span", "mot-cle", k === 0 ? "if" : "elif"));
          ligne.append(editeurCondition(c, (t) => { q.conditions[k] = t; maj(); }));
          if (q.conditions.length > 1) {
            const x = creer("button", "mini", "×"); x.type = "button"; x.title = `Retirer cette condition (et les postes de sa voie)`; x.setAttribute("aria-label", x.title);
            x.addEventListener("click", () => { q.conditions.splice(k, 1); q._origines.splice(k, 1); dessinerConditions(); maj(); });
            ligne.append(x);
          }
          zone.append(ligne);
        });
      };
      plus.addEventListener("click", () => { q.conditions.push(""); q._origines.push(null); dessinerConditions(); maj(); zone.querySelector(".ligne-condition:last-child input")?.focus(); });
      dessinerConditions();
    }
    if (nomChamp === "sinon") {
      const l = creer("label", "reglage case-a-cocher"), c = document.createElement("input"); c.type = "checkbox"; c.checked = Boolean(q.sinon);
      l.append(c, creer("span", "", "Voie « sinon » (else) : quand aucune condition n'est vraie"));
      corps.append(l);
      c.addEventListener("change", () => { q.sinon = c.checked; maj(); });
    }
    if (nomChamp === "condition") {
      const l = creer("div", "reglage"); l.append(creer("span", "", "Tant que…"), editeurCondition(q.condition, (t) => { q.condition = t; maj(); }));
      corps.append(l, creer("p", "aide", "La boucle refait un tour tant que la condition est vraie. Dans l'anneau, un poste doit la rendre fausse."));
    }
    if (nomChamp === "variable") {
      const i = champ("Nom de l'élément, à chaque tour (nom de variable)", texte(q.variable, "exemple : t"), "Deux noms séparés par une virgule si chaque élément en contient deux : numero, client.");
      i.addEventListener("input", () => { q.variable = i.value.trim(); maj(); });
    }
    if (nomChamp === "source_expr") {
      // une donnée du hall, ou une expression : range(5), enumerate(arrets, start=1), zip(cuves, temperatures)
      const i = champ("Ce que la boucle parcourt", texte(q.source, "exemple : temperatures"), "Une liste, un tuple, un texte, un dictionnaire ; ou range(…), enumerate(…), zip(…). Un tour par élément.");
      const d = document.createElement("datalist"); d.id = "sources-bulle";
      for (const [n, t] of variables) if (["list", "tuple", "str", "dict", "set", "?"].includes(t)) { const o = document.createElement("option"); o.value = n; d.append(o); }
      bulle.append(d); i.setAttribute("list", d.id);
      i.addEventListener("input", () => { q.source = i.value.trim(); maj(); });
    }
    if (nomChamp === "expression_retour") {
      const i = champ("Ce que la fonction renvoie", texte(q.expression, "exemple : hors"), "Un nom de variable, un nombre, un calcul. La fonction s'arrête à ce poste.");
      const d = document.createElement("datalist"); d.id = "retours-bulle"; for (const [n] of variables) { const o = document.createElement("option"); o.value = n; d.append(o); }
      bulle.append(d); i.setAttribute("list", d.id);
      i.addEventListener("input", () => { q.expression = i.value.trim(); maj(); });
    }
    if (nomChamp === "code") {
      const t = document.createElement("textarea"); t.value = q.code; t.rows = 4; t.style.cssText = "width:100%;font-family:var(--police-code);font-size:14px";
      champ("Code Python", t, "Ce poste vient du code : il se modifie ici ou dans l'éditeur.");
      t.addEventListener("input", () => { q.code = t.value; maj(); });
    }
  }

  const fermer = () => { bulle.remove(); document.removeEventListener("keydown", touches, true); };
  const ok = () => { if (valider.disabled) return; fermer(); surValider(q); };
  const non = () => { fermer(); surAnnuler(); };
  valider.addEventListener("click", ok);
  annuler.addEventListener("click", non);
  function touches(e) {
    if (!bulle.isConnected) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); non(); }
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON" && bulle.contains(e.target)) { e.preventDefault(); ok(); }
  }
  document.addEventListener("keydown", touches, true);

  vue.append(bulle);
  maj();
  // placement : à droite du poste si la place le permet, sinon à gauche ; toujours dans la vue
  const lv = vue.clientWidth, hv = vue.clientHeight, lb = bulle.offsetWidth, hb = bulle.offsetHeight;
  let x = ancre.x + 40; if (x + lb > lv - 8) x = ancre.x - 40 - lb;
  x = Math.max(66, Math.min(x, lv - lb - 8));
  const y = Math.max(8, Math.min(ancre.y - hb / 2, hv - hb - 8));
  bulle.style.left = x + "px"; bulle.style.top = y + "px";
  bulle.querySelector("input, select, textarea")?.focus();
  return { fermer };
}
