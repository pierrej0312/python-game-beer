// Accueil : pseudo, qualité, mode sans 3D. Python commence à se charger ici, pour être prêt sur la carte.
import * as progression from "./commun/progression.js";
import { PilotePython } from "./commun/python.js";

const p = progression.lire();
const pseudo = document.getElementById("pseudo"), sans3d = document.getElementById("sans3d"), etat = document.getElementById("etat-python");
pseudo.value = p.pseudo || "";
sans3d.checked = Boolean(p.sans3d);
for (const radio of document.querySelectorAll('input[name="qualite"]')) radio.checked = radio.value === (p.qualite || "haute");

new PilotePython((nom) => {
  if (nom === "pret") { etat.textContent = "Python est prêt"; etat.className = "etat-python pret"; }
  if (nom === "echec") { etat.textContent = "Python n'a pas pu se charger sur ce poste. Rechargez la page ; si le problème continue, prévenez le formateur."; etat.className = "etat-python echec"; }
});

document.getElementById("formulaire").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  progression.reglage("pseudo", pseudo.value.trim());
  progression.reglage("sans3d", sans3d.checked);
  progression.reglage("qualite", document.querySelector('input[name="qualite"]:checked').value);
  const cible = evenement.submitter && evenement.submitter.dataset.cible ? evenement.submitter.dataset.cible : "missions.html";
  location.href = cible + location.search;
});
