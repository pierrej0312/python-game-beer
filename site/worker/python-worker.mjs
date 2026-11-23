// Worker module : charge Pyodide (hébergé sur le site, dossier vendor/pyodide/) et exécute runner.py.
// Protocole : voir 02-moteur-python.md § 3 (messages { type, id, ... }).
import { loadPyodide } from "../vendor/pyodide/pyodide.mjs";

const FICHIERS_MOTEUR = ["erreurs_fr.py", "api_robot.py", "runner.py", "ligne.py", "atelier.py", "combat_web.py"];
const FICHIERS_COMBAT = ["regles.py", "moteur.py", "robots_entrainement.py", "apprentissage.py"];  // le championnat des robots, le même moteur que dans VS Code
// (le sumo, remplacé le 21/11/2026 par le championnat des robots, n'est plus chargé : ses modules portaient les mêmes noms)
let pyodide = null;

async function charger(message) {
  const debut = performance.now();
  pyodide = await loadPyodide({ indexURL: new URL("../vendor/pyodide/", import.meta.url).href });
  pyodide.FS.mkdirTree("/moteur");
  for (const nom of FICHIERS_MOTEUR) {
    const reponse = await fetch(new URL("../python/" + nom, import.meta.url));
    if (!reponse.ok) throw new Error("Fichier du moteur introuvable : " + nom);
    pyodide.FS.writeFile("/moteur/" + nom, await reponse.text());
  }
  pyodide.FS.mkdirTree("/moteur/combat");
  for (const nom of FICHIERS_COMBAT) {
    const reponse = await fetch(new URL("../python/combat/" + nom, import.meta.url));
    if (!reponse.ok) throw new Error("Fichier du championnat introuvable : " + nom);
    pyodide.FS.writeFile("/moteur/combat/" + nom, await reponse.text());
  }
  pyodide.runPython("import sys\nsys.path.insert(0, '/moteur')\nimport json, runner, ligne, atelier, combat_web");
  if (message.tamponInterruption) pyodide.setInterruptBuffer(message.tamponInterruption);
  const version = pyodide.runPython("sys.version.split()[0]");
  self.postMessage({ type: "pret", id: message.id, dureeMs: Math.round(performance.now() - debut), versionPython: version });
}

function executer(message) {
  const debut = performance.now();
  pyodide.globals.set("_code", message.code);
  pyodide.globals.set("_tests", message.fichiers.tests);
  pyodide.globals.set("_mission", JSON.stringify(message.mission));
  let resultat;
  try {
    const json = pyodide.runPython("json.dumps(runner.executer(_code, _tests, json.loads(_mission)), ensure_ascii=False)");
    resultat = JSON.parse(json);
  } catch (erreur) {
    const texte = String(erreur && erreur.message ? erreur.message : erreur);
    if (texte.includes("KeyboardInterrupt")) {
      resultat = { missionId: message.mission.id, sortie: [], journal: [], tests: [], nbActions: 0, limiteAtteinte: false, etoiles: [false, false, false],
        erreur: { type: "KeyboardInterrupt", ligne: null, messageOriginal: "KeyboardInterrupt",
          explication: "L'exécution a été arrêtée : elle durait trop longtemps.",
          conseil: "Une boucle while ne s'arrête probablement jamais : vérifiez sa condition." } };
    } else {
      self.postMessage({ type: "erreurInterne", id: message.id, message: texte });
      return;
    }
  }
  resultat.type = "resultat";
  resultat.id = message.id;
  resultat.dureeMs = Math.round(performance.now() - debut);
  self.postMessage(resultat);
}

