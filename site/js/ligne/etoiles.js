// Jeu 2 : les trois étoiles d'un niveau (05-jeu2-builder.md, même principe que le jeu 1).
// 1 : les tests du brassin du jour passent ; 2 : la mesure du plateau (cases de tapis ou pièces posées) ne dépasse pas le seuil ;
// 3 : les tests du brassin du lendemain passent. Les étoiles 2 et 3 demandent l'étoile 1.
export function mesure(niveau, plateau) {
  return niveau.etoiles.critere === "pieces" ? plateau.nbPiecesPosees() : plateau.nbCasesTapis();
}

export function etoiles(niveau, plateau, resultat) {
  if (!resultat || resultat.erreur) return [false, false, false];
  const visibles = resultat.tests.filter((t) => t.groupe === "visible"), bonus = resultat.tests.filter((t) => t.groupe === "bonus");
  const e1 = visibles.length > 0 && visibles.every((t) => t.ok);
  return [e1, e1 && mesure(niveau, plateau) <= niveau.etoiles.max, e1 && bonus.length > 0 && bonus.every((t) => t.ok)];
}
