// Le journal d'actions en phrases : sert de vue en mode sans 3D, et de légende sous la vue 3D.

const RAISONS = {
  mains_pleines: "Le préparateur porte déjà un objet.", rien_devant: "Il n'y a rien devant lui.", mains_vides: "Le préparateur ne porte rien.",
  objet_absent: "Cet objet n'est pas dans l'entrepôt.", quai_inconnu: "Ce quai n'existe pas.", mauvais_quai: "Ce n'est pas le bon quai.",
  obstacle: "Un obstacle lui barre la route.", chariot_plein: "Le chariot est plein : le fût ne monte pas.", quai_vide: "Il ne reste aucun fût sur le quai.",
  cuve_inconnue: "Cette cuve n'existe pas.", rayon_inconnu: "Ce rayon n'existe pas.", limite_actions: "Trop d'actions : la boucle ne s'arrête pas.",
};

export function decrire(a) {
  let phrase;
  switch (a.action) {
    case "prendre": phrase = a.objet ? `Le préparateur prend ${a.objet}.` : "Le préparateur veut prendre un objet."; break;
    case "livrer": phrase = `Il livre ${a.objet || "l'objet"} au quai ${a.quai}.`; break;
    case "ecran": phrase = `L'écran affiche : ${a.texte}`; break;
    case "controle": phrase = `Contrôle ${a.lieu} : ${a.texte}`; break;
    case "etiqueter": phrase = `Au pupitre, il colle l'étiquette : ${a.texte}`; break;
    case "ranger": phrase = `Il range ${a.objet || "l'objet"} au ${a.rayon}.` + (a.texte ? ` Écran du rayon : ${a.texte}` : ""); break;
    case "embouteiller": phrase = `Il vide ${a.objet || "le fût"} en bouteilles : ${a.texte} bouteilles sur le chariot.`; break;
    case "charger": phrase = a.ok ? `Un fût monte sur le chariot : ${a.total} sur 4.` : "Le préparateur veut charger un fût."; break;
    case "avancer": phrase = "Le préparateur avance d'une case."; break;
    case "tourner": phrase = `Il tourne à ${a.sens}.`; break;
    case "poser": phrase = "Il pose l'objet."; break;
    case "lire": phrase = "Il lit l'étiquette."; break;
    case "scanner": phrase = "Il scanne l'allée."; break;
    case "stock": phrase = "Il consulte le stock."; break;
    case "signaler": phrase = `Il signale : ${a.texte}`; break;
    case "etourdi": phrase = "Le préparateur est étourdi."; break;
    default: phrase = a.action;
  }
  if (!a.ok && a.raison && RAISONS[a.raison]) phrase += " " + RAISONS[a.raison];
  return phrase;
}

export function creerVueTexte(conteneur) {
  conteneur.innerHTML = "";
  const liste = document.createElement("ol");
  liste.className = "journal-texte";
  conteneur.appendChild(liste);
  return {
    vider(message) { liste.innerHTML = ""; if (message) { const li = document.createElement("li"); li.className = "journal-info"; li.textContent = message; liste.appendChild(li); } },
    ajouter(a) {
      const li = document.createElement("li");
      li.className = a.ok ? "journal-ok" : "journal-echec";
      const marque = document.createElement("span"); marque.className = "marque"; marque.textContent = a.ok ? "OK" : "ÉCHEC";
      li.append(marque, " " + decrire(a) + (a.ligne ? `  (ligne ${a.ligne})` : ""));
      liste.appendChild(li); li.scrollIntoView({ block: "nearest" });
    },
  };
}
