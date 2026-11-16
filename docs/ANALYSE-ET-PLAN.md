# ORBITA — Analyse du code existant et plan de développement

*Étapes 1 à 4 du cahier des charges (`docs/cahier-des-charges.md`, section 11) : analyser le code, lister ce qui fonctionne, lister les défauts, proposer l'architecture d'amélioration et le plan par étapes. Aucun code de jeu n'est modifié par ce document.*

- Version analysée : commit `ad561a3` de la branche de travail (`index.html`, 1 495 lignes).
- Références de lignes : toutes les mentions « l. N » renvoient à `index.html` dans cette version.
- Méthode : lecture intégrale du code, banc d'essai `tests/shoot.js` relancé, profil d'image et d'allocations sous Chromium (Playwright + CDP), simulateur de joueur humain bruité (validé sur le vrai jeu : 3 836 tentatives rejouées sur 3 840 donnent le même résultat) relancé sur les niveaux 1 à 120, et revérification des constats de la revue indépendante sur lesquels ce plan s'appuie (section 1.11).

---

## 0. Résumé pour le porteur du projet

**Ce qui marche et qu'on garde.** Le cœur est sain : un seul geste, des niveaux déterministes, une collision juste au degré près sur les niveaux normaux, un arc lumineux qui montre exactement où l'on peut planter, un viseur d'avance, un oscilloscope qui annonce la rotation 1,75 s à l'avance, six lois de rotation, des arcs interdits, une sentinelle, des aiguilles traversantes, des étoiles bonus, le « FRÔLÉ », un son 100 % synthétisé qui joue la gamme du monde, et un rendu « arcade vectorielle » soigné qui tient 60 images/s sur ordinateur avec 1 ms de calcul par image. Le banc d'essai passe (`pass: true`).

**Les trois problèmes qui comptent le plus pour un joueur sur téléphone.**
1. **Le jeu est beaucoup trop facile et trop court.** Un joueur qui vise avec 70 ms d'imprécision gagne 99 à 100 % des niveaux 1 à 120 ; un niveau dure 1,4 à 5,5 s ; les boss ont *moins* d'aiguilles (5,3) que les niveaux normaux (5,5) ; taper à l'aveugle (à la meilleure cadence) finit en moyenne 45 % des niveaux 1 à 40 du premier coup.
2. **L'échec est mal servi.** Un rebond de doigt (double tap) tue à coup sûr (40 sur 40 aux niveaux 1, 2, 3, 8, 21) ; la feuille d'échec cache le point d'impact sur les téléphones de moins de ~700 px de haut ; un tap entre 0,28 et 0,7 s relance en silence sans jamais montrer pourquoi on a perdu.
3. **Il manque tout ce qui donne envie de rejouer** : ni score, ni combo, ni tir parfait, ni record, ni vrai boss, ni niveaux spéciaux, ni musique ; les étoiles ne débloquent rien ; après le monde 8 tout recommence en chiffres romains.

S'y ajoutent des défauts d'interface ou de robustesse : écran noir si le réseau traîne (la police Google bloque le démarrage), rendu à 60 images/s même sur les écrans immobiles (batterie), 2,7 Mo alloués par seconde de jeu, mode paysage cassé, petits textes peu contrastés.

