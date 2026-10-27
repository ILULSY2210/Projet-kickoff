'use strict';
// Démarrage : génère les sprites, lance la boucle, affiche l'écran titre.
(function () {
  function boot() {
    G.Art.build();
    G.game.init();
    G.ui.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
