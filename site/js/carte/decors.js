// Les huit halls de la carte des missions. Les fonds sont des peintures (assets/carte/serie-0N.jpg, 1672 × 941) ;
// toutes les positions sont en pixels de ces images, relevées sur les dalles en cuivre peintes.
// arrets : les dalles de la route, dans l'ordre des missions (hors bonus) ; bonus : la dalle au bout de l'embranchement.

export const LARGEUR = 1672, HAUTEUR = 941;
export const ENTREE = { x: 112, y: 470 }, SORTIE = { x: 1560, y: 470 };      // les arches, identiques dans les huit halls

const LAMPES_A = [[285, 128], [700, 128], [975, 128], [1390, 128]];          // halls 1 à 3
const LAMPES_B = [[285, 125], [550, 125], [840, 125], [1125, 125]];          // halls 4 à 8

export const DECORS = {
  1: { image: "assets/carte/serie-01.jpg", lampes: LAMPES_A,
       arrets: [[410, 594, 150, 50], [836, 594, 150, 50], [1263, 593, 150, 50]] },
  2: { image: "assets/carte/serie-02.jpg", lampes: LAMPES_A,
       arrets: [[529, 597, 148, 50], [1141, 597, 148, 50]] },
  3: { image: "assets/carte/serie-03.jpg", lampes: LAMPES_A,
       arrets: [[435, 599, 136, 46], [830, 599, 136, 46], [1237, 599, 136, 46]], bonus: [982, 726, 106, 44],
       effets: [{ type: "voyant", x: 595, y: 368, couleur: "#3bff7a" }, { type: "voyant", x: 790, y: 366, couleur: "#ff3b3b", decalage: 0.7 },
                { type: "voyant", x: 1075, y: 368, couleur: "#3bff7a", decalage: 1.3 }] },
  4: { image: "assets/carte/serie-04.jpg", lampes: LAMPES_B,
       arrets: [[434, 598, 136, 46], [830, 598, 136, 46], [1237, 598, 136, 46]], bonus: [981, 692, 98, 34] },
  5: { image: "assets/carte/serie-05.jpg", lampes: LAMPES_B,
       arrets: [[434, 598, 136, 46], [830, 598, 136, 46], [1237, 598, 136, 46]], bonus: [981, 692, 98, 34] },
  6: { image: "assets/carte/serie-06.jpg", lampes: LAMPES_B,
       arrets: [[541, 598, 134, 46], [1130, 598, 134, 46]], bonus: [745, 702, 92, 32] },
  7: { image: "assets/carte/serie-07.jpg", lampes: LAMPES_B,
       arrets: [[366, 606, 122, 42], [678, 606, 122, 42], [991, 606, 122, 42], [1312, 606, 122, 42]],
       effets: [{ type: "vapeur", x: 690, y: 370 }, { type: "lueur", x: 990, y: 425, couleur: "#38f0e0" }] },
  8: { image: "assets/carte/serie-08.jpg", lampes: LAMPES_B,
       arrets: [[433, 598, 136, 46], [830, 598, 136, 46], [1238, 598, 136, 46]], bonus: [981, 692, 98, 34],
       effets: [{ type: "ecran", x: 555, y: 396, couleur: "#4cff8a" }] },
};