**Décisions proposées.**
- **On découpe `index.html` en scripts classiques** (`js/config.js`, `js/levels.js`, `js/core.js`, `js/render.js`…), sans outil de compilation ni module ES : le jeu reste un dossier qu'on ouvre dans un navigateur, le banc d'essai continue de fonctionner par `file://`, et le générateur de niveaux devient utilisable directement par les outils de réglage de la difficulté. Le premier commit déplace le code **sans en changer le comportement** (vérifié par un vidage identique des niveaux et par le banc d'essai).
- **Structure : 6 mondes de 50 niveaux (300 niveaux) puis « COSMOS ∞ » sans fin**, un boss tous les 10 niveaux (30 boss : les 5 mécaniques du cahier des charges, chacune en 6 paliers), un niveau spécial par bloc de 10, deux niveaux de respiration après chaque boss.
- **Tir PARFAIT = aiguille plantée au milieu d'un intervalle libre**, à ±35 ms de rotation près (bornée en angle). Le milieu de chaque arc allumé porte un repère visible. C'est aussi le tir le plus sûr : le parfait récompense le bon jeu au lieu de le contredire.
- **Sauvegarde v2** dans une seule clé versionnée, migration automatique de l'ancienne progression, sauvegarde automatique et **reprise de la partie en cours après fermeture de l'application**.
- **Difficulté pilotée par des mesures** : chaque monde a une cible chiffrée (taux de victoire du joueur simulé à 30 ms et 70 ms d'imprécision), vérifiée automatiquement à chaque modification ; aucun niveau sous 75 % à 30 ms (plancher d'équité), les derniers mondes entre 20 et 45 % à 70 ms.

**Plan.** Sept étapes pour une première version entièrement jouable (fondations et collision ; difficulté ; combo, score, parfait et étoiles ; boss et niveaux spéciaux ; animations, effets et son ; menus, mondes, récompenses et optimisation mobile ; contrôle qualité final), puis une phase 2 (collection, défis quotidiens et hebdomadaires, succès, défi à deux, classements, monétisation respectueuse) qui ne commence qu'une fois le jeu jouable et équilibré. Chaque étape a des tests d'acceptation chiffrés (section 6) et chaque exigence du cahier des charges est rattachée à une étape et à une vérification (section 7).

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

Les scripts de mesure ont été exécutés hors du dépôt ; l'étape 1 et l'étape 2 versent leurs équivalents dans `tests/` (sections 4.10 et 6).

### 1.11 Revue indépendante : statut des 32 constats

« Revérifié » = mesuré à nouveau pour ce document ; « confirmé » = confirmé par le second relecteur de la revue ; « lecture » = vérifié en lisant le code, sans pouvoir le mesurer ici ; « hypothèse » = non revérifié.

| Constat | Sujet | Statut | Traitement |
|---|---|---|---|
| UX-1 / ART-1 | Feuille d'échec qui cache l'impact (écrans courts) | confirmé + revérifié | Étape 1 |
| UX-2 | Tap entre 0,28 et 0,7 s : relance silencieuse, feuille jamais vue ; MENU à gauche sur la feuille d'échec seulement | confirmé + lecture | Étape 1 |
| UX-3 / ENG BUG-5 | « Il manquait 4° » au centre d'un arc interdit (20° en réalité) | confirmé | Étape 1 |
| UX-4 | Règle du monde affichée 1,3 s en 7 px, introuvable ensuite | confirmé | Étape 2 |
| UX-5 / ART-2 | Petits libellés < 11 px, contraste 2,5-3,8:1 dans les mondes sombres | confirmé | Étape 1 (palettes) et 6 |
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
| ART-4 | « FRÔLÉ » et « ★ n/3 » posés sur l'anneau du cadran | visible sur la capture de référence | Étape 5 |
| ART-6 | Pas d'icône PNG pour l'écran d'accueil iPhone | revérifié (seul `icon.svg` existe) | Étape 6 |
| ART-7 | HUD décalé de 68 px sur les feuilles de fin | visible sur les captures | Étape 1 |
| ART-8 | Bouton SUIVANT à la couleur du monde suivant après un boss | proposition | Étape 6 |
| BAL-1 | Pas de courbe de difficulté | revérifié (simulateur relancé) | Étape 2 |
| BAL-2 | La salve à l'aveugle passe | revérifié | Étapes 1 (relance) et 2 |
| BAL UX-1 | Inversions et arrêts annoncés seulement par l'oscilloscope, loin de l'action | lecture | Étape 2 |
| BAL FEAT-1 | Série de victoires | proposition | Étape 6 |
| BAL FEAT-2 | Records personnels | proposition | Étape 3 |
| BAL FEAT-3 | Donner un but aux étoiles, marquer la fin des mondes | proposition | Étapes 3 et 6 |

Contradiction tranchée : la revue (BAL, point vérifié n° 73) déconseille de supprimer la file d'attente des taps parce que le banc d'essai s'en sert pour provoquer son échec volontaire au niveau 10. La file est néanmoins remplacée (section 5.6), et `tests/shoot.js` provoque l'échec volontaire de façon déterministe (tirer quand le point d'impact prévu tombe sur une aiguille), dans le même commit. C'est un test plus strict, pas plus faible.

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
| D10 | Moyen | **Batterie** : 60 images/s même sur écrans immobiles ; 2,7 Mo/s alloués (≈ 4 GC/s) | 1.10 | 1, 6 |
| D11 | Moyen | **Timing approximatif et dépendant de l'appareil** : lancer simulé à l'image précédente (0 à 16,7 ms trop tôt) ; vol de 56 à 64,5 ms selon l'écran ; sous charge, le plafond `dt` ralentit tout le jeu (0,63× à CPU ×4) | 1.10, ENG PERF-1 | 1 |
| D12 | Moyen | **Collision 1,7 px avant le contact dessiné** ; contrôle ponctuel à l'atterrissage (une tête peut traverser la tige en vol pendant les ~12 dernières millisecondes, jusqu'à ≈ 0,036 rad à 3 rad/s, par calcul) | Lecture l. 657, 808-812 | 1 |
| D13 | Moyen | **Changements de vitesse peu lisibles** : inversions et arrêts annoncés seulement par l'oscilloscope en bas à droite | BAL UX-1 | 2 |
| D14 | Moyen | **Règles des mondes** affichées une fois, 1,3 s, en 7 px ; aucune relecture possible | UX-4 | 2 |
| D15 | Moyen | **Pas de musique**, un seul réglage son, vibrations inexistantes sur iPhone (API absente du navigateur) sans que l'interface le sache | Lecture | 5 |
| D16 | Moyen | **Pas de reprise après fermeture** de l'application ; seule la progression est gardée | Lecture | 1 |
| D17 | Mineur | Message d'échec faux au centre d'un arc interdit | UX-3 | 1 |
| D18 | Mineur | Petits textes peu contrastés dans les mondes sombres | UX-5 | 1, 6 |
| D19 | Mineur | Paysage cassé ; clavier ; icône iPhone ; saut de l'astre au menu ; HUD décalé sur les feuilles ; libellés sur l'anneau du cadran ; fautes de français | UX-6/7/8, ART-4/6/7, VIS-1 | 1, 5, 6 |
| D20 | Mineur | Sélection des niveaux en une longue liste : ne tiendra pas 300 niveaux | Lecture l. 1384-1404 | 6 |

---

## 4. Architecture d'amélioration

### 4.1 Principes

1. **Garder ce qui marche** : lois de rotation, règles de collision, rendu vectoriel, police, solides, phosphore, sons, prédicteur et banc d'essai sont déplacés, pas réécrits.
2. **Un seul changement de nature par commit** : déplacement du code d'abord (comportement identique et prouvé), corrections ensuite.
3. **Simulation déterministe séparée de l'affichage** : les règles ne lisent ni l'horloge murale, ni le DOM, ni le canvas. Elles émettent des événements que le rendu, l'audio, les effets et l'interface écoutent.
4. **Tout ce qui se règle est une donnée** : mondes, boss, niveaux spéciaux, score, difficulté, objectifs, séries sont des tables dans `js/config.js`.
5. **Chaque mécanique ajoutée est enseignée, mesurée et testée** ; aucun bouton sans effet réel.

### 4.2 Découpage de `index.html` : décision

**Décision : découper en scripts classiques chargés dans l'ordre par `index.html`, sans module ES ni outil de compilation.**

Justification :
- Le jeu va environ tripler (≈ 1 500 → ≈ 5 000 lignes : tables de 6 mondes, 5 boss × 6 paliers, niveaux spéciaux, score, sauvegarde v2, musique, nouveaux écrans). Un fichier unique de 5 000 lignes rend chaque étape difficile à relire et produit des conflits entre étapes.
- Le réglage de la difficulté (étape 2) doit appeler le **vrai** générateur des milliers de fois dans Node. Aujourd'hui, le simulateur doit d'abord vider les niveaux depuis un navigateur. Avec `js/config.js`, `js/util.js` et `js/levels.js` sans dépendance au DOM, Node les charge directement (`vm.runInContext`) : une seule source de vérité pour le jeu, le simulateur et les tests.
- **Pas de modules ES** : ils ne se chargent pas en `file://` dans Chromium (politique CORS), or le banc d'essai ouvre `file://…/index.html`. Les modules casseraient aussi le contrat de test (identifiants globaux).
- **Pas de compilateur ni de dépendance** : le porteur du projet garde un jeu qu'on ouvre en double-cliquant et qu'on publie tel quel sur GitHub Pages.
- Coût : une dizaine de petits fichiers à charger (cachés par le service worker, négligeable en HTTP/2) et une discipline de nommage (deux scripts classiques ne doivent pas déclarer le même `let/const` de premier niveau).

Fichiers cibles (ordre de chargement, tous en `<script defer src>`) :

| Fichier | Contenu | Dépend du DOM ? | Chargeable dans Node |
|---|---|---|---|
| `js/config.js` | Constantes (`GAP`, `ORBHIT`, `FLIGHT`…), tables `WORLDS`, `BOSSES`, `SPECIALS`, `SCORING`, `DIFFICULTY`, `OBJECTIVES`, `STREAK`, `GEN_VERSION`, `SAVE_VERSION` | non | oui |
| `js/util.js` | `rng`, `angDiff`, `norm`, `clamp`, `lerp`, `easeOut`, `pad2`, petit bus d'événements `bus.on/emit` | non | oui |
| `js/vector.js` | Police « Trace », solides filaires, `project`, `vsvg` | non (canvas fourni par l'appelant) | oui |
| `js/levels.js` | Lois de rotation (`patSpeed` et nouvelles), `makeLevel(n)`, `unionMeasure`, `computeArcs`, contrôle de capacité, orientation de départ | non | oui |
| `js/score.js` | Parfait, combo, score, objectifs, records, série (étape 3) | non | oui |
| `js/store.js` | Sauvegarde v2, migration, sauvegarde automatique, instantané de reprise (adaptateur de stockage injectable) | non | oui |
| `js/core.js` | État et machine à états, `startLevel`, `throwPin`, `update`, `stick`, `fail`, `win`, collisions, `predictRot`, `window.__botSafe`, reprise | non (émet des événements) | oui |
| `js/audio.js` | Bus WebAudio effets/musique, `sfx`, séquenceur musical (étape 5) | WebAudio | non |
| `js/fx.js` | Particules, textes flottants, secousses, flashs, vibrations | non | oui |
| `js/render.js` | Mise en page (`layout`, `resize`), fond, scène, HUD, bandeaux, phosphore, ordonnancement du rendu | canvas | non |
| `js/ui.js` | Écrans DOM, boutons, entrées pointeur et clavier, visibilité, orientation | DOM | non |
| `js/main.js` | Démarrage (chargement de la sauvegarde, reprise), boucle à pas fixe, service worker | DOM | non |

Le CSS reste en ligne dans `index.html` (≈ 300 lignes à terme) : il est nécessaire au premier affichage et évite une requête bloquante. Les polices B612 sont **auto-hébergées** dans `fonts/` (licence OFL, sous-ensemble latin en woff2, `font-display: swap`).

### 4.3 Contrat de test (préservé à chaque étape)

Le banc d'essai lit ces identifiants par leur nom depuis `page.evaluate`. Dans des scripts classiques, les `function` et les `let/const` de premier niveau partagent une seule portée globale : ils restent accessibles par leur nom.

| Identifiant | Fichier après découpage | Règle |
|---|---|---|
| `state` (`'menu'|'levels'|'play'|'pause'|'dying'|'winning'|'won'|'failed'`) | `core.js` | `let` ; noms d'états inchangés ; un nouvel état éventuel (intro de boss) se joue *à l'intérieur* de `play` |
| `startLevel(n)`, `throwPin()`, `update(dt)` | `core.js` | déclarations `function` (remplaçables par `window.x = …`, ce dont se servent les scripts du simulateur) ; `update(dt)` avance toute la simulation de `dt` secondes, ne lit jamais l'horloge et pilote toutes les transitions ; `throwPin()` sans argument = lancer à l'instant de simulation courant |
| `showMenu()`, `showLevels()` | `ui.js` | `function` ; affichent l'écran à partir de `unlocked` et `bestStars` |
| `left`, `flying`, `stuck`, `rot`, `t` | `core.js` | `flying` vaut une aiguille en vol ou `null` ; `stuck` contient toujours tous les occupants du bord (bloqueurs inclus) sous la forme `{a}` |
| `speedAt(t)`, `angDiff`, `norm`, `GAP` | `levels.js`, `util.js`, `config.js` | signatures inchangées |
| `LAUNCH`, `cy`, `R`, `FLYV` | `render.js` | toujours définis ; `FLYV` est dérivé de la durée de vol constante |
| `unlocked`, `bestStars`, `soundOn` | `store.js` | `let` modifiables ; `bestStars[n]` = nombre d'étoiles (0..3) affiché ; `soundOn = false` coupe les effets sonores |
| `window.__botSafe()` | `core.js` | prédicteur honnête, marge 0,7 × GAP de chaque côté, **étendu à chaque nouvelle mécanique** (anneaux, zones pulsées, inversions annoncées, niveaux spéciaux) avec la même physique que le jeu |
| `#playBtn`, `#hudBtn` | `index.html` | ids conservés |

Règles : toute évolution de `tests/shoot.js` se fait dans le même commit que le changement qui la motive et ne retire aucune vérification ; les nouveaux contrôles vont dans de nouveaux scripts (`tests/unit`, `tests/sim`, `tests/perf`, `tests/ui`).

### 4.4 Cœur déterministe et bus d'événements

- `core.js` ne touche ni au DOM ni au canvas : il émet `level:start`, `throw`, `hit`, `perfect`, `near`, `star`, `combo`, `fail`, `win`, `state`, `boss:phase`… ; `fx.js`, `audio.js`, `ui.js`, `store.js` s'abonnent. Les abonnés sont synchrones : `startLevel()` masque toujours les écrans avant de rendre la main (le banc d'essai en dépend).
- La physique travaille en unités normalisées : angles en radians, vol en fraction `u ∈ [0, 1]` de la course (0 = pas de tir, 1 = contact), anneaux et orbites placés à une fraction de course fixe. `render.js` convertit en pixels. Conséquence : **même timing sur tous les écrans**, et une partie peut être rejouée dans Node à partir de `(numéro de niveau, GEN_VERSION, instants des taps)`. Cette propriété servira en phase 2 à vérifier côté serveur les scores des défis et des classements.

### 4.5 Boucle, temps et entrées

- **Boucle à pas fixe** : `loop(now)` accumule le temps écoulé (plafonné à 0,25 s) et appelle `update(1/120)` autant que nécessaire, puis dessine une fois. Plus de ralenti sous charge (cible : vitesse de simulation ≥ 0,98× à CPU ×4). `update(dt)` garde son contrat : appelé par le banc avec `1/60`, il subdivise lui-même en pas de 1/120 s.
- **Lancer horodaté** : le gestionnaire `pointerdown` lit `e.timeStamp`, le convertit en instant de simulation, et l'aiguille part exactement à cet instant, même s'il tombe au milieu d'un pas. Le gestionnaire lit l'horloge, `update()` ne la lit jamais.
- **Vol de durée constante** `FLIGHT = 60 ms` sur tous les écrans (`FLYV = course / FLIGHT`).
- Latence : le tap est traité dans le gestionnaire d'événement, l'aiguille est visible à l'image suivante (≤ 16,7 ms) ; `touch-action: none` sur toute la zone de jeu.

### 4.6 Sauvegarde v2

Une seule clé `orbita_save`, contenu JSON versionné :

```js
{
  v: 2,                                   // SAVE_VERSION ; une v3 migrera en place
  gen: 2,                                 // GEN_VERSION des niveaux (invalide une reprise si les niveaux ont changé)
  progress: { unlocked: 23 },            // plus haut niveau jouable (1 .. 300, puis COSMOS ∞)
  levels: {                               // seulement les niveaux joués (stockage clairsemé)
    "12": { s: 0b011, best: 4820, combo: 9, perf: 4, time: 8.4, tries: 7, wins: 3 }
  },                                      // s = objectifs atteints : 1 = fini, 2 = toutes les étoiles bonus, 4 = objectif secondaire
  records: { bestCombo: 14, perfectTotal: 213, bestStreak: 18, careerScore: 123456, legacyStars: 47 },
  streak: { cur: 3, tokens: 1 },          // série en cours, jetons « Reprise »
  settings: { sfx: true, music: true, haptics: true },
  resume: null,                           // instantané de la partie en cours, voir ci-dessous
  stats: { attempts: 120, fails: 80, playTime: 3600 },
  meta: { created: 1763300000000, updated: 1763300000000 }
}
```

- **Migration** (une fois, au premier démarrage de la nouvelle version) : `orbita_unlocked` → `progress.unlocked` (borné à 1..300) ; les niveaux `n < unlocked` sont marqués « finis » (bit 1), car les anciens numéros ne correspondent plus aux mêmes niveaux et les nouveaux objectifs n'ont pas été réalisés ; le total des anciennes étoiles est conservé dans `records.legacyStars` et affiché dans les records ; `orbita_sound` → `settings.sfx` et `settings.music`. Les anciennes clés sont laissées en place pendant une version (retour arrière possible), puis supprimées.
- **Validation** à chaque lecture : types, bornes (`unlocked` entier entre 1 et 100 000 : COSMOS ∞ compris, sans valeur absurde qui figerait l'écran des niveaux), objets ; valeur invalide = valeur par défaut, sans exception. Écriture dans `try/catch` (quota, navigation privée).
- **Sauvegarde automatique** : fin de niveau (victoire ou échec), changement de réglage, record battu, pause, `visibilitychange` (masqué), `pagehide`.
- **Reprise après fermeture** : pendant `play` ou `pause`, un instantané `{ n, gen, t, rot, thrown: [angles], left, starsHit, score, combo, perfects, levelTime, savedAt }` est écrit au masquage de la page, à la pause et au plus toutes les 3 s après un atterrissage (jamais pendant un vol). Au démarrage, s'il a moins de 7 jours et le même `gen`, le menu propose **REPRENDRE NIV 34** : le niveau est régénéré (déterministe), les aiguilles replantées, et le jeu s'ouvre en pause. L'instantané est effacé à la fin du niveau ou à l'abandon.
- Les globales `unlocked` et `bestStars` restent la vue utilisée par l'interface ; `bestStars[n]` est recalculé depuis les bits au chargement.

### 4.7 Tables de données (`js/config.js`)

Esquisse des formes ; les valeurs exactes sont fixées aux étapes 2 à 4 par les outils de mesure.

```js
const FLIGHT = .060, GAP = .115, ORBHIT = .2, GEN_VERSION = 2, LEVELS_PER_WORLD = 50, BOSS_EVERY = 10;
const WORLDS = [
  { id: 'emeraude', name: 'ÉMERAUDE', theme: 'DÉCOUVERTE', rgb: [77,255,166], hi: [230,255,242], acc: [255,211,92], alert: [255,59,82],
    solid: 'ico', root: 62, scale: [0,2,4,7,9], tempo: 100,
    speed: [1.1, 2.2], throws: [4, 8], obstacleUnits: [0, 4], movers: 0,
    patterns: { 0: 1, 1: .6 }, intro: { 1: 'lancer', 2: 'bloqueurs', 3: 'etoiles', 4: 'sens', 6: 'parfait', 8: 'combo', 11: 'respiration', 21: 'dispositions' } },
  /* AMBRE, RUBIS, SAPHIR, OBSIDIENNE, COSMOS : mêmes champs (section 5) */
];
const BOSSES = [   // archétype k (1..5) au niveau 10·k de chaque monde ; tiers[0..5] = paliers I..VI
  { id: 'reacteur', name: 'LE RÉACTEUR', solid: 'cubocta', rule: 'IL ACCÉLÈRE À CHAQUE AIGUILLE',
    tiers: [ { throws: 10, v0: 1.1, accel: .05, vmax: 2.0, blockers: 0 }, /* … */ ] },
  /* PENDULE, ANNEAUX, FORTERESSE, CHAOS */
];
const SPECIALS = { pluie: { /* … */ }, chrono: { /* … */ }, parfait: { /* … */ } };
const SCORING = { needle: 100, perfect: 150, near: 50, star: 250, clear: 500, bossClear: 1500,
  comboStep: 3, comboMaxMult: 5, perfectComboGain: 2, perfectTime: .035, perfectMin: .02, perfectMax: .12, comboWindow: [1.2, 2.4] };
const DIFFICULTY = { floor30: .75, worldTargets70: [[.97,.80],[.80,.65],[.68,.52],[.58,.42],[.45,.32],[.35,.22]],
  breather: .10, cliff: .12, bossDrop: [.05,.10], mashMax: [.30, .03, .03, .03, .03, .03], maxUnits: 14 };
const OBJECTIVES = { parfaits: { /* k selon les tirs */ }, combo: { /* ×k */ }, chrono: { /* T */ }, score: { /* S */ } };
const STREAK = { milestones: [3, 7, 12, 20, 30, 40, 50], tokenMax: 3 };
```

Le générateur ne contient plus de constantes de réglage : il lit ces tables. Un test (`tests/unit/config.test.js`) vérifie leur cohérence (bornes, mondes contigus, chaque boss a 6 paliers, contraste des palettes ≥ 4,5:1 pour les libellés).

### 4.8 Budget de performance et de batterie

Cible : 60 images/s sur un téléphone de milieu de gamme (Android 2021-2022 de milieu de gamme, iPhone XR/11), en restant sobre en batterie.

| Poste | Aujourd'hui | Budget | Moyen |
|---|---|---|---|
| Calcul JS par image (CPU normal) | `update` ≤ 0,1 ms, `draw` 1,0 ms | `update` ≤ 0,5 ms, `draw` ≤ 3 ms | — |
| CPU ×4 (substitut) | 50-67 ms/image, jeu à 0,48-0,63× | ≤ 33 ms/image, simulation ≥ 0,98× | pas fixe ; DPR adaptatif ; composition du phosphore limitée au rectangle utile (cadran, couloir, HUD) |
| Résolution | DPR plafonné à 2 | DPR ≤ 2 et ≤ 2,3 Mpx ; descend à 1,5 puis 1,25 si l'image dépasse 20 ms pendant 45 images, remonte après 5 s fluides | `resize()` paramétré |
| Allocations | 2,7 Mo/s | ≤ 100 Ko/s en jeu | boucles indexées au lieu de `for…of` dans le rendu, chaînes HUD mises en cache (ne changent qu'avec la valeur), tableaux de pointillés constants, réservoirs de particules réutilisés (pas de `filter`), pas de fermetures par image |
| Écrans immobiles | 60 images/s partout | 0 image/s (niveaux, réglages, records, pause après 1 image, feuilles de fin une fois les animations terminées) ; démo du menu à 30 images/s | la boucle s'arrête et repart sur `wake()` (entrée, changement d'état, redimensionnement, visibilité) |
| Audio | — | séquenceur suspendu en arrière-plan ; `AudioContext.suspend()` si la page est masquée ou si effets et musique sont coupés | `audio.js` |
| Chargement | ressource bloquante tierce | aucun blocage tiers ; ≤ 300 Ko transférés à froid ; premier affichage < 1 s en 4G | polices auto-hébergées, service worker « cache puis réseau » avec course de 2,5 s |

Mesures associées : `tests/perf.js` (profil d'image à CPU ×1/×4, échantillonnage des allocations, images par seconde sur chaque écran immobile, latence tap → aiguille visible).

### 4.9 PWA et chargement

- `sw.js` : précache de tous les fichiers (`index.html`, `js/*.js`, `fonts/*`, icônes, manifeste) ; stratégie « cache d'abord, mise à jour en arrière-plan » pour l'application, course réseau / 2,5 s pour la navigation ; nom de cache incrémenté à chaque version ; un test vérifie que chaque fichier de `js/` est dans la liste.
- Icônes PNG 180/192/512 générées depuis `icon.svg` (inchangée) et `apple-touch-icon` (étape 6).

### 4.10 Outils de test (versés dans le dépôt au fil des étapes)

| Outil | Contenu | Étape |
|---|---|---|
| `tests/shoot.js` (existant) | bot, captures, balayage d'équité 1..60 | toutes |
| `tests/unit/run.js` | tests Node sans dépendance : sauvegarde et migration, déterminisme du générateur, score/combo/parfait, cohérence de `config.js`, chronologies de boss | 1, 3, 4 |
| `tests/sim/` | simulateur de joueur bruité porté depuis la revue (`human.js`), chargeant le vrai générateur ; `report.js` (cibles par monde, plancher, falaises), `mash.js` (salve aveugle), `bot.js` (prédicteur honnête sur 300 niveaux, 0 mort), `planner.js` (objectifs secondaires atteignables) | 1, 2, 3, 4 |
| `tests/perf.js` | profil, allocations, images au repos, latence | 1, 6 |
| `tests/ui.js` | occlusion de la feuille d'échec sur 5 écrans, reprise après rechargement, migration v1, boutons tous fonctionnels, clavier, paysage | 1, 6 |

---

## 5. Spécification de game design de la première version jouable

### 5.1 Structure

- **6 mondes de 50 niveaux = 300 niveaux**, puis **COSMOS ∞** (niveaux 301 et suivants, générés sans fin à difficulté de plateau).
- Chaque monde = 5 blocs de 10 niveaux. Dans un bloc : x1-x2 **respiration** (plus faciles), x3-x6 et x8-x9 montée, **x7 niveau spécial**, **x10 boss**.
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
| Obsidienne (violet sombre) | `#b48cff` | `#f1ecff` | `#9dffd0` | `#ff3b52` | tesseract | 7,8:1 |
| Cosmos (nacre spectrale, mon choix) | `#dff3ff` | `#ffffff` | `#ff5ccf` | `#ff3b52` | sphère armillaire | 17,7:1 |

- Obsidienne : le « sombre » vient de l'ambiance (lueur de fond très faible, trame plus discrète, phosphore moins persistant), pas des traits, qui restent lisibles.
- Cosmos : traits nacrés presque blancs ; la lueur de fond change lentement de teinte (cycle de 60 s, décoratif). Comme tout le monde est clair, les éléments se distinguent **par la forme** : obstacles mobiles = barres pleines, zones interdites = bandes hachurées creuses, bloqueurs = têtes creuses, aiguilles du joueur = têtes pleines (leçon d'OPALE, ART-3).
- Libellés secondaires : opacité calculée par monde pour garantir ≥ 4,5:1 (gain de luminance, ART-2) ; vérifié par test.

### 5.3 Introduction des mécaniques, une idée à la fois

Chaque nouvelle idée arrive dans un **niveau d'apprentissage court** (3-5 aiguilles, vitesse modérée, mécanique isolée), annoncée par un bandeau lisible (hauteur ≥ 10 px, ≥ 2 s, relisible dans la pause et dans la sélection des niveaux, corrige UX-4). Les niveaux suivants la combinent avec ce qui est connu.

| Monde (niveaux) | Thème | Nouvelles idées (niveau d'apprentissage) | Spéciaux (x7) | Boss (x10) |
|---|---|---|---|---|
| Émeraude (1-50) | Découverte | 1 lancer (« TOUCHE POUR LANCER ») ; 2 aiguilles déjà plantées (« ARC ALLUMÉ = ZONE LIBRE ») ; 3 étoiles bonus ; 4 rotation dans l'autre sens ; 6 PARFAIT (« PLANTE AU CENTRE D'UN ARC ») ; 8 COMBO (« ENCHAÎNE SANS ATTENDRE ») ; 11 respiration (vitesse qui varie doucement) ; 21 dispositions serrées (paires, éventails) | 7 Pluie d'étoiles, 17 Chrono, 27 Parfait, 37 Pluie, 47 Chrono | palier I des 5 boss : 10 Réacteur, 20 Pendule, 30 Anneaux, 40 Forteresse, 50 Chaos |
| Ambre (51-100) | Accélération | 51 accélération à l'impact (chaque aiguille plantée accélère l'astre) ; 61 à-coups ; 71 pas à pas (arrêts) ; 81 accélération + à-coups | rotation des 3 types | palier II |
| Rubis (101-150) | Précision | 101 zones interdites (arcs hachurés) ; 111 fentes (intervalles de 3 à 4 GAP) ; 121 zone glissante (arc interdit qui se déplace lentement sur le bord) ; 131 zones + fentes | idem | palier III |
| Saphir (151-200) | Rotations inversées | 151 alternée (inversions douces) ; 161 ressac (retours partiels) ; 171 inversion à l'impact (chaque aiguille plantée inverse le sens) ; 181 demi-tour annoncé (inversion brutale signalée 0,6 s avant) | idem | palier IV |
| Obsidienne (201-250) | Difficulté élevée | 201 sentinelle (obstacle mobile en orbite) ; 211 deux sentinelles ; 221 aiguilles traversantes ; 231 anneau-bouclier à portes | idem | palier V |
| Cosmos (251-300) | Défis extrêmes | 251 rotation irrégulière (somme de sinusoïdes) ; 261 double anneau ; 271 traversantes + sentinelles ; 281-299 tout combiné aux vitesses maximales | idem | palier VI ; 300 = Chaos VI, boss final |
| COSMOS ∞ (301+) | Sans fin | mélange tiré au sort (graine du niveau) parmi toutes les mécaniques, difficulté de plateau | x7 | archétypes en boucle, palier VI |

Correspondance avec les règles actuelles :

| Règle actuelle | Monde actuel | Nouveau monde |
|---|---|---|
| Rotation continue, respiration | Émeraude | Émeraude |
| À-coups, pas à pas | Braise | Ambre (accélération) |
| Arcs interdits | Givre | Rubis (précision) |
| Alternée, ressac | Ambre, divers | Saphir (rotations inversées) |
| Sentinelle | Iris | Obsidienne |
| Aiguilles traversantes | Soufre | Obsidienne puis Cosmos |
| Mélanges (Opale, Cobalt, cycles) | 7-8 et suivants | Cosmos et COSMOS ∞ |

### 5.4 Boss : un tous les 10 niveaux

Principe : le boss k d'un monde (niveau 10·k) est l'archétype k du cahier des charges ; il revient dans chaque monde à un palier plus dur (I à VI). Chaque boss a une **barre de vie** : un anneau segmenté autour du cadran, un segment par aiguille à planter, qui se fissure à chaque aiguille plantée.

Règles d'équité communes : tout changement est **annoncé ≥ 0,5 s à l'avance** (0,45 s en Cosmos) par un signal visuel au pas de tir **et** un son ; rien n'est aléatoire pendant le combat (graine) ; l'oscilloscope et le viseur d'avance intègrent la mécanique ; `__botSafe` la modélise exactement ; un boss se gagne sans tir parfait ; plancher d'équité : ≥ 75 % à 30 ms.

| Boss (niveaux) | Mécanique exacte avec un seul geste | Lisibilité | Identité visuelle et sonore |
|---|---|---|---|
| **LE RÉACTEUR** — accélère progressivement (10, 60, 110, 160, 210, 260) | La vitesse part de v0 et augmente d'un pourcentage fixe à chaque aiguille plantée (rampe douce de 0,3 s après l'impact), jusqu'à un plafond ; pas d'obstacle aux premiers paliers | La rampe est visible sur l'oscilloscope et sur un compte-tours (graduations du cadran qui s'allument avec la vitesse) | Cuboctaèdre ; ronronnement de moteur dont la hauteur suit la vitesse |
| **LE PENDULE** — change brutalement de direction (20, 70, 120, 170, 220, 270) | Inversion instantanée (en 80 ms) à des instants fixés : toutes les k aiguilles plantées et/ou selon un rythme ; chaque inversion est annoncée | 0,6-0,9 s avant : les deux chevrons de direction près du pas de tir clignotent et basculent, trois « tic » sonores ; l'oscilloscope montre le front | Étoile octangle ; tic-tac, puis coup sec à l'inversion |
| **LES ANNEAUX** — plusieurs anneaux à vitesses différentes (30, 80, 130, 180, 230, 280) | 1 à 3 anneaux-boucliers entre le pas de tir et l'astre, chacun tourne à sa vitesse et dans son sens, avec des **portes** (trous). L'aiguille doit passer par une porte de chaque anneau au moment où elle le traverse (instant fixe du vol), puis se planter sans contact. Toucher un anneau = échec « INTERCEPTÉ » | Anneaux en barres pleines, portes en vide avec repères ; un petit losange par anneau sur l'axe de tir s'allume quand sa porte sera alignée pour un tir lancé maintenant | Sphère armillaire ; nappe grave, « clic » de porte |
| **LA FORTERESSE** — zones interdites (40, 90, 140, 190, 240, 290) | 2 à 5 arcs interdits sur l'astre, dont 1 à 3 **pulsés** : éteints → annoncés (contour pointillé clignotant, 0,6 s) → actifs (bande hachurée) → éteints. Se planter dans une zone active = échec ; une aiguille plantée dans une zone éteinte y reste sans danger | Bord allumé = zones sûres maintenant ; le viseur d'avance indique l'état de la zone à l'instant d'impact prévu | Tesseract ; créneaux hachurés ; bourdonnement électrique pendant l'annonce |
| **LE CHAOS** — rotation irrégulière avec obstacles mobiles (50, 100, 150, 200, 250, 300) | Vitesse = somme de 2 ou 3 sinusoïdes de fréquences non multiples (jamais deux fois le même motif), plus 1 à 3 sentinelles en orbite à contre-sens (et un anneau au palier VI) | Oscilloscope sur 1,75 s ; chevrons de direction au pas de tir ; sentinelles en barres pleines | Dodécaèdre qui vibre légèrement ; arpège instable |

Évolution par palier (ordre de grandeur, réglé à l'étape 4 contre les cibles ; chaque palier respecte le plafond de 14 équivalents aiguilles) :

| Archétype | I (Émeraude) | III (Rubis) | VI (Cosmos) |
|---|---|---|---|
| Réacteur | 10 aiguilles, 1,1 → 2,0 rad/s (+5 %/aiguille), 0 bloqueur | 11, 1,6 → 3,0, 2 bloqueurs | 12, 2,2 → 3,9, 2 bloqueurs |
| Pendule | 8 aiguilles, inversion toutes les 4, annonce 0,9 s, 1,4 rad/s | 10, toutes les 3 + rythme 3 s, annonce 0,7 s | 13, toutes les 2 + rythme 2,2 s, annonce 0,45 s, 3,2 rad/s |
| Anneaux | 1 anneau, 3 portes larges (0,9 rad), lent | 2 anneaux en sens opposés, portes 0,7 rad | 3 anneaux, 2 portes de 0,5 rad, vitesses différentes |
| Forteresse | 2 arcs fixes + 1 pulsé (période 3 s) | 3 fixes + 2 pulsés | 5 arcs dont 3 pulsés (période 2 s), 3 rad/s |
| Chaos | 2 sinusoïdes, 1 sentinelle lente | 3 sinusoïdes, 2 sentinelles | 3 sinusoïdes fortes, 3 sentinelles, 1 anneau |

À partir du palier III, **deuxième phase à mi-vie** : un paramètre monte d'un cran (vitesse, anneau supplémentaire, zone pulsée en plus), annoncé par un flash de 0,4 s et un son, déclenché seulement quand aucune aiguille ne vole.

**Introduction (< 1,5 s, passable d'un tap dès 0,6 s)** : 0-0,3 s le cadran s'assombrit, balayage à la couleur du monde ; 0,3-0,9 s le solide du boss se trace (animation de tracé vectoriel), titre tapé « BOSS · LE PENDULE » ; 0,9-1,3 s ligne de règle (« AU SIGNAL, DEMI-TOUR ») ; son : nappe grave montante puis impact. Le bandeau reste relisible dans la pause.

**Victoire (≤ 1,6 s avant la feuille)** : bord verrouillé en blanc 0,2 s ; segments de la barre de vie qui éclatent en cascade 0,3 s ; explosion filaire (l'actuelle `explodeScene`, puissance ×1,5) et onde de choc plein écran ; tampon « BOSS VAINCU » ; son : impact grave + accord + cloches ; vibration [30, 40, 60] ; puis feuille avec score, record, et bouton SUIVANT à la couleur du monde suivant après le boss de fin de monde (ART-8).

### 5.5 Niveaux spéciaux et objectifs secondaires

Niveaux spéciaux (x7 de chaque bloc, 30 au total, enseignés à leur première apparition) :

| Type | Règle | Condition de victoire | Particularités |
|---|---|---|---|
| **PLUIE D'ÉTOILES** | 6 à 9 étoiles bonus sur l'astre | capturer au moins ⌈0,6 × N⌉ étoiles avant la dernière aiguille | ★2 = toutes les étoiles ; `__botSafe` vise les étoiles restantes |
| **CHRONO** | rotation rapide et constante, jauge de temps qui se vide autour du pas de tir | planter N aiguilles en T secondes (T = 1,3 × le temps médian du joueur simulé à 45 ms) | échec « TEMPS ÉCOULÉ » ; reste dense pour ne pas récompenser la salve aveugle |
| **PARFAIT** | 5 à 7 aiguilles, fenêtre parfaite élargie à ±45 ms et dessinée comme un couloir lumineux sur chaque arc | toutes les aiguilles parfaites | une aiguille non parfaite se brise : échec « IMPRÉCIS » |

Objectif secondaire : chaque niveau en affiche un (bandeau d'intro et petite jauge du HUD), tiré d'un catalogue par une table monde × position (pas de hasard d'une partie à l'autre) :

| Objectif | Condition | Exemple |
|---|---|---|
| PARFAITS k | au moins k tirs parfaits dans la partie (k ≤ 30 % des tirs) | « 3 PARFAITS » |
| COMBO ×k | atteindre le multiplicateur ×k (k = 2 à 4) | « COMBO ×3 » |
| CHRONO T | finir en moins de T secondes | « EN 14 S » |
| SCORE S | score ≥ S (S = 60 % du score du planificateur qui vise juste) | « 6 000 PTS » |

Chaque objectif est vérifié atteignable, niveau par niveau, par le planificateur sans bruit (`tests/sim/planner.js`).

### 5.6 Lancer, collision et tir PARFAIT

- **Lancer exact** : horodaté au tap (4.5), vol constant de 60 ms, pas de simulation de 1/120 s.
- **Anti-rebond** : un tap à moins de 40 ms du précédent est ignoré (rebond, deux doigts) ; au-delà, chaque tap produit un lancer à son instant exact, **jusqu'à deux aiguilles en vol** (`flying` désigne la plus récente). La file d'attente qui décalait le second tir jusqu'à l'impact du premier disparaît : un tap n'est jamais retardé ni déplacé.
- **Collision = dessin** : le rayon extérieur dessiné d'une tête (trait compris) vaut exactement `GAP × (R + PL) / 2`, donc deux têtes se touchent à l'écran exactement quand l'écart vaut GAP. Contrôle balayé pendant les derniers millimètres du vol (pointe entre le cercle des têtes et le bord, échantillonné à 1 ms avec la rotation analytique) pour qu'aucune tête ne traverse la tige en vol.
- **Traversantes** : arcs allumés calculés avec les antipodes des bloqueurs (bord allumé = sûr, partout) ; étoiles placées seulement là où une capture est possible.
- **Tir PARFAIT** : aiguille plantée à moins de *p* du **milieu de l'intervalle libre** où elle tombe (milieu entre ses deux voisins occupés), avec *p* = 35 ms × |vitesse à l'impact|, borné entre 0,02 et 0,12 rad (soit exactement ±35 ms entre 0,6 et 3,4 rad/s, et ±32 ms à la vitesse maximale de Cosmos).
  - Pourquoi le milieu de l'intervalle plutôt qu'un repère posé sur l'astre : c'est l'endroit le plus sûr, donc le parfait récompense le bon jeu au lieu de pousser au risque ; il découle des arcs allumés que le joueur lit déjà ; il reste défini dans tous les niveaux à au moins une aiguille ; et un intervalle étroit enfilé est parfait par construction, ce qui récompense naturellement la précision.
  - Pourquoi une fenêtre en temps : ±35 ms est la même exigence à toutes les vitesses. Le joueur simulé à 30 ms réussit environ 75 % de parfaits, celui à 70 ms environ 38 % : facile à comprendre, difficile à maîtriser.
  - Visible : un repère lumineux au milieu de chaque arc allumé ; il éclate au parfait. Le viseur d'avance ne signale pas le « parfait maintenant », pour que le parfait reste une anticipation.
  - Astre vide : pas d'intervalle, donc pas de parfait (première aiguille du niveau 1).

### 5.7 Combo, score et records

**Combo** : chaque aiguille plantée moins de *T*combo après l'impact précédent prolonge la chaîne (+1, ou +2 pour un PARFAIT) ; sinon la chaîne repart à 1. *T*combo = la moitié d'un tour de l'astre à sa vitesse moyenne, bornée entre 1,2 et 2,4 s. Elle est affichée comme un arc qui se vide autour du berceau du pas de tir.

| Chaîne c | 0-2 | 3-5 | 6-8 | 9-11 | ≥ 12 |
|---|---|---|---|---|---|
| Multiplicateur M | ×1 | ×2 | ×3 | ×4 | ×5 |

Le combo met en tension la patience (attendre la meilleure fenêtre) et le rythme (enchaîner), sans jamais être nécessaire pour finir un niveau.

**Score** :

- Aiguille : (100 + 150 si PARFAIT + 50 si FRÔLÉ) × M.
- Étoile bonus capturée : +250 (non multiplié).
- Niveau fini : +500 (+1 500 pour un boss).
- Exemple : 10 aiguilles dont 4 parfaites, multiplicateur moyen ×2, 3 étoiles : ≈ (1 000 + 600) × 2 + 750 + 500 ≈ 4 450.

**Records** : par niveau (meilleur score, meilleure chaîne, parfaits, meilleur temps) et globaux (meilleur combo, parfaits cumulés, meilleure série, **score de carrière** = somme des meilleurs scores par niveau, qui ne fait que monter et sera la base d'un classement réel en phase 2). Affichage : feuille de victoire (score qui défile en 0,5 s, record, tampon « NOUVEAU RECORD »), feuille d'échec (« 7/10 plantées · record 8/10 »), écran Records accessible depuis le menu, données 100 % locales.

### 5.8 Étoiles

Trois étoiles par niveau, chacune avec un sens clair et **cumulables d'une partie à l'autre** (un objectif atteint reste acquis) :

1. ★ **Fini** : terminer le niveau.
2. ★ **Étoiles bonus** : capturer toutes les étoiles bonus de l'astre (1 à 3) dans une même partie.
3. ★ **Objectif** : réussir l'objectif secondaire du niveau.

Total : 900 étoiles sur 300 niveaux, compteur par monde (x/150), badge « MONDE PARFAIT » à 150/150. Les étoiles ne bloquent rien ; elles débloqueront les cosmétiques en phase 2. La feuille de victoire indique ce qui manque (« Il te manque ★ OBJECTIF : 2 PARFAITS »).

### 5.9 Séries et récompenses

- **Série** = victoires consécutives sur des niveaux où il reste quelque chose à gagner (pas encore 3★, ou nouveau niveau). Un échec sur ces niveaux casse la série ; les niveaux déjà parfaits ne la font ni monter ni tomber (on peut s'y entraîner librement).
- **Récompense réelle : le jeton « REPRISE »**, gagné aux paliers de série 3, 7, 12, 20, 30, 40, 50 (stock maximum 3). Sur la feuille d'échec, le bouton « REPRISE ◆2 » (affiché seulement si l'on possède un jeton, une fois par partie) retire l'aiguille fautive et relance la partie au même instant après un compte à rebours de 0,8 s (rotation figée pendant le compte), la chaîne de combo repartant à zéro. Le jeton aide à franchir un niveau difficile sans rien bloquer pour qui n'en a pas. C'est le même mécanisme que la future « seconde chance » facultative de la phase 2, donc rien n'est jeté.
- Affichage : « SÉRIE 7 » sur la feuille de victoire et au menu, message de palier (« SÉRIE 12 · +1 REPRISE »), meilleure série dans les records.

### 5.10 Difficulté : cibles et paramètres

Mesure de référence : simulateur du « joueur qui vise » (attend la meilleure fenêtre et vise son milieu ; imprécision temporelle gaussienne σ), sur le vrai générateur, 300 essais par niveau.

| Monde | Tirs (normaux) | Vitesse ω (rad/s) | Obstacles fixes au départ (équivalents aiguilles) | Leviers principaux | σ = 30 ms : minimum par niveau / moyenne | σ = 70 ms : moyenne début → fin du monde | Boss à 70 ms | Durée d'un niveau propre |
|---|---|---|---|---|---|---|---|---|
| Émeraude | 4 → 8 | 1,1 → 2,2 | 0 → 4 | nombre de bloqueurs, respiration, vitesse | ≥ 95 % / ≈ 99 % | 97 → 80 % | 75-85 % | 6-15 s |
| Ambre | 6 → 9 | 1,6 → 2,8 | 2 → 5 | accélération à l'impact, à-coups, arrêts | ≥ 90 % / ≈ 96 % | 80 → 65 % | 60-70 % | 10-18 s |
| Rubis | 6 → 9 | 1,8 → 3,0 | 3 → 6 | zones interdites, fentes, zone glissante | ≥ 85 % / ≈ 93 % | 68 → 52 % | 48-58 % | 12-22 s |
| Saphir | 7 → 10 | 1,9 → 3,2 | 2 → 5 | inversions douces, ressac, inversions à l'impact et annoncées | ≥ 82 % / ≈ 90 % | 58 → 42 % | 38-48 % | 12-24 s |
| Obsidienne | 7 → 10 | 2,1 → 3,5 | 2 → 5 + 1-2 obstacles mobiles | sentinelles, traversantes, anneau à portes | ≥ 78 % / ≈ 87 % | 45 → 32 % | 28-38 % | 14-28 s |
| Cosmos | 8 → 11 | 2,3 → 3,8 | 2 → 5 + anneaux, sentinelles | rotation irrégulière, double anneau, tout combiné | ≥ 75 % / ≈ 84 % | 35 → 22 % | 20-30 % | 15-30 s |
| COSMOS ∞ | plateau | plateau | plateau | mélange | ≥ 75 % | 22-30 % | 20-30 % | 15-30 s |

Salve à l'aveugle (meilleure cadence parmi 100, 150, 200 et 250 ms ± 1 image, 40 départs, sans relance) : ≤ 30 % de succès sur les niveaux 11-50 (1-10 libres, c'est l'apprentissage), **≤ 3 % sur chaque niveau à partir de 51** ; salve soutenue pendant 60 s (relance dès que permise, 150 ms ± 1 image) : moins de 10 % des niveaux 51-100 finis et moins de 5 % au-delà. Autrement dit, taper sans regarder ne fait plus passer de niveau après le monde 1.

Règles :
- **Plancher d'équité** : chaque niveau ≥ 75 % à 30 ms.
- **Respirations** : x1-x2 de chaque bloc ≈ +10 points à 70 ms par rapport à x9.
- **Pas de falaise** : un niveau normal n'est jamais à plus de 12 points sous la moyenne de ses 4 voisins normaux à 70 ms ; un boss au plus 20 points sous ses voisins.
- **Capacité** : obstacles fixes + tirs ≤ 14 « équivalents aiguilles » sur le bord (budget actuel, l. 515 ; un arc interdit compte sa largeur, une aiguille isolée 3,4 × GAP), pour que le bot du banc d'essai (marge 1,7 × GAP) puisse toujours finir ; la revue a montré qu'au-delà (16,5) il échoue. Plus de tirs veut donc dire moins d'obstacles fixes : la difficulté des derniers mondes vient de la vitesse, de ses variations, des obstacles mobiles et des anneaux, qui ne consomment pas de place sur le bord.
- **Anti-salve** : à partir du monde 2, chaque niveau combine au moins deux des moyens suivants : obstacles fixes larges (arcs interdits), loi à arrêts ou inversions, obstacles mobiles ou anneaux (une porte laisse passer moins d'un tir aveugle sur deux) ; orientation de départ choisie pour que les obstacles passent sous le pas de tir dans les 0,2-1,5 premières secondes (mesure de la revue : 21 → 11 niveaux finis à l'aveugle sur 1-40) ; relance seulement une fois la feuille d'échec affichée.

Paramètres qui pilotent la difficulté, tous dans `DIFFICULTY` et `WORLDS` : nombre de tirs, obstacles fixes et leur disposition, vitesse (bornes par monde, rampe intra-monde en dents de scie par bloc), lois de rotation autorisées et leurs poids, intensité des mécaniques (accélération par aiguille, fréquence des inversions, durée d'annonce ≥ 0,45 s, vitesse des sentinelles, nombre d'anneaux et largeur des portes), fenêtre combo. Le réglage se fait par l'outil `tests/sim/report.js`, qui compare chaque monde à sa cible avec une tolérance de ±7 points et échoue si le plancher ou la règle des falaises est violé.

### 5.11 Retours (feedback) et durées

Toutes les durées sont courtes pour ne jamais casser le rythme ; le mode « mouvement réduit » retire secousses, flashs et ralenti, mais garde sons et vibrations.

| Événement | Visuel | Haptique (Android ; l'API n'existe pas sur iPhone, rien n'est simulé) | Son | Durée |
|---|---|---|---|---|
| Lancer | traînée de l'aiguille dans le phosphore | — | souffle bref + note montante | 60 ms (vol) |
| Impact | aiguille qui s'enfonce avec un léger rebond ; petit anneau lumineux au point d'impact ; segment de bord qui flashe ; l'astre recule de 3 px et grossit de 2 % puis revient ; 7 étincelles | 10 ms | « tink » métallique (FM inharmonique) + note de la gamme du monde | 120-180 ms |
| PARFAIT | anneau blanc qui s'étend, repère central qui éclate, « PARFAIT » tracé en haut du couloir de tir | [8, 20, 8] | chatoiement aigu propre au parfait | 250-600 ms |
| FRÔLÉ | arc d'accent sur l'intervalle serré, « FRÔLÉ · 3° » placé sous le cadran (plus sur l'anneau, ART-4) | [8, 30, 8] | deux notes aiguës | 900 ms |
| Palier de combo | « COMBO ×3 » qui grossit puis se fixe ; le bord et les graduations s'éclairent selon le multiplicateur | 12 ms | arpège montant d'un degré par palier | 450 ms |
| Étoile capturée | éclat d'accent, étoile du HUD qui se remplit | [10, 20, 10] | deux cloches | 400 ms |
| Échec | flash au point de contact (80 ms), les deux aiguilles se brisent en éclats, croix d'alerte ; **ralenti** : la rotation tombe à 20 % puis s'arrête en 0,25 s ; secousse de 6 px sur 180 ms | [30, 40, 90] | dent de scie qui chute + bris de verre | feuille d'échec à **0,45 s** |
| Feuille d'échec | montée en 150 ms ; la scène remonte et se réduit si besoin pour que le point de collision reste visible au-dessus du panneau ; cause en clair (« Il manquait 3° », « Aiguille plantée en pleine zone interdite », « Interceptée par l'anneau ») ; MENU à droite comme sur les autres feuilles ; HUD aligné sur la feuille | — | — | tap n'importe où = réessayer dès 0,45 s ; taps avant 0,45 s ignorés |
| Relance | pas de bandeau, construction de l'astre en 0,25 s, rappel de la cause 1,2 s près du pas de tir | — | note brève | 0,25 s |
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

---

## 6. Plan par étapes

Règle commune à toutes les étapes : le banc d'essai `node tests/shoot.js index.html <dossier>` rend `pass: true` à chaque commit, les tests ajoutés aux étapes précédentes restent verts, et chaque commit a un message clair en français.

### Étape 1 — Fondations, lancer et collision (étapes 4-5 du cahier des charges)

**Périmètre**, dans cet ordre de commits :
1. **Découpage sans changement de comportement** : déplacement du script dans `js/*.js` (4.2), CSS laissée en ligne. Preuve : vidage JSON de `makeLevel(1..200)` identique avant/après ; temps du balayage d'équité identiques ; banc d'essai vert.
2. **Chargement fiable** : polices auto-hébergées non bloquantes, service worker « cache d'abord » avec course de 2,5 s, liste de précache complète, cache `orbita-v4`.
3. **Sauvegarde v2** (4.6) : clé unique, migration v1, validation, sauvegarde automatique, instantané et reprise après fermeture.
4. **Structure 6 × 50 + COSMOS ∞**, boss tous les 10 niveaux, spéciaux réservés en x7 (joués comme des niveaux normaux jusqu'à l'étape 4), tables `WORLDS` aux 6 palettes, règles actuelles réparties selon 5.3 ; **réglage provisoire équitable** (formule actuelle étendue, ≥ 75 % à 30 ms partout) ; sélection des niveaux minimale par monde (6 sections repliables, en attendant l'étape 6).
5. **Lancer et collision** : boucle à pas fixe, lancer horodaté, vol constant de 60 ms, anti-rebond de 40 ms et deux aiguilles en vol maximum, rayon des têtes = GAP, contrôle balayé, traversantes (arcs allumés et étoiles), physique en unités normalisées.
6. **Parcours d'échec** : feuille à 0,45 s, scène qui laisse voir la collision, relance seulement après la feuille, cause rappelée après la relance, MENU à droite, message des arcs interdits, HUD aligné sur les feuilles, corrections de français (UX-6).
7. Mise à jour de `tests/shoot.js` (échec volontaire déterministe) dans le commit 5, et ajout des premiers tests.

**Fichiers** : `index.html`, `js/config.js`, `js/util.js`, `js/vector.js`, `js/levels.js`, `js/core.js`, `js/store.js`, `js/fx.js`, `js/render.js`, `js/ui.js`, `js/main.js`, `js/audio.js` (déplacement seulement), `sw.js`, `fonts/`, `README.md`, `tests/shoot.js`, `tests/README.md`, `tests/unit/`, `tests/sim/` (simulateur porté + `bot.js`), `tests/ui.js`, `tests/perf.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Contrat de test et jeu | `tests/shoot.js` | `pass: true`, niveaux 1..60 gagnés < 75 s |
| Découpage neutre (commit 1) | vidage JSON des niveaux (`tests/unit`) et temps du balayage d'équité | identiques octet pour octet au commit `ad561a3` |
| Démarrage sans réseau tiers | `tests/ui.js` (requêtes de polices bloquées) | `state` défini en < 1 s |
| Migration v1 → v2 | `tests/unit` + `tests/ui.js` (vraies clés v1 posées avant chargement) | progression, son et étoiles héritées corrects ; valeurs corrompues sans erreur |
| Reprise après fermeture | `tests/ui.js` : jouer 3 aiguilles, recharger la page | REPRENDRE proposé ; mêmes angles, `left`, `t` à 1e-9 près |
| Structure | `tests/unit` | 300 niveaux + 301..400 générés sans erreur ; boss ⇔ n % 10 = 0 ; monde = ⌈n/50⌉ |
| Équité provisoire | `tests/sim/report.js` et `tests/sim/bot.js` | chaque niveau 1..300 ≥ 75 % à 30 ms ; prédicteur : 0 mort et 0 blocage sur 300 niveaux × 4 parties à dt 1/60 et 1/120 |
| Timing exact | `tests/unit` : tap à une phase aléatoire dans l'image | angle d'impact = valeur analytique à 0,002 rad près, indépendamment de la phase et de la cadence (30, 60, 120 Hz) |
| Indépendance à l'écran | `tests/ui.js` sur 320×568, 360×640, 390×664, 390×844, 430×932 | vol = 60 ± 1 ms ; même angle d'impact pour la même séquence de taps |
| Collision = dessin | `tests/unit` (géométrie) + capture de deux aiguilles à GAP ± 0,002 rad | contact visuel ⇔ défaite |
| Double tap | rejeu de la mesure 1.10 | 0 mort sur 40 aux niveaux 1, 2, 3, 8, 21 |
| Traversantes | `tests/sim` | part du bord allumé mortelle = 0 % ; chaque étoile a un angle de capture sûr (niveaux 1..400) |
| Parcours d'échec | `tests/ui.js` sur les 5 écrans | point de collision ≥ 4 px au-dessus du filet du panneau ; tap à 0,3 s ignoré, à 0,5 s relance ; MENU à droite |
| Ralenti sous charge | `tests/perf.js` à CPU ×4 | vitesse de simulation ≥ 0,98× |
| Latence | `tests/perf.js` : événement tactile horodaté → première image où l'aiguille a quitté le pas de tir | ≤ 1 image en médiane, jamais plus de 2 |

### Étape 2 — Difficulté progressive et équilibrée (étape 6)

**Périmètre** : générateur v2 entièrement piloté par `WORLDS` et `DIFFICULTY` ; nouvelles mécaniques des niveaux normaux (accélération à l'impact, inversion à l'impact, demi-tour annoncé, zone glissante, anneau-bouclier à portes, rotation irrégulière) ; niveaux d'apprentissage et bandeaux de règle relisibles (UX-4) ; chevrons de direction au pas de tir qui annoncent arrêts et inversions 0,45 s avant (BAL UX-1) ; codage par la forme des obstacles mobiles (ART-3) ; orientation de départ anti-salve ; réglage par le simulateur ; `__botSafe` étendu à chaque mécanique.

**Fichiers** : `js/config.js`, `js/levels.js`, `js/core.js`, `js/render.js`, `tests/sim/*`, `tests/shoot.js` (seulement si une nouvelle mécanique exige d'étendre son repli sans `__botSafe`).

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Cibles par monde | `tests/sim/report.js` | moyennes 30/70 ms dans la table 5.10 à ±7 points ; plancher 75 % à 30 ms sur 1..300 et sur 100 niveaux de COSMOS ∞ |
| Pas de falaise, respirations | `tests/sim/report.js` | règles 5.10 respectées, rapport listant chaque exception |
| Joueur qui n'anticipe pas (réactif) | `tests/sim/report.js` | aucune falaise propre aux inversions et aux arrêts (écart ≤ 15 points avec ses voisins) |
| Salve aveugle | `tests/sim/mash.js` (cadences 100/150/200/250 ms ± 1 image, 40 départs) | ≤ 30 % sur 11-50, ≤ 3 % sur chaque niveau à partir de 51 ; salve soutenue 60 s : < 10 % des niveaux 51-100 finis, < 5 % au-delà |
| Une idée à la fois | `tests/unit` | chaque niveau d'apprentissage n'ajoute qu'un drapeau de mécanique nouveau par rapport aux niveaux précédents |
| Prédicteur honnête | `tests/sim/bot.js` | 0 mort, 0 blocage sur 300 niveaux × 4 parties |
| Durées | `tests/sim/report.js` | niveau propre (45 ms) dans les plages de 5.10 |
| Banc d'essai | `tests/shoot.js` | `pass: true` (niveaux 1..60 en < 75 s de jeu) |

### Étape 3 — Combo, score, tir parfait et étoiles (étape 7)

**Périmètre** : `js/score.js` (objectifs de 5.5, parfait de 5.6, 5.7 et 5.8) ; repères de milieu d'arc ; jauge de combo ; score et multiplicateur dans le HUD ; objectifs secondaires (catalogue, attribution, jauge) ; étoiles en bits cumulables ; records par niveau et globaux ; écran Records ; feuilles de victoire et d'échec enrichies (BAL FEAT-2/3).

**Fichiers** : `js/config.js`, `js/score.js`, `js/core.js`, `js/store.js`, `js/render.js`, `js/ui.js`, `index.html`, `tests/unit/score.test.js`, `tests/sim/planner.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Formules (parfait, chaîne, multiplicateur, score, étoiles) | `tests/unit` | cas limites : astre vide, intervalle étroit, traversante, chaîne expirée à T ± 1 ms |
| Parfait apprenable | `tests/sim` | taux de parfaits ≈ 75 % à 30 ms et ≈ 38 % à 70 ms (±8 points), décroissant avec σ |
| Objectifs atteignables | `tests/sim/planner.js` | ★3 obtenue par le planificateur sur 100 % des niveaux 1..300 |
| Persistance | `tests/ui.js` | records et bits d'étoiles conservés après rechargement ; jamais de régression d'un record |
| HUD | captures `tests/shoot.js` + revue de planches | score, multiplicateur et objectif lisibles en 320×568 sans chevauchement |

### Étape 4 — Boss et niveaux spéciaux (étape 8)

**Périmètre** : 5 archétypes × 6 paliers (5.4), barre de vie, deuxième phase, intro < 1,5 s, séquence de victoire ; 3 types de niveaux spéciaux (5.5) ; `__botSafe` qui modélise anneaux, zones pulsées, inversions annoncées et objectifs des spéciaux.

**Fichiers** : `js/config.js` (`BOSSES`, `SPECIALS`), `js/levels.js`, `js/core.js`, `js/render.js`, `js/fx.js`, `js/audio.js` (sons de boss), `tests/unit/boss.test.js`, `tests/sim/*`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Annonces | `tests/unit` sur la chronologie de chaque boss | chaque changement annoncé ≥ 0,5 s (≥ 0,45 s en Cosmos) ; aucun changement de phase pendant un vol |
| Difficulté des boss | `tests/sim/report.js` | colonne « Boss à 70 ms » de 5.10 ; ≥ 75 % à 30 ms |
| Prédicteur | `tests/sim/bot.js` | 0 mort sur les 30 boss et 30 spéciaux × 8 parties |
| Durées d'intro et de victoire | instrumentation des événements (`tests/ui.js`) | intro ≤ 1,5 s, passable dès 0,6 s ; victoire ≤ 1,6 s avant la feuille |
| Lisibilité | captures de chaque archétype × 2 paliers en 360×640 et 390×844 | revue de planches : anneaux, portes, zones et chevrons distincts par la forme |
| Banc d'essai | `tests/shoot.js` | boss 10, 20, 30, 40, 50, 60 gagnés dans le balayage ; capture `04-boss10` |

### Étape 5 — Animations, effets visuels et son (étape 9)

**Périmètre** : retours de 5.11 avec leurs durées ; libellés hors de l'anneau du cadran (ART-4) ; transitions de monde ; `js/audio.js` en deux bus avec musique procédurale (5.12) ; reprise audio robuste (tous états ≠ `running`, sons demandés pendant la reprise rejoués s'ils ont moins de 300 ms, ENG BUG-6) ; vibrations seulement si l'API existe ; mouvement réduit respecté partout.

**Fichiers** : `js/fx.js`, `js/render.js`, `js/audio.js`, `js/ui.js`, `js/config.js`, `tests/ui.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Durées | journal horodaté des événements (`tests/ui.js`) | conformes à 5.11 à ±20 ms ; feuille d'échec à 0,45 s, victoire ≤ 1,6 s |
| Audio | `tests/ui.js` (compteur de nœuds, contexte simulé « suspendu ») | aucun nœud qui fuit après 60 s ; aucun son perdu pendant la reprise ; musique et effets coupables indépendamment et persistés |
| Mouvement réduit | `tests/ui.js` avec `prefers-reduced-motion` | ni secousse, ni flash, ni ralenti ; aucune erreur |
| Coût | `tests/perf.js` | budget de 4.8 tenu avec tous les effets |
| Rendu | planches de captures (impact, parfait, combo ×5, échec, victoire de boss) | revue visuelle de la direction artistique |

### Étape 6 — Menus, mondes, récompenses et optimisation mobile (étapes 10-11)

**Périmètre** : menu (CONTINUER/REPRENDRE, NIVEAUX, RECORDS, RÉGLAGES) ; carte des 6 mondes puis grille de 50 niveaux par monde (cases boss et spéciaux marquées) ; réglages SON, MUSIQUE, VIBRATIONS (ce dernier seulement si l'appareil le permet) ; séries et jetons REPRISE (5.9) ; bouton SUIVANT à la couleur du monde suivant ; clavier (UX-7) ; voile « Tourne ton téléphone » en paysage court (UX-8) ; icônes PNG et `apple-touch-icon` ; contraste ; saut de l'astre du menu (VIS-1) ; budget de performance complet (4.8) : arrêt du rendu au repos, DPR adaptatif, composition partielle du phosphore, chasse aux allocations.

**Fichiers** : `index.html`, `js/ui.js`, `js/render.js`, `js/main.js`, `js/store.js`, `js/score.js`, `js/config.js`, `manifest.webmanifest`, `sw.js`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `tests/ui.js`, `tests/perf.js`.

**Tests d'acceptation** :

| Ce qui est vérifié | Outil | Seuil |
|---|---|---|
| Aucun bouton décoratif | `tests/ui.js` : clic sur chaque bouton visible de chaque écran | chaque clic change l'état, l'écran ou un réglage persisté |
| Séries et jetons | `tests/unit` + `tests/ui.js` | paliers, plafond de 3, une reprise par partie, la reprise relance au bon instant |
| Écrans | captures en 320×568, 360×640, 390×844, 430×932, 768×1024, 1280×800 | aucun chevauchement, cibles tactiles ≥ 44 px |
| Batterie | `tests/perf.js` | 0 image/s sur niveaux, records, réglages, pause ; ≤ 30 sur le menu |
| Fluidité | `tests/perf.js` | CPU ×4 : ≤ 33 ms par image et simulation ≥ 0,98× ; allocations ≤ 100 Ko/s |
| Chargement | `tests/perf.js` | aucune ressource tierce bloquante ; démarrage hors ligne < 1 s |
| Clavier et paysage | `tests/ui.js` | Entrée active le bouton focalisé ; focus visible ; voile en 844×390 tactile, absent en 412×350 |

### Étape 7 — Contrôle qualité final de la version jouable

**Périmètre** : passage complet de tous les tests ; session de 30 minutes automatisée (mémoire stable, aucune erreur) ; migration depuis une vraie sauvegarde v1 ; jeu hors ligne ; relecture de tous les textes ; liste de vérification sur appareils réels à faire par le porteur du projet (un Android de milieu de gamme et un iPhone : 60 images/s, son et musique, reprise après fermeture, installation sur l'écran d'accueil, lisibilité en plein jour) ; mise à jour de `README.md` et `tests/README.md` ; notes de version.

**Tests d'acceptation** : tous les seuils des étapes 1 à 6 ; tas JS qui varie de moins de 10 % sur 30 minutes ; zéro erreur de console ; liste de vérification sur appareil signée par le porteur du projet.

### Risques et parades

| Risque | Parade |
|---|---|
| Rendre le jeu plus dur casse le bot du banc d'essai (capacité du bord) | Plafond de 14 équivalents aiguilles inscrit dans `DIFFICULTY` et vérifié par `tests/sim/bot.js` ; la difficulté vient du timing et des obstacles mobiles |
| La couche phosphore coûte trop cher sur un téléphone modeste | DPR adaptatif, composition limitée au rectangle utile ; dernier recours : phosphore à 30 images/s, jamais supprimé (c'est l'identité visuelle) |
| Comportements propres à iPhone (audio interrompu, pas de vibration, PWA) non mesurables en Chromium | Code défensif aux étapes 1 et 5, liste de vérification sur appareil réel à l'étape 7 |
| Le découpage introduit une régression invisible | Commit 1 strictement neutre et prouvé (vidage identique, banc d'essai) avant toute correction |
| Dérive du périmètre vers la phase 2 | Aucune fonction de phase 2 avant la validation de l'étape 7 ; aucun bouton visible sans fonction réelle |

### Phase 2 — Fonctionnalités secondaires (après la version jouable)

| Fonction | Ce qui se fait côté client | Ce qui exige un service externe | Prérequis déjà posés en phase 1 |
|---|---|---|---|
| **Collection et cosmétiques** (aiguilles, sphères, effets lumineux, thèmes, animations d'impact) | Tout : table `COSMETICS`, déblocage par étoiles, succès et paliers de série ; les cosmétiques ne changent que le dessin, jamais la géométrie de collision (test : boîtes de collision identiques quel que soit l'habillage) | — | rendu séparé de la simulation, étoiles cumulables, sauvegarde versionnée |
| **Défis quotidiens** | Niveau(x) généré(s) avec la graine de la date, série de jours | Classement du jour (serveur) | générateur déterministe, `GEN_VERSION` |
| **Défis hebdomadaires** | Parcours de 7 niveaux, graine de la semaine ISO | Classement de la semaine | idem |
| **Succès et trophées** | ≈ 30 succès calculés à partir des événements du bus, écran dédié | — | bus d'événements, records |
| **Défi à deux sur le même niveau** | Code partageable (lien `#defi=…` : numéro de niveau ou graine, `GEN_VERSION`, score à battre) via l'API de partage du navigateur ; comparaison affichée honnêtement comme « score déclaré » | Vérification du score : le serveur rejoue la partie à partir des instants de taps (simulation déterministe dans Node) | cœur déterministe chargeable dans Node |
| **Partage des records** | API de partage du navigateur / presse-papiers, image de carte de score générée dans un canvas | — | records |
| **Classements mondial et entre amis, comparaison des performances** | Interfaces seulement (`js/net.js` : `submit`, `top`, `around`, fournisseur nul) ; **aucune interface visible tant qu'un vrai service n'existe pas** | Service avec comptes, liste d'amis, anti-triche par rejeu, conformité RGPD | score de carrière monotone, rejeu vérifiable |
| **Seconde chance par publicité récompensée (facultative)** | Réutilise la REPRISE ; au plus une par partie ; jamais imposée | Régie publicitaire pour jeux web (ou emballage natif type TWA/Capacitor), gestion du consentement | jeton REPRISE |
| **Version Premium sans publicité** | Drapeau de droits dans la sauvegarde | Paiement (boutique d'applications ou prestataire web) et validation du reçu | sauvegarde versionnée |
| **Récompenses quotidiennes** | Calendrier local (récompenses cosmétiques seulement, donc la manipulation de l'horloge est sans enjeu) | — | collection |

Garde-fous : aucune publicité imposée, aucune mécanique payante qui aide à gagner, aucune énergie ni vie limitée, aucun classement simulé.

---

## 7. Traçabilité des exigences

| § | Exigence du cahier des charges | Où | Vérification |
|---|---|---|---|
| 1 | Lancer des aiguilles sur une sphère qui tourne ; contact = perdu | Existant, étape 1 (collision = dessin) | `tests/shoot.js`, tests de géométrie |
| 1 | Planter sous des étoiles pour les récupérer | Existant, étape 1 (traversantes), étape 3 (★2) | `tests/sim` : toute étoile capturable |
| 1 | Une seule action | Toutes | Aucune entrée de jeu autre que le tap (revue de code, `tests/ui.js`) |
| 1 | Compris en moins de 5 s, difficile à maîtriser | Étapes 2, 3 (apprentissage, parfait) | Niveaux 1-5 ≥ 97 % à 70 ms ; parfait ≈ 75 %/38 % à 30/70 ms |
| 2 | Vitesses variées, deux sens, changements soudains, accélérations et ralentissements | Étapes 2, 4 | `tests/unit` (drapeaux de mécaniques par niveau), captures |
| 2 | Aiguilles plantées = zones de danger ; espacement de plus en plus difficile | Existant, étape 2 | `tests/sim/report.js` (difficulté croissante dans le niveau et entre niveaux) |
| 2 | Étoiles par tirs réussis ; configurations différentes ; bonus et mécanismes spéciaux | Étapes 2, 3, 4 | `tests/sim/planner.js`, catalogue de mécaniques |
| 2 | Impact : animation rapide, effet lumineux, vibration légère, son métallique, réaction de la sphère | Étape 5 | Journal des durées, captures, test de l'API de vibration |
| 2 | Échec : ralenti court, collision spectaculaire, aiguilles qui se brisent, défaite rapide, recommencer tout de suite | Étapes 1, 5 | Feuille à 0,45 s, relance d'un tap, captures |
| 2 | Pas d'animation trop longue | Étape 5 | Durées 5.11 à ±20 ms |
| 3 | Plusieurs centaines de niveaux en mondes Émeraude, Ambre, Rubis, Saphir, Obsidienne, Cosmos | Étape 1 | `tests/unit` (300 niveaux + COSMOS ∞) |
| 3 | Chaque monde introduit progressivement de nouvelles mécaniques | Étape 2 | Test « une idée à la fois » |
| 3 | Débuts accessibles, difficulté intelligente, jamais injuste | Étape 2 | Plancher 75 % à 30 ms, pas de falaise, prédicteur 0 mort |
| 3 | Boss tous les 10 niveaux | Étapes 1 (structure), 4 (mécaniques) | `tests/unit`, `tests/sim` |
| 3 | Niveaux spéciaux ; objectifs secondaires ; étoiles à collectionner | Étapes 3, 4 | `tests/sim/planner.js`, compteur 900 étoiles |
| 3 | Défis quotidiens | Phase 2 | — |
| 3 | Récompenses pour les séries de victoires | Étape 6 | `tests/unit` + `tests/ui.js` (jetons REPRISE) |
| 4 | Combo : tirs consécutifs → multiplicateur, bonus du parfait, combos impressionnants | Étapes 3, 5 | `tests/unit`, captures combo ×5 |
| 4 | Tir parfait : fenêtre définie, effet lumineux, son unique, bonus | Étapes 3, 5 | `tests/unit`, taux de parfaits, captures, inventaire des sons |
| 4 | Score par niveau, record personnel, meilleur combo, nombre de parfaits | Étape 3 | `tests/ui.js` (persistance) |
| 4 | Classement général | Phase 2 (interfaces seulement avant) | Aucun classement visible sans service réel |
| 4 | Collection sans avantage injuste | Phase 2 | Test de géométrie identique quel que soit l'habillage |
| 5 | 5 boss aux mécaniques demandées, identité visuelle, intro courte, victoire satisfaisante | Étape 4 | Chronologies, `tests/sim`, captures |
| 5 | Niveaux spéciaux | Étape 4 | `tests/sim/bot.js`, `planner.js` |
| 6 | Garder l'identité (noir profond, cercles orbitaux, graduations, typographie, animations lumineuses, interfaces géométriques) | Toutes | Planches de captures comparées à `docs/reference/captures-actuelles.jpg` |
| 6 | Palette par monde (vert néon, orange doré, rouge lumineux, bleu électrique, violet sombre) | Étape 1 | `tests/unit` (palettes, contraste) |
| 6 | Lisibilité sur smartphone ; moderne, élégant, reconnaissable | Étapes 1, 6 | Contraste ≥ 4,5:1, captures 320×568 à 430×932 |
| 7 | Sons : lancement, impact, combo, étoile, monde, victoire, défaite | Étape 5 | Inventaire des sons, `tests/ui.js` |
| 7 | Ambiance électronique discrète, musique désactivable indépendamment | Étape 5 | `tests/ui.js` (deux réglages indépendants et persistés) |
| 8 | Classements mondial et amis, partage, défis quotidiens et hebdomadaires, comparaison, succès, défi à deux | Phase 2 | — |
| 8 | Ne jamais simuler un classement mondial | Toutes | Aucune interface de classement avant un service réel (revue) |
| 9 | Publicité récompensée facultative, cosmétiques, Premium sans pub, récompenses quotidiennes, défis renouvelés | Phase 2 (jeton REPRISE prêt en étape 6) | — |
| 9 | Pas de pub imposée, pas de pay-to-win, pas de progression bloquée | Toutes | Progression indépendante des étoiles (`tests/unit`) |
| 10 | Commandes tactiles très réactives | Étape 1 | Latence ≤ 1 image, lancer horodaté |
| 10 | Tailles d'écran, 60 FPS, chargement rapide, batterie, animations fluides | Étapes 1, 6 | `tests/perf.js`, captures multi-écrans |
| 10 | Sauvegarde automatique, reprise après fermeture | Étape 1 | `tests/ui.js` (rechargement) |
| 11 | Analyser, identifier, proposer une architecture (étapes 1-4) | Ce document | — |
| 11 | Lancer et collision (5), difficulté (6), combos/score/étoiles (7), boss (8), animations (9), menus/mondes/récompenses (10), mobile (11) | Étapes 1 à 6 | Tests d'acceptation de chaque étape |
| 11 | Tester chaque mécanique ; ne pas tout réécrire ; garder l'existant ; pas de bouton décoratif | Toutes | Commit de découpage neutre, banc d'essai à chaque commit, test « chaque bouton agit » |
| Final | Version améliorée et entièrement jouable avant les fonctionnalités secondaires | Étapes 1-7 puis phase 2 | Étape 7 validée avant toute fonctionnalité de phase 2 |

---

## Annexe — Reproduire les mesures

- Banc d'essai : `node tests/shoot.js index.html tests/out/baseline` puis `python3 tests/sheet.py tests/out/baseline`.
- Profil d'image : remplacer `update` et `draw` par des versions chronométrées (ce sont des déclarations `function` globales), jouer le niveau 8 avec `__botSafe` pendant 6 s, avec `Emulation.setCPUThrottlingRate` à 1, 4 et 6 via CDP.
- Allocations : `HeapProfiler.startSampling` (intervalle 512 octets) pendant 6 s de jeu, agrégation par fonction.
- Simulateur : vider `makeLevel(1..200)` et la mise en page 390×844, puis politique « centre » (meilleure fenêtre, viser son milieu), 100 essais par niveau et par σ ∈ {0, 30, 45, 70, 100, 140 ms}.
- Salve aveugle : `startLevel(n, true)`, un `throwPin()` toutes les 6, 9 ou 12 images à partir de 30 départs différents, `update(1/60)`, succès si l'état passe à `winning`.
- Ces scripts deviennent `tests/perf.js` et `tests/sim/` aux étapes 1 et 2.
