// Catalogue des matières (07-materiaux-textures-lumieres.md § 4). Chaque objet de la scène pointe vers
// une entrée de MATIERES. Les valeurs de rugosité et de métal sont des réglages à l'œil.
import * as THREE from "three";
import { texMur, texDanger, texBois } from "./textures.js";

// ----- Palette de la scène (d'après les moodboards du formateur : graphite, orange de sécurité, kraft, inox) -----
export const PAL = {
  graphite: 0x2f3239, graphiteClair: 0x464a54, graphiteSombre: 0x1c1e23, socle: 0x25272d,
  orange: 0xf28c1e, jaune: 0xf5b82e, kraft: 0xc89a63, bois: 0xc58d57, inox: 0xc9ced6,
  caoutchouc: 0x17181b, creme: 0xfff3e0, encre: 0x2b2350,
  reussite: 0x4fc4a0, erreur: 0xf2746b, accent: 0xffc857,
  lueurChaude: 0xffa24a, lueurFroide: 0xbfd6ff, fond: 0x131419,
};

const std = (reglages) => new THREE.MeshStandardMaterial(reglages);

export function creerMatieres(qualite) {
  const haute = qualite === "haute";
  const M = {
    socle: std({ color: PAL.socle, roughness: 0.75, metalness: 0.1 }),
    beton_sol: std({ color: 0xffffff, roughness: 0.82, metalness: 0.0 }),
    mur: std({ color: 0xffffff, map: texMur(), roughness: 0.7, metalness: 0.25 }),
    peinture_metal: std({ color: PAL.graphite, roughness: 0.5, metalness: 0.35 }),
    peinture_claire: std({ color: PAL.graphiteClair, roughness: 0.55, metalness: 0.3 }),
    peinture_sombre: std({ color: PAL.graphiteSombre, roughness: 0.6, metalness: 0.3 }),
    peinture_orange: std({ color: PAL.orange, roughness: 0.45, metalness: 0.25 }),
    peinture_jaune: std({ color: PAL.jaune, roughness: 0.5, metalness: 0.2 }),
    peinture_rouge: std({ color: 0xb8433c, roughness: 0.55, metalness: 0.2 }),
    danger: std({ color: 0xffffff, map: texDanger(), roughness: 0.6 }),
    inox: std({ color: PAL.inox, roughness: 0.28, metalness: 1.0, envMapIntensity: 1.0 }),
    acier_brosse: std({ color: 0xaab0ba, roughness: 0.38, metalness: 1.0 }),
    carton: std({ color: PAL.kraft, roughness: 0.92, metalness: 0.0 }),
    bois_palette: std({ color: 0xffffff, map: texBois(), roughness: 0.82 }),
    caoutchouc: std({ color: PAL.caoutchouc, roughness: 0.95 }),
    plastique_mat: std({ color: PAL.creme, roughness: 0.6 }),
    tissu_gilet: std({ color: PAL.orange, roughness: 0.9 }),
    tissu_sombre: std({ color: 0x2a2d36, roughness: 0.9 }),
    peau: std({ color: 0xe8b796, roughness: 0.8 }),
    reflechissant: std({ color: 0xe9eef5, roughness: 0.35, metalness: 0.6, emissive: 0x8c95a3, emissiveIntensity: 0.25 }),
    casque: haute ? new THREE.MeshPhysicalMaterial({ color: PAL.jaune, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 })
                  : std({ color: PAL.jaune, roughness: 0.3 }),
    verre_fenetre: std({ color: 0x0f1622, roughness: 0.2, emissive: PAL.lueurFroide, emissiveIntensity: 0.55 }),
    neon: std({ color: 0x111111, emissive: 0xfff2dc, emissiveIntensity: 2.2 }),
    bandeau_orange: std({ color: 0x1a1206, emissive: PAL.lueurChaude, emissiveIntensity: 2.0 }),
    led_eteinte: std({ color: 0x1a1c20, emissive: 0x3a3f48, emissiveIntensity: 0.4 }),
  };
  // matières à émission pilotée par le jeu : une instance par objet
  M.led = (couleur = 0x3a3f48, intensite = 0.4) => std({ color: 0x15171b, emissive: couleur, emissiveIntensity: intensite, roughness: 0.4 });
  M.couleur = (hex, r = 0.55, m = 0.1) => std({ color: hex, roughness: r, metalness: m });
  M.ecran = (texture) => std({ color: 0x000000, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 1.0, roughness: 0.25 });
  M.image = (texture, r = 0.8) => std({ color: 0xffffff, map: texture, roughness: r });
  return M;
}