// Jeu 2 : exécute le Python généré à partir du plateau (python/ligne.py).
function executerLigne(message) {
  const debut = performance.now();
  pyodide.globals.set("_code", message.code);
  pyodide.globals.set("_tests", message.tests);
  pyodide.globals.set("_niveau", JSON.stringify(message.niveau));
  pyodide.globals.set("_suivre", JSON.stringify(message.suivre));
  let resultat;
  try {
    resultat = JSON.parse(pyodide.runPython("json.dumps(ligne.executer_ligne(_code, json.loads(_niveau), _tests, json.loads(_suivre)), ensure_ascii=False)"));
  } catch (erreur) {
    const texte = String(erreur && erreur.message ? erreur.message : erreur);
    if (!texte.includes("KeyboardInterrupt")) { self.postMessage({ type: "erreurInterne", id: message.id, message: texte }); return; }
    resultat = { niveauId: message.niveau.id, sortie: [], trace: [], journal: [], tests: [], quais: {}, rebut: 0, variables: {},
      erreur: { type: "KeyboardInterrupt", ligne: null, messageOriginal: "KeyboardInterrupt", explication: "La ligne a été arrêtée : elle tournait trop longtemps.", conseil: "Relancez la ligne ; si le problème revient, prévenez le formateur." } };
  }
  resultat.type = "resultat";
  resultat.id = message.id;
  resultat.dureeMs = Math.round(performance.now() - debut);
  self.postMessage(resultat);
}

// Atelier de construction : découpe le code en postes (rapide, sans délai) ou l'exécute en suivant chaque ligne.
function analyserAtelier(message) {
  pyodide.globals.set("_code", message.code);
  pyodide.globals.set("_fonction", message.fonction ? JSON.stringify(message.fonction) : "");
  pyodide.globals.set("_modules", !!message.modules);
  const resultat = JSON.parse(pyodide.runPython("json.dumps(atelier.analyser(_code, json.loads(_fonction) if _fonction else None, modules=_modules), ensure_ascii=False)"));
  self.postMessage({ ...resultat, type: "resultat", id: message.id });
}

function executerAtelier(message) {
  const debut = performance.now();
  pyodide.globals.set("_code", message.code);
  pyodide.globals.set("_tests", message.tests);
  pyodide.globals.set("_mission", message.mission ? JSON.stringify(message.mission) : "");
  let resultat;
  try {
    resultat = JSON.parse(pyodide.runPython("json.dumps(atelier.executer_atelier(_code, _tests, _mission), ensure_ascii=False)"));
  } catch (erreur) {
    const texte = String(erreur && erreur.message ? erreur.message : erreur);
    if (!texte.includes("KeyboardInterrupt")) { self.postMessage({ type: "erreurInterne", id: message.id, message: texte }); return; }
    resultat = { sortie: [], trace: [], tests: [], etatFinal: {},
      erreur: { type: "KeyboardInterrupt", ligne: null, messageOriginal: "KeyboardInterrupt", explication: "L'exécution a été arrêtée : elle durait trop longtemps.", conseil: "Une boucle ne s'arrête probablement jamais : vérifiez sa condition." } };
  }
  resultat.type = "resultat";
  resultat.id = message.id;
  resultat.dureeMs = Math.round(performance.now() - debut);
  self.postMessage(resultat);
}

// Sumo : combat, bilan contre les robots d'entraînement, tournoi (python/sumo_web.py).
function sumo(message) {
  const debut = performance.now();
  pyodide.globals.set("_action", message.action);
  pyodide.globals.set("_args", JSON.stringify(message.args || []));
  let resultat;
  try {
    pyodide.globals.set("_module", "combat_web");
    resultat = JSON.parse(pyodide.runPython("json.dumps(getattr(sys.modules[_module], _action)(*json.loads(_args)), ensure_ascii=False)"));
  } catch (erreur) {
    const texte = String(erreur && erreur.message ? erreur.message : erreur);
    if (!texte.includes("KeyboardInterrupt")) { self.postMessage({ type: "erreurInterne", id: message.id, message: texte }); return; }
    resultat = { erreur: { type: "KeyboardInterrupt", ligne: null, message: "Le calcul a été arrêté : il durait trop longtemps." } };
  }
  self.postMessage({ type: "resultat", id: message.id, dureeMs: Math.round(performance.now() - debut), donnees: resultat });
}

self.onmessage = async (evenement) => {
  const message = evenement.data;
  try {
    if (message.type === "charger") await charger(message);
    else if (message.type === "executer") executer(message);
    else if (message.type === "executerLigne") executerLigne(message);
    else if (message.type === "analyserAtelier") analyserAtelier(message);
    else if (message.type === "executerAtelier") executerAtelier(message);
    else if (message.type === "sumo") sumo(message);
  } catch (erreur) {
    self.postMessage({ type: "erreurInterne", id: message.id, message: String(erreur && erreur.message ? erreur.message : erreur) });
  }
};
