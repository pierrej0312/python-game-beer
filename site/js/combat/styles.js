// Les styles de robot (le modèle 3D) : le robot en formes simples, plus ceux du catalogue robots/catalogue.json.
// Le style ne change rien au combat : seulement l'apparence et les animations.
import { lireCatalogue } from "./robot-modele.js";

export async function listeStyles() {
  const cat = await lireCatalogue();
  // un robot qui attend son jeu d'animations (pas encore converti) n'est pas proposé : il resterait figé dans l'arène
  const prets = cat.robots.filter((r) => !r.animations || r.animations === "integrees" || cat.animations?.[r.animations]);
  return [...prets.map((r) => ({ id: r.id, nom: r.nom, portrait: r.portrait || null, credit: r.credit || "" })),
    { id: "simple", nom: "Robot de base", portrait: cat.portrait_simple || null, credit: "" }];
}

// Un style stable pour un robot qui n'en a pas choisi (robots d'entraînement, anciens envois) : tiré de son nom.
export function styleParDefaut(nom, liste, sauf = null) {
  const choix = liste.filter((s) => s.id !== sauf && s.id !== "simple");
  const pool = choix.length ? choix : liste;
  let h = 0; for (const c of String(nom)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length].id;
}

export function remplirChoix(select, liste, valeur) {
  select.innerHTML = "";
  for (const s of liste) { const o = document.createElement("option"); o.value = s.id; o.textContent = s.nom; select.append(o); }
  select.value = liste.some((s) => s.id === valeur) ? valeur : liste[0].id;
  return select.value;
}
