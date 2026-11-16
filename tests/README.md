# Tests d'Orbita

Banc d'essai automatique (Chromium + Playwright) :

```bash
node tests/shoot.js index.html tests/out/shots          # ~2 min : bot + captures + balayage d'équité 1..60
node tests/shoot.js index.html tests/out/shots --quick  # version rapide (niveaux 1..12)
python3 tests/sheet.py tests/out/shots                  # planches de captures (sheet-*.png)
```

`summary.json` contient `"pass": true` si : aucune erreur console, le bot gagne les niveaux joués en temps réel,
et le balayage accéléré gagne chaque niveau avec une marge « humaine » en moins de 75 s de jeu.

Le banc s'appuie sur ces identifiants globaux du jeu : `state`, `startLevel(n)`, `throwPin()`, `showMenu()`,
`showLevels()`, `update(dt)`, `left`, `flying`, `stuck`, `rot`, `t`, `speedAt(t)`, `LAUNCH`, `cy`, `R`, `FLYV`,
`GAP`, `angDiff`, `norm`, `unlocked`, `bestStars`, `soundOn`, `window.__botSafe()`, et les boutons `#playBtn`, `#hudBtn`.
