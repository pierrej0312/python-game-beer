// Minuteur d'interruption : il tourne dans son propre fil, donc il déclenche à l'heure même quand la page est occupée par la 3D.
// Message { tampon, delaiMs } : arme le minuteur. Message { annuler: true } : le désarme.
let minuterie = null;
self.onmessage = (e) => {
  clearTimeout(minuterie);
  if (e.data.annuler) return;
  const { tampon, delaiMs } = e.data;
  minuterie = setTimeout(() => { tampon[0] = 2; }, delaiMs);     // 2 = SIGINT : Pyodide lève KeyboardInterrupt
};
