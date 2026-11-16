# Tests d'Orbita

Banc d'essai automatique (Chromium + Playwright) :

```bash
node tests/shoot.js index.html tests/out/shots          # ~2 min : bot + captures + balayage d'équité 1..60
node tests/shoot.js index.html tests/out/shots --quick  # version rapide (niveaux 1..12)
python3 tests/sheet.py tests/out/shots                  # planches de captures (sheet-*.png)
```

`summary.json` contient `"pass": true` si : aucune erreur console, le bot gagne les niveaux joués en temps réel,
et le balayage accéléré gagne chaque niveau avec une marge « humaine » en moins de 75 s de jeu.

Autres contrôles :

```bash
node tests/ui.js                 # interface : fumée (chaque bouton, chaque touche dans chaque état, son, visibilité)
node tests/unit/run.js           # tests unitaires, dont la comparaison des niveaux avec la référence
node tests/unit/dump.js --check  # makeLevel(1..200) comparé à tests/ref/levels-ad561a3.json
```

`tests/ref/` contient les références produites à partir de `git show ad561a3:index.html` (version d'avant le
découpage en `js/`) : vidage des niveaux 1..200 et de la mise en page sur 5 écrans, temps du balayage d'équité.

Le banc s'appuie sur ces identifiants globaux du jeu : `state`, `startLevel(n)`, `throwPin()`, `showMenu()`,
`showLevels()`, `update(dt)`, `left`, `flying`, `stuck`, `rot`, `t`, `speedAt(t)`, `LAUNCH`, `cy`, `R`, `FLYV`,
`GAP`, `angDiff`, `norm`, `unlocked`, `bestStars`, `soundOn`, `window.__botSafe()`, et les boutons `#playBtn`, `#hudBtn`.
Les scripts de `js/` sont des scripts classiques : leurs `function` et leurs `let`/`const` de premier niveau
partagent une seule portée globale et restent accessibles par leur nom.
