// Pilote du worker Python : charger, exécuter, interrompre (02-moteur-python.md).

// ----- Réglages -----
export const DELAI_MAX_MS = 5000;        // au-delà, l'exécution est interrompue
const URL_WORKER = new URL("../../worker/python-worker.mjs", import.meta.url);
const URL_MINUTEUR = new URL("../../worker/minuteur.mjs", import.meta.url);

export class PilotePython {
  constructor(surEtat) {
    this.surEtat = surEtat || (() => {});
    this.numero = 0;
    this.attentes = new Map();
    this.pret = null;
    this.version = null;
    this.dureeChargementMs = null;
    this.tampon = null;
    this._demarrer();
  }

  _demarrer() {
    this.surEtat("chargement");
    // L'interruption propre demande un SharedArrayBuffer, donc une page isolée (en-têtes du fichier _headers).
    this.tampon = (self.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined") ? new Uint8Array(new SharedArrayBuffer(1)) : null;
    if (this.tampon && !this.minuteur) this.minuteur = new Worker(URL_MINUTEUR, { type: "module" });
    this.worker = new Worker(URL_WORKER, { type: "module" });
    this.worker.onmessage = (e) => this._recevoir(e.data);
    this.worker.onerror = (e) => this._echecGeneral(e.message || "Le worker Python a rencontré une erreur.");
    this.pret = this._envoyer({ type: "charger", paquets: [], tamponInterruption: this.tampon }).then((m) => {
      this.version = m.versionPython; this.dureeChargementMs = m.dureeMs; this.surEtat("pret", m); return m;
    }).catch((erreur) => { this.surEtat("echec", erreur); throw erreur; });
    this.pret.catch(() => {});
  }

  _envoyer(message) {
    const id = ++this.numero;
    return new Promise((resoudre, rejeter) => { this.attentes.set(id, { resoudre, rejeter }); this.worker.postMessage({ ...message, id }); });
  }

  _recevoir(message) {
    const attente = this.attentes.get(message.id);
    if (!attente) return;
    this.attentes.delete(message.id);
    if (message.type === "erreurInterne") attente.rejeter(new Error(message.message)); else attente.resoudre(message);
  }

  _echecGeneral(texte) {
    for (const a of this.attentes.values()) a.rejeter(new Error(texte));
    this.attentes.clear();
  }

  // Jeu 2 : exécute le Python généré à partir du plateau. Le code est produit par le jeu : pas de boucle sans fin possible,
  // mais le même délai maximal s'applique par prudence.
  async executerLigne(niveau, code, tests, suivre) {
    return this._executerAvecDelai({ type: "executerLigne", jeu: "ligne", niveau, code, tests, suivre }, niveau.id);
  }

  // Atelier : découpe le code en postes. Rapide et sans exécution du code : pas de délai.
  // modules (l'usine) : chaque def d'un programme devient un module qui contient ses postes.
  async analyserAtelier(code, fonction = null, modules = false) {
    await this.pret;
    return this._envoyer({ type: "analyserAtelier", code, fonction, modules });
  }

  // Atelier : exécute le code en suivant chaque ligne (état des variables avant chaque ligne).
  async executerAtelier(mission, code, tests) {
    return this._executerAvecDelai({ type: "executerAtelier", jeu: "atelier", code, tests, mission: { fonction: mission.fonction || null, cas: mission.cas || [], inchange: mission.inchange || false, fichiers: mission.fichiers || null, etoiles: mission.etoiles || null } }, mission.id);
  }

  // Exécute le code du stagiaire sur une mission. Renvoie le résultat du runner.
  async executer(mission, code, tests) {
    return this._executerAvecDelai({ type: "executer", jeu: "missions", missionId: mission.id, mission, code, fichiers: { tests } }, mission.id);
  }

  // Sumo : action de python/sumo_web.py (combat, bilan, tournoi, regles). Le tournoi peut durer : délai propre.
  async sumo(action, args = [], delaiMs = DELAI_MAX_MS, module = "sumo") {
    const r = await this._executerAvecDelai({ type: "sumo", module, action, args }, action, delaiMs);
    return r.donnees || { erreur: r.erreur ? { type: r.erreur.type, message: r.erreur.explication } : { type: "Inconnu", message: "Pas de réponse." } };
  }

  // Championnat des robots : action de python/combat_web.py (combat, bilan, tournoi, regles).
  combat(action, args = [], delaiMs = DELAI_MAX_MS) { return this.sumo(action, args, delaiMs, "combat"); }

  async _executerAvecDelai(message, ident, delaiMs = DELAI_MAX_MS) {
    await this.pret;
    if (this.tampon) this.tampon[0] = 0;
    let arretForce = false;
    const requete = this._envoyer(message);
    // Page isolée : le minuteur, dans son propre fil, écrit le signal d'interruption dans le tampon partagé.
    // Sinon : on arrête le worker et on recharge Python.
    if (this.tampon) this.minuteur.postMessage({ tampon: this.tampon, delaiMs });
    const minuterie = this.tampon ? null : setTimeout(() => {
      arretForce = true; this.worker.terminate(); this._echecGeneral("arret"); this._demarrer();
    }, delaiMs);
    try {
      return await requete;
    } catch (erreur) {
      if (!arretForce) throw erreur;
      return { type: "resultat", missionId: ident, niveauId: ident, sortie: [], journal: [], trace: [], tests: [], nbActions: 0, limiteAtteinte: false, etoiles: [false, false, false],
        erreur: { type: "KeyboardInterrupt", ligne: null, messageOriginal: "Exécution arrêtée",
          explication: "L'exécution a été arrêtée : elle durait trop longtemps.",
          conseil: "Une boucle ne s'arrête probablement jamais : vérifiez sa condition. Python se recharge, patientez quelques secondes." } };
    } finally { clearTimeout(minuterie); if (this.tampon) this.minuteur.postMessage({ annuler: true }); }
  }
}
