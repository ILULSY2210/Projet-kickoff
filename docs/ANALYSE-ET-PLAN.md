# ORBITA — Analyse du code existant et plan de développement

*Étapes 1 à 4 du cahier des charges (`docs/cahier-des-charges.md`, section 11) : analyser le code, lister ce qui fonctionne, lister les défauts, proposer l'architecture d'amélioration et le plan par étapes. Aucun code de jeu n'est modifié par ce document.*

- Version analysée : commit `ad561a3` de la branche de travail (`index.html`, 1 495 lignes).
- Références de lignes : toutes les mentions « l. N » renvoient à `index.html` dans cette version.
- Méthode : lecture intégrale du code, banc d'essai `tests/shoot.js` relancé, profil d'image et d'allocations sous Chromium (Playwright + CDP), simulateur de joueur humain bruité (validé sur le vrai jeu : 3 836 tentatives rejouées sur 3 840 donnent le même résultat) relancé sur les niveaux 1 à 120, et revérification des constats de la revue indépendante sur lesquels ce plan s'appuie (section 1.11).
- Révision 2 (16 novembre 2026) : plan corrigé après une relecture critique ; ce qui a changé, et pourquoi, est résumé à l'annexe B.

---

## 0. Résumé pour le porteur du projet

**Ce qui marche et qu'on garde.** Le cœur est sain : un seul geste, des niveaux déterministes, une collision juste au degré près sur les niveaux normaux, un arc lumineux qui montre exactement où l'on peut planter, un viseur d'avance, un oscilloscope qui annonce la rotation 1,75 s à l'avance, six lois de rotation, des arcs interdits, une sentinelle, des aiguilles traversantes, des étoiles bonus, le « FRÔLÉ », un son 100 % synthétisé qui joue la gamme du monde, et un rendu « arcade vectorielle » soigné qui tient 60 images/s sur ordinateur avec 1 ms de calcul par image. Le banc d'essai passe (`pass: true`).

**Les trois problèmes qui comptent le plus pour un joueur sur téléphone.**
1. **Le jeu est beaucoup trop facile et trop court.** Un joueur qui vise avec 70 ms d'imprécision gagne 99 à 100 % des niveaux 1 à 120 ; un niveau dure 1,4 à 5,5 s ; les boss ont *moins* d'aiguilles (5,3) que les niveaux normaux (5,5) ; taper à l'aveugle (à la meilleure cadence) finit en moyenne 45 % des niveaux 1 à 40 du premier coup.
2. **L'échec est mal servi.** Un rebond de doigt (double tap) tue à coup sûr (40 sur 40 aux niveaux 1, 2, 3, 8, 21) ; la feuille d'échec cache le point d'impact sur les téléphones de moins de ~700 px de haut ; un tap entre 0,28 et 0,7 s relance en silence sans jamais montrer pourquoi on a perdu.
3. **Il manque tout ce qui donne envie de rejouer** : ni score, ni combo, ni tir parfait, ni record, ni vrai boss, ni niveaux spéciaux, ni musique ; les étoiles ne débloquent rien ; après le monde 8 tout recommence en chiffres romains.

S'y ajoutent des défauts d'interface ou de robustesse : écran noir si le réseau traîne (la police Google bloque le démarrage), rendu à 60 images/s même sur les écrans immobiles (batterie), 2,7 Mo alloués par seconde de jeu, mode paysage cassé, petits textes peu contrastés.

**Décisions proposées.**
- **On découpe `index.html` en scripts classiques** (`js/config.js`, `js/levels.js`, `js/core.js`, `js/render.js`…), sans outil de compilation ni module ES : le jeu reste un dossier qu'on ouvre dans un navigateur, le banc d'essai continue de fonctionner par `file://`, et le vrai code du jeu devient utilisable directement par les outils de réglage de la difficulté. Le premier commit déplace le code **sans en changer le comportement** (vérifié par un vidage identique des niveaux, par le banc d'essai et par un test qui actionne chaque bouton et chaque touche).
- **Structure : 6 mondes de 50 niveaux (300 niveaux) puis « COSMOS ∞ » sans fin**, un boss tous les 10 niveaux (30 boss : les 5 mécaniques du cahier des charges, chacune en 6 paliers, de la plus simple à la plus dure), un niveau spécial par bloc de 10, deux niveaux de respiration après chaque boss.
- **Une idée à la fois, boss compris** : aucun niveau n'utilise une mécanique jamais vue, sauf un niveau d'apprentissage court qui en ajoute une seule. En Émeraude, chaque boss est précédé du niveau qui enseigne sa mécanique. Vérifié automatiquement sur les niveaux 1 à 400.
- **Tir PARFAIT = aiguille plantée au milieu d'un intervalle libre**, à ±35 ms de rotation près (bornée en angle). Le milieu de chaque arc allumé porte un repère aussi large que la tolérance, et un raté de peu affiche « TÔT » ou « TARD ». C'est aussi le tir le plus sûr : le parfait récompense le bon jeu au lieu de le contredire.
- **Une collision qui correspond exactement au dessin, et le même timing sur tous les écrans** : vol de 60 ms partout, positions physiques indépendantes de l'écran, dessin calé sur elles.
- **Démarrage fiable** : polices hébergées avec le jeu, service worker qui installe chaque version d'un bloc (jamais de mélange de fichiers de deux versions), garde-fou qui remplace tout écran noir par « TOUCHE POUR RECHARGER ».
- **Sauvegarde v2** dans une clé versionnée (avec la renumérotation des niveaux), migration de l'ancienne progression sans étoiles offertes, sauvegarde automatique, échec enregistré à l'instant même, et **reprise de la partie en cours après fermeture** par relecture des instants de tir.
- **Difficulté pilotée par des mesures** faites sur le vrai code du jeu : chaque monde a une cible chiffrée (taux de victoire du joueur simulé à 30 ms et 70 ms d'imprécision), vérifiée automatiquement avec des échantillons assez grands pour trancher ; aucun niveau sous 75 % à 30 ms (plancher d'équité), les derniers mondes entre 20 et 45 % à 70 ms.

**Plan.** Sept étapes pour une première version entièrement jouable : (1) fondations, lancer, collision et échec ; (2) structure en 6 mondes et difficulté, c'est-à-dire la fin du « trop facile » ; (3) combo, score, parfait et étoiles ; (4) boss et niveaux spéciaux ; (5) animations, effets, son et musique ; (6) menus, mondes, récompenses, reprise après fermeture et optimisation mobile ; (7) contrôle qualité final. Le porteur reçoit une version jouable à essayer sur son téléphone à la fin des étapes 2 et 4. La phase 2 (collection, défis quotidiens et hebdomadaires, succès, défi à deux, classements, monétisation respectueuse) ne commence qu'une fois le jeu jouable et équilibré. Chaque étape a des tests d'acceptation chiffrés (section 6) et chaque exigence du cahier des charges est rattachée à une étape et à une vérification (section 7).

---

## 1. Analyse du code existant

### 1.1 Inventaire

| Fichier | Rôle | Taille |
|---|---|---|
| `index.html` | Tout le jeu : CSS en ligne (l. 16-147), DOM des écrans (l. 149-233), un seul script classique (l. 235-1493) | 1 495 lignes, 91 Ko |
| `sw.js` | Service worker « réseau d'abord, cache en secours », cache `orbita-v3` (4 fichiers) | 14 lignes |
| `manifest.webmanifest` | PWA, portrait, icône SVG unique | 13 lignes |
| `icon.svg` | Icône vectorielle (bonne, dans la zone sûre « maskable ») | 2,8 Ko |
| `tests/shoot.js`, `tests/sheet.py` | Banc d'essai Playwright (bot, captures, balayage d'équité 1..60) et planches de captures | 141 + 23 lignes |
| `docs/` | Cahier des charges et capture de référence | — |

Aucune dépendance, aucun outil de compilation. Seule ressource externe : la feuille de style Google Fonts (B612, B612 Mono), l. 15.

### 1.2 Architecture et flux de données

Un script unique, organisé en sections commentées, partage tout son état par des variables globales.

