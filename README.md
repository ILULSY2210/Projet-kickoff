# Orbita

Petit jeu mobile à une touche (HTML5, sans dépendance ni outil de compilation : `index.html` et ses scripts `js/`).

**But :** un astre tourne. Touche l'écran pour tirer une aiguille qui se plante dessus.
Si deux aiguilles se touchent, c'est perdu. Plante-les toutes pour passer au niveau suivant.

- **Arcade vectorielle** : tracés lumineux sur fond d'encre, astres en fil de fer, affichage façon tableau de bord.
- **6 mondes de 50 niveaux** (300 niveaux), puis **COSMOS ∞** sans fin : Émeraude (découverte), Ambre (accélération),
  Rubis (précision), Saphir (rotations inversées), Obsidienne (difficulté élevée), Cosmos (défis extrêmes), chacun avec
  sa palette, son astre et sa gamme.
- **Une idée à la fois** : chaque mécanique est enseignée par un niveau court, annoncé par un bandeau (relisible dans la
  pause et la sélection des niveaux) : aiguilles déjà plantées, étoiles, sens de rotation, accélération à chaque aiguille,
  demi-tour annoncé, zones interdites, anneaux à portes, rotation irrégulière, à-coups, arrêts, rampe, fentes, zones
  pulsées et glissantes, inversions, sentinelles, aiguilles traversantes, trois anneaux, portes pulsées.
- Les **chevrons** du pas de tir annoncent 0,45 s à l'avance chaque arrêt, reprise ou inversion de la rotation.
- Un **boss** tous les 10 niveaux (Réacteur, Pendule, Forteresse, Anneaux, Chaos, de plus en plus durs) ; un niveau
  spécial en x7 (ils se jouent pour l'instant comme des niveaux normaux, sur leur terrain).
- **Difficulté mesurée** : chaque niveau est réglé par un joueur simulé qui joue le vrai code du jeu (`tests/sim/`) :
  les premiers mondes restent accessibles, les derniers sont durs, et aucun niveau n'est injuste (≥ 75 % de victoires
  pour un joueur précis à 30 ms). Taper à l'aveugle ne fait plus passer de niveau après le premier monde.
- **3 étoiles par niveau** : finir le niveau, plus des étoiles bonus à décrocher.
- Chaque aiguille plantée joue une note de la gamme du monde.
- Progression sauvegardée (et reprise depuis l'ancienne version, sans étoiles offertes), sons générés, installable sur
  l'écran d'accueil (PWA, hors ligne).

## Un tir juste, sur tous les écrans

- **Le tir part à l'instant exact du toucher** (horodatage de l'événement), et l'aiguille vole **60 ms** sur tous
  les téléphones : le même geste donne le même résultat partout.
- **Ce que tu vois est ce qui compte** : deux têtes d'aiguilles se touchent à l'écran exactement quand c'est perdu,
  et un **arc allumé** du bord est toujours une zone sûre, y compris avec les aiguilles traversantes.
- **Un rebond de doigt ne tue plus** : un second toucher à moins de 40 ms est ignoré ; au-delà, chaque toucher tire
  aussitôt (deux aiguilles au plus en vol).
- **REPRENDRE** après une pause : compte à rebours 3-2-1 de 0,6 s avant que l'astre ne reparte.
- **Échec lisible** : la feuille arrive en 0,45 s, la collision reste visible au-dessus d'elle, la cause est dite en
  clair (« Il manquait 3° », « Aiguille plantée en pleine zone interdite »…) et rappelée au-dessus du pas de tir après
  la relance ; un toucher sur la feuille relance, et le tir suivant n'est accepté qu'après 250 ms.
- Simulation à pas fixe (1/120 s) : le jeu garde sa vitesse même quand le téléphone peine, et reste fluide à 90 ou 120 Hz.

## Jouer

Ouvre `index.html` dans un navigateur. Pour jouer sur téléphone, active **GitHub Pages**
(Settings → Pages → branche, dossier `/`), ouvre l'adresse sur ton mobile, puis fais
« Ajouter à l'écran d'accueil ». Sur le réseau local : `node tests/lib/serve.js 8080`, puis
`http://<adresse de l'ordinateur>:8080/` sur le téléphone.

## Développement

- Plan de développement, architecture et spécification : `docs/ANALYSE-ET-PLAN.md` ; cahier des charges :
  `docs/cahier-des-charges.md`.
- Tests : voir `tests/README.md`. Après toute modification d'un fichier du jeu, `node tests/unit/sw.test.js --bump`
  (nouvelle version du service worker, sinon les joueurs garderaient l'ancienne).
