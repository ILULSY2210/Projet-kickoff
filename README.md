# Orbita

Petit jeu mobile à une touche (HTML5, sans dépendance ni outil de compilation : `index.html` et ses scripts `js/`).

**But :** un astre tourne. Touche l'écran pour lancer une aiguille qui se plante dessus.
Si deux aiguilles se touchent, c'est perdu. Plante-les toutes pour passer au niveau suivant.

- **Arcade vectorielle** : tracés lumineux sur fond d'encre, astres en fil de fer, affichage façon tableau de bord.
- **8 mondes** de 5 niveaux (Émeraude, Ambre, Givre, Braise, Iris, Soufre, Opale, Cobalt), chacun avec sa couleur,
  son astre et sa règle : rotation qui s'inverse, arcs interdits, rotation pas à pas, sentinelle en orbite…
- Un **boss** à la fin de chaque monde, puis des variantes sans fin.
- **3 étoiles par niveau** : finir le niveau, plus des étoiles bonus à décrocher.
- Chaque aiguille plantée joue une note de la gamme du monde.
- Difficulté équilibrée : tous les niveaux sont vérifiés jouables par un bot de test.
- Progression sauvegardée, sons générés, installable sur l'écran d'accueil (PWA, hors-ligne).

## Jouer

Ouvre `index.html` dans un navigateur. Pour jouer sur téléphone, active **GitHub Pages**
(Settings → Pages → branche, dossier `/`), ouvre l'adresse sur ton mobile, puis fais
« Ajouter à l'écran d'accueil ».
