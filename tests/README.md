# Tests d'Orbita

Tout tourne dans Chromium par Playwright (déjà installés), sur le vrai jeu (`index.html` et ses scripts `js/`).
Les sorties vont dans `tests/out/` (ignoré par git).

## Banc d'essai

```bash
node tests/shoot.js index.html tests/out/shots          # ~1 min : bot + captures + balayage d'équité 1..60
node tests/shoot.js index.html tests/out/shots --quick  # version rapide (niveaux 1..12)
python3 tests/sheet.py tests/out/shots                  # planches de captures (sheet-*.png)
```

`summary.json` contient `"pass": true` si : aucune erreur console, le bot gagne les niveaux joués en temps réel,
le balayage accéléré gagne chaque niveau avec une marge « humaine » en moins de 75 s de jeu, et l'**échec
volontaire** du niveau 10 est obtenu (tir déclenché quand le point d'impact prévu tombe sur une aiguille ; `failOk`).

## Autres contrôles

```bash
node tests/unit/run.js           # tests unitaires (~1 min) : chaque tests/unit/*.test.js, puis dump.js --check
node tests/ui.js                 # interface (~2 min)
node tests/ui.js --only=smoke    # une seule section (plusieurs : --only=smoke,echec)
node tests/play.js               # gameplay accéléré dans la vraie page (~20 s)
node tests/perf.js               # régularité, charge, latence (~20 s)
node tests/lib/serve.js 8080     # sert le jeu en http (le service worker y fonctionne sur localhost)
node tests/sim/agree.js          # accord du simulateur Node avec la vraie page (~30 s)
node tests/palettes.js           # planche des 6 palettes et des deux violets d'Obsidienne (docs/reference/)
```

## Simulateur (`tests/sim/`)

Le simulateur exécute le **vrai** cœur du jeu dans Node : `tests/sim/load.js` charge `js/config.js`, `js/util.js`,
`js/levels.js` et `js/core.js` dans un contexte `vm` (aucune copie de la physique ; `core.js` n'utilise ni le DOM ni le
canvas, il émet des événements sur `bus` que le rendu, les effets, le son, l'interface et la sauvegarde écoutent).
`tests/sim/driver.js` contient les politiques de joueur (injectées telles quelles dans Node ou dans la page) : `aim`
(joueur qui vise, imprécision σ), `reactive` (n'anticipe pas), `mash` (salve à l'aveugle), `bot` (`__botSafe`), et
`replay` (rejoue un journal d'instants de tir). Leur anticipation passe par `predict()` et `shotSafe()` du cœur, les
mêmes que `__botSafe`.

| Outil | Ce qui est vérifié |
|---|---|
| `tests/sim/agree.js [--n=2000] [--max=400]` | ≥ 2 000 tentatives du joueur qui vise (σ au hasard) rejouées dans Chromium et dans Node : ≥ 99,5 % d'issues identiques, angles à 1e-9 |

| Outil | Section | Ce qui est vérifié |
|---|---|---|
| `tests/unit/dump.js --check` | — | `makeLevel(1..400)` identique entre Chromium et Node, et identique à la référence `tests/ref/levels-gen2.json` (un changement voulu des niveaux se verse avec `node tests/unit/dump.js --update`) |
| `tests/unit/levels.test.js` | — | générateur v2 sur 1..400 : une idée à la fois (`drapeaux(n) ⊆ drapeaux(1..n−1) ∪ {TEACH[n]}`, chaque niveau d'apprentissage introduit son idée et elle seule, en 3 à 5 aiguilles), capacité tirs + obstacles fixes ≤ 14, déterminisme, boss et spéciaux |
| `tests/unit/sw.test.js` | — | précache du service worker cohérent (`VERSION`, `FILES`, `?v=`, empreintes) |
| `tests/unit/timing.test.js` | — | intégration par trapèzes à 0,002 rad d'une référence après 30 s, pour chaque loi de rotation ; même journal de tirs (au début d'un pas ou au milieu, par `throwPin(tSim)`) → mêmes issues et angles à 1e-9 près à 30, 60, 90, 120 et 144 Hz ; interception par la tête d'une sentinelle au même instant (1e-9) quel que soit le découpage en pas |
| `tests/unit/input.test.js` | — | horodatage des taps (`tapInstant`) : bornes, garde « depuis 1970 », événement en retard |
| `tests/unit/geometry.test.js` | — | collision = dessin sur 5 écrans : rayon des têtes = GAP × (R + PL) / 2, règle et dessin d'accord à GAP ± 0,002 rad, sentinelles (tige, et tête en vol : aucun recouvrement dessiné sans interception, ≤ 0,1 px en 390×844 et ≤ 2 px ailleurs) ; captures dans `tests/out/geometry/` |
| `tests/unit/config.test.js` | — | structure 6 × 50 + COSMOS ∞, boss et spéciaux, palettes (trait, libellés ≥ 4,5:1, blanc chaud, alerte), positions u, `TEACH` (Node) |
| `tests/unit/save.test.js` | — | sauvegarde v2 et migration de la version 1 (unlocked 150 → 150, aucune étoile, `legacyStars`, CONTINUER → niveau 1), valeurs corrompues sans exception (Node, localStorage simulé) |
| `tests/unit/text.test.js` | — | messages d'échec par cause (zone interdite, degrés exacts au bord d'un arc), accords, glyphes de la police vectorielle |
| `tests/ui.js` | `smoke` | chaque bouton visible de chaque écran, Espace/Entrée/P/Échap dans chaque état, son, case de niveau, `visibilitychange` |
| | `regles` | 320×568 : bandeau d'un niveau d'apprentissage (titre et règle ≥ 10 px) affiché ≥ 2 s même après un tir sûr ; règles relisibles dans la pause et dans la sélection des niveaux |
| | `migration` | vraies clés v1 posées avant le chargement : migration, CONTINUER → niveau 1, grille ouverte, valeurs corrompues sans erreur |
| | `boot`, `offline`, `update`, `guard` | démarrage sans réseau tiers, hors ligne, mise à jour au menu seulement, garde-fou de démarrage |
| | `ecrans` | 5 écrans : vol 60 ± 1 ms, même journal → mêmes angles à 1e-9, croisements dessinés à ± 1 ms (pointe, tête, centre de la tête) |
| | `tir` | taps à phase aléatoire : départ à l'instant du tap, jamais dans le passé |
| | `reprendre` | compte à rebours de 0,6 s, rotation figée, taps et `throwPin()` ignorés, aucun bandeau d’intro sous l’anneau 3-2-1 en 320×568 |
| | `echec` | 5 écrans : feuille à 0,45 s, tap à 0,3 s ignoré, à 0,5 s relance, verrou de 250 ms, cause rappelée, collision et sentinelle ≥ 4 px au-dessus du filet, MENU à droite, HUD aligné, aiguilles restantes justes avec une ou deux aiguilles en vol |
| `tests/play.js` | `doubletap` | double tap à 8 ms : 0 mort sur 40 aux niveaux 1, 2, 3, 8, 21 et au premier niveau à sentinelle |
| | `vol` | second tap 60-200 ms après le premier : part à son instant exact ; jamais plus de deux aiguilles en vol |
| | `predicteur` | `__botSafe` : 0 mort, 0 blocage sur 1..300 × 4 parties, à dt 1/60 et 1/120 |
| | `traversantes` | 1..300 : 0 % de bord allumé mortel (pas de 0,001 rad) ; chaque étoile a un angle de capture sûr |
| `tests/perf.js` | `regularite` | horloge virtuelle à 90 et 120 Hz : variation de l'incrément de rotation dessiné < 5 % |
| | `charge` | CPU ×4 : vitesse de simulation ≥ 0,98 |
| | `latence` | événement tactile → aiguille visiblement partie : ≤ 1 image en médiane, ≤ 2 au plus |

`tests/play.js`, `tests/perf.js` et `tests/unit/timing.test.js` remplacent `requestAnimationFrame` (et
`performance.now` pour `play.js`) avant le chargement de la page : la boucle du jeu avance alors sur une horloge
virtuelle pilotée par le test, à la cadence voulue.

**Version du service worker.** `sw.js` précache tous les fichiers du jeu d'un bloc, dans un cache nommé par
`VERSION`, et `index.html` charge les scripts avec `?v=N`. Après toute modification d'un fichier précaché
(`index.html`, `js/`, `fonts/`, manifeste, icône, `sw.js`), lancer `node tests/unit/sw.test.js --bump` : il
incrémente `VERSION` et les `?v=`, puis met à jour `tests/ref/sw-hashes.json`. Sinon `sw.test.js` échoue.

`tests/ref/` contient la référence des niveaux du générateur v2 (`levels-gen2.json`), les empreintes du service worker
et, pour mémoire, le balayage d'équité de la version d'avant le découpage (`sweep-ad561a3.json`).

## Contrat de test

Les bancs s'appuient sur ces identifiants globaux du jeu (scripts classiques : leurs `function` et leurs
`let`/`const` de premier niveau partagent une seule portée globale et restent accessibles par leur nom) :
`state`, `startLevel(n)`, `throwPin()`, `showMenu()`, `showLevels()`, `update(dt)`, `left`, `flying`, `stuck`,
`rot`, `t`, `speedAt(t)`, `LAUNCH`, `cy`, `R`, `FLYV`, `GAP`, `angDiff`, `norm`, `unlocked`, `bestStars`, `soundOn`,
`window.__botSafe()`, et les boutons `#playBtn`, `#hudBtn`.

- `update(dt)` avance la simulation de `dt` secondes exactement, en pas de 1/120 s (`STEP`) puis un pas fractionnaire
  s'il reste ; il ne lit jamais l'horloge.
- `throwPin()` lance à l'instant simulé courant ; `throwPin(tSim)` à l'instant `tSim` (jamais avant le dernier instant
  simulé). Deux aiguilles au plus en vol : `flights` les contient, `flying` vaut la plus récente ou `null`.
- `predict(tL)` donne l'angle d'impact d'un tir lancé à `tL` (même intégrateur et même grille de pas que le jeu) ;
  `window.__botSafe(tSim)` accepte l'instant du lancer envisagé (facultatif).
- Sous-phase de `play` : `playPhase` (`'jeu'`, ou `'compte'` pendant le compte à rebours de REPRENDRE, où
  `throwPin()` ne fait rien et `__botSafe()` rend `false`).
- `FLYV = (LAUNCH − (cy + R)) / FLIGHT` : `(LAUNCH − (cy + R)) / FLYV` vaut la durée du vol (60 ms).
- Couche d'entrée (`tap(ts)`, clavier) seulement : anti-rebond de 40 ms, verrou de 250 ms après une relance ;
  `throwPin()` et `startLevel()` n'en savent rien.
