// Envoi des résultats au formateur par Netlify Forms (03-jeu1-missions.md § 9).
// Les formulaires cachés sont déclarés dans les pages : « resultat-missions » (missions.html), « resultat-ligne » (ligne.html).
// Aucun code ni plateau de stagiaire n'est envoyé.

export const NOM_FORMULAIRE = "resultat-missions";

export async function envoyer(champs, formulaire = NOM_FORMULAIRE) {
  const corps = new URLSearchParams({ "form-name": formulaire, ...champs }).toString();
  const reponse = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: corps });
  if (!reponse.ok) throw new Error("Le site a répondu " + reponse.status);
  return true;
}
