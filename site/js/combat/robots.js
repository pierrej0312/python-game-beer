// Les robots d'entraînement, traduits de robots_entrainement.py (mêmes décisions, même tirage pour le hasard).
import { R } from "./regles.js";
import { cout } from "./moteur.js";

export function hasard(graine = 2026) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const peut = (etat, action) => etat.moi.energie >= cout(action);

export function boxeur(etat) {
  const adv = etat.adversaire, d = etat.distance;
  if (adv.phase === "recuperation" && d <= 140 && peut(etat, "crochet")) return "crochet";
  if (adv.action === "garde" && d <= 140 && peut(etat, "coup_bas")) return "coup_bas";
  if (d <= 160 && peut(etat, "direct")) return "direct";
  if (d <= 160) return "garde";
  return "avancer";
}
export function cogneur(etat) {
  const d = etat.distance;
  if (d <= 150 && peut(etat, "special")) return "special";
  if (d <= 140 && peut(etat, "crochet")) return "crochet";
  if (d <= 140) return "reculer";
  return "avancer";
}
export function mur(etat) {
  const adv = etat.adversaire, d = etat.distance;
  if (["recuperation", "sonne"].includes(adv.phase) && d <= 140 && adv.reste >= 5 && peut(etat, "crochet")) return "crochet";
  if (["recuperation", "sonne"].includes(adv.phase) && d <= 160 && peut(etat, "direct")) return "direct";
  if (["preparation", "frappe"].includes(adv.phase) && d <= 200) return ["coup_bas", "projection"].includes(adv.action) ? "garde_basse" : "garde";
  if (d > 170) return "avancer";
  return "garde";
}
export function lutteur(etat) {
  const adv = etat.adversaire, d = etat.distance;
  if (adv.action === "garde" && d <= 110 && peut(etat, "projection")) return "projection";
  if (adv.action === "garde_basse" && d <= 160 && peut(etat, "direct")) return "direct";
  if (d > 110) return "avancer";
  if (peut(etat, "direct")) return "direct";
  return "garde";
}
export function danseur(etat) {
  const adv = etat.adversaire, d = etat.distance;
  if (adv.phase === "preparation" && d <= 170 && peut(etat, "esquive")) return "esquive";
  if (["recuperation", "sonne"].includes(adv.phase) && d <= 160 && peut(etat, "direct")) return "direct";
  if (d < 180 && etat.moi.bord_derriere > 50) return "reculer";
  if (d > 220) return "avancer";
  return "garde";
}
export function fabriquerHasard(graine = 2026) {
  const h = hasard(graine);
  return (etat) => { const possibles = R.ACTIONS.filter((a) => peut(etat, a)); return possibles[Math.floor(h() * possibles.length)]; };
}
export const REFERENCES = { boxeur, cogneur, mur, lutteur, danseur };
export const adversaires = () => ({ ...REFERENCES, hasard: fabriquerHasard() });
export const DESCRIPTIONS = {
  boxeur: "enchaîne les directs, balaie les gardes hautes", cogneur: "cherche le gros coup", mur: "garde haute ou basse, puis contre-attaque",
  lutteur: "attrape les gardes hautes, frappe les gardes basses", danseur: "esquive et frappe à distance", hasard: "joue au hasard",
};