| Lignes | Section | Contenu |
|---|---|---|
| 236-243 | Globals | canvas principal `cvs/ctx`, couche phosphore `glow/gctx` (demi-résolution, `GS = .5`), fond pré-rendu `bg`, constantes `GAP = .115` rad (distance minimale entre deux aiguilles), `ORBHIT = .2` rad (capture d'étoile), `TILT`, variables de mise en page |
| 245-254 | Sauvegarde | `store.get/set` (préfixe `orbita_`, JSON, try/catch), `unlocked`, `bestStars`, `soundOn` |
| 256-282 | Utilitaires | générateur pseudo-aléatoire `rng(seed)`, `angDiff`, `norm`, `clamp`, `lerp`, `easeOut`, `vib`, préférence « mouvement réduit », cache de couleurs `col()` |
| 284-354 | Police vectorielle « Trace » | glyphes en traits sur grille 4×6, `vtext` (canvas), `vsvg/setVT` (DOM) : aucun `fillText`, le canvas ne dépend pas des polices web |
| 356-438 | Solides filaires | icosaèdre, dodécaèdre, octaèdre, cuboctaèdre, étoile octangle, cristal, tesseract, planète annelée, sphère armillaire ; projection perspective `project()` |
| 440-463 | Mondes | `WORLDS` (8 mondes : couleur, accent, gamme musicale, règle), `worldInfo()` (cycles en chiffres romains), `setTheme()` (variables CSS) |
| 465-556 | Niveaux | `SPEC[monde][position]`, `patSpeed()` (6 lois de rotation), `unionMeasure()`, `makeLevel(n)`, `speedAt(t)` |
| 558-641 | Son | contexte WebAudio paresseux, compresseur, écho, `voice/bell/noise`, `sfx(k)` (13 sons) |
| 643-679 | État et mise en page | variables d'état (l. 644-650), `layout()`, `resize()` |
| 681-721 | Fond et arcs libres | `buildBg()` (dégradé, trame, cercles de portée, réticule, cadre, vignette), `computeArcs()` |
| 723-855 | Règles | `startLevel`, `throwPin`, particules, `fail`, `win`, `explodeScene`, `stick` (collision), `predictRot`, `window.__botSafe` |
| 857-950 | Simulation | `update(dt)` (rotation, vol, sentinelle, atterrissage exact, viseur, transitions), `updDemo` (démo du menu) |
| 952-1351 | Rendu | `syncScene`, `drawDial`, `drawBody`, `drawFx`, `drawGame`, `drawHud`, `drawIntro`, `drawWinStars`, `drawMenuScene`, `draw(dt)` |
| 1353-1359 | Boucle | `requestAnimationFrame`, `dt` plafonné à 33 ms |
| 1361-1447 | Écrans DOM | menu, niveaux, victoire, échec, pause |
| 1448-1492 | Entrées et démarrage | boutons, `tap()`, `pointerdown`, clavier, `visibilitychange`, enregistrement du service worker |

Flux d'une image :

```
requestAnimationFrame(loop) ── dt = min(33 ms, now - last)
  ├─ update(dt)          [sauf en pause]
  │    temps t, rotation rot += speedAt(t)·dt
  │    aiguille en vol : y -= FLYV·dt → test sentinelle → contact (cy+R) → stick(angle exact)
  │    stick : collision (GAP), traversante, FRÔLÉ, étoiles → win() si plus d'aiguille
  │    transitions : dying → showFail (0,7 s), winning → explosion (0,26 s) → showWin (1,15 s)
  │    particules, textes, secousse
  └─ draw(dt)
       fond pré-rendu → couche phosphore (effacement partiel + traits épais, 1/2 résolution)
       → composition « lighter » plein écran → passe nette (cadran, astre, HUD, bandeaux) → balayage
Entrées : pointerdown (canvas) → tap() → throwPin() ou relance ; boutons DOM → startLevel/showMenu…
```

### 1.3 Machine à états

États : `menu`, `levels`, `play`, `pause`, `dying`, `winning`, `won`, `failed` (variable `state`, l. 644).

```
menu ──JOUER/CONTINUER──► play ◄──REPRENDRE── pause ◄──bouton ‖, P, onglet masqué── play
  ▲   ◄──NIVEAUX──► levels ──case──► play
  │                                   │ collision                      │ dernière aiguille plantée
  │                                   ▼                                ▼
  │                              dying (0,7 s) ──► failed         winning (1,15 s) ──► won
  │                      tap après 0,28 s ──► play (relance)      SUIVANT / REJOUER ──► play
  └────────────────── MENU (depuis failed, won, pause) ────────────────────────────────┘
```

- Toutes les transitions passent par `update(dt)` (l. 901-909) ou par des appels explicites (`startLevel`, `showMenu`…) : l'horloge murale n'est lue que dans `loop()` (et pour recaler `last` à la reprise, l. 1447 et 1486). C'est ce qui permet au banc d'essai de jouer 60 niveaux en accéléré.
- Un tap pendant `dying` après 0,28 s relance le niveau (l. 1469 et 1478) **avant** l'apparition de la feuille d'échec (0,7 s, l. 901) : voir défaut D4.
- `visibilitychange` met en pause (l. 1486) ; il n'existe aucune reprise après fermeture de l'application.

### 1.4 Générateur de niveaux (`makeLevel`, l. 497-555)

- **Déterministe** : graine `rng(n * 7919 + 17)` (l. 499). Le niveau n est toujours identique ; seule la rotation de départ (`rot = 0`, l. 728) et la phase `t = L.phase` le complètent.
- **Monde et position** : `w = floor((n-1)/5)`, `pos = (n-1) % 5`, boss si `pos === 4` (l. 500). Les mondes 1 à 8 lisent la table `SPEC` (l. 468-477 : loi de rotation, dosage dense/rapide, disposition, sentinelles, traversantes) ; au-delà, tirage aléatoire graine (l. 505-513).
- **Difficulté** : `d = 1 - exp(-(n-1)/26)` plus un décalage de position (l. 502) ; elle sature vers n ≈ 100.
- **Budget d'obstacles** : au plus 14 « équivalents aiguilles » sur l'astre (l. 515), où une aiguille isolée compte 3,4 × GAP de bord interdit au joueur prudent (l. 530-532). Le nombre de tirs est le budget moins les obstacles (l. 533-535).
- **Dispositions** : `scatter`, `pairs`, `fan`, `sym`, `wall`, `wall+`, `wall2` (l. 523-529) ; un arc interdit (« wall ») est stocké comme une suite de bloqueurs invisibles espacés de ≤ 1,9 × GAP (l. 522 et 554).
- **Vitesse** : déduite d'une fenêtre de tir visée `tau` (0,34 s au début, plancher 0,1 s, 0,08 s pour un boss, l. 539) puis bornée entre 1,3 et 2,9 rad/s (l. 541-542). La revue a mesuré que les fenêtres réelles sont 2 à 2,4 fois plus larges que `tau` : c'est la cause directe de la facilité (défaut D1).
- **Étoiles bonus** : 1 à 3 par niveau (l. 544-548) ; **sentinelles** : arcs en orbite à contre-sens (l. 550-551) ; `vmax` sert à l'échelle de l'oscilloscope (l. 552).
- **Lois de rotation** `patSpeed` (l. 478-487) : 0 continue, 1 respiration, 2 alternée (inversions douces), 3 à-coups, 4 pas à pas (arrêts), 5 ressac (retours en arrière partiels). Toutes sont des fonctions périodiques sans hasard, donc prévisibles et prévisualisées par l'oscilloscope.

### 1.5 Lancer, vol et collision

- `throwPin()` (l. 742-750) crée l'aiguille au pas de tir `LAUNCH` ; si une aiguille vole déjà, le tap est **mis en file** (`queued`, l. 744) et relâché à l'impact (l. 839).
- Vol vertical à `FLYV = 6 × H` px/s (l. 662) : la durée du vol dépend donc de l'écran (mesuré : 56 ms en 320×568, 64,5 ms en 390×844).
- Contact quand la pointe atteint le bord (`cy + R`) ; l'angle d'impact est **corrigé du dépassement** de la dernière image (l. 890-894) : la position d'atterrissage ne dépend pas de la cadence d'image.
- Collision (`stick`, l. 807-840) : défaite si l'écart angulaire avec une aiguille, un bloqueur ou un point d'arc interdit est inférieur à `GAP` (0,115 rad = 6,6°) ; pour les traversantes, on teste aussi le point de sortie opposé (l. 810-811). FRÔLÉ si l'écart est inférieur à 2 × GAP (l. 821-828). Étoile capturée à moins de `ORBHIT` = 0,2 rad (l. 829-837).
- Les têtes sont dessinées avec un rayon `HEAD = (GAP - 0,012) × (R + PL) / 2` (l. 657) : deux têtes se touchent visuellement à GAP − 0,012 rad, alors que la défaite est déclarée à GAP. Le jeu tue donc environ 1,7 px avant le contact visible (écart faible mais systématique).
- Sentinelle : test d'intervalle pendant la traversée de son orbite (l. 884-889), cohérent avec le dessin à l'épaisseur de la tige près (revue BAL, vérifié).
- `window.__botSafe` (l. 844-855) : prédicteur honnête qui refait le calcul du jeu avec une marge de 1,7 × GAP (0,7 × GAP de chaque côté), utilisé par le banc d'essai.

### 1.6 Rendu

- **Fond pré-rendu** une fois par monde ou changement de taille (l. 681-708, clé l. 1329) : pas de dégradé recalculé à chaque image.
- **Couche phosphore** (l. 1333-1341) : un canvas à demi-résolution est partiellement effacé (`destination-out`, constante de temps 42 ms) puis reçoit les traits en gras ; il est composé en `lighter` sur tout l'écran. C'est l'effet « oscilloscope » qui fait l'identité visuelle, et c'est aussi le poste le plus coûteux (section 1.10).
- **Passe nette** : cadran gradué (l. 980-1004), astre filaire, arcs libres allumés, arcs interdits hachurés, bloqueurs à tête creuse, aiguilles du joueur à tête pleine, étoiles, sentinelles (l. 1006-1104), aiguille en vol (l. 1179-1184), effets (l. 1114-1136), HUD : niveau, monde, rythme, étoiles bonus, aiguilles restantes, oscilloscope de rotation passée et à venir (l. 1196-1258), bandeaux de monde et de niveau (l. 1261-1294), étoiles de victoire (l. 1297-1312).
- Texte du canvas en traits vectoriels ; texte du DOM en SVG généré par la même police (`vsvg`) : identité typographique cohérente même sans B612.
- `DPR` plafonné à 2 (l. 668). Le rendu tourne **à chaque image dans tous les états**, y compris l'écran des niveaux, la pause et les feuilles de fin.

### 1.7 Audio

- Contexte créé au premier geste (l. 560-575), compresseur maître, envoi d'écho filtré, tampon de bruit.
- 13 sons synthétisés (l. 612-641) : `ui`, `throw`, `hit` (note de la gamme du monde, l'aiguille k joue le degré k), `near`, `orb`, `ping` (« boîte à musique » : chaque bloqueur qui passe sous la tête de lecture tinte, l. 866-874), `fail`, `win`, `boom`, `world`, `start`, `boss`, `star`.
- Pas de musique, un seul réglage « SON ». Reprise du contexte uniquement depuis l'état `suspended` (l. 573).

### 1.8 Persistance

- Trois clés `orbita_unlocked` (nombre), `orbita_stars` (objet niveau → 1..3), `orbita_sound` (booléen), lues au démarrage (l. 250-254), écrites à la victoire (l. 784) et au changement de son (l. 1453).
- Robuste aux valeurs corrompues (revue ENG, vérifié), sauf nombres absurdes (`unlocked = 500000` fige l'écran des niveaux).
- Ni version, ni sauvegarde de partie en cours, ni records.

### 1.9 Entrées

- `pointerdown` sur le canvas avec `preventDefault` et `touch-action: none` (l. 26 et 1471) : pas de délai tactile de 300 ms. Le lancer part dans le gestionnaire, mais il est **simulé comme parti à l'image précédente** : l'image suivante avance l'aiguille d'un `dt` complet, alors que le tap a eu lieu entre deux images (défaut D11).
- Tap n'importe où sur la feuille d'échec = réessayer (l. 1472) ; clavier : Espace/Entrée (tirer, relancer, suivant), P/Échap (pause) (l. 1473-1485).

### 1.10 Mesures (novembre 2026, Chromium headless, Playwright)

| Mesure | Résultat |
|---|---|
| Banc d'essai complet `node tests/shoot.js index.html tests/out/baseline` | `pass: true`, aucune erreur, 34 s ; niveaux 1..60 gagnés par le bot en **1,4 à 5,5 s** de jeu |
| Mise en page 390×844 | R = PL = 70,2 px, tête 7,2 px, GAP = 16,1 px sur le cercle des têtes, vol 64,5 ms, canvas 780×1688, couche phosphore 195×422 |
| Durée du vol selon l'écran | 320×568 : 56,0 ms ; 360×640 : 58,5 ms ; 390×664 : 56,6 ms ; 390×844 et 430×932 : 64,5 ms |
| Profil d'image, niveau 8 joué par le bot, CPU normal | image 16,7 ms (p95 16,8) ; `update` ≤ 0,1 ms ; `draw` (JS) 1,0 ms médiane, 1,5 ms p95 |
| CPU ralenti ×4 (substitut d'un téléphone moyen, rendu logiciel = pire cas) | image 50 ms médiane (p95 67) ; `draw` JS 4,7 ms ; **le jeu tourne à 0,63× la vitesse réelle** (plafond `dt` de 33 ms, l. 1355) |
| CPU ×4, effet du DPR et du phosphore | DPR 3 (plafonné 2) + phosphore : 67 ms, 0,48× ; sans composition du phosphore : 33 ms, 0,93× ; DPR 1,5 : 50 ms, 0,71× ; DPR 1 : 16,7 ms, 0,99× |
| Allocations pendant le jeu (échantillonnage du tas) | **2,7 Mo/s** (≈ 45 Ko par image), 22 chutes du tas en 6 s (≈ 4 ramasse-miettes/s). Principaux postes : `update` 381 Ko/s, `drawFx` 367, `drawBody` 361, `vpath` 296, itérateurs `for…of` 251, `drawDial` 214, `drawHud` 207 |
| Images dessinées quand rien ne bouge | **60/s** sur l'écran des niveaux, le menu, la pause et la feuille de victoire |
| Simulateur, joueur qui vise (100 essais par niveau), taux de victoire moyen à 30/45/70/100/140 ms | niveaux 1-20 : 100/100/100/98/90 % ; 21-40 : 100/100/100/98/85 % ; 41-80 : 100/100/100/95/82 % ; 81-120 : 100/100/99/95/81 %. 107 niveaux sur 120 à ≥ 99 % à 70 ms ; le plus dur (L84) à 94 % |
| Contenu des niveaux 1-40 | 5,5 tirs en moyenne, **5,3 pour les boss** (boss 15, 30, 40 : 4 tirs) ; vitesse moyenne 1,72 rad/s ; niveau propre en 3,7 s (joueur à 45 ms) ; les 40 niveaux en ≈ 2,5 min |
| Salve à l'aveugle (un tap toutes les 100, 150 ou 200 ms dès le départ, meilleure cadence, 30 départs) | succès moyen **45 %** sur les niveaux 1-40 ; 19 niveaux sur 40 à ≥ 50 % ; par monde : 100/83/100/80/57, 0/100/20/100/37, 0/100/100/67/13… |
| Double tap à 8 ms (rebond, deux doigts) après un tir sûr | mort **40/40** aux niveaux 1, 2, 3, 8 et 21 ; 33/40 au 16 ; 0/40 au 26 (rapide) |
| Traversantes : part du bord **allumé** qui tue | 8 % aux niveaux 27-30, 38, 40 ; 15 à 35 % ensuite (51 : 28 %, 56 : 32 %, 76 : 35 %) |
| Étoiles impossibles à capturer (aucun angle sûr) | niveaux 56, 76, 114, 143, 152, 183 (tous à traversantes) |
| Police Google qui ne répond pas | le script du jeu **n'a toujours pas démarré à 6 s** (écran noir) |
| Feuille d'échec contre point d'impact (px cachés sous le filet du panneau) | 320×568 : 32 ; 360×640 : 9 ; 390×664 : 10 ; 375×667 : visible de justesse (6 px) ; 390×844 : visible |
| Chronologie de l'échec (lecture du code) | rotation figée en 0,22 s, relance par tap acceptée dès 0,28 s, feuille à 0,7 s |
| Chronologie de la victoire | explosion à 0,26 s, feuille à 1,15 s |

Les scripts de mesure ont été exécutés hors du dépôt ; l'étape 1 et l'étape 2 versent leurs équivalents dans `tests/` (sections 4.10 et 6). Les chiffres du simulateur décrivent l'ancienne physique : à partir de l'étape 2, seules les mesures faites sur le vrai code du jeu font foi.

### 1.11 Revue indépendante : statut des 32 constats

« Revérifié » = mesuré à nouveau pour ce document ; « confirmé » = confirmé par le second relecteur de la revue ; « lecture » = vérifié en lisant le code, sans pouvoir le mesurer ici ; « hypothèse » = non revérifié.

| Constat | Sujet | Statut | Traitement |
|---|---|---|---|
| UX-1 / ART-1 | Feuille d'échec qui cache l'impact (écrans courts) | confirmé + revérifié | Étape 1 |
| UX-2 | Tap entre 0,28 et 0,7 s : relance silencieuse, feuille jamais vue ; aucune garde sur le premier tir après relance ; MENU à gauche sur la feuille d'échec seulement | confirmé + lecture | Étape 1 (relance seulement sur la feuille, verrou de 250 ms après une relance par tap) |
| UX-3 / ENG BUG-5 | « Il manquait 4° » au centre d'un arc interdit (20° en réalité) | confirmé | Étape 1 |
| UX-4 | Règle du monde affichée 1,3 s en 7 px, introuvable ensuite | confirmé | Étape 2 |
| UX-5 / ART-2 | Petits libellés < 11 px, contraste 2,5-3,8:1 dans les mondes sombres | confirmé | Étape 2 (palettes) et 6 |
| UX-6 | Fautes et formulations (« ROTATION CONTINU », « l'oscillo ») | confirmé | Étape 1 |
| UX-7 | Clavier : Entrée/Espace capturés partout, focus invisible | confirmé | Étape 6 |
| UX-8 / ART-5 / ENG BUG-4 | Paysage sur téléphone : boutons hors écran, feuilles qui couvrent l'astre ; redimensionnement en plein vol | confirmé (paysage) ; hypothèse (vol) | Étape 1 (vol normalisé) et 6 (paysage) |
| ENG BUG-1 | Écran noir si la police Google ne répond pas ; service worker sans délai de secours | revérifié | Étape 1 |
| ENG BUG-2 / BAL BUG-1 / BAL BUG-2 | Traversantes : bord allumé mortel, étoiles impossibles | revérifié | Étape 1 |
| ENG BUG-3 | Tap mis en file pendant le vol = mort quasi certaine | revérifié | Étape 1 |
| ENG PERF-1 | Composition du phosphore + plafond `dt` : ralenti sous charge | revérifié | Étape 1 (pas fixe) et 6 (DPR adaptatif) |
| ENG BUG-6 | Sons perdus pendant la reprise du contexte audio ; état iOS « interrupted » jamais repris | lecture (l. 573) ; comportement Safari non testable ici | Étape 5 |
| ENG VIS-1 | L'astre du menu saute de 12 px après 0,5 s | hypothèse (finition) | Étape 6 |
| ART-3 | OPALE : arcs interdits et sentinelles identiques | confirmé par capture ; le monde disparaît, le principe (codage par la forme) reste | Étape 2 |
| ART-4 | « FRÔLÉ » et « ★ n/3 » posés sur l'anneau du cadran | visible sur la capture de référence | Étape 3 (emplacement unique de message) et 5 |
| ART-6 | Pas d'icône PNG pour l'écran d'accueil iPhone | revérifié (seul `icon.svg` existe) | Étape 6 |
| ART-7 | HUD décalé de 68 px sur les feuilles de fin | visible sur les captures | Étape 1 |
| ART-8 | Bouton SUIVANT à la couleur du monde suivant après un boss | proposition | Étape 6 |
| BAL-1 | Pas de courbe de difficulté | revérifié (simulateur relancé) | Étape 2 |
| BAL-2 | La salve à l'aveugle passe | revérifié | Étapes 1 (relance) et 2 |
| BAL UX-1 | Inversions et arrêts annoncés seulement par l'oscilloscope, loin de l'action | lecture | Étape 2 |
| BAL FEAT-1 | Série de victoires | proposition | Étape 6 |
| BAL FEAT-2 | Records personnels | proposition | Étape 3 |
| BAL FEAT-3 | Donner un but aux étoiles, marquer la fin des mondes | proposition | Étapes 3 et 6 |

Contradiction tranchée : la revue (BAL, point vérifié n° 73) déconseille de supprimer la file d'attente des taps parce que le banc d'essai s'en sert pour provoquer son échec volontaire au niveau 10. La file est néanmoins remplacée (section 5.6), et `tests/shoot.js` provoque l'échec volontaire de façon déterministe (tirer quand le point d'impact prévu tombe sur une aiguille), dans le même commit (1.6) ; ne pas l'obtenir fait désormais échouer le banc. C'est un test plus strict, pas plus faible.

---

## 2. Mécaniques fonctionnelles à conserver

| Mécanique | Où | Pourquoi on la garde |
|---|---|---|
| Un seul geste : toucher = lancer | l. 742, 1466-1471 | C'est la règle fondamentale du cahier des charges |
| Niveaux déterministes à graine | l. 499 | Équité, rejouabilité, et base des futurs défis partagés et classements vérifiables |
| Atterrissage exact corrigé du dépassement | l. 890-894 | Le résultat ne dépend pas de la cadence d'image |
| Collision à GAP, traversantes, sentinelle | l. 807-812, 884-889 | Règles justes ; seules les marges de dessin et l'affichage des traversantes sont à corriger |
| Arcs libres allumés = zone sûre | l. 711-721, 1023-1033 | Lecture immédiate ; 0 écart avec la collision sur les niveaux normaux 1-120 (revue) |
| Viseur d'avance (index plein si la zone est libre) | l. 896-899, 1148-1154 | Aide honnête au timing, invisible pour qui ne la cherche pas |
| Oscilloscope de rotation passée et à venir (1,75 s) | l. 1236-1254 | Rend les changements de vitesse prévisibles ; à compléter près du pas de tir |
| 6 lois de rotation sans hasard | l. 478-487 | Variété, prévisibilité ; réparties dans les nouveaux mondes |
| Dispositions d'obstacles et arcs interdits | l. 518-529 | Base du générateur v2 |
| Étoiles bonus avec arc de capture visible | l. 1079-1090 | Mécanique demandée (« planter sous les étoiles ») ; capture 100 % atteignable hors traversantes |
| FRÔLÉ (écart en degrés) | l. 821-828 | Retour très apprécié, devient un bonus de score |
| Boîte à musique (bloqueurs qui tintent) et sons par degré de la gamme | l. 866-874, 618-620 | Identité sonore à conserver et enrichir |
| Police vectorielle, solides filaires, phosphore, fond pré-rendu, cadran gradué | l. 284-438, 681-708, 1326-1351 | L'identité « arcade vectorielle » choisie par le porteur du projet |
| Démo du menu (l'astre joue tout seul) | l. 928-950 | Comprendre le jeu en moins de 5 s, sans texte |
| Mouvement réduit, zones sûres (encoche), retour clavier | l. 143-146, 151-152, 1473 | Accessibilité de base déjà en place |
| PWA hors ligne après une visite | `sw.js`, `manifest.webmanifest` | Démarrage hors ligne < 1 s (revue) ; à fiabiliser |
| Prédicteur honnête et banc d'essai | l. 842-855, `tests/` | Filet de sécurité de toute la suite |
| Mémoire stable, pas de fuite de nœuds audio | revue ENG | Bonne base pour une session longue |

---

## 3. Défauts du gameplay et de l'interface, classés par impact sur un joueur au téléphone

Impact : **Majeur** = change l'expérience de tous les joueurs ; **Moyen** = gêne fréquente ou ciblée ; **Mineur** = finition ou cas rare.

| # | Impact | Défaut | Preuve | Étape |
|---|---|---|---|---|
| D1 | Majeur | **Aucune courbe de difficulté** : 99-100 % de victoires à 70 ms d'imprécision sur 1-120 ; même à 140 ms, 81-90 % | Simulateur relancé (1.10) | 2 |
| D2 | Majeur | **Niveaux minuscules** : 5,5 tirs, 1,4-5,5 s ; boss plus courts que les niveaux normaux ; 40 niveaux en 2,5 min | 1.10 | 2, 4 |
| D3 | Majeur | **Rien à rejouer** : ni score, ni combo, ni parfait, ni record ; étoiles sans usage ; après le monde 8, cycles identiques | Lecture, revue BAL FEAT-1/2/3 | 3, 6 |
| D4 | Majeur | **Échec mal servi** : relance silencieuse dès 0,28 s (la cause n'est jamais montrée au joueur rapide) ; feuille d'échec qui cache l'impact jusqu'à 32 px en 320×568 ; MENU à l'emplacement de « rejouer » des autres feuilles | 1.10, UX-1, UX-2 | 1 |
| D5 | Majeur | **Double tap mortel** : un rebond ou deux doigts tuent 40 fois sur 40 aux niveaux lents | 1.10 | 1 |
| D6 | Majeur | **Boss sans mécanique propre** : octaèdre central et anneau pointillé, mêmes règles qu'un niveau normal, un boss tous les 5 niveaux au lieu de 10 | Lecture l. 1014-1017, 1.10 | 4 |
| D7 | Majeur | **La salve à l'aveugle gagne** : 45 % de succès moyen au premier essai sur 1-40 | 1.10, BAL-2 | 1, 2 |
| D8 | Majeur | **Écran noir au démarrage si le réseau traîne** (feuille Google bloquante, service worker sans délai de secours) | 1.10, ENG BUG-1 | 1 |
| D9 | Moyen | **Traversantes incohérentes** : jusqu'à 35 % du bord allumé est mortel, alors que le niveau 2 enseigne « arc allumé = zone libre » ; 6 étoiles impossibles | 1.10 | 1 |
| D10 | Moyen | **Batterie** : 60 images/s même sur écrans immobiles ; 2,7 Mo/s alloués (≈ 4 GC/s) | 1.10 | 6 |
| D11 | Moyen | **Timing approximatif et dépendant de l'appareil** : lancer simulé à l'image précédente (0 à 16,7 ms trop tôt) ; vol de 56 à 64,5 ms selon l'écran ; sous charge, le plafond `dt` ralentit tout le jeu (0,63× à CPU ×4) ; intégration de la rotation à droite, erreur jusqu'à ≈ 0,008 rad par changement de vitesse | 1.10, ENG PERF-1, lecture l. 864 | 1 |
| D12 | Moyen | **Collision 1,7 px avant le contact dessiné** ; de plus, pendant les ~14 dernières millisecondes du vol, une tête plantée voisine peut sembler traverser la tige (défaut de dessin seulement : la règle d'atterrissage à GAP est juste et doit rester la règle) | Lecture l. 657, 808-812 | 1 (rayon des têtes, ordre de dessin) |
| D13 | Moyen | **Changements de vitesse peu lisibles** : inversions et arrêts annoncés seulement par l'oscilloscope en bas à droite | BAL UX-1 | 2 |
| D14 | Moyen | **Règles des mondes** affichées une fois, 1,3 s, en 7 px ; aucune relecture possible | UX-4 | 2 |
| D15 | Moyen | **Pas de musique**, un seul réglage son, vibrations inexistantes sur iPhone (API absente du navigateur) sans que l'interface le sache | Lecture | 5, 6 |
| D16 | Moyen | **Pas de reprise après fermeture** de l'application ; seule la progression est gardée | Lecture | 6 |
| D17 | Mineur | Message d'échec faux au centre d'un arc interdit | UX-3 | 1 |
| D18 | Mineur | Petits textes peu contrastés dans les mondes sombres | UX-5 | 2, 6 |
| D19 | Mineur | Paysage cassé ; clavier ; icône iPhone ; saut de l'astre au menu ; HUD décalé sur les feuilles ; libellés sur l'anneau du cadran ; fautes de français | UX-6/7/8, ART-4/6/7, VIS-1 | 1, 3, 5, 6 |
| D20 | Mineur | Sélection des niveaux en une longue liste : ne tiendra pas 300 niveaux | Lecture l. 1384-1404 | 2 (sections par monde), 6 |
| D21 | Mineur | **Reprise de pause instantanée** : la rotation repart à l'image même où l'on touche REPRENDRE, doigt encore sur le bouton | Lecture l. 1447 | 1 |

---

## 4. Architecture d'amélioration

### 4.1 Principes

1. **Garder ce qui marche** : lois de rotation, règles de collision, rendu vectoriel, police, solides, phosphore, sons, prédicteur et banc d'essai sont déplacés, pas réécrits.
2. **Un seul changement de nature par commit** : déplacement du code d'abord (comportement identique et prouvé), puis une correction par commit, chacun avec le banc d'essai vert. Si quelque chose casse, on retrouve le commit fautif par bissection.
3. **Simulation déterministe séparée de l'affichage** : les règles ne lisent ni l'horloge murale, ni le DOM, ni le canvas. Elles émettent des événements que le rendu, l'audio, les effets et l'interface écoutent.
4. **Tout ce qui se règle est une donnée** : mondes, boss, niveaux spéciaux, score, difficulté, objectifs, séries sont des tables dans `js/config.js`.
5. **Chaque mécanique ajoutée est enseignée, mesurée et testée** ; aucun bouton sans effet réel, vérifié par `tests/ui.js` dès le premier commit.
6. **Mesurer sur le vrai jeu** : tous les chiffres de difficulté viennent du vrai code du jeu (exécuté dans le navigateur à l'étape 1, puis dans Node à partir de l'étape 2), jamais d'une copie de la physique.

### 4.2 Découpage de `index.html` : décision

**Décision : découper en scripts classiques chargés dans l'ordre par `index.html`, sans module ES ni outil de compilation.**

Justification :
- Le jeu va environ tripler (≈ 1 500 → ≈ 5 000 lignes : tables de 6 mondes, 5 boss × 6 paliers, niveaux spéciaux, score, sauvegarde v2, musique, nouveaux écrans). Un fichier unique de 5 000 lignes rend chaque étape difficile à relire et produit des conflits entre étapes.
- Le réglage de la difficulté (étape 2) doit faire jouer le **vrai** cœur du jeu des centaines de milliers de fois dans Node. Avec `js/config.js`, `js/util.js`, `js/levels.js` et `js/core.js` sans dépendance au DOM, Node les charge directement (`vm.runInContext`) : une seule source de vérité pour le jeu, le simulateur et les tests.
- **Pas de modules ES** : ils ne se chargent pas en `file://` dans Chromium (politique CORS), or le banc d'essai ouvre `file://…/index.html`. Les modules casseraient aussi le contrat de test (identifiants globaux).
- **Pas de compilateur ni de dépendance** : le porteur du projet garde un jeu qu'on ouvre en double-cliquant et qu'on publie tel quel sur GitHub Pages.
- Coût : une dizaine de petits fichiers à charger (précachés par le service worker, négligeable en HTTP/2) et deux règles de discipline :
  - deux scripts classiques ne doivent pas déclarer le même `let/const` de premier niveau ;
  - **seul `js/main.js`, chargé en dernier, agit au chargement** (`resize()`, `showMenu()`, écouteurs d'événements, `requestAnimationFrame`, enregistrement du service worker). Les autres fichiers ne font que déclarer des constantes, des tables et des fonctions. Ainsi l'ordre de chargement ne peut pas provoquer d'accès à un `let/const` pas encore déclaré.

Fichiers cibles (ordre de chargement, tous en `<script defer src="js/…?v=N">`, où N est le numéro de version du service worker, voir 4.9) :

| Fichier | Contenu | Dépend du DOM ? | Chargeable dans Node |
|---|---|---|---|
| `js/config.js` | Constantes (`GAP`, `ORBHIT`, `FLIGHT`, `STEP`, positions `U`…), tables `WORLDS`, `TEACH`, `BOSSES`, `SPECIALS`, `SCORING`, `DIFFICULTY`, `OBJECTIVES`, `STREAK`, `GEN_VERSION`, `SAVE_VERSION` | non | oui |
| `js/util.js` | `rng`, `angDiff`, `norm`, `clamp`, `lerp`, `easeOut`, `pad2`, petit bus d'événements `bus.on/emit` | non | oui |
| `js/vector.js` | Police « Trace », solides filaires, `project`, `vsvg` | non (canvas fourni par l'appelant) | oui |
| `js/levels.js` | Lois de rotation, `makeLevel(n)`, drapeaux de mécaniques `flags(n)`, `unionMeasure`, `computeArcs`, contrôle de capacité, orientation de départ | non | oui |
| `js/score.js` | Parfait, combo, étoile éphémère, score, objectifs, records (étape 3) | non | oui |
| `js/store.js` | Étape 1 : sauvegarde v1 déplacée telle quelle. Étape 2 : sauvegarde v2 et migration. Étapes 3 et 6 : champs ajoutés (adaptateur de stockage injectable) | non | oui |
| `js/core.js` | État et machine à états, `startLevel`, `throwPin`, `update`, `stick`, `fail`, `win`, collisions, `predict()` pure, `window.__botSafe`, relecture d'un journal de tirs (étape 6) | non à partir de l'étape 2 (émet des événements) | oui à partir de l'étape 2 |
| `js/audio.js` | Bus WebAudio effets/musique, `sfx`, séquenceur musical (étape 5) | WebAudio | non |
| `js/fx.js` | Particules, textes flottants, secousses, flashs, vibrations | non | oui |
| `js/render.js` | Mise en page (`layout`, `resize`), carte u → pixels, fond, scène, HUD, bandeaux, phosphore, ordonnancement du rendu | canvas | non |
| `js/ui.js` | Écrans DOM, boutons, couche d'entrée (`tap()`, clavier : anti-rebond, verrous, passage d'intro), visibilité, orientation | DOM | non |
| `js/main.js` | Démarrage, boucle à pas fixe, service worker ; seul fichier qui agit au chargement | DOM | non |

Le CSS reste en ligne dans `index.html` (≈ 300 lignes à terme) : il est nécessaire au premier affichage et évite une requête bloquante. Un petit garde-fou en ligne (une dizaine de lignes, avant les scripts) affiche « LE JEU N'A PAS DÉMARRÉ · TOUCHE POUR RECHARGER » si `state` n'existe toujours pas 4 s après le chargement ou si une erreur survient au démarrage : plus jamais d'écran noir muet.

**Polices auto-hébergées** dans `fonts/` : fichiers woff2 du sous-ensemble latin (B612 400 et 700, B612 Mono 400 et 700, soit les graisses chargées aujourd'hui), pris dans les paquets npm `@fontsource/b612` et `@fontsource/b612-mono` (version 5.3.0, licence OFL-1.1 ; le registre npm est joignable depuis l'environnement de travail, pas forcément Google Fonts). La licence OFL exige d'accompagner les fichiers de son texte : `fonts/OFL.txt` est versé avec eux. `@font-face` avec `font-display: swap`. Plus aucune requête vers `fonts.googleapis.com` ni `fonts.gstatic.com`.

### 4.3 Contrat de test (préservé à chaque étape)

Le banc d'essai lit ces identifiants par leur nom depuis `page.evaluate`. Dans des scripts classiques, les `function` et les `let/const` de premier niveau partagent une seule portée globale : ils restent accessibles par leur nom.

| Identifiant | Fichier après découpage | Règle |
|---|---|---|
| `state` (`'menu'`, `'levels'`, `'play'`, `'pause'`, `'dying'`, `'winning'`, `'won'`, `'failed'`) | `core.js` | `let` ; noms d'états inchangés. Les sous-phases nouvelles se jouent **à l'intérieur** de `play` et sont lisibles dans `playPhase` (`'intro'`, `'compte'`, `'annonce'`, `'jeu'`) |
| `startLevel(n)`, `throwPin()`, `update(dt)` | `core.js` | déclarations `function` (remplaçables par `window.x = …`) ; `update(dt)` avance toute la simulation de `dt` secondes exactement, ne lit jamais l'horloge et pilote toutes les transitions ; `throwPin()` sans argument = lancer à l'instant de simulation courant ; `throwPin(tSim)` = lancer à l'instant `tSim` (≥ dernier instant simulé), utilisé par la couche d'entrée et par la relecture |
| `showMenu()`, `showLevels()` | `ui.js` | `function` ; affichent l'écran à partir de `unlocked` et `bestStars` |
| `left`, `flying`, `stuck`, `rot`, `t` | `core.js` | `flying` vaut la plus récente aiguille en vol ou `null` ; `stuck` contient toujours tous les occupants du bord (bloqueurs inclus) sous la forme `{a}` |
| `speedAt(t)`, `angDiff`, `norm`, `GAP` | `levels.js`, `util.js`, `config.js` | signatures inchangées |
| `LAUNCH`, `cy`, `R`, `FLYV` | `render.js` | toujours définis ; `FLYV = (LAUNCH − (cy + R)) / FLIGHT` (vitesse moyenne), donc `(LAUNCH − (cy + R)) / FLYV` vaut exactement la durée du vol, comme le suppose le repli du banc d'essai |
| `unlocked`, `bestStars`, `soundOn` | `store.js` | `let` modifiables ; `bestStars[n]` = nombre d'étoiles (0..3) affiché ; `soundOn = false` coupe les effets sonores |
| `window.__botSafe()` | `core.js` | prédicteur honnête, marge 0,7 × GAP de chaque côté, calculé par la même fonction pure `predict()` que le jeu ; **étendu à chaque nouvelle mécanique** (anneaux, zones pulsées et glissantes, inversions annoncées, sentinelles, niveaux spéciaux) |
| `#playBtn`, `#hudBtn` | `index.html` | ids conservés ; un clic sur `#playBtn` finit toujours dans l'état `play`, même quand il affiche REPRENDRE (après le compte à rebours de 0,6 s) |

Règles :
- **Sous-phases** de `play` (intro de boss, compte à rebours de REPRENDRE et de la REPRISE, annonce de deuxième phase) : `__botSafe()` rend `false` et `throwPin()` ne fait rien ; le pas de tir affiche un verrou. Passer une intro d'un tap se fait uniquement dans la couche d'entrée.
- **Couche d'entrée seulement** : l'anti-rebond de 40 ms et le verrou de 250 ms après une relance par tap vivent dans `tap()` et le gestionnaire clavier, jamais dans `throwPin()` ni `startLevel()`. Le banc d'essai et le simulateur gardent ainsi un contrôle exact du lancer.
- **Spécial PARFAIT** : `__botSafe()` ne rend `true` que si le point d'impact prévu tombe à moins de p/2 du milieu de l'intervalle libre (p défini en 5.6).
- **`predict(instant)`** : fonction pure de `core.js` qui donne, pour un tir lancé à cet instant, l'angle d'impact et les passages devant les sentinelles et les anneaux, avec le même intégrateur que le jeu. Elle sert à `__botSafe`, au viseur d'avance et aux politiques du simulateur.
- Toute évolution de `tests/shoot.js` se fait dans le même commit que le changement qui la motive et ne retire aucune vérification ; les nouveaux contrôles vont dans de nouveaux scripts (`tests/unit`, `tests/ui.js`, `tests/play.js`, `tests/perf.js`, `tests/sim`).

### 4.4 Cœur déterministe, unités normalisées et géométrie de l'écran

**Bus d'événements.** À partir de l'étape 2, `core.js` ne touche ni au DOM ni au canvas : il émet `level:start`, `throw`, `hit`, `perfect`, `near`, `star`, `combo`, `fail`, `win`, `state`, `boss:phase`… ; `fx.js`, `audio.js`, `ui.js`, `store.js` s'abonnent. Les abonnés sont synchrones : `startLevel()` masque toujours les écrans avant de rendre la main (le banc d'essai en dépend).

**Unités normalisées.** Angles en radians, temps en secondes de simulation, vol en fraction `u` de la course : u = 0 au pas de tir, u = 1 au contact avec l'astre, u = (instant − instant du lancer) / `FLIGHT`. Chaque élément radial a une **position physique u fixe, la même sur tous les écrans**, inscrite dans `config.js` (valeurs relevées sur la mise en page de référence 390×844) :

| Élément | u (physique) | Rayon dessiné qui sert d'ancre |
|---|---|---|
| Contact (bord de l'astre) | 1 | R |
| Cercle extérieur des têtes plantées | `U.head` = 0,76 | R + PL + HEAD |
| Orbite des sentinelles : bord intérieur, centre, bord extérieur | 0,73 / 0,71 / 0,69 | RS − 0,75·HEAD, RS, RS + 0,75·HEAD |
| Cadran gradué | `U.dial` = 0,66 | RD |
| Anneaux à portes k = 0, 1, 2 (étape 2) | 0,62 / 0,57 / 0,52 | RD + 12 + k × max(14 px ; 2,2 × HEAD) |
| Pas de tir | 0 | LAUNCH − cy |

- L'aiguille en vol a une longueur physique `U.len` = 1 − `U.head` = 0,24 : sa queue est en u − 0,24. Elle occupe le rayon d'un élément mince tant que sa pointe est entre u_élément et u_élément + 0,24 (soit 14,4 ms) ; sentinelles et anneaux se testent sur cet intervalle (test d'intervalle, comme aujourd'hui pour la sentinelle).
- `render.js` convertit u en pixels par une **fonction affine par morceaux** qui passe exactement par les ancres de l'écran courant (et par LAUNCH + PL + HEAD pour u = −0,24, pour que l'aiguille au repos garde sa vraie longueur). L'aiguille dessinée croise donc chaque élément dessiné à l'instant exact où la physique le dit, sur tous les écrans ; sa vitesse en pixels varie un peu le long du vol, ce qui est imperceptible en 60 ms.
- Pourquoi pas une seule échelle linéaire : la bande entre le cercle des têtes et le cadran occupe 24 à 34 % de la course (comptés depuis le contact) en 390×844, mais 33 à 48 % en 320×568 ; une position u unique dessinerait l'orbite hors du cadran sur les grands téléphones ou sur les têtes sur les petits.
- Conséquence : **même timing sur tous les écrans**, et une partie peut être rejouée dans Node à partir de `(numéro de niveau, GEN_VERSION, instants des tirs)`. Cette propriété sert à la reprise après fermeture (étape 6), au simulateur, et servira en phase 2 à vérifier côté serveur les scores des défis et des classements.

**Budget de place à l'écran** (mesuré sur la mise en page actuelle) :

| Zone | 320×568 | 360×640 | 390×844 | Ce qui y va |
|---|---|---|---|---|
| Bande cercle des têtes → cadran | 27,9 px | 31,4 px | 34 px | orbite des sentinelles, rien d'autre |
| Marge cadran → bord de l'écran | 9-11 px | 9-11 px | 9-11 px | rien (trop étroit pour une barre de vie) |
| Couloir sous le cadran (cadran → pas de tir) | 99 px | 122 px | 215 px | anneaux à portes ; bandeaux et messages sur les niveaux sans anneau |

- **Anneaux** : dessinés hors du cadran, dans le couloir de tir, en arcs concentriques autour de l'astre aux rayons du tableau ci-dessus ; seule la partie basse compte, ils peuvent être coupés par les bords de l'écran. Écart entre anneaux ≥ 12 px (14 px en 320×568). Portes : longueur d'arc ≥ 3 × HEAD px sur le plus petit écran (≥ 17,7 px en 320×568). Losange de synchronisation ≥ 8 px, posé sur l'axe de tir.
- **Bandeaux et messages** : sous le cadran sur les niveaux normaux ; **au-dessus du cadran ou dans le HUD du haut** sur les niveaux à anneaux.
- **Barre de vie des boss** : barre segmentée dans le HUD du haut, sous le numéro de niveau (et non un anneau autour du cadran).
- **Vérification chiffrée** dans `tests/ui.js` en 320×568 et 360×640 : écart entre anneaux ≥ 12 px, portes ≥ 3 × HEAD, et aucun chevauchement entre les boîtes englobantes des anneaux, des messages, du HUD et de la barre de vie.

### 4.5 Boucle, temps et entrées

- **Boucle à pas fixe** : `loop(now)` accumule le temps écoulé (plafonné à 0,25 s) et appelle `update(STEP)` (STEP = 1/120 s) autant que nécessaire, puis dessine une fois. Plus de ralenti sous charge (cible : vitesse de simulation ≥ 0,98× à CPU ×4). `update(dt)` garde son contrat : il avance de `dt` exactement, en pas entiers de 1/120 s puis un dernier pas fractionnaire si `dt` n'en est pas un multiple (le banc l'appelle avec 1/60 = deux pas). Même suite de pas → résultats identiques au bit près.
- **Intégration par la méthode des trapèzes** partout (cœur, `predict()`, simulateur) : `rot += h × (v(t) + v(t + h)) / 2`. L'ancienne somme à droite (`rot += speedAt(t) × dt`) se trompe jusqu'à 0,5 × h × |Δv|, soit ≈ 0,008 rad pour h = 1/120 s et une variation de vitesse de 2 rad/s. Les lois de vitesse restent **continues** (un changement brusque est une rampe d'au moins 50 ms, comme l'inversion du Pendule en 80 ms), sinon le trapèze perd sa précision.
- **Rendu interpolé** : la simulation garde les valeurs du pas précédent (rotation, temps, u des aiguilles en vol, angles des sentinelles et des anneaux) et le rendu dessine à α = reste de l'accumulateur / STEP. Sans cela, un écran à 90 Hz reçoit 1, 1, 2, 1, 1, 2… pas par image, soit des sauts de 3,5 / 3,5 / 7 px pour une tête à 3 rad/s (même défaut à 144 Hz).
- **Lancer horodaté** : le gestionnaire `pointerdown` lit `e.timeStamp` et le convertit en instant de simulation (correspondance horloge murale / instant simulé notée au dernier pas). Si `|e.timeStamp − performance.now()| > 1000 ms` (certaines WebView donnent des millisecondes depuis 1970), il prend `performance.now()`. L'instant est borné à [dernier instant simulé, maintenant] : jamais de lancer dans le passé. L'aiguille part exactement à cet instant (`throwPin(tSim)`), même au milieu d'un pas, et c'est cet instant qui est noté dans le journal des tirs. Le gestionnaire lit l'horloge, `update()` ne la lit jamais.
- **Vol de durée constante** `FLIGHT = 60 ms` sur tous les écrans.
- **Couche d'entrée** (`ui.js`) : anti-rebond de 40 ms, verrou de 250 ms après une relance par tap, passage d'intro, verrou des sous-phases (4.3).
- **Latence** : le tap est traité dans le gestionnaire d'événement, l'aiguille est visible à l'image suivante (≤ 16,7 ms) ; `touch-action: none` sur toute la zone de jeu.

### 4.6 Sauvegarde

Une clé principale `orbita_save`, en JSON versionné, et une petite clé séparée `orbita_resume` pour la partie en cours :

```js
// orbita_save
{
  v: 2, gen: 2,                                        // SAVE_VERSION, GEN_VERSION des niveaux
  progress: { unlocked: 23 },                          // étape 2 : plus haut niveau jouable (1 .. 300, puis COSMOS ∞)
  legacyStars: 47,                                     // étape 2 : total des étoiles de l'ancienne version, affiché comme record
  settings: { sfx: true, music: true, haptics: true },// étape 2 (sfx), 5 (music), 6 (haptics)
  levels: {                                            // étape 3 : seulement les niveaux joués (stockage clairsemé)
    "12": { s: 0b011, best: 4820, combo: 9, perf: 4, time: 8.4, tries: 7, wins: 3 }
  },                                                   // s = objectifs atteints : 1 = fini, 2 = étoiles bonus, 4 = objectif secondaire
  records: { bestCombo: 14, perfectTotal: 213, bestStreak: 18, careerScore: 123456 }, // étape 3
  stats: { attempts: 120, fails: 80, playTime: 3600 }, // étape 3
  streak: { cur: 3, tokens: 1, failsHere: 0 },         // étape 6 : série, jetons REPRISE, échecs de suite sur le niveau en cours
  meta: { created: 1763300000000, updated: 1763300000000 }
}
// orbita_resume (étape 6) : journal des tirs de la partie en cours
{ n: 34, gen: 2, v: 4, taps: [0.82, 1.94, 3.10], tNow: 3.62, savedAt: 1763300000000 }
```

- **Validation** à chaque lecture : types, bornes (`unlocked` entier entre 1 et 100 000 : COSMOS ∞ compris, sans valeur absurde qui figerait l'écran des niveaux), objets ; valeur absente ou invalide = valeur par défaut, sans exception. Un champ ajouté par une étape ultérieure est simplement absent des sauvegardes plus anciennes : **aucune migration supplémentaire** n'est nécessaire entre les étapes 2, 3 et 6. Écriture dans `try/catch` (quota, navigation privée).
- **Migration de l'ancienne version** (étape 2, en même temps que la renumérotation des niveaux) : `progress.unlocked = clamp(orbita_unlocked, 1, 300)`, pour l'accès seulement ; **aucun niveau n'est marqué fini** et aucune étoile n'est attribuée (les anciens numéros ne correspondent plus aux mêmes niveaux : on offrirait jusqu'à 299 ★ pour des niveaux jamais joués) ; le total des anciennes étoiles devient `legacyStars` ; `orbita_sound` → `settings.sfx` (et `settings.music` à l'étape 5). Le bouton CONTINUER vise le **premier niveau d'apprentissage non fini ≤ `unlocked`**, sinon `unlocked` : un ancien joueur à 150 ne tombe pas en Rubis sans avoir vu les mécaniques d'Émeraude et d'Ambre ; toute la grille jusqu'à `unlocked` reste ouverte. Pour un joueur ordinaire, la règle ne change rien (finir un niveau débloque le suivant, donc tous ses niveaux d'apprentissage sont finis). Les anciennes clés restent en place une version (retour arrière possible), puis sont supprimées.
- **Sauvegarde automatique** : victoire, échec, changement de réglage, record battu, pause, `visibilitychange` (masqué), `pagehide`.
- **Un échec est écrit au même tick que la collision**, dans `fail()` : tentatives + 1, échecs + 1, mise à jour de la série (5.9), effacement de `orbita_resume`, écriture synchrone. Fermer l'application pendant l'animation de 0,45 s ou sur la feuille d'échec ne peut donc ni sauver une série, ni garder une partie à reprendre. Le jeton REPRISE est décompté à l'appui sur le bouton, avant le compte à rebours.
- **Reprise après fermeture (étape 6), par relecture** : `orbita_resume` est écrit à chaque tir et au masquage de la page. Au démarrage, s'il a moins de 7 jours et les mêmes `gen` et numéro de version, le menu propose **REPRENDRE NIV 34** : `startLevel(n)`, puis relecture à pas fixe qui réinjecte les tirs jusqu'à `tNow` (30 s de jeu se rejouent en moins de 20 ms ; si une aiguille vole à `tNow`, la relecture continue jusqu'à son impact), puis pause et compte à rebours de 0,6 s. La REPRISE de 5.9 est la même relecture sans le tir fatal. Pourquoi un journal plutôt qu'une liste de champs : tout l'état que les étapes 3 et 4 ajoutent (chaîne de combo, rampe du Réacteur, phase 2, compteur du Pendule, zones pulsées, jauge du CHRONO, étoile éphémère) découle de (niveau, temps, tirs) ; un champ oublié ne peut donc pas casser la reprise d'un boss. C'est aussi le format que le serveur rejouera en phase 2.
- Les globales `unlocked` et `bestStars` restent la vue utilisée par l'interface ; `bestStars[n]` est recalculé depuis les bits au chargement.

### 4.7 Tables de données (`js/config.js`)

Esquisse des formes ; les valeurs exactes sont fixées aux étapes 2 à 4 par les outils de mesure.

```js
const FLIGHT = .060, STEP = 1 / 120, GAP = .115, ORBHIT = .2, GEN_VERSION = 2, LEVELS_PER_WORLD = 50, BOSS_EVERY = 10;
const U = { head: .76, sentIn: .73, sent: .71, sentOut: .69, dial: .66, rings: [.62, .57, .52], len: .24 };
const WORLDS = [
  { id: 'emeraude', name: 'ÉMERAUDE', theme: 'DÉCOUVERTE', rgb: [77,255,166], hi: [230,255,242], acc: [255,211,92], alert: [255,59,82],
    solid: 'ico', root: 62, scale: [0,2,4,7,9], tempo: 100, speed: [1.1, 2.2], load: [[4, 0], [8, 4]] }, // load = [tirs, obstacles fixes] début → fin
  /* AMBRE, RUBIS, SAPHIR, OBSIDIENNE, COSMOS : mêmes champs (section 5) */
];
const TEACH = { 1: 'lancer', 2: 'bloqueurs', 3: 'etoiles', 4: 'sens', 6: 'parfait', 7: 'pluie', 8: 'combo', 9: 'accel',
  11: 'respiration', 17: 'chrono', 19: 'demitour', 21: 'serre', 27: 'parfaitSp', 29: 'zone', 39: 'anneau', 49: 'irreg',
  51: 'acoups', 61: 'arrets', 71: 'rampe', 81: 'anneaux2', 101: 'fentes', 111: 'pulse', 121: 'glisse',
  151: 'alternee', 161: 'rythme', 171: 'invImpact', 181: 'ressac', 201: 'sentinelle', 211: 'traversantes', 221: 'sentinelles2',
  251: 'anneaux3', 261: 'portesPulsees' };          // niveau d'apprentissage → seul drapeau nouveau qu'il introduit (5.3)
const BOSSES = [   // du plus simple au plus dur ; archétype k au niveau 10·k de chaque monde ; tiers[0..5] = paliers I..VI
  { id: 'reacteur',   name: 'LE RÉACTEUR',   solid: 'cubocta',     flag: 'accel',    rule: 'IL ACCÉLÈRE À CHAQUE AIGUILLE', tiers: [ /* 5.4 */ ] },
  { id: 'pendule',    name: 'LE PENDULE',    solid: 'stella',      flag: 'demitour', rule: 'AU SIGNAL, DEMI-TOUR',          tiers: [ /* … */ ] },
  { id: 'forteresse', name: 'LA FORTERESSE', solid: 'bastion',     flag: 'zone',     rule: 'ÉVITE LES ZONES INTERDITES',    tiers: [ /* … */ ] },
  { id: 'anneaux',    name: 'LES ANNEAUX',   solid: 'gyro',        flag: 'anneau',   rule: 'PASSE PAR LES PORTES',          tiers: [ /* … */ ] },
  { id: 'chaos',      name: 'LE CHAOS',      solid: 'icosidodeca', flag: 'irreg',    rule: 'RIEN NE TOURNE DEUX FOIS PAREIL', tiers: [ /* … */ ] }
];
const SPECIALS = { pluie: { /* … */ }, chrono: { /* … */ },
  parfait: { n: 6, window: .045, k: { emeraude: 2, ambre: 3, rubis: 3, saphir: 3, obsidienne: 4, cosmos: 4 } } };
const SCORING = { needle: 100, perfect: 150, near: 50, star: 250, ephemeral: 300, clear: 500, bossClear: 1500,
  comboStep: 3, comboMaxMult: 5, perfectComboGain: 2, perfectTime: .035, perfectMin: .02, perfectMax: .12, comboWindow: [1.2, 2.4],
  ephemeralLife: 2.5, ephemeralFromMult: 3 };
const DIFFICULTY = { floor30: .75, floorLow95: .72, worldTargets70: [[.97,.80],[.80,.65],[.68,.52],[.58,.42],[.45,.32],[.35,.22]],
  breather: .10, cliff: .12, bossCliff: .20, capacity: 14, mashEarly: .30, mashLate: 6 / 200,
  trials: 300, trialsRecheck: 1000, recheckBelow: .85 };
const OBJECTIVES = { parfaits: { /* k selon les tirs */ }, combo: { /* ×k */ }, chrono: { /* T */ }, score: { /* S */ } };
const STREAK = { maxTries: 3, milestones: [ /* réglés par tests/sim/streak.js */ ], tokenMax: 3 };
```

Le générateur ne contient plus de constantes de réglage : il lit ces tables. Un test (`tests/unit/config.test.js`) vérifie leur cohérence : bornes, mondes contigus, chaque boss a 6 paliers, positions `U` dans l'ordre (pas de tir < anneaux < cadran < sentinelles < têtes < contact), contraste des palettes ≥ 4,5:1 pour les libellés, **solide de chaque boss absent des solides de monde et 5 solides de boss tous différents**.

### 4.8 Budget de performance et de batterie

Cible : 60 images/s sur un téléphone de milieu de gamme (Android 2021-2022 de milieu de gamme, iPhone XR/11), en restant sobre en batterie.

| Poste | Aujourd'hui | Budget | Moyen |
|---|---|---|---|
| Calcul JS par image (CPU normal) | `update` ≤ 0,1 ms, `draw` 1,0 ms | `update` ≤ 0,5 ms, `draw` ≤ 3 ms | — |
| CPU ×4 (substitut) | 50-67 ms/image, jeu à 0,48-0,63× | ≤ 33 ms/image, simulation ≥ 0,98× | pas fixe ; DPR adaptatif ; composition du phosphore limitée au rectangle utile (cadran, couloir, HUD) |
| Régularité du mouvement | — | à 90 et 120 Hz, coefficient de variation de l'incrément de rotation par image < 5 % | rendu interpolé (4.5) |
| Résolution | DPR plafonné à 2 | DPR ≤ 2 et ≤ 2,3 Mpx ; descend à 1,5 puis 1,25 si l'image dépasse 20 ms pendant 45 images, remonte après 5 s fluides ; **changement appliqué seulement entre deux tentatives ou en pause** (réallouer les canvas en plein tir provoquerait un à-coup) | `resize()` paramétré |
| Allocations | 2,7 Mo/s | ≤ 100 Ko/s en jeu | boucles indexées au lieu de `for…of` dans le rendu, chaînes HUD mises en cache, tableaux de pointillés constants, réservoirs de particules réutilisés (pas de `filter`), pas de fermetures par image |
| Écrans immobiles | 60 images/s partout | 0 image/s (niveaux, réglages, records, pause après 1 image, feuilles de fin une fois les animations terminées) ; démo du menu à 30 images/s ; animation CSS du logo arrêtée quand le menu est masqué (`animation-play-state: paused`) | la boucle s'arrête et repart sur `wake()` (entrée, changement d'état, redimensionnement, visibilité) |
| Audio | — | séquenceur suspendu en arrière-plan ; `AudioContext.suspend()` si la page est masquée ou si effets et musique sont coupés | `audio.js` |
| Chargement | ressource bloquante tierce | aucun blocage tiers ; ≤ 300 Ko transférés à froid ; premier affichage < 1 s en 4G ; démarrage hors ligne < 1 s | polices auto-hébergées, précache atomique (4.9) |

Mesures associées : `tests/perf.js` (profil d'image à CPU ×1/×4, échantillonnage des allocations, images par seconde sur chaque écran immobile, latence tap → aiguille visible, régularité à 90 et 120 Hz par horloge virtuelle).

### 4.9 PWA et chargement

Douze scripts qui dépendent les uns des autres ne doivent jamais être mélangés entre deux versions (un `index.html` récent avec un `core.js` ancien = erreur au démarrage = écran noir, le défaut D8 que l'on corrige). D'où un **précache atomique et versionné** :

```js
// sw.js
const VERSION = 'orbita-v4';                         // incrémenté à chaque publication
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'js/config.js?v=4', /* … tous les js/ */, 'fonts/b612-latin-400-normal.woff2', /* … */];
// install  : caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
//            → tout ou rien, en contournant le cache HTTP de GitHub Pages (max-age de 10 min)
// fetch    : requêtes GET de même origine servies seulement depuis caches.open(VERSION), navigation comprise ;
//            réseau seulement si le fichier manque (course de 2,5 s pour une navigation, puis petite page « hors ligne »)
//            aucune écriture fichier par fichier en arrière-plan
// activate : supprime les autres caches
```

- **Mise à jour** : une nouvelle version n'atteint les joueurs que si `VERSION` change. Le nouveau service worker télécharge tous les fichiers d'un coup, puis attend ; la page lui demande de s'activer **seulement quand l'état est `menu` ou `levels`**, puis se recharge au `controllerchange`. Jamais pendant un niveau.
- **Navigation servie depuis le même cache** que les scripts : une navigation réseau d'abord recevrait un `index.html` récent alors que les scripts viendraient de l'ancien cache. Le réseau ne sert que s'il manque quelque chose.
- **Adresses versionnées** : `index.html` charge `js/…?v=4` (le numéro de `VERSION`). Un `index.html` récent ne peut donc jamais réutiliser un ancien script resté dans le cache HTTP du navigateur, même avant l'installation du service worker (première visite). Vérifié : Chromium charge bien `file://…/js/a.js?v=4`, le banc d'essai continue de fonctionner.
- Garde-fou de démarrage en ligne (4.2) pour tout autre échec.
- **Test** `tests/unit/sw.test.js` : calcule l'empreinte de chaque fichier précaché et la compare à `tests/ref/sw-hashes.json` (empreintes de la dernière `VERSION`) ; échoue si un fichier a changé sans que `VERSION` change, si un fichier référencé par `index.html` (scripts, polices, icônes, manifeste) manque dans `FILES`, ou si un `?v=` ne correspond pas à `VERSION`. `node tests/unit/sw.test.js --update` réécrit la référence après un changement de `VERSION`.
- Icônes PNG 180/192/512 générées depuis `icon.svg` (inchangée) et `apple-touch-icon` (étape 6).

### 4.10 Outils de test (versés dans le dépôt au fil des étapes)

| Outil | Contenu | Étapes |
|---|---|---|
| `tests/shoot.js` (existant) | bot, captures, balayage d'équité 1..60 ; à l'étape 1, l'échec volontaire devient déterministe (tirer quand le point d'impact prévu tombe sur une aiguille) et **ne pas l'obtenir fait échouer `pass`** | toutes |
| `tests/ui.js` | Playwright. Dès l'étape 1 : **fumée** (clic sur chaque bouton visible de chaque écran ; Espace, Entrée, P et Échap dans chaque état ; son basculé ; clic sur une case de niveau ; `visibilitychange` : zéro erreur et état attendu après chaque action), démarrage sans réseau tiers, hors ligne, parcours d'échec et indépendance à l'écran sur 5 écrans. Puis : géométrie des anneaux et des messages, migration, persistance, reprise, séries, réglages, paysage | 1 → 7 |
| `tests/play.js` | Playwright, jeu accéléré dans la vraie page (`update` appelé directement) : prédicteur sur les niveaux 1..200 (1..300 à partir de l'étape 2), double tap, tir pendant un vol, traversantes | 1, 2 |
| `tests/perf.js` | profil CPU ×1/×4, allocations, images au repos, latence, régularité à 90/120 Hz | 1, 6 |
| `tests/unit/` | Node sans dépendance : géométrie, intégration, service worker, `config.js`, sauvegarde et migration, score, chronologies de boss, drapeaux de mécaniques ; plus `dump.js` (vidage des niveaux et de la mise en page par Playwright, références dans `tests/ref/`) | 1 → 4 |
| `tests/sim/` | À partir de l'étape 2. `load.js` exécute le **vrai** `js/core.js` (avec `config`, `util`, `levels`, puis `score`) dans Node (`vm`), en le pilotant par `startLevel` / `throwPin(tSim)` / `update` : aucune copie de la physique. Les politiques sont des greffons (`aim` qui attend la meilleure fenêtre et vise son milieu, `reactive` qui n'anticipe pas, `mash` qui tape à l'aveugle, `planner` sans bruit), et leur anticipation passe par la même `predict()` que `__botSafe`. Outils : `report.js` (cibles, plancher, falaises, durées), `mash.js`, `bot.js`, `planner.js`, `streak.js`, `agree.js`. Générateur pseudo-aléatoire à graine partout, graines versées dans `tests/sim/seeds.json` | 2, 3, 4, 6 |

- **`tests/sim/agree.js`** : rejoue au moins 2 000 tentatives (σ tiré au hasard, niveaux 1..400, boss et spéciaux compris dès qu'ils existent) dans Chromium (vraie page) et dans Node ; exige **≥ 99,5 % d'issues identiques** (100 % attendus, puisque c'est le même code), sinon l'étape échoue. Fait partie de l'acceptation des étapes 2 et 4 et de tout commit qui touche à la physique. Si une version accélérée du simulateur est un jour ajoutée pour gagner du temps, elle doit passer le même test.
- Le simulateur de la revue (`human.js`) n'est **pas** utilisé pour accepter quoi que ce soit : il a été validé sur l'ancienne physique, que l'étape 1 modifie. Il ne sert que de source d'inspiration pour l'écriture des politiques.

---

## 5. Spécification de game design de la première version jouable

### 5.1 Structure

- **6 mondes de 50 niveaux = 300 niveaux**, puis **COSMOS ∞** (niveaux 301 et suivants, générés sans fin à difficulté de plateau).
- Chaque monde = 5 blocs de 10 niveaux. Dans un bloc : x1-x2 **respiration** (plus faciles ; c'est là que les mondes 2 à 6 placent leurs niveaux d'apprentissage), x3-x6 et x8 montée, **x7 niveau spécial**, x9 montée (en Émeraude : **niveau d'apprentissage de la mécanique du boss**), **x10 boss**.
- Le numéro du niveau reste unique et continu (1..300, 301+) : sauvegarde, sélection et contrat de test simples.
- Progression jamais bloquée artificiellement : finir un niveau débloque le suivant ; les étoiles et les objectifs ne conditionnent pas l'accès aux mondes.

### 5.2 Palettes

Fond noir d'encre `#04070a` inchangé, cercles orbitaux, graduations et police vectorielle conservés. Chaque monde fixe 4 couleurs : trait principal, blanc chaud (`hi`, aiguilles et chiffres), accent (étoiles, FRÔLÉ) et alerte (collision).

| Monde | Trait | Hi | Accent | Alerte | Solide | Contraste du trait sur le fond |
|---|---|---|---|---|---|---|
| Émeraude (vert néon) | `#4dffa6` | `#e6fff2` | `#ffd35c` | `#ff3b52` | icosaèdre | 15,5:1 |
| Ambre (orange doré) | `#ffb23e` | `#fff4de` | `#9fe8ff` | `#ff3b52` | planète annelée | 11,2:1 |
| Rubis (rouge lumineux) | `#ff4f6a` | `#ffeef1` | `#ffd35c` | `#5ff3ff` (cyan : le rouge est déjà la couleur du monde) | cristal | 6,3:1 |
| Saphir (bleu électrique) | `#4aa8ff` | `#eaf5ff` | `#ffcf7a` | `#ff3b52` | dodécaèdre | 8,0:1 |
| Obsidienne (violet sombre) | `#b48cff` **ou** `#9a6bff` (au choix du porteur) | `#f1ecff` | `#9dffd0` | `#ff3b52` | tesseract | 7,8:1 ou 5,7:1 |
| Cosmos (nacre spectrale, mon choix) | `#dff3ff` | `#ffffff` | `#ff5ccf` | `#ff3b52` | sphère armillaire | 17,7:1 |

- Obsidienne : le cahier des charges demande un « violet sombre » ; `#b48cff` peut se lire lavande. Les deux teintes seront montrées côte à côte sur la planche de palettes de l'étape 2 (première étape qui change les palettes), et le porteur choisit. Dans les deux cas, le « sombre » vient aussi de l'ambiance (lueur de fond très faible, trame plus discrète, phosphore moins persistant).
- Cosmos : traits nacrés presque blancs ; la lueur de fond change lentement de teinte (cycle de 60 s, décoratif). Comme tout le monde est clair, les éléments se distinguent **par la forme** : obstacles mobiles = barres pleines, zones interdites = bandes hachurées creuses, bloqueurs = têtes creuses, aiguilles du joueur = têtes pleines (leçon d'OPALE, ART-3).
- Libellés secondaires : opacité calculée par monde pour garantir ≥ 4,5:1 (gain de luminance, ART-2) ; vérifié par test.
- Les solides des boss (5.4) sont tous différents des solides de monde.

### 5.3 Introduction des mécaniques, une idée à la fois

**Règle.** Aucun niveau, **boss et spéciaux compris**, n'utilise un drapeau de mécanique qu'aucun niveau précédent n'a utilisé, sauf les **niveaux d'apprentissage** désignés (table `TEACH`), qui en ajoutent exactement un. Un drapeau est une idée qui change la façon de jouer ou de gagner : loi de rotation, type d'obstacle, règle d'un boss ou d'un spécial, PARFAIT et COMBO. L'intensité (vitesse, nombre de tirs, largeur des portes, nombre de bloqueurs) n'est pas un drapeau. Le cadre d'un boss (intro, barre de vie) n'en est pas un non plus ; sa mécanique, si.

Test : pour tout niveau n de 1 à 400, `drapeaux(n) ⊆ drapeaux(1..n−1) ∪ {TEACH[n]}`, et chaque niveau d'apprentissage introduit bien son drapeau et lui seul. Il porte sur les drapeaux du générateur dès l'étape 2 ; PARFAIT et COMBO (niveaux 6 et 8) s'y ajoutent à l'étape 3, les règles des spéciaux (7, 17, 27) et des boss à l'étape 4, quand ces systèmes existent. Un niveau d'apprentissage est court (3 à 5 aiguilles, vitesse modérée, mécanique isolée) et annoncé par un bandeau lisible (hauteur ≥ 10 px, ≥ 2 s, relisible dans la pause et dans la sélection des niveaux, corrige UX-4).

Conséquence pour les boss : en Émeraude, chaque boss est précédé, au niveau x9 du même bloc, du niveau d'apprentissage de sa mécanique, et son palier I n'utilise que cette mécanique. Les paliers suivants n'ajoutent que des idées déjà apprises (table de 5.4, avec le niveau où chacune est apprise).

| Monde (niveaux) | Thème | Niveaux d'apprentissage : la seule idée nouvelle de chacun | Ce que les autres niveaux combinent |
|---|---|---|---|
| Émeraude (1-50) | Découverte | 1 lancer (« TOUCHE POUR LANCER ») ; 2 aiguilles déjà plantées (« ARC ALLUMÉ = ZONE LIBRE ») ; 3 étoiles bonus ; 4 rotation dans l'autre sens ; 6 PARFAIT (« PLANTE AU CENTRE D'UN ARC ») ; 7 spécial PLUIE D'ÉTOILES ; 8 COMBO (« ENCHAÎNE LES TIRS : COMBO ×2, ×3… ») ; **9 « L'ASTRE ACCÉLÈRE À CHAQUE AIGUILLE »** ; 11 respiration (vitesse qui varie doucement) ; 17 spécial CHRONO ; **19 « DEMI-TOUR ANNONCÉ »** (inversion signalée, toutes les k aiguilles) ; 21 dispositions serrées (paires, éventails) ; 27 spécial PARFAIT ; **29 « ZONE INTERDITE »** (arc hachuré fixe) ; **39 « ANNEAU À PORTES »** ; **49 « ROTATION IRRÉGULIÈRE »** | bloqueurs, étoiles, sens, respiration ; boss : 10 Réacteur I, 20 Pendule I, 30 Forteresse I, 40 Anneaux I, 50 Chaos I |
| Ambre (51-100) | Accélération | 51 à-coups ; 61 pas à pas (arrêts) ; 71 rampe (l'astre accélère avec le temps, plus seulement à chaque aiguille) ; 81 deux anneaux à contre-sens | accélération à chaque aiguille avec à-coups, arrêts et rampe ; zones et anneaux simples |
| Rubis (101-150) | Précision | 101 fentes (plusieurs zones interdites séparées par des passages de 3 à 4 GAP) ; 111 zone pulsée (éteinte → annoncée → active → éteinte) ; 121 zone glissante (arc interdit qui se déplace lentement sur le bord ; il passe sur les aiguilles déjà plantées sans effet, seule une aiguille qui arrive dans la zone active est perdue) | zones fixes, fentes, pulsées et glissantes, avec les lois d'Ambre |
| Saphir (151-200) | Rotations inversées | 151 alternée (inversions douces) ; 161 demi-tour au rythme (inversions annoncées à intervalles de temps fixes) ; 171 inversion à chaque aiguille ; 181 ressac (retours en arrière partiels) | toutes les inversions, avec zones et anneaux |
| Obsidienne (201-250) | Difficulté élevée | 201 sentinelle (obstacle mobile en orbite) ; 211 aiguilles traversantes ; 221 deux sentinelles en sens opposés | sentinelles et traversantes avec tout ce qui précède, vitesses hautes |
| Cosmos (251-300) | Défis extrêmes | 251 trois anneaux ; 261 portes pulsées (portes d'anneau qui s'ouvrent et se ferment, annoncées comme les zones pulsées) | 271-299 : tout combiné aux vitesses maximales ; 300 = Chaos VI, boss final |
| COSMOS ∞ (301+) | Sans fin | aucune idée nouvelle | mélange tiré de la graine du niveau parmi toutes les mécaniques, difficulté de plateau ; archétypes de boss en boucle au palier VI |

Les spéciaux (x7) tournent dans l'ordre PLUIE, CHRONO, PARFAIT : PARFAIT tombe aux niveaux 27, 57, 87, 117, 147, 177, 207, 237, 267 et 297. Leur terrain n'utilise que des mécaniques déjà apprises.

Correspondance avec les règles actuelles :

| Règle actuelle | Monde actuel | Nouveau monde |
|---|---|---|
| Rotation continue, respiration | Émeraude | Émeraude |
| À-coups, pas à pas | Braise | Ambre (accélération) |
| Arcs interdits | Givre | Émeraude 29 (zone fixe), puis Rubis (fentes, zones pulsées et glissantes) |
| Alternée, ressac | Ambre, divers | Saphir (rotations inversées) |
| Sentinelle | Iris | Obsidienne |
| Aiguilles traversantes | Soufre | Obsidienne puis Cosmos |
| Mélanges (Opale, Cobalt, cycles) | 7-8 et suivants | Cosmos et COSMOS ∞ |

### 5.4 Boss : un tous les 10 niveaux

**Principe.** Le boss k d'un monde (niveau 10·k) est l'archétype k ; il revient dans chaque monde à un palier plus dur (I à VI). L'ordre du cahier des charges est gardé, sauf l'échange des boss 3 et 4 : les zones interdites (Forteresse) se lisent plus facilement que les anneaux, elles viennent donc avant. Le palier I de chaque archétype n'utilise que sa mécanique, apprise au niveau précédent (x9) ; les paliers suivants n'ajoutent que des idées déjà apprises.

**Barre de vie** : barre segmentée dans le HUD du haut, sous le numéro de niveau, un segment par aiguille à planter, qui se fissure à chaque aiguille plantée (4.4 : il n'y a pas la place d'un anneau autour du cadran).

**Règles d'équité communes** : tout changement est annoncé ≥ 0,5 s à l'avance (0,45 s en Cosmos) par un signal visuel au pas de tir **et** un son ; rien n'est aléatoire pendant le combat (graine) ; l'oscilloscope et le viseur d'avance intègrent la mécanique ; `__botSafe` la modélise exactement ; un boss se gagne sans tir parfait ; plancher d'équité : ≥ 75 % à 30 ms ; au plus 20 points sous ses voisins à 70 ms.

| Boss (niveaux) | Mécanique exacte avec un seul geste | Lisibilité | Identité visuelle et sonore |
|---|---|---|---|
| **LE RÉACTEUR** — accélère progressivement (10, 60, 110, 160, 210, 260) | La vitesse part de v0 et augmente d'un pourcentage fixe à chaque aiguille plantée (rampe douce de 0,3 s après l'impact), jusqu'à un plafond | Rampe visible sur l'oscilloscope et sur un compte-tours (graduations du cadran qui s'allument avec la vitesse) | **Cuboctaèdre** ; ronronnement de moteur dont la hauteur suit la vitesse |
| **LE PENDULE** — change brutalement de direction (20, 70, 120, 170, 220, 270) | Inversion rapide (en 80 ms) toutes les k aiguilles plantées, puis (palier IV et plus) aussi à un rythme fixe ; chaque inversion est annoncée | 0,6-0,9 s avant : les deux chevrons de direction près du pas de tir clignotent et basculent, trois « tic » sonores ; l'oscilloscope montre le front | **Étoile octangle** ; tic-tac, puis coup sec à l'inversion |
| **LA FORTERESSE** — zones interdites (30, 80, 130, 180, 230, 280) | Arcs interdits fixes, puis (palier III et plus) pulsés : éteints → annoncés (contour pointillé clignotant, 0,6 s) → actifs (bande hachurée) → éteints, et glissants (palier IV). Se planter dans une zone active = échec ; une aiguille plantée dans une zone éteinte y reste sans danger | Bord allumé = zones sûres maintenant ; le viseur d'avance indique l'état de la zone à l'instant d'impact prévu | **« Bastion »** : octaèdre inscrit dans un cube (nouveau solide) ; créneaux hachurés ; bourdonnement électrique pendant l'annonce |
| **LES ANNEAUX** — plusieurs anneaux à vitesses différentes (40, 90, 140, 190, 240, 290) | 1 à 3 anneaux-boucliers dans le couloir de tir (géométrie 4.4), chacun à sa vitesse et dans son sens, avec des **portes**. L'aiguille doit passer par une porte de chaque anneau pendant tout le temps où elle le traverse (intervalle fixe du vol), puis se planter sans contact. Toucher un anneau = échec « INTERCEPTÉ » | Anneaux en barres pleines, portes en vide avec repères ; un losange par anneau sur l'axe de tir s'allume quand sa porte sera alignée pour un tir lancé maintenant | **« Gyroscope »** : trois anneaux inclinés autour d'un noyau (nouveau, distinct de la sphère armillaire de Cosmos) ; nappe grave, « clic » de porte |
| **LE CHAOS** — rotation irrégulière avec obstacles mobiles (50, 100, 150, 200, 250, 300) | Vitesse = somme de 2 ou 3 sinusoïdes de fréquences non multiples (jamais deux fois le même motif) ; à partir du palier II, obstacles mobiles déjà appris (anneaux, puis sentinelles) | Oscilloscope sur 1,75 s ; chevrons de direction au pas de tir ; obstacles mobiles en barres pleines | **Icosidodécaèdre** (nouveau) qui vibre légèrement ; arpège instable |

Paliers (ordre de grandeur, réglé à l'étape 4 contre les cibles ; entre parenthèses, le niveau où l'idée ajoutée est apprise ; chaque palier respecte la capacité de 5.10 : tirs + obstacles fixes ≤ 14) :

| Archétype | I · Émeraude | II · Ambre | III · Rubis | IV · Saphir | V · Obsidienne | VI · Cosmos |
|---|---|---|---|---|---|---|
| Réacteur | 10 aiguilles, 1,1 → 2,0 rad/s, rien d'autre | 11, 1,5 → 2,6, + à-coups (51) | 11, 1,7 → 3,0, + 2 bloqueurs | 12, 1,9 → 3,3, + alternée (151) | 12, 2,0 → 3,5, + 1 sentinelle (201) | 12, 2,2 → 3,9, + 2 bloqueurs et 1 sentinelle |
| Pendule | 8, demi-tour toutes les 4, annonce 0,9 s, 1,4 rad/s | 9, toutes les 3, annonce 0,8 s, + 2 bloqueurs | 10, toutes les 3, annonce 0,7 s, + 1 zone fixe | 11, toutes les 3 + au rythme de 3 s (161), annonce 0,6 s | 12, toutes les 2 + rythme 2,5 s, annonce 0,5 s, + 1 sentinelle (201) | 13, toutes les 2 + rythme 2,2 s, annonce 0,45 s, 3,2 rad/s |
| Forteresse | 8, 2 zones fixes larges (0,45 rad), 1,4 rad/s | 8, 3 zones fixes étroites (0,3 rad), + rampe (71) | 9, 2 fixes + 1 pulsée (111), période 3 s | 9, 2 fixes + 1 pulsée + 1 glissante (121) | 9, 2 fixes + 2 pulsées (2,5 s), + 1 sentinelle (201) | 9, 2 fixes + 3 pulsées (2 s), 3 rad/s |
| Anneaux | 8, 1 anneau, 3 portes de 0,9 rad, lent | 9, 2 anneaux à contre-sens (81), portes 0,8 rad | 10, 2 anneaux, portes 0,7 rad, + 1 zone fixe | 10, 2 anneaux à vitesses différentes, astre alterné (151) | 11, 2 anneaux + 1 sentinelle (201) | 11, 3 anneaux (251), 2 portes de 0,5 rad, portes pulsées (261) |
| Chaos | 9, 2 sinusoïdes, aucun obstacle mobile | 10, 2 sinusoïdes + 1 anneau lent (39) | 10, 3 sinusoïdes + 1 anneau | 11, 3 sinusoïdes + 2 anneaux (81) | 11, 3 sinusoïdes + 2 sentinelles opposées (221) | 12, 3 sinusoïdes fortes + 2 sentinelles + 2 anneaux |

Le cahier des charges demande « plusieurs anneaux » pour le boss 3 : c'est le cas dès le palier II (niveau 90) ; le palier I n'en a qu'un, parce que c'est la première rencontre avec un anneau.

**Deuxième phase**, à partir du palier III, à mi-vie : un paramètre **déjà présent dans le combat** monte d'un cran (vitesse, vitesse d'un anneau, une zone pulsée de plus). Flash et son à T, effet à T + 0,6 s (T + 0,45 s en Cosmos), déclenché seulement quand aucune aiguille ne vole ; entre T et l'effet, le pas de tir est verrouillé (sous-phase `annonce`, 4.3) et la chaîne de combo est figée.

**Introduction (< 1,5 s, passable d'un tap dès 0,6 s)** : 0-0,3 s le cadran s'assombrit, balayage à la couleur du monde ; 0,3-0,9 s le solide du boss se trace (animation de tracé vectoriel), titre tapé « BOSS · LE PENDULE » ; 0,9-1,3 s ligne de règle (« AU SIGNAL, DEMI-TOUR ») ; son : nappe grave montante puis impact. Pendant l'intro, `throwPin()` ne fait rien ; le passage d'un tap est géré par la couche d'entrée. Le bandeau reste relisible dans la pause.

**Victoire (≤ 1,6 s avant la feuille)** : bord verrouillé en blanc 0,2 s ; segments de la barre de vie qui éclatent en cascade 0,3 s ; explosion filaire (l'actuelle `explodeScene`, puissance ×1,5) et onde de choc plein écran ; tampon « BOSS VAINCU » ; son : impact grave + accord + cloches ; vibration [30, 40, 60] ; puis feuille avec score, record, et bouton SUIVANT à la couleur du monde suivant après le boss de fin de monde (ART-8).

### 5.5 Niveaux spéciaux et objectifs secondaires

Niveaux spéciaux (x7 de chaque bloc, 30 au total, enseignés à leur première apparition : 7, 17, 27). Ils suivent les **mêmes règles d'équité que les boss** dans `tests/sim/report.js` : ≥ 75 % à 30 ms (avec la règle d'intervalle de confiance de 5.10) et au plus 20 points sous leurs voisins à 70 ms.

| Type | Règle | Condition de victoire | Particularités |
|---|---|---|---|
| **PLUIE D'ÉTOILES** | 6 à 9 étoiles bonus sur l'astre | capturer au moins ⌈0,6 × N⌉ étoiles avant la dernière aiguille | ★2 = toutes les étoiles ; `__botSafe` vise les étoiles restantes |
| **CHRONO** | rotation rapide et constante, jauge de temps qui se vide autour du pas de tir | planter N aiguilles en T secondes (T = 1,3 × le temps médian du joueur simulé à 45 ms) | échec « TEMPS ÉCOULÉ » ; reste dense pour ne pas récompenser la salve aveugle |
| **PARFAIT** | 6 aiguilles, au moins 2 bloqueurs au départ ; fenêtre parfaite élargie à ±45 ms et dessinée comme un couloir lumineux sur chaque arc | **au moins k aiguilles parfaites sur 6** ; une aiguille non parfaite ne se brise pas ; échec « IMPRÉCIS · 2/6, IL EN FALLAIT 3 » dès que k n'est plus atteignable (au plus tard à la dernière aiguille) | k = 2 en Émeraude (niveau 27), 3 d'Ambre à Saphir, 4 en Obsidienne et Cosmos ; ★2 = 6/6 parfaites ; `__botSafe` vise à p/2 du milieu (4.3) |

Taux de victoire du spécial PARFAIT (calcul exact, sans compter le risque de collision) :

| Condition (fenêtre ±45 ms) | σ = 30 ms | σ = 45 ms | σ = 70 ms |
|---|---|---|---|
| Une aiguille parfaite | 86,6 % | 68,3 % | 48,0 % |
| ≥ 2 sur 6 | 100 % | 98,6 % | 87,0 % |
| ≥ 3 sur 6 | 99,6 % | 91,5 % | 61,7 % |
| ≥ 4 sur 6 | 96,5 % | 71,2 % | 30,6 % |
| 6 sur 6 (★2) | 42,3 % | 10,1 % | 1,2 % |

Choix de k : le plus grand qui reste à moins de 20 points des voisins à 70 ms. Au niveau 27, les voisins sont vers 88 % : k = 3 (61,7 %) ferait une falaise, k = 2 (87 %) non. En Rubis, les voisins descendent de 68 à 52 % : k = 4 (30,6 %) serait à 22-37 points dessous, k = 3 convient. En Obsidienne (45 → 32 %) et Cosmos (35 → 22 %), k = 4 convient. `report.js` vérifie ces valeurs sur le vrai jeu et peut les baisser, jamais élargir la fenêtre au-delà de ±45 ms.

Objectif secondaire : chaque niveau en affiche un (bandeau d'intro et petite jauge du HUD), tiré d'un catalogue par une table monde × position (pas de hasard d'une partie à l'autre) :

| Objectif | Condition | Exemple |
|---|---|---|
| PARFAITS k | au moins k tirs parfaits dans la partie (k ≤ 30 % des tirs) | « 3 PARFAITS » |
| COMBO ×k | atteindre le multiplicateur ×k (k = 2 à 4) | « COMBO ×3 » |
| CHRONO T | finir en moins de T secondes | « EN 14 S » |
| SCORE S | score ≥ S (S = 60 % du score du planificateur qui vise juste) | « 6 000 PTS » |

Chaque objectif est vérifié atteignable, niveau par niveau, par le planificateur sans bruit (`tests/sim/planner.js`).

### 5.6 Lancer, collision et tir PARFAIT

- **Lancer exact** : horodaté au tap (4.5), vol constant de 60 ms, pas de simulation de 1/120 s, intégration par trapèzes.
- **Anti-rebond** (couche d'entrée) : un tap à moins de 40 ms du précédent est ignoré (rebond, deux doigts) ; au-delà, chaque tap produit un lancer à son instant exact, **jusqu'à deux aiguilles en vol** (`flying` désigne la plus récente). La file d'attente qui décalait le second tir jusqu'à l'impact du premier disparaît : un tap n'est jamais retardé ni déplacé.
- **Collision = dessin** : le rayon extérieur dessiné d'une tête (trait compris) vaut exactement `GAP × (R + PL) / 2`, donc deux têtes se touchent à l'écran exactement quand l'écart vaut GAP. **La règle reste le test d'atterrissage à GAP**, si bien que les arcs allumés restent exactement sûrs.
  - Pas de contrôle « balayé » pendant le vol : il ajouterait une zone mortelle invisible, d'un seul côté, de 0,041 à 0,078 rad (36 à 68 % de GAP) selon l'écran et la vitesse, ce qui casserait la règle « bord allumé = sûr ».
  - Le seul défaut restant est visuel : pendant les 14 dernières millisecondes du vol (`U.len` × 60 ms, une ou deux images), une tête plantée voisine peut sembler traverser la tige. Il est masqué par le dessin : les têtes plantées sont dessinées par-dessus l'aiguille en vol.
- **Traversantes** : arcs allumés calculés avec les antipodes des bloqueurs (bord allumé = sûr, partout) ; étoiles placées seulement là où une capture est possible.
- **Tir PARFAIT** : aiguille plantée à moins de *p* du **milieu de l'intervalle libre** où elle tombe (milieu entre ses deux voisins occupés), avec *p* = 35 ms × |vitesse à l'impact|, borné entre 0,02 et 0,12 rad (soit exactement ±35 ms entre 0,6 et 3,4 rad/s, et ±32 ms à la vitesse maximale de Cosmos).
  - Pourquoi le milieu de l'intervalle plutôt qu'un repère posé sur l'astre : c'est l'endroit le plus sûr, donc le parfait récompense le bon jeu au lieu de pousser au risque ; il découle des arcs allumés que le joueur lit déjà ; il reste défini dans tous les niveaux à au moins une aiguille ; et un intervalle étroit enfilé est parfait par construction, ce qui récompense naturellement la précision.
  - Pourquoi une fenêtre en temps : ±35 ms est la même exigence à toutes les vitesses. Le joueur simulé à 30 ms réussit environ 75 % de parfaits, celui à 70 ms environ 38 % : facile à comprendre, difficile à maîtriser.
  - **Visible et apprenable** : au milieu de chaque arc allumé, un court segment lumineux de largeur angulaire 2*p* (la vraie tolérance à la vitesse du moment) ; il éclate au parfait. Sur un atterrissage non parfait à moins de 3*p* du milieu, une petite marque « TÔT » ou « TARD » s'affiche 0,4 s au repère : le joueur apprend de quel côté il rate. Le viseur d'avance ne signale pas le « parfait maintenant », pour que le parfait reste une anticipation.
  - Astre vide : pas d'intervalle, donc pas de parfait (première aiguille du niveau 1). PARFAIT et COMBO sont actifs à partir de leurs niveaux d'apprentissage (6 et 8).

### 5.7 Combo, score et records

**Combo** : chaque aiguille plantée moins de *T*combo après l'impact précédent prolonge la chaîne (+1, ou +2 pour un PARFAIT) ; sinon la chaîne repart à 1. *T*combo = la moitié d'un tour de l'astre à sa vitesse moyenne, bornée entre 1,2 et 2,4 s. Elle est affichée comme un arc qui se vide autour du berceau du pas de tir.

- **Portée** : une tentative. La chaîne repart de zéro à chaque `startLevel` et à chaque REPRISE ; sa minuterie est **figée** pendant les intros de boss, les annonces de deuxième phase, les comptes à rebours et la pause.

| Chaîne c | 0-2 | 3-5 | 6-8 | 9-11 | ≥ 12 |
|---|---|---|---|---|---|
| Multiplicateur M | ×1 | ×2 | ×3 | ×4 | ×5 |

Le combo met en tension la patience (attendre la meilleure fenêtre) et le rythme (enchaîner), sans jamais être nécessaire pour finir un niveau.

**Étoile éphémère** (le bonus qui apparaît en cours de jeu, cahier des charges § 2) : à chaque palier de combo ×3 ou plus, une étoile éphémère apparaît au milieu de l'arc allumé le plus large et y reste 2,5 s (petit compte à rebours circulaire, tintement à l'apparition). Capturée comme une étoile bonus (aiguille plantée à moins de `ORBHIT`), elle vaut +300 × M ; elle ne compte pas pour ★2. Elle ne dépend que du jeu (niveau, instants des tirs) : la relecture et la reprise restent exactes. Comme elle se trouve au milieu d'un arc, la capturer revient souvent à réussir un parfait : les deux récompenses se renforcent.

**Score** :

- Aiguille : (100 + 150 si PARFAIT + 50 si FRÔLÉ) × M.
- Étoile bonus capturée : +250 (non multiplié) ; étoile éphémère : +300 × M.
- Niveau fini : +500 (+1 500 pour un boss).
- Exemple : 10 aiguilles dont 4 parfaites, multiplicateur moyen ×2, 3 étoiles : ≈ (1 000 + 600) × 2 + 750 + 500 ≈ 4 450.

**Records** : par niveau (meilleur score, meilleure chaîne, parfaits, meilleur temps) et globaux (meilleur combo, parfaits cumulés, meilleure série, **score de carrière** = somme des meilleurs scores par niveau, qui ne fait que monter et sera la base d'un classement réel en phase 2). Affichage : feuille de victoire (score qui défile en 0,5 s, record, tampon « NOUVEAU RECORD »), feuille d'échec (« 7/10 plantées · record 8/10 »), écran Records accessible depuis le menu, données 100 % locales.

**Un seul emplacement de message par atterrissage.** PARFAIT, palier de COMBO, ★ n/3 et FRÔLÉ peuvent tomber sur la même aiguille ; les empiler serait du bruit. Priorité : PARFAIT > palier COMBO > ★ > FRÔLÉ. Le premier s'affiche, les autres s'ajoutent en suffixe (« PARFAIT · ★ 2/3 »). Sons et vibrations suivent la même priorité, avec au plus deux voix par atterrissage (le son d'impact et celui de l'événement prioritaire). L'emplacement est sous le cadran, ou au-dessus du cadran sur les niveaux à anneaux (4.4). `tests/ui.js` vérifie en 320×568 que les boîtes des messages ne se chevauchent jamais entre elles ni avec le HUD.

### 5.8 Étoiles

Trois étoiles par niveau, chacune avec un sens clair et **cumulables d'une partie à l'autre** (un objectif atteint reste acquis) :

1. ★ **Fini** : terminer le niveau.
2. ★ **Étoiles bonus** : capturer toutes les étoiles bonus de l'astre (1 à 3) dans une même partie ; sur un spécial PARFAIT, réussir 6 parfaits sur 6. L'étoile éphémère ne compte pas.
3. ★ **Objectif** : réussir l'objectif secondaire du niveau.

Total : 900 étoiles sur 300 niveaux, compteur par monde (x/150), badge « MONDE PARFAIT » à 150/150. Les étoiles ne bloquent rien ; elles débloqueront les cosmétiques en phase 2. La feuille de victoire indique ce qui manque (« Il te manque ★ OBJECTIF : 2 PARFAITS »).

### 5.9 Séries et récompenses

- **Série** : nombre de niveaux consécutifs gagnés **en 3 tentatives au plus**. Une victoire la fait monter si elle apporte quelque chose (premier passage du niveau ou étoile nouvelle) ; une victoire sans gain ne la fait ni monter ni tomber (on peut s'entraîner librement, mais pas accumuler des jetons en rejouant un niveau facile). Le 3e échec de suite sur un niveau où il reste quelque chose à gagner la remet à zéro ; les niveaux déjà à 3★ ne la cassent jamais. Pourquoi « 3 tentatives » : dans les derniers mondes, un joueur moyen ne gagne un niveau du premier coup qu'une fois sur trois ou quatre ; une série « sans échec » n'y dépasserait presque jamais 3, et les jetons ne tomberaient qu'en Émeraude, là où on n'en a pas besoin.
- **Récompense réelle : le jeton « REPRISE »**, gagné aux paliers de série (stock maximum 3). Les paliers sont réglés par `tests/sim/streak.js` pour qu'un joueur à σ = 45 ms gagne en moyenne un jeton tous les 8 à 12 niveaux, dans chaque monde.
- **REPRISE** : sur la feuille d'échec, le bouton « REPRISE ◆2 » (affiché seulement si l'on possède un jeton, une fois par tentative). À l'appui, le jeton est décompté et sauvegardé, puis la partie est rejouée sans le tir fatal jusqu'à son instant (4.6), suivie d'un compte à rebours de 0,8 s (rotation figée, taps ignorés). La chaîne de combo repart à zéro ; la série est conservée (la REPRISE annule, pour la série, l'échec qu'elle répare). C'est le même mécanisme que la future « seconde chance » facultative de la phase 2, donc rien n'est jeté.
- Affichage : « SÉRIE 7 » sur la feuille de victoire et au menu, message de palier (« SÉRIE 12 · +1 REPRISE »), meilleure série dans les records.

### 5.10 Difficulté : cibles et paramètres

**Mesure de référence** : politique du « joueur qui vise » (attend la meilleure fenêtre et vise son milieu ; imprécision temporelle gaussienne σ), appliquée au vrai cœur du jeu dans Node (4.10).

**Méthode statistique** (300 essais donnent ±2,5 points d'erreur type autour de 75 %, trop pour trancher seuls) :
- générateur pseudo-aléatoire à graine dans tous les outils, graines versées dans le dépôt ;
- 300 essais par niveau et par σ ; tout niveau estimé sous 85 % est remesuré avec 1 000 essais ;
- **plancher** : un niveau passe si l'estimation est ≥ 75 % **et** si la borne basse de l'intervalle de confiance à 95 % (Wilson) est ≥ 72 % ;
- un niveau signalé par la règle des falaises est remesuré avec 1 000 essais avant d'échouer ;
- `report.js` imprime les intervalles de confiance et les graines.

| Monde | Tirs + obstacles fixes, début → fin (≤ 14) | Vitesse ω (rad/s) | Leviers principaux | σ = 30 ms : minimum par niveau / moyenne | σ = 70 ms : moyenne début → fin du monde | Boss et spéciaux à 70 ms | Durée d'un niveau propre |
|---|---|---|---|---|---|---|---|
| Émeraude | 4 + 0 → 8 + 4 | 1,1 → 2,2 | nombre de bloqueurs, respiration, vitesse | ≥ 95 % / ≈ 99 % | 97 → 80 % | 75-85 % | 6-15 s |
| Ambre | 6 + 2 → 9 + 5 | 1,6 → 2,8 | accélération à l'impact, à-coups, arrêts, rampe | ≥ 90 % / ≈ 96 % | 80 → 65 % | 60-70 % | 10-18 s |
| Rubis | 6 + 3 → 9 + 5 | 1,8 → 3,0 | fentes, zones pulsées et glissantes | ≥ 85 % / ≈ 93 % | 68 → 52 % | 48-58 % | 12-22 s |
| Saphir | 7 + 2 → 10 + 4 | 1,9 → 3,2 | inversions douces, au rythme, à l'impact, ressac | ≥ 82 % / ≈ 90 % | 58 → 42 % | 38-48 % | 12-24 s |
| Obsidienne | 7 + 2 → 10 + 4, plus 1-2 sentinelles | 2,1 → 3,5 | sentinelles, traversantes | ≥ 78 % / ≈ 87 % | 45 → 32 % | 28-38 % | 14-28 s |
| Cosmos | 8 + 2 → 11 + 3 (ou 9 + 5), plus anneaux et sentinelles | 2,3 → 3,8 | trois anneaux, portes pulsées, tout combiné | ≥ 75 % / ≈ 84 % | 35 → 22 % | 20-30 % | 15-30 s |
| COSMOS ∞ | plateau (≤ 14) | plateau | mélange | ≥ 75 % | 22-30 % | 20-30 % | 15-30 s |

**Capacité** : tirs + obstacles fixes ≤ 14 « équivalents aiguilles » sur le bord (budget actuel, l. 515), pour que le bot du banc d'essai (marge 1,7 × GAP) puisse toujours finir ; la revue a montré qu'au-delà (16,5) il échoue. Décompte :
- un tir ou un bloqueur isolé = 1 ;
- un arc interdit fixe = `unionMeasure(arc, ±1,7 × GAP) / (3,4 × GAP)` (un arc de 0,45 rad compte environ 2,15) ;
- zones pulsées et glissantes, anneaux et sentinelles = 0 unité permanente, mais `tests/sim/bot.js` doit quand même finir chaque niveau avec 0 mort et 0 blocage.

Plus de tirs veut donc dire moins d'obstacles fixes : la difficulté des derniers mondes vient de la vitesse, de ses variations, des obstacles mobiles et des anneaux.

**Salve à l'aveugle** (meilleure cadence parmi 100, 150, 200 et 250 ms ± 1 image, **200 départs par cadence**, sans relance) : ≤ 30 % de succès sur les niveaux 11-50 (1-10 libres, c'est l'apprentissage) ; **à partir du niveau 51, chaque niveau passe si la meilleure cadence réussit au plus 6 départs sur 200** ; salve soutenue pendant 60 s (relance dès que permise, 150 ms ± 1 image) : moins de 10 % des niveaux 51-100 finis et moins de 5 % au-delà. Autrement dit, taper sans regarder ne fait plus passer de niveau après le monde 1.

Règles :
- **Plancher d'équité** : chaque niveau ≥ 75 % à 30 ms (avec la règle d'intervalle ci-dessus).
- **Respirations** : x1-x2 de chaque bloc ≈ +10 points à 70 ms par rapport aux niveaux x8 et x9 du bloc précédent (x8 seul en Émeraude, où x9 est un niveau d'apprentissage).
- **Pas de falaise** : un niveau normal n'est jamais à plus de 12 points sous la moyenne de ses 4 voisins normaux à 70 ms ; un boss ou un spécial au plus 20 points sous ses voisins.
- **Anti-salve** : à partir du monde 2, chaque niveau combine au moins deux des moyens suivants : obstacles fixes larges (arcs interdits), loi à arrêts ou inversions, obstacles mobiles ou anneaux (une porte laisse passer moins d'un tir aveugle sur deux) ; orientation de départ choisie pour que les obstacles passent sous le pas de tir dans les 0,2-1,5 premières secondes (mesure de la revue : 21 → 11 niveaux finis à l'aveugle sur 1-40) ; relance seulement une fois la feuille d'échec affichée, puis 250 ms de verrou.

Paramètres qui pilotent la difficulté, tous dans `DIFFICULTY` et `WORLDS` : nombre de tirs, obstacles fixes et leur disposition, vitesse (bornes par monde, rampe intra-monde en dents de scie par bloc), lois de rotation autorisées et leurs poids, intensité des mécaniques (accélération par aiguille, fréquence des inversions, durée d'annonce ≥ 0,45 s, vitesse des sentinelles, nombre d'anneaux et largeur des portes), fenêtre combo. Le réglage se fait par `tests/sim/report.js`, qui compare chaque monde à sa cible avec une tolérance de ±7 points et échoue si le plancher ou la règle des falaises est violé.

### 5.11 Retours (feedback) et durées

Toutes les durées sont courtes pour ne jamais casser le rythme ; le mode « mouvement réduit » retire secousses, flashs et ralenti, mais garde sons et vibrations.

| Événement | Visuel | Haptique (Android ; l'API n'existe pas sur iPhone, rien n'est simulé) | Son | Durée |
|---|---|---|---|---|
| Lancer | traînée de l'aiguille dans le phosphore | — | souffle bref + note montante | 60 ms (vol) |
| Impact | aiguille qui s'enfonce avec un léger rebond ; petit anneau lumineux au point d'impact ; segment de bord qui flashe ; l'astre recule de 3 px et grossit de 2 % puis revient ; 7 étincelles | 10 ms | « tink » métallique (FM inharmonique) + note de la gamme du monde | 120-180 ms |
| PARFAIT | anneau blanc qui s'étend, repère central qui éclate, « PARFAIT » dans l'emplacement de message (priorité 1) | [8, 20, 8] | chatoiement aigu propre au parfait | 250-600 ms |
| Presque parfait (à moins de 3*p*) | marque « TÔT » ou « TARD » au repère du milieu | — | — | 400 ms |
| Palier de combo | « COMBO ×3 » (priorité 2, ou suffixe) qui grossit puis se fixe ; le bord et les graduations s'éclairent selon le multiplicateur | 12 ms | arpège montant d'un degré par palier | 450 ms |
| Étoile capturée | éclat d'accent, étoile du HUD qui se remplit, « ★ 2/3 » (priorité 3, ou suffixe) | [10, 20, 10] | deux cloches | 400 ms |
| Étoile éphémère | apparition au milieu de l'arc le plus large avec compte à rebours circulaire ; capture : éclat + score | [10, 20, 10] à la capture | tintement à l'apparition, deux cloches à la capture | 2,5 s de vie |
| FRÔLÉ | arc d'accent sur l'intervalle serré, « FRÔLÉ · 3° » (priorité 4, ou suffixe), jamais sur l'anneau du cadran (ART-4) | [8, 30, 8] | deux notes aiguës | 900 ms |
| Échec | flash au point de contact (80 ms), les deux aiguilles se brisent en éclats, croix d'alerte ; **ralenti** : la rotation tombe à 20 % puis s'arrête en 0,25 s ; secousse de 6 px sur 180 ms ; sauvegarde écrite au même tick | [30, 40, 90] | dent de scie qui chute + bris de verre | feuille d'échec à **0,45 s** |
| Feuille d'échec | montée en 150 ms ; la scène remonte et se réduit si besoin pour que le point de collision (ou la sentinelle fautive) reste visible au-dessus du panneau ; cause en clair (« Il manquait 3° », « Aiguille plantée en pleine zone interdite », « Interceptée par l'anneau ») ; MENU à droite comme sur les autres feuilles ; HUD aligné sur la feuille | — | — | tap n'importe où = réessayer dès 0,45 s ; taps avant 0,45 s ignorés |
| Relance | pas de bandeau, construction de l'astre en 0,25 s, rappel de la cause 1,2 s près du pas de tir ; **tirs ignorés pendant 250 ms** après une relance par tap | — | note brève | 0,25 s |
| REPRENDRE (pause, reprise après fermeture) | compte à rebours 3-2-1 sur le pas de tir, rotation figée, taps ignorés | — | trois tics | 0,6 s |
| Deuxième phase d'un boss | flash au pas de tir, pas de tir verrouillé | 12 ms | accord montant | effet à T + 0,6 s |
| Victoire | bord verrouillé 0,25 s, explosion filaire à 0,3 s, feuille à 1,0 s (1,6 s pour un boss), score qui défile 0,5 s (passable d'un tap), étoiles qui apparaissent à 0,15 s d'intervalle | [20, 30, 20] | gamme montante + cloches + impact grave | 1,0-1,6 s |
| Changement de monde | balayage, morphing de palette 0,6 s, bandeau du monde tapé | — | accord de quinte + cloches | 2,0 s (passable) |

### 5.12 Identité sonore et musique

Tout reste synthétisé (WebAudio) : aucun fichier audio, chargement nul. Deux bus séparés, **EFFETS** et **MUSIQUE**, chacun avec son réglage persistant, alimentent le compresseur maître.

| Son | Synthèse | Caractère |
|---|---|---|
| Lancement | bruit filtré passe-bande qui monte + triangle glissé | sec, 50 ms |
| Impact | triangle sur la note du degré k de la gamme du monde + « tink » FM (rapport 2,76) dont la hauteur monte avec le combo | métallique, distinctif |
| Combo (palier) | arpège de 3 notes de la gamme, une octave plus haut à chaque palier | gratifiant |
| Parfait | cloche FM aiguë + octave + léger souffle inversé | unique, reconnaissable |
| Étoile | deux cloches (existant) | brillant |
| Changement de monde | nappe de quinte + 4 cloches (existant, enrichi) | solennel, 2 s |
| Victoire | gamme montante + cloches + basse (existant) | court |
| Défaite | dents de scie qui chutent + bruit de bris | net, jamais agressif |
| Boss : intro, inversion, porte, victoire | nappe grave, tic-tac, clic, impact + accord | identité par boss |

**Musique électronique discrète, procédurale** : séquenceur à anticipation (minuterie de 25 ms, programmation 120 ms à l'avance sur l'horloge audio), tempo et gamme par monde (Émeraude 100 BPM pentatonique … Cosmos 124 BPM), 4 couches : basse pulsée, nappe lente, arpège de cloches dont la densité suit le multiplicateur de combo, tic de charleston en bruit filtré. Mixée environ 12 dB sous les effets. Pendant la pause : −12 dB et filtre ; à l'échec : filtre qui se ferme 0,6 s ; page masquée : contexte suspendu. Variante mineure et percussions pendant les boss. Les « pings » de la boîte à musique restent dans les effets, sur la même gamme. `soundOn` coupe les effets ; `musicOn` coupe la musique ; les deux sont indépendants.

**Réglages** : la musique arrive à l'étape 5 **avec** son bouton MUSIQUE, à côté de SON, dans le menu et dans la feuille de pause, sauvegardé dans `settings.music` ; l'étape 6 déplace les deux dans l'écran Réglages. Le réglage VIBRATIONS (étape 6) n'est affiché que si `('vibrate' in navigator) && matchMedia('(pointer: coarse)').matches` : Chrome sur ordinateur expose l'API sans moteur de vibration, un bouton y serait décoratif.

---

## 6. Plan par étapes

Règles communes à toutes les étapes :
- le banc d'essai `node tests/shoot.js index.html <dossier>` rend `pass: true` à chaque commit, la fumée de `tests/ui.js` passe, et les tests ajoutés aux étapes précédentes restent verts ;
- un changement de comportement par commit, message clair en français ;
- **points de contrôle du porteur** à la fin des étapes 2 et 4 : une version jouable publiée à une adresse que le porteur peut ouvrir sur son téléphone, avec un journal des changements de 10 lignes en français ; ses retours sont traités en tête de l'étape suivante.

| Étape | Cahier des charges § 11 | Contenu | Contrôle du porteur |
|---|---|---|---|
| 1 | 5 | Découpage, chargement fiable, lancer et collision, parcours d'échec | — |
| 2 | 6 | Structure 6 × 50, sauvegarde v2, générateur v2, nouvelles mécaniques, difficulté mesurée | oui |
| 3 | 7 | Parfait, combo, étoile éphémère, score, objectifs, étoiles, records | — |
| 4 | 8 | Boss (5 × 6 paliers) et niveaux spéciaux | oui |
| 5 | 9 | Animations, effets, son, musique et son réglage | — |
| 6 | 10, 11 | Menus, mondes, séries et REPRISE, reprise après fermeture, réglages, optimisation mobile | — |
| 7 | — | Contrôle qualité final | liste de vérification sur appareil |

### Étape 1 — Fondations, lancer et collision (§ 11, point 5)

**But** : le même jeu et les mêmes niveaux, mais un code découpé, un démarrage qui ne dépend plus du réseau, un lancer exact et identique sur tous les écrans, une collision qui correspond exactement au dessin, et un échec bien servi.

**Hors périmètre** : structure 6 × 50, palettes, générateur et difficulté, sauvegarde v2 et migration (étape 2) ; score, combo, parfait (étape 3) ; boss (étape 4) ; musique (étape 5) ; reprise après fermeture, séries, réglages, budget batterie (étape 6). Les niveaux restent ceux d'aujourd'hui, à une exception près : le placement des étoiles sur les niveaux à traversantes (commit 1.9).

**Commits**, dans cet ordre. Après chacun : `tests/shoot.js` → `pass: true`, fumée de `tests/ui.js` sans erreur, `tests/unit` vert.

| # | Commit | Contenu |
|---|---|---|
| 1.1 | Découpage neutre | Le script d'`index.html` est déplacé tel quel dans les 11 fichiers `js/` de 4.2 (sauf `score.js`, qui n'existe qu'à l'étape 3), chargés en `<script defer>` ; CSS en ligne ; `main.js` en dernier, seul à agir au chargement. `sw.js` inchangé (il met déjà en cache tout fichier chargé). Ajout de `tests/unit/dump.js`, des références `tests/ref/` (générées depuis `git show ad561a3:index.html`) et de la fumée `tests/ui.js` |
| 1.2 | Chargement fiable | Polices auto-hébergées (`fonts/`, `fonts/OFL.txt`, `@font-face`, liens Google retirés) ; `sw.js` à précache atomique `orbita-v4`, adresses `?v=4`, mise à jour seulement au menu ; garde-fou de démarrage en ligne ; `tests/unit/sw.test.js` et `tests/ref/sw-hashes.json` |
| 1.3 | Pas fixe, trapèzes, rendu interpolé | `loop` à accumulateur ; `update(dt)` en pas de 1/120 s ; intégration par trapèzes dans `update` et dans la prédiction ; rendu à α = reste / STEP |
| 1.4 | Vol constant et positions u | `FLIGHT = 60 ms`, positions `U` dans `config.js`, vol et sentinelle calculés en u, carte affine par morceaux dans `render.js`, `FLYV = (LAUNCH − (cy + R)) / FLIGHT` |
| 1.5 | Lancer horodaté | `e.timeStamp` → instant simulé ; garde « millisecondes depuis 1970 » ; bornage à [dernier instant simulé, maintenant] ; `throwPin(tSim)` |
| 1.6 | Fin de la file d'attente | Suppression de `queued` ; jusqu'à deux aiguilles en vol ; anti-rebond de 40 ms dans `tap()` et le clavier ; `tests/shoot.js` : échec volontaire déterministe au niveau 10, dont l'absence met `pass` à `false` |
| 1.7 | REPRENDRE avec compte à rebours | Sortie de pause : 0,6 s de compte à rebours, rotation figée, taps ignorés, puis `play` (sous-phase `compte`, 4.3) |
| 1.8 | Têtes = GAP | Rayon extérieur dessiné des têtes = `GAP × (R + PL) / 2` ; têtes plantées dessinées par-dessus l'aiguille en vol |
| 1.9 | Traversantes | Arcs allumés calculés avec les antipodes ; étoiles placées seulement où une capture est possible |
| 1.10 | Échec : chronologie | Feuille à 0,45 s ; taps avant ignorés ; relance par tap seulement sur la feuille ; verrou de 250 ms après une relance par tap (couche d'entrée) ; cause rappelée près du pas de tir pendant 1,2 s après la relance |
| 1.11 | Échec : mise en page | Scène qui remonte pour laisser voir la collision ou la sentinelle fautive ; MENU à droite ; HUD aligné sur les feuilles (ART-7) |
| 1.12 | Textes | Message des arcs interdits (UX-3) ; fautes et formulations (UX-6) ; mise à jour de `README.md` et `tests/README.md` |

**Fichiers** :
- modifiés : `index.html`, `sw.js`, `README.md`, `tests/shoot.js`, `tests/README.md` ;
- créés : `js/config.js`, `js/util.js`, `js/vector.js`, `js/levels.js`, `js/store.js`, `js/core.js`, `js/audio.js`, `js/fx.js`, `js/render.js`, `js/ui.js`, `js/main.js` ; `fonts/b612-latin-400-normal.woff2`, `fonts/b612-latin-700-normal.woff2`, `fonts/b612-mono-latin-400-normal.woff2`, `fonts/b612-mono-latin-700-normal.woff2`, `fonts/OFL.txt` ; `tests/ui.js`, `tests/play.js`, `tests/perf.js`, `tests/lib/serve.js` (petit serveur HTTP local, nécessaire au service worker) ; `tests/unit/run.js`, `tests/unit/dump.js`, `tests/unit/geometry.test.js`, `tests/unit/timing.test.js`, `tests/unit/sw.test.js` ; `tests/ref/levels-ad561a3.json`, `tests/ref/sweep-ad561a3.json`, `tests/ref/sw-hashes.json`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil | Commit |
|---|---|---|---|
| Contrat de test et jeu | `tests/shoot.js` | `pass: true`, niveaux 1..60 gagnés en < 75 s de jeu | chacun |
| Aucun bouton décoratif, aucune erreur (fumée) | `tests/ui.js` | chaque bouton visible de chaque écran cliqué ; Espace, Entrée, P, Échap dans chaque état ; son basculé ; case de niveau ; `visibilitychange` : 0 erreur console ou page, état attendu après chaque action | chacun, dès 1.1 |
| Découpage neutre | `tests/unit/dump.js` + balayage de `shoot.js` | vidage de `makeLevel(1..200)` et de la mise en page sur 5 écrans, et temps du balayage (`simTimes`) identiques octet pour octet à `ad561a3` | 1.1 |
| Démarrage sans réseau tiers | `tests/ui.js`, requêtes vers les domaines Google bloquées | `state` défini en < 1 s ; aucune requête vers `fonts.googleapis.com` ou `fonts.gstatic.com`, même non bloquées | 1.2 |
| Hors ligne et mise à jour | `tests/ui.js` sur `tests/lib/serve.js` | second chargement sans réseau < 1 s ; une nouvelle `VERSION` ne s'applique qu'au menu, jamais pendant un niveau | 1.2 |
| Cohérence du service worker | `tests/unit/sw.test.js` | échoue si un fichier change sans `VERSION`, si un fichier référencé manque dans `FILES`, ou si un `?v=` diffère | 1.2 |
| Garde-fou de démarrage | `tests/ui.js` : un script rendu volontairement invalide | message « TOUCHE POUR RECHARGER » en ≤ 4 s ; jamais d'écran noir muet | 1.2 |
| Intégration | `tests/unit/timing.test.js` (référence numérique d'erreur < 1e-4 rad) | angle d'impact à 0,002 rad de la référence après 30 s de jeu, pour chaque loi de rotation ; résultats identiques à 1e-9 près quel que soit le rythme d'appel (30, 60, 90, 120, 144 Hz) | 1.3 |
| Régularité | `tests/perf.js`, boucle pilotée par une horloge virtuelle à 90 et 120 Hz | coefficient de variation de l'incrément de rotation par image < 5 % | 1.3 |
| Ralenti sous charge | `tests/perf.js` à CPU ×4 | vitesse de simulation ≥ 0,98× | 1.3 |
| Indépendance à l'écran | `tests/ui.js` sur 320×568, 360×640, 390×664, 390×844, 430×932 | vol = 60 ± 1 ms ; un même journal de tirs donne les mêmes issues et les mêmes angles à 1e-9 près sur les 5 écrans ; pointe et queue dessinées qui croisent l'orbite des sentinelles et le cercle des têtes à ±1 ms de l'instant physique | 1.4 |
| Lancer horodaté | `tests/unit` + `tests/ui.js` (événements à phases aléatoires dans l'image, horodatage « depuis 1970 », événement en retard) | départ à l'instant du tap à 1 ms près ; jamais dans le passé ; garde active | 1.5 |
| Latence | `tests/perf.js` : événement tactile horodaté → première image où l'aiguille a quitté le pas de tir | ≤ 1 image en médiane, jamais plus de 2 | 1.5 |
| Double tap | `tests/play.js` (rejeu de la mesure 1.10, deux taps à 8 ms d'écart par `tap()`) | 0 mort sur 40 aux niveaux 1, 2, 3, 8 et 21 | 1.6 |
| Tir pendant un vol | `tests/play.js` | un second tap 60 à 200 ms après le premier part à son instant exact ; jamais plus de deux aiguilles en vol | 1.6 |
| Échec volontaire | `tests/shoot.js` | état `failed` atteint au niveau 10, sinon `pass: false` | 1.6 |
| REPRENDRE | `tests/ui.js` | 0,6 s de compte à rebours, rotation figée, taps ignorés, puis `play` ; `throwPin()` et `__botSafe()` inertes pendant le compte | 1.7 |
| Collision = dessin | `tests/unit/geometry.test.js` + captures de deux aiguilles à GAP ± 0,002 rad sur les 5 écrans | contact visuel ⇔ défaite | 1.8 |
| Traversantes | `tests/play.js` | part du bord allumé mortelle = 0 % (échantillonnage tous les 0,001 rad) ; chaque étoile a un angle de capture sûr (niveaux 1..200) | 1.9 |
| Prédicteur | `tests/play.js` | 0 mort et 0 blocage sur les niveaux 1..200 × 4 parties, à dt 1/60 et 1/120 | 1.6 et 1.12 |
| Parcours d'échec | `tests/ui.js` sur les 5 écrans | point de collision et sentinelle fautive ≥ 4 px au-dessus du filet du panneau ; tap à 0,3 s ignoré, à 0,5 s relance ; tirs ignorés 250 ms après une relance par tap ; MENU à droite ; HUD aligné | 1.10, 1.11 |
| Textes | `tests/unit` (catalogue des messages) + relecture | message des arcs interdits juste (UX-3) ; fautes UX-6 corrigées | 1.12 |

### Étape 2 — Structure 6 × 50 et difficulté progressive (§ 11, point 6)

**Périmètre**, par groupes de commits :
1. **Cœur sans DOM** (neutre) : bus d'événements ; `config`, `util`, `levels` et `core` chargeables dans Node ; `tests/sim/load.js` et `tests/sim/agree.js`. Preuve : mêmes vérifications de neutralité qu'en 1.1 (vidage, balayage, fumée) et accord Node / Chromium.
2. **Structure** : 6 × 50 + COSMOS ∞ ; tables `WORLDS` aux 6 palettes (planche comparant les deux violets d'Obsidienne) ; **sauvegarde v2 et migration de l'ancienne version** (elles arrivent avec la renumérotation des niveaux, sans quoi la version publiée au point de contrôle afficherait d'anciennes étoiles sur de nouveaux niveaux) ; sélection des niveaux minimale par monde (6 sections repliables, en attendant l'étape 6).
3. **Générateur v2** piloté par `WORLDS`, `TEACH` et `DIFFICULTY` ; mécaniques existantes redistribuées selon 5.3 ; décompte de capacité ; orientation de départ anti-salve ; bandeaux de règle relisibles (UX-4) ; chevrons de direction au pas de tir qui annoncent arrêts et inversions 0,45 s avant (BAL UX-1) ; codage par la forme des obstacles mobiles (ART-3) ; premier réglage de la difficulté (c'est ici que le jeu cesse d'être trop facile).
4. **Nouvelles mécaniques, un commit chacune**, chacune avec son niveau d'apprentissage, son dessin, `predict()` / `__botSafe` et `bot.js` à 0 mort : accélération à chaque aiguille ; demi-tour annoncé (toutes les k aiguilles, puis au rythme) ; anneau à portes (1, 2 puis 3 anneaux, portes pulsées), avec la géométrie de 4.4 ; rotation irrégulière ; rampe ; zone pulsée ; zone glissante (elle passe sur les aiguilles déjà plantées sans effet ; seule une aiguille qui arrive dans la zone active est perdue ; hachures dessinées par-dessus ces aiguilles) ; inversion à chaque aiguille ; deux sentinelles opposées.
5. **Réglage final** monde par monde avec `report.js`.

Les emplacements de boss (x10) jouent dès cette étape la mécanique de leur archétype aux paramètres de leur palier, comme un niveau normal (sans intro, barre de vie ni deuxième phase) : difficulté et drapeaux sont donc mesurés dès l'étape 2, et l'étape 4 ajoute le cadre du boss. Les spéciaux (x7) se jouent comme des niveaux normaux jusqu'à l'étape 4.

**Fichiers** : `index.html`, `js/config.js`, `js/util.js`, `js/levels.js`, `js/core.js`, `js/store.js`, `js/render.js`, `js/ui.js`, `js/fx.js`, `js/audio.js` (abonnement au bus), `sw.js` (`VERSION`), `tests/sim/*`, `tests/unit/*`, `tests/ui.js`, `tests/shoot.js` (seulement si une nouvelle mécanique exige d'étendre son repli sans `__botSafe`).

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Accord du simulateur | `tests/sim/agree.js` | ≥ 2 000 tentatives (σ au hasard, niveaux 1..400) : ≥ 99,5 % d'issues identiques entre Chromium et Node |
| Cibles par monde | `tests/sim/report.js` | moyennes 30/70 ms dans la table 5.10 à ±7 points ; plancher (règle d'intervalle) sur 1..300 et sur 100 niveaux de COSMOS ∞ |
| Pas de falaise, respirations | `tests/sim/report.js` | règles 5.10, après remesure à 1 000 essais ; rapport listant chaque exception, intervalles et graines |
| Joueur qui n'anticipe pas (réactif) | `tests/sim/report.js` | aucune falaise propre aux inversions et aux arrêts (écart ≤ 15 points avec ses voisins) |
| Salve aveugle | `tests/sim/mash.js` (200 départs par cadence) | ≤ 30 % sur 11-50 ; ≤ 6/200 sur chaque niveau à partir de 51 ; salve soutenue 60 s : < 10 % des niveaux 51-100 finis, < 5 % au-delà |
| Une idée à la fois | `tests/unit` | pour tout n de 1 à 400, emplacements de boss compris : `drapeaux(n) ⊆ drapeaux(1..n−1) ∪ {TEACH[n]}` ; chaque niveau d'apprentissage d'une mécanique du générateur l'introduit, et elle seule, en 3 à 5 aiguilles (les niveaux 6, 8, 7, 17 et 27 sont vérifiés aux étapes 3 et 4) |
| Capacité | `tests/unit` | tirs + obstacles fixes ≤ 14 sur chaque niveau 1..400 |
| Prédicteur honnête | `tests/sim/bot.js` + `tests/play.js` | 0 mort, 0 blocage sur 300 niveaux × 4 parties, à dt 1/60 et 1/120 |
| Géométrie des anneaux | `tests/ui.js` en 320×568 et 360×640 | écart entre anneaux ≥ 12 px ; portes ≥ 3 × HEAD ; losanges ≥ 8 px ; boîtes des anneaux, bandeaux, HUD sans chevauchement |
| Indépendance à l'écran avec anneaux | `tests/ui.js` sur les 5 écrans | même journal de tirs → mêmes issues et angles à 1e-9 ; pointe dessinée qui croise chaque anneau à ±1 ms de l'instant physique |
| Zone glissante | `tests/unit` | une zone qui passe sur une aiguille plantée ne la tue pas ; une aiguille qui arrive dans la zone active est perdue ; `predict()` d'accord |
| Migration | `tests/unit` + `tests/ui.js` (vraies clés v1 posées avant chargement) | ancien `unlocked` 150 → `unlocked` 150, aucun bit d'étoile, `legacyStars` = ancien total, CONTINUER → niveau 1 (premier niveau d'apprentissage non fini) ; valeurs corrompues sans erreur |
| Palettes | `tests/unit` + planche | contraste des libellés ≥ 4,5:1 ; planche Obsidienne `#b48cff` / `#9a6bff` remise au porteur |
| Durées | `tests/sim/report.js` | niveau propre (45 ms) dans les plages de 5.10 |
| Banc d'essai | `tests/shoot.js` | `pass: true` (niveaux 1..60 en < 75 s de jeu) |

**Point de contrôle du porteur** : version publiée + journal de 10 lignes.

### Étape 3 — Combo, score, tir parfait et étoiles (§ 11, point 7)

**Périmètre** : `js/score.js` (parfait de 5.6, combo et étoile éphémère de 5.7, objectifs de 5.5, étoiles de 5.8) ; repère du milieu d'arc de largeur 2*p* et marques TÔT/TARD ; jauge de combo ; score et multiplicateur dans le HUD ; objectifs secondaires (catalogue, attribution, jauge) ; emplacement unique de message avec priorités ; étoiles en bits cumulables ; records par niveau et globaux ; écran Records ; feuilles de victoire et d'échec enrichies (BAL FEAT-2/3) ; champs `levels`, `records`, `stats` de la sauvegarde ; écriture de l'échec au même tick.

**Fichiers** : `js/config.js`, `js/score.js`, `js/core.js`, `js/store.js`, `js/render.js`, `js/ui.js`, `js/fx.js`, `index.html`, `sw.js`, `tests/unit/score.test.js`, `tests/sim/planner.js`, `tests/ui.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Formules (parfait, chaîne, multiplicateur, score, étoiles, étoile éphémère) | `tests/unit` | cas limites : astre vide, intervalle étroit, traversante, chaîne expirée à T ± 1 ms, minuterie figée pendant pause et compte à rebours |
| Une idée à la fois | `tests/unit` | test de l'étape 2 étendu : PARFAIT apparaît au niveau 6 et COMBO au niveau 8, pas avant |
| Parfait apprenable | `tests/sim` | taux de parfaits ≈ 75 % à 30 ms et ≈ 38 % à 70 ms (±8 points), décroissant avec σ ; marque TÔT/TARD du bon côté dans 100 % des cas |
| Étoile éphémère déterministe | `tests/sim` | même journal de tirs → même apparition, même capture, même score |
| Objectifs atteignables | `tests/sim/planner.js` | ★3 obtenue par le planificateur sur 100 % des niveaux 1..300 |
| Persistance | `tests/ui.js` | records et bits d'étoiles conservés après rechargement ; jamais de régression d'un record ; échec suivi d'un rechargement 100 ms plus tard : tentative comptée |
| Messages et HUD | `tests/ui.js` en 320×568 | boîtes des messages sans chevauchement entre elles ni avec le HUD ; au plus 2 voix par atterrissage |
| Accord du simulateur | `tests/sim/agree.js` | ≥ 99,5 % (le score ne doit pas changer les issues) |

### Étape 4 — Boss et niveaux spéciaux (§ 11, point 8)

**Périmètre** : cadre des 5 archétypes × 6 paliers (5.4) : intro < 1,5 s, barre de vie dans le HUD du haut, deuxième phase (effet à T + 0,6 s), séquence de victoire, solides propres (cuboctaèdre, étoile octangle, bastion, gyroscope, icosidodécaèdre), sons de boss ; 3 types de niveaux spéciaux (5.5) ; sous-phases `intro` et `annonce` (4.3) ; `__botSafe` qui modélise les règles des spéciaux.

**Fichiers** : `js/config.js` (`BOSSES`, `SPECIALS`), `js/vector.js` (nouveaux solides), `js/levels.js`, `js/core.js`, `js/render.js`, `js/fx.js`, `js/audio.js` (sons de boss), `js/ui.js`, `sw.js`, `tests/unit/boss.test.js`, `tests/sim/*`, `tests/ui.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Annonces | `tests/unit` sur la chronologie de chaque boss | chaque changement annoncé ≥ 0,5 s (≥ 0,45 s en Cosmos), deuxième phase comprise ; aucun changement de phase pendant un vol |
| Difficulté des boss et des spéciaux | `tests/sim/report.js` | colonne « Boss et spéciaux à 70 ms » de 5.10 ; ≥ 75 % à 30 ms (règle d'intervalle) ; au plus 20 points sous les voisins ; k du spécial PARFAIT confirmé |
| Une idée à la fois | `tests/unit` | test de l'étape 2 étendu aux règles des spéciaux, sur 1..400 |
| Identité visuelle | `tests/unit/config.test.js` | solide de chaque boss absent des solides de monde ; 5 solides de boss différents |
| Prédicteur | `tests/sim/bot.js` | 0 mort sur les 30 boss et 30 spéciaux × 8 parties |
| Sous-phases | `tests/ui.js` | `throwPin()` sans effet pendant l'intro et l'annonce ; tap qui passe l'intro dès 0,6 s ; durées : intro ≤ 1,5 s, victoire ≤ 1,6 s avant la feuille |
| Lisibilité | captures de chaque archétype × 2 paliers en 320×568, 360×640 et 390×844 + `tests/ui.js` | anneaux, portes, zones et chevrons distincts par la forme ; barre de vie, HUD, anneaux et messages sans chevauchement |
| Accord du simulateur | `tests/sim/agree.js` | ≥ 99,5 % sur ≥ 2 000 tentatives, boss et spéciaux compris |
| Banc d'essai | `tests/shoot.js` | boss 10, 20, 30, 40, 50, 60 gagnés dans le balayage ; capture `04-boss10` |

**Point de contrôle du porteur** : version publiée + journal de 10 lignes.

### Étape 5 — Animations, effets visuels et son (§ 11, point 9)

**Périmètre** : retours de 5.11 avec leurs durées ; libellés hors de l'anneau du cadran (ART-4) ; transitions de monde ; `js/audio.js` en deux bus avec musique procédurale (5.12) **et bouton MUSIQUE** à côté de SON dans le menu et la pause ; reprise audio robuste (tous états ≠ `running`, sons demandés pendant la reprise rejoués s'ils ont moins de 300 ms, ENG BUG-6) ; vibrations seulement si l'API existe ; mouvement réduit respecté partout.

**Fichiers** : `js/fx.js`, `js/render.js`, `js/audio.js`, `js/ui.js`, `js/store.js`, `js/config.js`, `index.html`, `sw.js`, `tests/ui.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Durées | journal horodaté des événements (`tests/ui.js`) | conformes à 5.11 à ±20 ms ; feuille d'échec à 0,45 s, victoire ≤ 1,6 s |
| Audio | `tests/ui.js` (compteur de nœuds, contexte simulé « suspendu ») | aucun nœud qui fuit après 60 s ; aucun son perdu pendant la reprise ; au plus 2 voix par atterrissage |
| Musique indépendante | `tests/ui.js` | MUSIQUE et SON coupables séparément, depuis le menu et la pause, persistés après rechargement |
| Mouvement réduit | `tests/ui.js` avec `prefers-reduced-motion` | ni secousse, ni flash, ni ralenti ; aucune erreur |
| Coût | `tests/perf.js` | budget de 4.8 tenu avec tous les effets |
| Rendu | planches de captures (impact, parfait, combo ×5, échec, victoire de boss) | revue visuelle de la direction artistique |

### Étape 6 — Menus, mondes, récompenses, reprise et optimisation mobile (§ 11, points 10 et 11)

**Périmètre** : menu (CONTINUER/REPRENDRE, NIVEAUX, RECORDS, RÉGLAGES) ; carte des 6 mondes puis grille de 50 niveaux par monde (cases boss et spéciaux marquées) ; écran Réglages (SON et MUSIQUE déplacés, VIBRATIONS seulement sur appareil tactile qui a l'API) ; séries et jetons REPRISE (5.9) ; **reprise après fermeture par journal des tirs** (4.6) ; bouton SUIVANT à la couleur du monde suivant ; clavier (UX-7) ; voile « Tourne ton téléphone » en paysage court (UX-8) ; icônes PNG et `apple-touch-icon` ; contraste ; saut de l'astre du menu (VIS-1) ; budget de performance complet (4.8) : arrêt du rendu au repos, DPR adaptatif appliqué entre deux tentatives, composition partielle du phosphore, chasse aux allocations, animation du logo arrêtée hors du menu.

**Fichiers** : `index.html`, `js/ui.js`, `js/render.js`, `js/main.js`, `js/store.js`, `js/core.js` (relecture), `js/score.js`, `js/config.js`, `manifest.webmanifest`, `sw.js`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `tests/ui.js`, `tests/perf.js`, `tests/sim/streak.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Aucun bouton décoratif | fumée de `tests/ui.js` étendue aux nouveaux écrans | chaque clic change l'état, l'écran ou un réglage persisté ; VIBRATIONS absent en 1280×800 avec souris |
| Séries et jetons | `tests/unit` + `tests/sim/streak.js` | paliers, plafond de 3, une REPRISE par tentative ; un jeton tous les 8 à 12 niveaux en moyenne à 45 ms, dans chaque monde |
| REPRISE | `tests/ui.js` | même état qu'avant le tir fatal à 1e-9 près ; jeton décompté à l'appui ; chaîne de combo à zéro, série conservée |
| Reprise après fermeture | `tests/ui.js` | 3 aiguilles puis rechargement : REPRENDRE proposé ; mêmes angles, `left` et `t` à 1e-9 près ; rechargement en pleine deuxième phase d'un boss : même état à 1e-9 près ; puis compte à rebours de 0,6 s |
| Échec puis fermeture | `tests/ui.js` | échec, rechargement 100 ms plus tard : aucun REPRENDRE proposé, échec compté ; après le 3e échec de suite sur un niveau incomplet : série à 0 |
| Écrans | captures en 320×568, 360×640, 390×844, 430×932, 768×1024, 1280×800 | aucun chevauchement, cibles tactiles ≥ 44 px |
| Batterie | `tests/perf.js` | 0 image/s sur niveaux, records, réglages, pause ; ≤ 30 sur le menu ; animation du logo arrêtée hors du menu ; aucun changement de DPR pendant une tentative |
| Fluidité | `tests/perf.js` | CPU ×4 : ≤ 33 ms par image et simulation ≥ 0,98× ; allocations ≤ 100 Ko/s |
| Chargement | `tests/perf.js` | aucune ressource tierce ; démarrage hors ligne < 1 s |
| Clavier et paysage | `tests/ui.js` | Entrée active le bouton focalisé ; focus visible ; voile en 844×390 tactile, absent en 412×350 |

### Étape 7 — Contrôle qualité final de la version jouable

**Périmètre** : passage complet de tous les tests ; session de 30 minutes automatisée (mémoire stable, aucune erreur) ; migration depuis une vraie sauvegarde de l'ancienne version ; jeu hors ligne ; relecture de tous les textes ; liste de vérification sur appareils réels à faire par le porteur du projet (un Android de milieu de gamme et un iPhone : 60 images/s, son et musique, reprise après fermeture, installation sur l'écran d'accueil, lisibilité en plein jour) ; mise à jour de `README.md` et `tests/README.md` ; notes de version.

**Tests d'acceptation** : tous les seuils des étapes 1 à 6 ; tas JS qui varie de moins de 10 % sur 30 minutes ; zéro erreur de console ; liste de vérification sur appareil signée par le porteur du projet.

### Risques et parades

| Risque | Parade |
|---|---|
| Rendre le jeu plus dur casse le bot du banc d'essai (capacité du bord) | Capacité tirs + obstacles fixes ≤ 14 inscrite dans `DIFFICULTY`, vérifiée par `tests/unit` et `tests/sim/bot.js` ; la difficulté vient du timing et des obstacles mobiles |
| Les chiffres de difficulté sont faux parce que le simulateur ne joue pas le même jeu | Le simulateur exécute le vrai `core.js` ; `agree.js` (≥ 99,5 %) à chaque étape qui touche la physique ; l'ancien simulateur n'accepte rien |
| Mélange de versions des scripts après une mise à jour (écran noir) | Précache atomique versionné, adresses `?v=`, mise à jour au menu seulement, `sw.test.js`, garde-fou de démarrage |
| La couche phosphore coûte trop cher sur un téléphone modeste | DPR adaptatif, composition limitée au rectangle utile ; dernier recours : phosphore à 30 images/s, jamais supprimé (c'est l'identité visuelle) |
| Comportements propres à iPhone (audio interrompu, pas de vibration, PWA) non mesurables en Chromium | Code défensif aux étapes 1 et 5, liste de vérification sur appareil réel à l'étape 7 |
| Le découpage introduit une régression invisible | Commit 1.1 strictement neutre et prouvé (vidage identique, balayage identique, fumée de tous les boutons et touches) avant toute correction |
| Les choix de difficulté ne plaisent pas au porteur | Points de contrôle jouables à la fin des étapes 2 et 4 |
| Dérive du périmètre vers la phase 2 | Aucune fonction de phase 2 avant la validation de l'étape 7 ; aucun bouton visible sans fonction réelle |

### Phase 2 — Fonctionnalités secondaires (après la version jouable)

| Fonction | Ce qui se fait côté client | Ce qui exige un service externe | Prérequis déjà posés en phase 1 |
|---|---|---|---|
| **Collection et cosmétiques** (aiguilles, sphères, effets lumineux, thèmes, animations d'impact) | Tout : table `COSMETICS`, déblocage par étoiles, succès et paliers de série ; les cosmétiques ne changent que le dessin, jamais la géométrie de collision (test : boîtes de collision identiques quel que soit l'habillage) | — | rendu séparé de la simulation, étoiles cumulables, sauvegarde versionnée |
| **Défis quotidiens** | Niveau(x) généré(s) avec la graine de la date, série de jours | Classement du jour (serveur) | générateur déterministe, `GEN_VERSION` |
| **Défis hebdomadaires** | Parcours de 7 niveaux, graine de la semaine ISO | Classement de la semaine | idem |
| **Succès et trophées** | ≈ 30 succès calculés à partir des événements du bus, écran dédié | — | bus d'événements, records |
| **Défi à deux sur le même niveau** | Code partageable (lien `#defi=…` : numéro de niveau ou graine, `GEN_VERSION`, score à battre) via l'API de partage du navigateur ; comparaison affichée honnêtement comme « score déclaré » | Vérification du score : le serveur rejoue la partie à partir du journal des tirs (simulation déterministe dans Node) | cœur déterministe chargeable dans Node, journal des tirs |
| **Partage des records** | API de partage du navigateur / presse-papiers, image de carte de score générée dans un canvas | — | records |
| **Classements mondial et entre amis, comparaison des performances** | Interfaces seulement (`js/net.js` : `submit`, `top`, `around`, fournisseur nul) ; **aucune interface visible tant qu'un vrai service n'existe pas** | Service avec comptes, liste d'amis, anti-triche par rejeu, conformité RGPD | score de carrière monotone, rejeu vérifiable |
| **Seconde chance par publicité récompensée (facultative)** | Réutilise la REPRISE par relecture ; au plus une par partie ; jamais imposée | Régie publicitaire pour jeux web (ou emballage natif type TWA/Capacitor), gestion du consentement | jeton REPRISE |
| **Version Premium sans publicité** | Drapeau de droits dans la sauvegarde | Paiement (boutique d'applications ou prestataire web) et validation du reçu | sauvegarde versionnée |
| **Récompenses quotidiennes** | Calendrier local (récompenses cosmétiques seulement, donc la manipulation de l'horloge est sans enjeu) | — | collection |

Garde-fous : aucune publicité imposée, aucune mécanique payante qui aide à gagner, aucune énergie ni vie limitée, aucun classement simulé.

---

## 7. Traçabilité des exigences

| § | Exigence du cahier des charges | Où | Vérification |
|---|---|---|---|
| 1 | Lancer des aiguilles sur une sphère qui tourne ; contact = perdu | Existant, étape 1 (collision = dessin) | `tests/shoot.js`, tests de géométrie |
| 1 | Planter sous des étoiles pour les récupérer | Existant, étape 1 (traversantes), étape 3 (★2) | `tests/play.js` puis `tests/sim` : toute étoile capturable |
| 1 | Une seule action | Toutes | Aucune entrée de jeu autre que le tap (revue de code, `tests/ui.js`) |
| 1 | Compris en moins de 5 s, difficile à maîtriser | Étapes 2, 3 (apprentissage, parfait) | Niveaux 1-5 ≥ 97 % à 70 ms ; parfait ≈ 75 %/38 % à 30/70 ms |
| 2 | Vitesses variées, deux sens, changements soudains, accélérations et ralentissements | Étapes 2, 4 | `tests/unit` (drapeaux de mécaniques par niveau), captures |
| 2 | Aiguilles plantées = zones de danger ; espacement de plus en plus difficile | Existant, étape 2 | `tests/sim/report.js` (difficulté croissante dans le niveau et entre niveaux) |
| 2 | Étoiles par tirs réussis ; configurations différentes | Étapes 2, 3 | `tests/sim/planner.js`, catalogue de mécaniques |
| 2 | Apparition de bonus et de mécanismes spéciaux | Étape 3 (étoile éphémère qui apparaît en jeu aux paliers de combo), étape 4 (niveaux spéciaux, deuxième phase des boss) | `tests/sim` (apparition déterministe), `tests/sim/bot.js` |
| 2 | Impact : animation rapide, effet lumineux, vibration légère, son métallique, réaction de la sphère | Étape 5 | Journal des durées, captures, test de l'API de vibration |
| 2 | Échec : ralenti court, collision spectaculaire, aiguilles qui se brisent, défaite rapide, recommencer tout de suite | Étapes 1, 5 | Feuille à 0,45 s, relance d'un tap, captures |
| 2 | Pas d'animation trop longue | Étape 5 | Durées 5.11 à ±20 ms |
| 3 | Plusieurs centaines de niveaux en mondes Émeraude, Ambre, Rubis, Saphir, Obsidienne, Cosmos | Étape 2 | `tests/unit` (300 niveaux + COSMOS ∞) |
| 3 | Chaque monde introduit progressivement de nouvelles mécaniques | Étapes 2, 4 | Test « une idée à la fois » sur 1..400, boss et spéciaux compris |
| 3 | Débuts accessibles, difficulté intelligente, jamais injuste | Étape 2 | Plancher 75 % à 30 ms (avec intervalle de confiance), pas de falaise, prédicteur 0 mort |
| 3 | Boss tous les 10 niveaux | Étapes 2 (emplacements et mécaniques), 4 (cadre) | `tests/unit`, `tests/sim` |
| 3 | Niveaux spéciaux ; objectifs secondaires ; étoiles à collectionner | Étapes 3, 4 | `tests/sim/planner.js`, règles d'équité des spéciaux, compteur 900 étoiles |
| 3 | Défis quotidiens | Phase 2 | — |
| 3 | Récompenses pour les séries de victoires | Étape 6 | `tests/unit`, `tests/sim/streak.js`, `tests/ui.js` (jetons REPRISE) |
| 4 | Combo : tirs consécutifs → multiplicateur, bonus du parfait, combos impressionnants | Étapes 3, 5 | `tests/unit`, captures combo ×5 |
| 4 | Tir parfait : fenêtre définie, effet lumineux, son unique, bonus | Étapes 3, 5 | `tests/unit`, taux de parfaits, repère de largeur 2*p*, captures, inventaire des sons |
| 4 | Score par niveau, record personnel, meilleur combo, nombre de parfaits | Étape 3 | `tests/ui.js` (persistance) |
| 4 | Classement général | Phase 2 (interfaces seulement avant) | Aucun classement visible sans service réel |
| 4 | Collection sans avantage injuste | Phase 2 | Test de géométrie identique quel que soit l'habillage |
| 5 | 5 boss aux mécaniques demandées, intro courte, victoire satisfaisante | Étape 4 | Chronologies, `tests/sim`, captures |
| 5 | Chaque boss a une identité visuelle | Étape 4 | Solides propres aux boss, test « solide de boss ∉ solides de monde, 5 solides différents » |
| 5 | Niveaux spéciaux | Étape 4 | `tests/sim/bot.js`, `report.js` (règles des boss), `planner.js` |
| 6 | Garder l'identité (noir profond, cercles orbitaux, graduations, typographie, animations lumineuses, interfaces géométriques) | Toutes | Planches de captures comparées à `docs/reference/captures-actuelles.jpg` |
| 6 | Palette par monde (vert néon, orange doré, rouge lumineux, bleu électrique, violet sombre) | Étape 2 | `tests/unit` (palettes, contraste) ; teinte d'Obsidienne choisie par le porteur sur planche |
| 6 | Lisibilité sur smartphone ; moderne, élégant, reconnaissable | Étapes 1, 2, 6 | Contraste ≥ 4,5:1, captures 320×568 à 430×932, géométrie chiffrée des anneaux et messages |
| 7 | Sons : lancement, impact, combo, étoile, monde, victoire, défaite | Étape 5 | Inventaire des sons, `tests/ui.js` |
| 7 | Ambiance électronique discrète, musique désactivable indépendamment | Étape 5 (musique et son bouton MUSIQUE ensemble) | `tests/ui.js` (deux réglages indépendants et persistés) |
| 8 | Classements mondial et amis, partage, défis quotidiens et hebdomadaires, comparaison, succès, défi à deux | Phase 2 | — |
| 8 | Ne jamais simuler un classement mondial | Toutes | Aucune interface de classement avant un service réel (revue) |
| 9 | Publicité récompensée facultative, cosmétiques, Premium sans pub, récompenses quotidiennes, défis renouvelés | Phase 2 (jeton REPRISE prêt en étape 6) | — |
| 9 | Pas de pub imposée, pas de pay-to-win, pas de progression bloquée | Toutes | Progression indépendante des étoiles (`tests/unit`) |
| 10 | Commandes tactiles très réactives | Étape 1 | Latence ≤ 1 image, lancer horodaté |
| 10 | Tailles d'écran, 60 FPS, chargement rapide, batterie, animations fluides | Étapes 1, 6 | `tests/perf.js` (dont régularité à 90/120 Hz), captures multi-écrans |
| 10 | Sauvegarde automatique | Étapes 2, 3, 6 | `tests/ui.js` (rechargement, échec écrit au même tick) |
| 10 | Reprise après fermeture | Étape 6 (journal des tirs) | `tests/ui.js` (rechargement en jeu et en deuxième phase de boss, état identique à 1e-9) |
| 11 | Analyser, identifier, proposer une architecture (étapes 1-4) | Ce document | — |
| 11 | Lancer et collision (5), difficulté (6), combos/score/étoiles (7), boss (8), animations (9), menus/mondes/récompenses (10), mobile (11) | Étapes 1 à 6 | Tests d'acceptation de chaque étape |
| 11 | Tester chaque mécanique ; ne pas tout réécrire ; garder l'existant ; pas de bouton décoratif | Toutes | Commit de découpage neutre, banc d'essai et fumée de `tests/ui.js` à chaque commit |
| Final | Version améliorée et entièrement jouable avant les fonctionnalités secondaires | Étapes 1-7 puis phase 2 | Étape 7 validée avant toute fonctionnalité de phase 2 |

---

## Annexe A — Reproduire les mesures

- Banc d'essai : `node tests/shoot.js index.html tests/out/baseline` puis `python3 tests/sheet.py tests/out/baseline`.
- Profil d'image : remplacer `update` et `draw` par des versions chronométrées (ce sont des déclarations `function` globales), jouer le niveau 8 avec `__botSafe` pendant 6 s, avec `Emulation.setCPUThrottlingRate` à 1, 4 et 6 via CDP.
- Allocations : `HeapProfiler.startSampling` (intervalle 512 octets) pendant 6 s de jeu, agrégation par fonction.
- Simulateur de la revue : vider `makeLevel(1..200)` et la mise en page 390×844, puis politique « centre » (meilleure fenêtre, viser son milieu), 100 essais par niveau et par σ ∈ {0, 30, 45, 70, 100, 140 ms}. Il décrit l'ancienne physique ; à partir de l'étape 2, seul `tests/sim/` (vrai cœur dans Node) fait foi.
- Salve aveugle : `startLevel(n, true)`, un `throwPin()` toutes les 6, 9 ou 12 images à partir de 30 départs différents, `update(1/60)`, succès si l'état passe à `winning`.
- Géométrie de l'écran (bandes, couloir, recouvrement des têtes en vol) : formules de `layout()` (l. 652-667) évaluées sur 320×568, 360×640, 375×667, 390×664, 390×844 et 430×932.
- Ces scripts deviennent `tests/perf.js` et `tests/play.js` à l'étape 1, puis `tests/sim/` à l'étape 2.

## Annexe B — Révision après relecture critique (16 novembre 2026)

Une relecture critique du plan a vérifié ses références au code (toutes justes) et demandé des corrections. Ce qui a changé :

| Point relevé | Correction | Où |
|---|---|---|
| Les boss d'Émeraude introduisaient 5 mécaniques que les niveaux normaux n'enseignaient que 50 à 250 niveaux plus tard | Règle « une idée à la fois » appliquée à tous les niveaux, boss et spéciaux compris ; niveaux d'apprentissage en x9 avant chaque boss d'Émeraude ; boss réordonnés du plus simple au plus dur ; paliers qui n'ajoutent que des idées apprises ; test sur 1..400 | 5.3, 5.4, étape 2 |
| Spécial PARFAIT « toutes parfaites » : 0,6 à 2,5 % de victoires à 70 ms | Au moins k parfaites sur 6 (k = 2, 3 ou 4 selon le monde), règles d'équité des boss appliquées aux spéciaux | 5.5 |
| Le contrôle balayé ajoutait une zone mortelle invisible ; une échelle u linéaire ne tient pas sur tous les écrans | Contrôle balayé supprimé (défaut masqué par l'ordre de dessin) ; positions u physiques fixes et carte affine par morceaux | 4.4, 5.6 |
| Pas de place prévue pour les anneaux, leurs portes et la barre de vie | Budget de place chiffré, anneaux dans le couloir de tir, barre de vie dans le HUD, vérification chiffrée | 4.4, 5.4 |
| Les cibles de difficulté reposaient sur un simulateur validé sur l'ancienne physique | Le simulateur exécute le vrai cœur dans Node ; `agree.js` à chaque étape qui touche la physique | 4.10 |
| Service worker fichier par fichier : risque de mélange de versions et d'écran noir | Précache atomique versionné, adresses `?v=`, mise à jour au menu, `sw.test.js`, garde-fou de démarrage | 4.9 |
| Étape 1 trop large et trop éloignée du gameplay | Étape 1 réduite au découpage, au chargement, au lancer, à la collision et à l'échec, en 12 petits commits ; structure et sauvegarde à l'étape 2, reprise à l'étape 6 ; points de contrôle du porteur aux étapes 2 et 4 | 6 |
| Autres | Reprise par journal des tirs ; échec écrit au même tick ; intégration par trapèzes et rendu interpolé ; capacité en une seule contrainte ; tailles d'échantillon et graines ; fumée de tous les boutons dès le premier commit ; deuxième phase annoncée 0,6 s avant ; solides propres aux boss ; bouton MUSIQUE avec la musique ; portée du combo et emplacement unique de message ; étoile éphémère ; sous-phases du contrat de test ; compte à rebours après REPRENDRE ; zone glissante précisée ; migration sans étoiles offertes ; source et licence des polices ; repère du parfait à la largeur de la tolérance ; série en 3 tentatives ; choix du violet d'Obsidienne ; DPR changé entre deux tentatives ; échec volontaire du banc d'essai rendu obligatoire ; garde sur l'horodatage des taps | 4 à 6 |

Écarts assumés par rapport à la relecture, avec leur raison :
- **Spécial PARFAIT** : la relecture proposait k = 3 en Émeraude et Ambre puis k = 4 dès Rubis. Le calcul donne k = 3 à 61,7 % à 70 ms au niveau 27 (voisins vers 88 %) et k = 4 à 30,6 % en Rubis (voisins entre 52 et 68 %) : deux falaises de plus de 20 points. D'où k = 2 en Émeraude, 3 d'Ambre à Saphir, 4 ensuite. L'échec tombe aussi dès que k n'est plus atteignable plutôt qu'en fin de niveau (défaite rapide, cahier des charges § 2).
- **Navigation hors ligne** : la relecture proposait une course réseau de 2,5 s pour les navigations. Une navigation servie par le réseau donnerait un `index.html` récent avec des scripts de l'ancien cache, précisément le mélange à éviter : la navigation est servie depuis le même cache que les scripts, et le réseau n'intervient que si un fichier manque.
- **Sauvegarde v2** : la relecture la plaçait à l'étape 3. Elle arrive à l'étape 2 avec la renumérotation des niveaux, sinon la version publiée au point de contrôle afficherait d'anciennes étoiles sur de nouveaux niveaux ; les étapes 3 et 6 n'ajoutent que des champs.
- **Simulateur** : comme le simulateur exécute le vrai cœur, `agree.js` n'est pas une condition de l'étape 1 (où aucun simulateur Node n'existe encore : les mesures de l'étape 1 se font dans la vraie page) mais des étapes 2 et 4.
- **Zones pulsées** : la relecture plaçait leur apprentissage au niveau 89, pour une Forteresse II au niveau 90 (ancienne position). Avec le nouvel ordre, la Forteresse II tombe au niveau 80. Les zones pulsées sont apprises au niveau 111, en Rubis, le monde de la précision, et utilisées à partir de la Forteresse III (niveau 130) ; la Forteresse II ajoute la rampe (apprise au niveau 71).
- **Série** : la relecture demandait de remettre la série à zéro à chaque échec, puis de la définir en « 3 tentatives au plus ». Les deux sont conciliés : c'est le 3e échec de suite sur un niveau qui la remet à zéro, toujours écrit au même tick que la collision. Une victoire ne la fait monter que si elle apporte un gain, pour qu'on ne puisse pas accumuler des jetons en rejouant un niveau facile.

## Annexe C — Écarts de réalisation (étape 1)

Écarts décidés pendant la réalisation, chacun versé dans le commit qui le motive.

| Commit | Prévu | Réalisé | Raison |
|---|---|---|---|
| 1.3 | Rendu interpolé entre le pas précédent et le pas courant, à α = reste de l'accumulateur / STEP | Rendu **au présent** : le rendu dessine l'instant t + reste de l'accumulateur en prolongeant le pas courant par les mêmes lois (rotation par trapèze, position de l'aiguille en fonction du temps, angle des sentinelles) ; il ne décide rien (contact, collision) et ne modifie pas l'état de la simulation (`viewAt`, `RV`) | L'interpolation entre deux pas dessine l'état d'un pas en arrière (8,3 ms de retard constant) : l'aiguille ne quitterait visiblement le pas de tir à l'image suivante qu'une fois sur deux, ce qui rend inatteignable la latence « ≤ 1 image en médiane » de 1.5. Les lois de vitesse étant connues et déterministes, l'état au présent se calcule exactement, sans extrapolation hasardeuse. Même régularité mesurée (coefficient de variation 0 % à 90 et 120 Hz, `tests/perf.js`) |
| 1.3 | Sentinelle : test d'intervalle par image | Test continu : premier instant exact où la sentinelle (mouvement uniforme) couvre l'axe de tir pendant que l'aiguille traverse son orbite (`sentHit`), et écart minimal sur l'intervalle pour le prédicteur (`sentMin`) | Le résultat ne doit dépendre ni de la cadence d'image ni du découpage en pas (`tests/unit/timing.test.js`, 1e-9) |
| 1.4 | Extrémité de la tête de l'aiguille en vol dessinée en u − 0,24 par la carte affine | Dessinée au plus loin des deux : u − 0,24 par la carte, ou pointe + longueur réelle (`pinYs`) | Sur les petits écrans le couloir de tir est court (99 px en 320×568) : la carte seule raccourcissait l'aiguille de 43 % pendant la traversée du couloir. La règle « au plus loin » garde sa longueur réelle et ne déplace les croisements de la tête avec l'orbite des sentinelles et le cercle des têtes que de moins de 0,1 ms (vérifié à ± 1 ms par `tests/ui.js`, section `ecrans`) |
| 1.4 | `SENT_PAD` calculé à chaque mise en page | Constante physique `SENT_PAD = 0,038` rad (valeur de 390×844) dans `config.js` | Sinon la marge des sentinelles, donc l'issue d'un tir, variait légèrement avec l'écran (épaisseur de trait plafonnée à 1,4 px sur les petits écrans) |
| 1.8 | Orbite des sentinelles dessinée sur RS ± 0,75 × HEAD | Épaisseur des sentinelles tirée de `SENT_PAD` : demi-épaisseur (et bout arrondi) = SENT_PAD × RS − demi-épaisseur de la tige, et ancres de la carte u sur RS ± cette demi-épaisseur | Avec des têtes plus grosses (GAP au lieu de GAP − 0,012), une épaisseur en 1,5 × HEAD aurait dessiné les sentinelles 0,5 px plus larges que la règle ; ainsi le dessin touche la tige exactement quand la règle déclare l'interception (`tests/unit/geometry.test.js`) |
| 1.8 (correction après recette) | Sentinelle testée contre la tige seule (`SENT_PAD`), sur la traversée de l'orbite | La tête de l'aiguille en vol est aussi testée, comme un disque : interception dès que la distance du centre de la tête à l'arc de la sentinelle (corps ou bout arrondi) passe sous demi-épaisseur + rayon de la tête (`SENT_PAD_HEAD = 0,08078` rad). Le centre de la tête suit la carte u → rayon de la mise en page de référence 390×844 (`UREF`, `HEAD_REF` dans `config.js`), affine par morceaux : premier contact calculé exactement (intervalles et racines de second degré, `sentHeadHit`), indépendant du découpage en pas. `__botSafe` garde 0,7 × GAP de marge au-delà de `SENT_PAD_HEAD` sur la fenêtre de la tête | La marge de la tige (6,3 px en 390×844) laissait la tête (8,1 px de rayon) passer sur le bout d'une sentinelle sans interception, recouvrement dessiné de 4 à 5 px pendant 3 à 4 ms. Mesuré après correction (`tests/unit/geometry.test.js`) : recouvrement sans interception 0 px en 390×844, 0,4 à 1,1 px sur les petits écrans (couloir de tir plus court : la tête y est dessinée à pointe + longueur réelle, centre de la tête sur l'orbite à 0,06 ms de la règle) ; écart dessiné à une interception par la tête ≤ 0,21 px en 390×844 (orbite traitée comme droite à l'échelle de la tête), ≤ 0,55 px ailleurs. Restent, inchangés et sous le pixel ou presque : la pointe arrondie de la tige qui peut entamer l'orbite de 0,9 px avant la fenêtre, et un écart de 2 px au plus quand la pointe arrive au coin d'une sentinelle |
| 1.10 | Verrou de 250 ms après une relance « par tap » | Verrou après toute relance depuis la feuille d'échec : tap sur la scène ou la feuille, Espace/Entrée, et bouton RÉESSAYER | Le bouton est lui aussi touché du doigt : un joueur qui enchaîne au rythme tirerait à l'aveugle juste après l'avoir pressé. Le verrou reste dans la couche d'entrée (`retry()`), jamais dans `startLevel()` |
| 1.12 | Catalogue des messages vérifié par `tests/unit` | Messages d'échec en table (`FAIL_TEXT`, `config.js`) avec un conseil propre à chaque cause, vérifiés par `tests/unit/text.test.js` ; tests ajoutés hors liste : `tests/unit/input.test.js` (horodatage), `tests/unit/text.test.js` | Le conseil était tiré au hasard quelle que soit la cause (« Vise un arc allumé » après une interception par la sentinelle, UX-6) |

## Annexe D — Écarts de réalisation (étape 2)

Écarts décidés pendant la réalisation, chacun versé dans le commit qui le motive.

| Commit | Prévu | Réalisé | Raison |
|---|---|---|---|
| 2.1 | `core.js` sans DOM, abonnés au bus | En plus : le viseur d'avance (`leadA`, `leadOk`) est calculé au rendu (`syncScene`) et la démo du menu vit dans `render.js` ; `predict()` garde en cache l'intégration sur la grille des pas (mêmes opérations, résultat identique au bit près) ; `shotSafe(tL, k)` est la règle commune à `__botSafe` (k = 0,7) et aux politiques du simulateur (k = 0) | Le viseur et la démo sont de l'affichage ; le cache rend le joueur simulé qui vise assez rapide pour mesurer 300 niveaux × 300 essais (≈ 10 ms par essai) sans copie de la physique |
| 2.2 | Sauvegarde v2 sans étoiles avant l'étape 3 (champ `levels` ajouté à l'étape 3, étoiles en bits) | Les étoiles de l'étape 2 (sens actuel : 1 = fini, 2 = au moins une étoile bonus, 3 = toutes) sont gardées dans `levels[n].stars` ; l'étape 3 ajoutera les bits `s` en convertissant : `stars ≥ 1` → fini, `stars = 3` → toutes les étoiles bonus (aucune étoile offerte) | Sinon les étoiles gagnées au point de contrôle de l'étape 2 seraient perdues au rechargement |
| 2.2 | `tests/unit/dump.js --check` : niveaux identiques à `ad561a3` | Comparés sans les champs de structure (`w`, `boss`, `pos`, fiche du monde) jusqu'au générateur v2, qui remplace cette référence par celle de `GEN_VERSION` 2 | Le commit 2.2 change la structure (mondes de 50, boss tous les 10) mais pas encore le contenu des niveaux |
| 2.3 | Générateur v2 piloté par `WORLDS`, `TEACH`, `DIFFICULTY` | Les idées encore à réaliser (accélération, demi-tour, anneaux, rotation irrégulière, rampe, zones pulsées et glissantes, inversion à l'impact, deux sentinelles) sont absentes de la liste `IMPL` : leur niveau d'apprentissage reste un niveau ordinaire, et les boss de leur archétype se jouent avec leurs paramètres de palier et les seules idées déjà réalisées, jusqu'au commit de chaque mécanique | Chaque mécanique arrive dans son propre commit (plan, étape 2, point 4) ; le test « une idée à la fois » reste vrai à chaque commit |
| 2.3 | `dump.js --check` contre la référence `ad561a3` | Contre `tests/ref/levels-gen2.json` (mise à jour explicite par `--update`) et contrôle d'identité Chromium / Node sur 1..400 ; orientation de départ, moyennes des lois et `vmax` arrondis (1e-9, 1e-6) | Les niveaux changent volontairement ; `Math.tanh` et `Math.pow` peuvent différer d'un dernier bit entre le V8 de Node et celui de Chromium : sans arrondi, deux niveaux sur 400 différaient au 16e chiffre |
| 2.3 | Étoiles de l'étape 2 : 1 + au moins une étoile bonus + toutes | Un niveau sans étoile bonus (les niveaux 1 et 2, désormais sans étoile : elles s'apprennent au niveau 3) donne 3/3 à la victoire | Sinon ces niveaux plafonneraient à 2/3 sans rien qui manque |
| 2.7 | Lois de rotation déplacées telles quelles | Loi « pas à pas » redessinée en arrêts francs : départ en 0,25 s, palier de 1,35 s, arrêt en 0,25 s, pause de 0,75 s (rampes lisses) ; les chevrons annoncent aussi la reprise après un arrêt | Avec l'ancienne loi (sinus tronqué), la vitesse variait sans cesse : le joueur réactif (qui n'anticipe pas) perdait 30 à 60 points sur ces niveaux par rapport à ses voisins, sans qu'aucune annonce puisse l'aider. Arrêts francs et reprises annoncées le ramènent dans l'écart de 15 points visé |
| 2.10 | Anneaux à portes : chaque anneau à sa vitesse et dans son sens ; Anneaux VI : 3 anneaux, 2 portes de 0,5 rad | Tous les anneaux d'un niveau ont la même période de passage (portes × vitesse égales, un anneau à 2 portes tourne 1,5 fois plus vite), voisins à contre-sens, et leurs portes se rejoignent sur l'axe à t* + j·Tp ; fenêtre commune d'au moins 0,42 s ; vitesse des anneaux ajustée (±20 %) pour que l'astre ne fasse pas un nombre presque entier (ni 1/4, 1/3, 1/2… ) de tours par période ; portes pulsées de période 1,5·Tp (un passage sur trois environ fermé) ; Anneaux VI à portes de 0,6 rad ; `__botSafe` prend sur les anneaux une marge de temps (35 ms de part et d'autre) plutôt que 0,7 × GAP d'angle ; seule la partie basse des anneaux est dessinée (±0,95 rad, estompée jusqu'à ±1,35 rad) ; bandeaux et messages des niveaux à anneaux dessinés sous les anneaux | Avec des anneaux indépendants, trois portes de 0,5 rad ne s'alignaient que 0,4 % du temps : le prédicteur restait bloqué (0 tir en 33 s au niveau 251). Une période d'astre commensurable avec celle des anneaux présentait toujours les mêmes angles aux fenêtres de passage (blocage au niveau 41). Les anneaux entiers traversaient le HUD du haut |
| 2.11 | Anti-salve : au moins deux moyens parmi zones larges, lois à arrêts ou inversions, obstacles mobiles ou anneaux ; niveaux d'apprentissage de 3 à 5 aiguilles | À partir du monde 2, chaque niveau a au moins un anneau dont la fenêtre de passage (0,42 à 0,6 s, plus courte qu'une salve de ses aiguilles à 100 ms) revient toutes les ~2 s, en plus des zones et des lois à arrêts ; les niveaux d'apprentissage des mondes 2 à 6 ont 5 aiguilles et un anneau étroit ; boss à partir du palier II : un anneau ; Pendule I : 3 bloqueurs ; Émeraude : 3 à 5 obstacles fixes, plus souvent répartis régulièrement ; traversantes sans zone (6 aiguilles au moins) | Mesure (`mash.js`, 60 départs) : avec zones et lois à arrêts seulement, 41 niveaux sur 113 au-delà de 50 dépassaient 3 % (salves rapides de 100 ms qui se glissent entre deux obstacles) et les niveaux d'apprentissage passaient à 30-45 % ; avec l'anneau, le pire niveau au-delà de 50 réussit 1 départ sur 60 et la moyenne de 11-50 tombe à 24 % |
| 2.12 | Réglage par `report.js`, monde par monde | Réglage automatique niveau par niveau (`tests/sim/tune.js`) : la cible à 70 ms de chaque niveau est la droite de son monde (table 5.10) plus un décalage selon sa place dans le bloc (respirations en x1-x2 : +7 et +5 points ; montée jusqu'au boss : −5), les niveaux d'apprentissage au moins 12 points au-dessus ; le levier est un facteur d'échelle de temps de toutes les rotations (plafonné à 1,3 × la vitesse de fin du monde), puis le nombre d'aiguilles ; `report.js` vérifie ensuite toutes les règles | 300 niveaux générés ne se règlent pas à la main ; un facteur continu par niveau, mesuré avec des graines fixes, converge en quelques itérations. Le joueur simulé qui vise regarde au moins trois périodes de passage des anneaux (au plus 8 s) : « attendre la meilleure fenêtre » du plan |
| 2.10 (recette 2, P12) | Fenêtre de passage commune d'au moins 0,42 s | Chaque anneau a ses propres portes, assez larges pour laisser passer l'aiguille pendant W à sa vitesse (W ≥ 0,42 s jusqu'au monde 4 ; en Obsidienne, Cosmos et COSMOS ∞, fenêtres plus courtes mais régulières, 0,45 → 0,35 s, `RING_WIN` = 0,35 s) (l'anneau à deux portes des niveaux à trois anneaux tourne 1,5 fois plus vite : portes plus larges) ; fenêtre et période de passage en secondes, que le facteur de réglage ne change plus (il ne règle que la vitesse de l'astre ; la vitesse des anneaux, ±20 %, évite les rapports presque entiers avec la vitesse réglée de l'astre) ; période de passage plus courte (Émeraude 2 s ; à partir du monde 2, 1,35 → 1,1 s ; 1,3 s pour l'anneau anti-salve des niveaux d'apprentissage) ; vitesse des anneaux choisie aussi pour que la période de passage ne soit pas presque commensurable avec la période (2,6 s) de la loi pas à pas, et jamais trois anneaux avec cette loi ; vérifié sur 1..400 par `tests/unit/levels.test.js` | La recette a mesuré 196 niveaux à anneaux sous 0,42 s (le facteur divisait la fenêtre, et l'anneau à deux portes n'en avait que les deux tiers) ; à la fin du jeu, des fenêtres courtes punissent l'imprécision sans recourir à la vitesse brute (à 0,35 s, un niveau de Cosmos passe de 60 à 23 % à 70 ms en restant à 92 % à 30 ms) ; trois anneaux avec des arrêts périodiques donnaient une difficulté erratique (294 : 13 à 60 % à 70 ms selon un facteur de vitesse à 1 % près) ; une période étirée par un facteur < 1 allongeait les niveaux d'Ambre et de Rubis à 27-29 s |
| 2.11 (recette 2, P2) | Mécaniques combinées librement | Une seule source d'arrêts ou d'inversions par niveau : une loi à arrêts ou inversions (alternée, pas à pas, ressac) OU des demi-tours (toutes les k aiguilles, au rythme, à l'impact), jamais les deux ; les demi-tours comptent comme « loi à inversions » pour l'anti-salve | Deux systèmes d'annonce à lire en même temps (arrêts de la loi et demi-tours programmés) : le joueur réactif ne trouvait presque jamais d'instant sûr (niveau 183 : 92 % de parties non finies) |
| 2.12 (recette 2, P7) | Niveau d'apprentissage : court, vitesse modérée | Facteur de réglage plafonné à 1 sur les niveaux d'apprentissage (dans le générateur, quel que soit `DIFFICULTY.tune`) : jamais plus vite que la vitesse de début du monde (vérifié par `tests/unit/levels.test.js`) ; anneau anti-salve des mondes 2 à 6 : 0,35 s toutes les 2 s (0,42 s pour les apprentissages à trois anneaux et à portes pulsées) ; `report.js` exige qu'un apprentissage dépasse ses voisins de 12 points à 70 ms, ou atteigne 90 % (début de monde, voisins vers 85 %) | Le réglage avait poussé 261 à 4,9 rad/s, 81 à 3,6, 39 à 2,5. Sans accélération, les fenêtres des anneaux des apprentissages n'étaient plus raccourcies : une salve de 5 aiguilles à 100 ms passait 7 à 22 fois sur 200 (151, 211, 221, 251) |
| 2.12 (recette 2, P1) | COSMOS ∞ généré sans fin, réglé par une règle générale | Les niveaux 301-400 forment la réserve de COSMOS ∞, réglée et vérifiée niveau par niveau ; au-delà, le niveau n rejoue le niveau 301 + (n − 301) mod 100 (boss et spéciaux restent à leur place), en miroir un cycle sur deux (symétrie gauche-droite exacte : même journal de tirs, mêmes issues, angles opposés, vérifié par `tests/unit/levels.test.js`) ; réserve limitée à deux anneaux, jamais d'anneaux multiples avec une loi à arrêts et des fentes. `report.js` mesure par défaut le cycle 401-500, que le réglage n'a jamais vu (graines différentes), `bot.js` toute la réserve | Avec un générateur sans fin réglé seulement sur 301-398, 19 des 100 niveaux 401-500 passaient sous le plancher de 75 % à 30 ms (466 à 5,7 %) : le plancher d'équité n'est garanti que sur des niveaux mesurés. 200 niveaux distincts (100 et leurs miroirs) |
| 2.12 (recette 2, P3/P4) | Réglage : facteur de vitesse, puis aiguilles en moins si le plancher à 30 ms n'est pas tenu | Facteur borné (1,45 × la vitesse prévue du niveau, 1,15 × la vitesse de fin du monde, 1 pour un niveau d'apprentissage) ; trop facile au plafond : une aiguille de plus (jusqu'à +5) ; Émeraude de 5 à 10 tirs (4 à 8 prévus) ; traversantes d'Obsidienne et de Cosmos avec deux anneaux et plus rares (12 % puis 6 % des niveaux : leurs aiguilles remplissent le bord à 7 tirs et la vitesse plafond ne les rend pas assez durs pour la fin du jeu) ; plancher à 30 ms manqué (95, 90, 85, 82, 80, 80 % selon le monde) : une aiguille de PLUS et plus lent ; cibles des respirations à +9 et +7 points (≈ +10 sur x8-x9, plan 5.10) ; 200 essais par itération | À difficulté égale à 70 ms, plus d'aiguilles moins rapides font plus de tirs moyennement difficiles et moins de tirs très étroits : le joueur précis y gagne davantage. Retirer des aiguilles (réglage précédent) faisait l'inverse : la fin d'Obsidienne et de Cosmos restait trop facile à 70 ms pour tenir le plancher à 30 ms |
| 2.12 (recette 2) | Joueur qui vise : « attend la meilleure fenêtre et vise son milieu » | Il prend la première fenêtre presque aussi large que la meilleure qu'il voit (≥ 85 %) ou déjà assez large pour sa précision (marge ≥ 3 σ : au plus 0,3 % de risque par tir à ne pas attendre davantage) ; il réfléchit 0,4 s après chaque impact (0,25 s auparavant) | Sinon le joueur simulé attendait jusqu'à trois périodes de passage pour gagner quelques millisecondes de marge dont il n'a pas besoin : niveaux propres de 27 à 46 s, loin d'un joueur réel ; à l'inverse, 0,25 s entre l'impact et la décision suivante est un temps de réaction minimal, pas celui d'un joueur qui relit le bord (Émeraude à 4,5 s par niveau) |
| 2.12 (recette 2, P2) | Joueur réactif | Il lit aussi les zones (pas de tir vers une zone active ou annoncée, marge comme pour les arcs), garde une marge de temps sur les portes des anneaux (80 ms, puis 50 ms quand il attend) attend que l'astre tourne à peu près régulièrement (vitesse qui a changé de moins de 12 % en 0,15 s : il voit une accélération en cours, il ne la prévoit pas) et n'exige pas sur un astre presque vide le milieu exact du plus grand arc (marge plafonnée à 3 σ de temps à la vitesse de l'astre, plus 0,15 rad) ; mesuré avec 200 essais, remesuré avec 400 avant d'échouer | Il tirait au tout début de l'ouverture d'une porte (une fois sur deux trop tôt avec 45 ms d'imprécision), dans les zones pulsées annoncées (112 : 82 échecs sur 100 dans la zone) et en pleine accélération des lois irrégulière et en ressac, en extrapolant une vitesse qui changeait déjà sous ses yeux (106 : 24 % contre 95 % au joueur qui vise) |
| 2.12 (recette 2, P2) | Joueur réactif : « aucune falaise propre aux inversions et aux arrêts (écart ≤ 15 points avec ses voisins) » | `report.js` mesure aussi, sur chaque niveau signalé, le même joueur sur la variante calme du niveau (mêmes anneaux, zones, obstacles et vitesse moyenne ; loi continue, sans demi-tours ni inversion à l'impact) ; le niveau échoue si l'écart à ses voisins dépasse 15 points ET si la variante calme fait plus de 15 points de mieux | Un écart du joueur réactif qui ne vient pas des arrêts et des inversions (variante calme aussi basse : 191, 194, 206, 214…) n'est pas une falaise propre à eux ; la règle reste stricte pour les autres |
| 2.12 (recette 2, P4) | Falaises : 4 voisins normaux | Les niveaux d'apprentissage ne servent pas de voisins de référence (ils restent soumis à la règle), ni pour le début et la fin d'un monde à 70 ms ; respirations : `report.js` échoue sous +5 points, imprime la moyenne par monde, le réglage vise ≈ +10 ; x8 seul quand x9 est un niveau d'apprentissage (le plan le prévoit pour Émeraude, où x9 apprend la mécanique du boss : le bloc 51-52 suit 48 et l'apprentissage 49) | Un niveau d'apprentissage est par construction bien plus facile (court, vitesse modérée) : compté comme voisin, il faisait passer pour falaises les niveaux x3 des derniers mondes |
| Recette 2 (P10) | Géométrie des anneaux pour les écrans en portrait | En paysage (écran bas), l'astre est réduit jusqu'à ce que le troisième anneau tienne au-dessus du pas de tir ; bandeaux dans la marge de gauche si le couloir reste trop court | Les anneaux se trouvaient au-delà du pas de tir (carte u → rayon non monotone) |
| Recette 3 (Q1) | Loi ressac : « retours en arrière partiels » (sinusoïde 0,5 + 0,8 sin 1,3t) | Ressac en paliers, comme la loi pas à pas : palier en avant de 2,9 s, rampe lisse de 0,3 s, recul de 1,33 s à 30 % de la vitesse du palier, rampe de 0,3 s (même période de 4,8 s) ; sa pointe vaut 1,34 × sa vitesse moyenne | La sinusoïde passait plus de la moitié du temps à accélérer ou à ralentir et sa pointe valait 2,1 × sa vitesse moyenne : le joueur réactif (qui n'anticipe pas) tirait en pleine décélération ou à la pointe (224 : 20 % contre 53 % sur la variante calme). Une sinusoïde moins ample ne recule plus avant que sa pointe soit assez basse ; les paliers gardent le recul, et les bascules (annoncées par les chevrons) sont brèves (224 : 51 % contre 59 %) |
| Recette 3 (Q1) | Lois à-coups et irrégulière à pleine amplitude ; accélération et rampe libres (pointes de 7 à 14 rad/s mesurées par la recette) | Plafond de pointe dans `genLevel` (`DIFFICULTY.peak`) : pointe de la loi ≤ 1,8 × sa vitesse moyenne (à-coups et irrégulière), et vitesse de pointe ≤ 2,2 × ω et ≤ 7 rad/s accélération et rampe comprises (à-coups, ressac, irrégulière). Leviers dans l'ordre : amplitude de la loi autour de sa valeur moyenne (ω inchangée) jusqu'à 0,3, puis plafond de l'accélération ou de la rampe du niveau, puis amplitude plus basse ; le Réacteur garde son accélération (sa loi s'aplatit d'abord). À cette amplitude, la loi irrégulière ne s'arrête plus et ne recule plus : elle tourne plus ou moins vite. Vérifié sur 1..400 par `tests/unit/levels.test.js` | La recette proposait ≈ 2,2 × ω : mesuré avant réglage (joueur réactif contre variante calme, 100 essais), 2,2 laissait les niveaux irréguliers à 25-40 points sous la variante calme (133 : 36 contre 77 %, 143 : 38 contre 72 %, 150 : 26 contre 67 %) ; avec la loi plafonnée à 1,8 × sa moyenne, 143 : 63 contre 72 %, 187 : 56 contre 55 %, 100 : 60 contre 47 %. Une vitesse qui double en une seconde ne se lit pas sans l'anticiper ; l'accélération à l'impact, lente et annoncée par l'impact, n'est bornée que par le plafond total |
| Recette 3 (Q1) | Demi-tours au rythme de période P (3,2 → 2,4 s ; Pendule : 3, 2,5 puis 2,2 s) ; « choisir la phase ou la vitesse des anneaux pour que les passages tombent entre les annonces » (recette) | Entre la fin d'un demi-tour et l'annonce du suivant, l'astre balaie au moins 1,15 tour : P ≥ 1,15 × 2π / ω + annonce + bascule + 0,2 s (161 : 6 s à 1,4 rad/s ; Pendule IV-VI : 3,4, 3,2 et 2,8 s) ; vitesse des anneaux choisie (±20 %) pour que leur période de passage ne soit presque commensurable ni avec P ni avec 2P, ni avec la période des lois alternée (7 s) et ressac (4,8 s), comme pour la loi pas à pas : les passages dérivent le long du va-et-vient au lieu de se caler entre les annonces | Aller et retour durent autant : à 1,4 rad/s et P = 3 s, l'astre ne balayait que 4,3 rad, moins encore hors des annonces, et l'anneau (période 1,85 s, presque 1/3 de 2P) ne passait qu'à trois angles : le joueur réactif ne trouvait aucun tir dans 239 parties sur 400 au niveau d'apprentissage 161 (21 %). Des passages calés entre les annonces (période de passage = P / m) se répéteraient aux mêmes angles et satureraient le bord ; en dérivant, environ un passage sur trois tombe pendant une annonce, les autres à des angles toujours nouveaux. Mesuré avant réglage : 161 de 21 à 63 % (variante calme 73 %), 299 de 0 à 43 %, 283 de 16 à 32 % (calme 37 %), 199 de 24 à 46 % |
| Recette 3 (Q3) | Durées : « niveau propre (45 ms) dans les plages de 5.10 », vérifié par `report.js` sur la médiane de chaque monde | `report.js` vérifie aussi chaque niveau : niveau propre (médiane des victoires à 45 ms) au plus au maximum de son monde, 1,5 × pour un boss, 30 s dans COSMOS ∞ (durées mesurées aussi sur les niveaux de COSMOS ∞ du rapport) ; `tune.js` retire une aiguille à la fois aux niveaux au-delà de 92 % de leur plafond, un boss garde le nombre d'aiguilles de son archétype. Exception nommée dans `report.js` (`BOSS_DUR_STAGE4`, dépassement imprimé sans échec) : les boss 60, 100, 110, 120, 150, 170, 220, 260 et ceux de la réserve de COSMOS ∞ 310, 340, 390 (rejoués en 410, 440, 490…), repris à l'étape 4 ; les boss 80, 90, 180, 190, 200, 320 et 370 tiennent la règle par leur seul facteur de vitesse | La recette a mesuré 58 niveaux sur 300 au-delà du maximum de leur monde (Ambre 52 à 26,8 s, 90 à 35,1 s ; boss jusqu'à 57 s) et la lecture « médiane » n'était pas notée. Les boss ont 9 à 14 aiguilles par archétype ; une grille de 7 facteurs de vitesse (`tune.js --grid --gridd=0`) ne trouve pour ces onze-là aucun réglage sous 1,5 × le maximum, ou seulement en les rendant 25 à 45 points plus faciles à 70 ms (120 : de 59 à 87 % ; 170 : de 49 à 68 % ; 220 : de 33 à 57 %). L'étape 4 reprend leur cadre (intro, barre de vie, deuxième phase) et donc leur durée ; les vider de leurs aiguilles maintenant changerait leur archétype |
| Recette 3 (Q1, Q3, Q5) | Réglage : sécante sur le facteur de vitesse, une aiguille de plus ou de moins (`tune.js`) | Après le plafond de pointe et les demi-tours au rythme, trois passes de `tune.js` (193 niveaux changés par le générateur, puis 83, puis la réserve 358 et 397), puis `tune.js --grid` sur une centaine de niveaux : 7 ou 8 facteurs × (aiguilles −1, 0, +1), réglage le plus proche de la cible à 70 ms qui tient le plancher à 30 ms (+2 points), la durée (92 % du plafond) et, avec `--prmin`, le joueur réactif (moyenne de ses voisins moins 12 points) ; `--lowp30` choisit, à 3 points près de la cible, le réglage où le joueur précis gagne le moins (moyennes à 30 ms de Saphir et de Cosmos, au bord de la table) ; cibles imposées (`--target`) pour les respirations (41-42, 191-192, 241-242 : ≈ +10 points) et la fin d'Émeraude (38, 42, 44, 45, 48 vers 76-86 %) ; un boss garde le nombre d'aiguilles de son archétype | La réussite d'un niveau à anneaux varie de façon erratique avec le facteur (la vitesse des anneaux suit celle de l'astre : 149 passe de 32 à 70 % à 70 ms entre les facteurs 0,675 et 0,772) : la sécante s'arrêtait loin de la cible. Le plafond de pointe avait rendu trop faciles des niveaux irréguliers (165 : 87 % pour 53 % visés) et les aiguilles retirées pour la durée en avaient rendu d'autres trop faciles (239 : 62 % pour 31 %) : le premier rapport complet après réglage manquait la fin d'Émeraude, le début d'Ambre, trois moyennes à 30 ms, trois respirations, six falaises et un apprentissage, en plus de cinq niveaux du joueur réactif |
| Recette 3 (Q5) | Marges statistiques : vérifier avec au moins deux jeux de graines indépendants ; plancher de COSMOS ∞ (497, 468, 421, sources 397, 368, 321) vers 78 % à 30 ms ; respirations 41-42, 191-192, 241-242 à ≈ +10 points | Contrôle `tests/sim/fresh.js` sur deux jeux de graines jamais vus par le réglage ni par le rapport (graines de `seeds.json` décalées de 200 000 000 et de 300 000 000) : 400 essais par niveau sur 1..300, 401-500 et 321, 368, 397, remesure à 1 000 essais de tout ce qui est à moins de 3 points d'une limite (plancher : < 78 % ou Wilson < 75 % ; joueur réactif : plus de 12 points sous ses voisins, puis variante calme ; respiration : sous +8). Plancher tenu sur les deux jeux : 1..300 au minimum 79,5 et 81,0 % ; COSMOS ∞ au minimum 79,6 % (423, 1 000 essais, Wilson 77,0 %) et 79,8 % (423, 1 000 essais) ; 421, 468, 497 : 97,5 / 97,8, 96,5 / 96,5, 93,5 / 88,5 % ; sources 321, 368, 397 : 97,5 / 96,5, 96,5 / 96,5, 91,8 / 90,3 %. Respirations 41-42 : +10,4 / +10,9 ; 191-192 : +17,8 / +9,9 ; 241-242 : +11,2 / +10,1. Le contrôle a trouvé des échecs que le rapport officiel laissait passer : joueur réactif sur 106, 219, 245, 246 (premier jeu) et 106, 126, 132, 219, 245, 246, 293 (second), respiration 141-142 à +4,4 points (second) ; et deux respirations justes, 281-282 (+5,9) et 291-292 (+5,6). Réglés sur un troisième jeu (décalage 400 000 000 : 70 ms, 30 ms, joueur réactif et variante calme pour chaque réglage candidat), puis vérifiés sur les deux premiers : 106 [0,92, 1], 126 [0,9, 1], 132 [1,25, −2], 219 [1,14, 3], 245 [1,05, −1], 246 [0,92, 0], 293 [0,95, 4], 141 [0,75, 0], 142 [0,88, 0], 281 [1,08, −1], 292 [1,18, 0], et 249 [0,56, 0] rendu plus dur (sa cible, 28 % à 70 ms) pour que la fin d'Obsidienne ne s'adoucisse pas (36,3 % à 70 ms, 35,5 avant). Après réglage, aucun échec sur les deux jeux (Rubis, Obsidienne et Cosmos remesurés) : joueur réactif au plus 10,4 points sous ses voisins sur ces niveaux (293 sur le second jeu : 12,3 points sur 400 essais, 10,4 sur 1 000), respirations 141-142 : +10,7 / +10,1, 281-282 : +13,6 / +8,6, 291-292 : +9,9 / +10,0 ; rapport officiel 101-300 (avant 281 et 292) : pass ; rapport officiel 251-300 : pass (Cosmos : 80,7 % au minimum à 30 ms, fin à 70 ms 26,0 % contre 24,8, respirations au moins +11,5 points contre +8,7). Le réglage 716654c (marges d'Obsidienne) avait été validé avant par un rapport complet sur les graines officielles : pass | Avec 300 essais à graines fixes, un niveau vers 40 % garde ±5,5 points d'erreur à 95 % : plusieurs niveaux du joueur réactif passaient le rapport officiel de justesse (245 et 246 : 35-36 % sur les graines officielles, 31-32 % sur 1 000 essais neufs). Ces niveaux répondent au facteur de façon erratique (la vitesse des anneaux suit celle de l'astre : 245 passe de 24 à 72 % à 70 ms entre les facteurs 0,65 et 0,75) : on retient un réglage qui tient ensemble la cible à 70 ms, le plancher et le joueur réactif sur un jeu de graines, puis on le vérifie sur deux autres. Restent à moins de 3 points d'une limite, sans échouer sur aucun des trois jeux (officiel et deux neufs) : le joueur réactif sur 275 (14,1 et 12,7 points sous ses voisins sur 1 000 essais ; variante calme 13,1 points au-dessus), 300 (boss : 11,1 et 13,7 ; variante calme 14,6 au-dessus) et 294 (13,1 et 12,3 ; variante calme 32 points au-dessus : un jeu de graines défavorable le ferait échouer ; sur une grille de 9 réglages, les seuls où le joueur réactif dépasse 27 % rendent le niveau 38 à 40 points plus facile à 70 ms, et au facteur 0,95 la loi pas à pas et les deux anneaux se calent au point que le joueur réactif ne gagne plus jamais : à reprendre avec le générateur). Les autres niveaux à plus de 15 points de leurs voisins sur un jeu (69, 103, 128, 160, 206, 234, 238, 268, 270) ont une variante calme à moins de 10 points. 69 et 176 étaient aussi à moins de 3 points de la limite (15,5 à 21 points sous leurs voisins, variante calme jusqu'à 13,8 et 13,7 points au-dessus sur les graines officielles) : réglés de nouveau, 69 [1,05, 2] et 176 [1,25, 1], puis vérifiés sur les deux jeux neufs (69 : 11,7 et 13,0 points sous ses voisins sur 1 000 essais ; 176 : 5,2 et 6,1) et par les rapports officiels 51-100 et 151-200 : pass (69 : 19,1 points sous ses voisins sur les graines officielles, variante calme 9,5 points au-dessus ; respiration 71-72 : +13,7). 176 reste à 45 % à 70 ms (43 avant) ; 69 passe de 67 à 77 % à 70 ms sur les graines officielles (cible 70 ; 76 dans les deux cas sur le troisième jeu) |
| Recette 4 (R2, R3) | Plafond de pointe sur toutes les lois, accélération et rampe comprises (≤ 2,2 × ω et ≤ 7 rad/s) | La recette 3 ne l'appliquait qu'aux lois à-coups, ressac et irrégulière : 245 (pas à pas + rampe) montait à 9,55 rad/s, 284, 393 et 493 (respirante + accélération) à 8,3-8,6. Le plafond vaut désormais pour toutes les lois ; les lois sans amplitude réglable (continue, respirante, alternée, pas à pas, ressac) n'ont que les leviers d'accélération (jusqu'à une aiguille d'accélération) et de rampe (jusqu'à 15 %) ; un niveau encore au-dessus de 7 rad/s, leviers au plancher (387 et 487, pas à pas seul à 7,06 rad/s), est ralenti juste assez (1 %). Pointe des lois et `vmax` échantillonnés toutes les 2 ms sur 300 s (`lawStat`) au lieu de 400 points espacés de 0,1 s : la pointe vraie des lois irrégulières dépassait le plafond de 1 à 2 % (313 : 7,09 rad/s) et `vmax` (seuil des chevrons, échelle du graphe) la sous-estimait de 3 à 6 % | 29 niveaux changent de loi, d'accélération ou de rampe (45, 74, 86, 89, 96, 100, 136, 219, 223, 245, 278, 284, 296, 313, 318, 322, 369, 371, 375, 387, 393 et leurs copies de COSMOS ∞), les autres de `vmax` seulement ; réglés de nouveau avec `tune.js` (mesures ci-dessous) |
| Recette 4 (R1, R4, R5, P2) | Règle « réactif » : niveau et voisins mesurés à 200 essais ; boss 150 et 220 dans `BOSS_DUR_STAGE4` ; 373 (source de 473) à 80 % à 30 ms ; `tests/ui.js` reprendre et echec en temps réel | `report.js` et `fresh.js` remesurent à 1 000 essais tout niveau à arrêts ou inversions à plus de 12 points sous ses voisins, AVEC ses quatre voisins, puis sa variante calme à 1 000 essais ; 103 (facteur 1,322 → 1,1, 8 aiguilles) et 294 (1,001 → 1,2, astre plafonné à 7 rad/s) réglés pour le joueur réactif sur graines neuves ; 245 repris après le plafond de sa rampe (facteur 1,3, 9 aiguilles) ; 150 (1,45 → 1,4 : 26,8 s pour 33) et 220 (1,101 → 1,25 : 38,5 s pour 42) tiennent la règle des durées et sortent de `BOSS_DUR_STAGE4` (restent 60, 100, 110, 120, 170, 260 et 310, 340, 390) ; 373 : facteur 0,469 → 0,45 (95,6 % à 30 ms sur 500 essais de graines neuves) ; `tests/ui.js` relève le compte à rebours et la chronologie de l'échec sur une horloge virtuelle | La recette 3 a trouvé 103 en échec et 294 à 1 point de la limite sur graines neuves : des voisins mesurés à 200 essais (±3,5 points) faisaient dépendre la règle des graines tirées ; 150 et 220 dépassaient leur plafond de moins de 1 % ; 473 était le niveau de COSMOS ∞ le plus juste (77,0 % sur un jeu neuf) ; sur une machine chargée, les attentes en temps réel de `ui.js` dépassaient la fenêtre de 0,6 s mesurée |
| Contrôle final de l'étape 2 | Deux écarts limites sur graines neuves, laissés à l'étape 4 | Le boss 200 (Saphir, loi irrégulière, deux anneaux) est 19-20 points sous ses voisins pour le joueur réactif sur tous les jeux de graines ; sa variante calme fait 12,1 / 12,3 / 16,4 / 17,7 points de mieux selon le jeu, autour de la limite de 15. Le boss 160 dure 37,3 s sur deux jeux neufs pour un plafond de 36 s (35,5 s sur les graines officielles). Les deux passent le rapport officiel ; ce sont des boss, repris avec le cadre des boss de l'étape 4 |

### Mesures à la fin de l'étape 2, après la recette 2 (vrai cœur dans Node, `node tests/sim/report.js`, graines officielles, 300 essais, remesures à 1 000)

| Monde | 30 ms : minimum / moyenne (table) | 70 ms : début → fin (table ±7) | Boss et spéciaux à 70 ms (table ±7) | Niveau propre à 45 ms (plage) |
|---|---|---|---|---|
| Émeraude | 99,0 / 99,9 % (≥ 95 / ≈ 99) | 95,1 → 85,8 % (97 → 80) | 86,3 % (75-85) | 7,1 s (6-15) |
| Ambre | 92,3 / 99,2 % (≥ 90 / ≈ 96) | 80,1 → 70,3 % (80 → 65) | 68,0 % (60-70) | 16,9 s (10-18) |
| Rubis | 93,7 / 98,5 % (≥ 85 / ≈ 93) | 68,0 → 55,4 % (68 → 52) | 56,0 % (48-58) | 17,5 s (12-22) |
| Saphir | 86,1 / 96,3 % (≥ 82 / ≈ 90) | 57,7 → 46,0 % (58 → 42) | 46,0 % (38-48) | 18,3 s (12-24) |
| Obsidienne | 83,7 / 93,4 % (≥ 78 / ≈ 87) | 46,0 → 31,0 % (45 → 32) | 36,5 % (28-38) | 22,2 s (14-28) |
| Cosmos | 79,4 / 90,4 % (≥ 75 / ≈ 84) | 34,6 → 25,8 % (35 → 22) | 25,1 % (20-30) | 25,8 s (15-30) |
| COSMOS ∞ (401-500, cycle en miroir jamais vu par le réglage) | 76,3 % au minimum (niveau 497, Wilson 73,6 %) | moyenne 26,7 % (22-30) | 26,3 % (20-30) | — |

- Tenu : plancher d'équité sur 1..300 (minimum 79,4 % au niveau 275, borne de Wilson 76,8 %) et sur COSMOS ∞ ; toutes les
  cibles par monde (début, fin, moyennes à 30 ms, boss et spéciaux), moyenne de COSMOS ∞ ; aucune falaise ; respirations
  ≥ +5 points (moyennes par monde +10,4, +14,6, +16,6, +20,1, +20,2, +20,5) ; apprentissages ≥ voisins + 12 ou ≥ 90 % ;
  durées dans les plages ; salve aveugle (`mash.js` : 20,9 % sur 11-50, 0/200 au pire au-delà, salve soutenue : aucun
  niveau fini) ; prédicteur honnête (`bot.js` : 0 mort, 0 blocage sur 1..300, 301-700 et 1001-1100) ; accord Chromium /
  Node 2 000 / 2 000 (`agree.js`). La dernière mesure complète signalait encore la respiration 271-272 (+4,5 : 269 venait
  d'être rendu plus facile pour une falaise limite) ; 271 et 272 ont été repris puis remesurés avec les graines
  officielles (39,0 et 36,0 % à 70 ms, 96,7 et 90,7 % à 30 ms) : +8,8 points sur 268-269, aucune autre règle touchée.
- Contrôle avec des graines neuves (`report.js --seed=777777`, avant les dernières retouches) : mêmes résultats à quelques
  points près ; restaient, de justesse, deux apprentissages (61, 71 : +11 et +10 points, 88 %) et trois falaises à
  12,5-12,8 points (205, 269, 299), repris ensuite.
- Pas tenu : joueur réactif sur 27 niveaux à arrêts, inversions ou vitesse très variable, où il fait plus de 15 points de
  moins que ses voisins ET que la variante calme du même niveau : 57, 65, 69, 75, 96, 100, 117, 126, 133, 143, 149, 150,
  161, 165, 174, 187, 199, 200, 224, 232, 239, 254, 265, 276, 277, 283, 299 (écarts de 16,5 à 45 points ; détail par
  niveau, causes d'échec et graines : `node tests/sim/report.js`, puis `tests/out/sim/report.json`). Sept autres niveaux
  signalés (46, 79, 160, 191, 194, 219, 289) ne doivent pas leur écart aux arrêts et inversions (variante calme aussi
  basse). Le joueur qui vise gagne tous ces niveaux (≥ 79 % à 30 ms) ; le joueur réactif modélisé (aucune anticipation,
  extrapolation à vitesse constante sur 0,26 s) y perd surtout aux lois irrégulière, en ressac et à-coups à vitesse élevée
  (pointes de 7 à 10 rad/s) et aux demi-tours au rythme combinés aux fenêtres d'anneaux. À reprendre avec le porteur :
  adoucir ces lois (pointe de vitesse bornée) ou accepter qu'elles récompensent l'anticipation.

### Mesures à la fin de la recette 3 de l'étape 2 (vrai cœur dans Node, `node tests/sim/report.js`, graines officielles, 300 essais, remesures à 1 000 ; code d'`afc2ccc`)

Rapport complet sur 1..300 et COSMOS ∞ 401-500 : **pass**, aucune règle en échec (4 196 s).

| Monde | 30 ms : minimum / moyenne (table) | 70 ms : début → fin, moyenne (table ±7) | Boss et spéciaux à 70 ms (table ±7) | Niveau propre à 45 ms : médiane, pire niveau hors boss (plafond) | Respirations : moyenne, minimum |
|---|---|---|---|---|---|
| Émeraude | 98,0 / 99,8 % (≥ 95 / ≈ 99) | 95,1 → 86,1 %, 91,6 % (97 → 80) | 88,1 % (75-85) | 6,9 s, 14,8 s au 43 (15 s) | +10,0, +8,7 |
| Ambre | 97,0 / 99,4 % (≥ 90 / ≈ 96) | 84,2 → 68,3 %, 76,1 % (80 → 65) | 72,6 % (60-70) | 14,6 s, 17,4 s au 65 (18 s) | +13,5, +10,0 |
| Rubis | 93,7 / 98,2 % (≥ 85 / ≈ 93) | 65,8 → 54,8 %, 63,5 % (68 → 52) | 58,8 % (48-58) | 17,1 s, 21,1 s au 141 (22 s) | +17,3, +10,0 |
| Saphir | 86,7 / 96,6 % (≥ 82 / ≈ 90) | 57,3 → 45,0 %, 53,3 % (58 → 42) | 50,1 % (38-48) | 17,6 s, 22,1 s au 157 (24 s) | +19,3, +12,5 |
| Obsidienne | 82,6 / 93,8 % (≥ 78 / ≈ 87) | 42,4 → 36,3 %, 41,3 % (45 → 32) | 35,8 % (28-38) | 20,5 s, 25,5 s au 206 (28 s) | +21,9, +10,3 (241-242) |
| Cosmos | 80,7 / 90,8 % (≥ 75 / ≈ 84) | 34,8 → 26,0 %, 32,4 % (35 → 22) | 25,2 % (20-30) | 24,5 s, 27,3 s au 259 (30 s) | +22,9, +11,5 |
| COSMOS ∞ (401-500, cycle en miroir jamais vu par le réglage) | 78,9 % au minimum (423, 1 000 essais, Wilson 76,3 %) ; 421, 468, 497 : 96,3, 96,0, 94,3 % | moyenne 26,8 % (22-30) | 26,9 % (20-30) | 21,9 s ; pire niveau hors boss 28,6 s au 495 (30 s) | — |

- Plancher d'équité sur 1..300 : minimum 80,7 % (294, Wilson 78,1 %). Obsidienne et Cosmos restent les mondes les plus
  durs (fin à 70 ms 36,3 et 26,0 % ; moyennes à 70 ms 41,3 et 32,4 %).
- Joueur réactif (Q1) : aucune falaise propre aux arrêts et aux inversions. Sur les 173 niveaux à arrêts ou inversions
  de 1..300, le pire écart à ses voisins est 25,9 points (160), puis 19,1 (69), 18,0 (238), 17,9 (206) et 16,9 (128) :
  tous ont une variante calme aussi basse (48,8, 73,5, 44,8, 46,5 et 70,0 % : moins de 15 points de mieux), et ne sont
  donc pas des falaises propres aux arrêts ; ensuite 14,7 (285) et moins. Les 27 niveaux de la recette : 69 à 19,1 points
  sous ses voisins (variante calme à 73,5 %, 9,5 points au-dessus), les 26 autres de 10 points au-dessus à 13,9 points
  au-dessous (239 : 13,9 ; 200 : 10,5 ; tous les autres sous 8 points) ; 161
  (apprentissage) 75,0 % (21 % avant), 187 72,0 %, 265 49,0 % et 299 36,5 % (0 % avant), avec 80,7, 45,3, 30,3 et
  16,7 % à 70 ms pour le joueur précis.
- Durées (Q3) : tous les niveaux hors boss tiennent le plafond de leur monde, et les boss 1,5 × ce plafond, sauf les
  boss nommés dans `BOSS_DUR_STAGE4` et repris à l'étape 4 (dépassement imprimé par `report.js`, sans échec) : 60
  (38,9 s pour 27), 100 (32,5 pour 27), 110 (40,5 pour 33), 120 (34,0 pour 33), 150 (33,3 pour 33), 170 (42,9 pour 36),
  220 (42,2 pour 42), 260 (51,0 pour 45), et dans COSMOS ∞ 410, 440, 490 (55,5, 54,3, 52,7 pour 45). Les niveaux
  signalés par la recette : 52 11,9 s, 65 17,4 s, 70 25,7 s et 90 25,1 s (boss : au plus 27 s).
- Marges sur graines neuves (Q5, `tests/sim/fresh.js`, deux jeux à 400 essais, remesures à 1 000 ; détail dans la
  ligne « Recette 3 (Q5) » ci-dessus) : plancher sur 1..300 au minimum 79,5 et 81,0 % ; COSMOS ∞ au minimum 79,6 et
  79,8 % (423) ; 421, 468, 497 : 97,5 / 97,8, 96,5 / 96,5, 93,5 / 88,5 % ; sources 321, 368, 397 : 97,5 / 96,5,
  96,5 / 96,5, 91,8 / 90,3 % ; respiration 241-242 : +11,2 / +10,1 points (+10,3 sur les graines officielles) ;
  41-42 : +10,4 / +10,9 ; 191-192 : +17,8 / +9,9.
- Autres contrôles sur le même code : salve aveugle (`mash.js` : 23,3 % en moyenne sur 11-50, au-delà au pire 1 départ
  réussi sur 200 (132), salve soutenue : 0/50 niveaux finis sur 51-100, 0/200 au-delà) ; prédicteur honnête (`bot.js` :
  3 200 parties sur 1..300 et la réserve 301-400, 0 mort, 0 blocage) ; accord Chromium / Node 2 000 / 2 000
  (`agree.js`, écart d'angle au plus 7e-15) ; capacité et « une idée à la fois » (`tests/unit/levels.test.js`) ;
  `tests/unit/run.js`, `tests/shoot.js` (+ `tests/sheet.py`) et `tests/ui.js` : pass (service worker `orbita-v63`).

### Mesures à la fin de la recette 4 de l'étape 2 (vrai cœur dans Node, `node tests/sim/report.js`, graines officielles, 300 essais, remesures à 1 000 ; code de `655b20c`)

Rapport complet sur 1..300 et COSMOS ∞ 401-500 : **pass**, aucune règle en échec (3 074 s).

| Monde | 30 ms : minimum / moyenne | 70 ms : début → fin, moyenne | Boss et spéciaux à 70 ms | Niveau propre à 45 ms (médiane) | Respirations : moyenne, minimum |
|---|---|---|---|---|---|
| Émeraude | 98,0 / 99,8 % | 95,1 → 86,1 %, 91,6 % | 88,1 % | 6,9 s | +10,0, +8,7 |
| Ambre | 96,7 / 99,4 % | 84,2 → 68,3 %, 76,1 % | 72,7 % | 14,6 s | +12,4, +8,2 |
| Rubis | 93,7 / 98,2 % | 66,5 → 54,8 %, 63,6 % | 58,5 % | 17,2 s | +17,3, +10,0 |
| Saphir | 86,7 / 96,6 % | 57,3 → 45,0 %, 53,3 % | 50,1 % | 17,6 s | +19,3, +12,5 |
| Obsidienne | 82,2 / 93,3 % | 42,4 → 36,0 %, 40,8 % | 34,6 % | 20,9 s | +22,5, +10,3 (241-242) |
| Cosmos | 82,0 / 90,8 % | 34,8 → 26,5 %, 32,6 % | 25,2 % | 24,0 s | +22,6, +10,0 |
| COSMOS ∞ (401-500) | 78,9 % au minimum (423, Wilson 76,3 %) ; 421, 468, 473, 497 : 96,3, 96,0, 97,0, 94,3 % | moyenne 26,9 % | 27,6 % | 22,0 s | — |

- Plancher sur 1..300 : minimum 82,0 % (296, Wilson 79,5 %). Le jeu ne devient pas plus facile : moyennes à 70 ms à
  0,5 point au plus de la recette 3 (Obsidienne 40,8 contre 41,3, Cosmos 32,6 contre 32,4) ; Obsidienne et Cosmos
  restent les plus durs.
- Plafond de pointe (R2, R3 ; pointe échantillonnée toutes les 5 ms sur 300 s, accélération et rampe au maximum, 1..500) :
  aucun niveau au-delà de 7 rad/s ni de 2,2 × ω (au plus 7,00 rad/s et 2,20 × ω ; 245 : 9,55 → 7,00 rad/s).
- Joueur réactif (R1) : aucun échec ; 103 à 82,0 % (voisins vers 69 %), 294 à 30,3 % sur 1 000 essais, 245 à 43,0 %.
  Quatre écarts au-delà de 15 points (69, 160, 206, 238) ont une variante calme aussi basse. Graines neuves
  (`tests/sim/fresh.js`, K = 700 000 000 et 300 000 000, 400 essais, remesures à 1 000 avec les voisins) : 0 échec sur
  les deux jeux ; 103 6,8 points AU-DESSUS de ses voisins, 294 5,6 points sous eux, 245 14,7 et 12,2 points sous eux
  (variante calme à moins de 15 points).
- Durées (R4) : 150 en 26,9 s (plafond 33) et 220 en 38,3 s (plafond 42) tiennent la règle ; `BOSS_DUR_STAGE4` ne garde
  que 60, 100, 110, 120, 170, 260 et, dans COSMOS ∞, 410, 440, 490 (sources 310, 340, 390) ; pire niveau hors boss
  27,3 s (259, plafond 30).
- Marges (R5, Q5) : 473 (source 373) à 97,0 % à 30 ms (79,6 % avant) et 95,5 % sur le jeu K = 700 000 000 ; plancher
  sur graines neuves au minimum 79,3 et 79,5 % (401, 423, 435), 421 / 468 / 497 à 97,8-98,5 / 96,5-97,0 / 88,5-89,5 % ;
  respiration 241-242 : +10,3 points (officielles), +10,1 et +14,6 (neuves).
- Autres contrôles sur le même code : `bot.js` 3 200 parties, 0 mort, 0 blocage ; `mash.js` 23,3 % sur 11-50, au pire
  1/200 au-delà, salve soutenue 0/50 et 0/200 ; `agree.js` 2 000 / 2 000 (écart d'angle 7e-15) ; `tests/unit/run.js`,
  `tests/shoot.js` (+ `tests/sheet.py`) et `tests/ui.js` : pass (service worker `orbita-v64`) — `tests/ui.js` complet
  passé alors que `report.js` occupait les 4 cœurs (P2).
