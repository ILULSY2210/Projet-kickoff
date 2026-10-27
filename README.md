# Bastion des Lanternes

Prototype jouable d'un RPG en pixel-art isométrique, inspiré de trois idées :

- **Construis ton camp** : coupe du bois, extrais de la pierre, bâtis fermes, scieries, carrières, maisons, mine et taverne. Les bâtiments produisent des ressources en continu, même pendant tes expéditions.
- **Conquiers le donjon** : des étages générés aléatoirement, avec slimes, chauves-souris, gobelins, squelettes archers, orques, et un Chevalier de bronze tous les 3 étages.
- **Choisis tes héros** : recrute cinq héros à la taverne (guerrier, archère elfe, mage, nain forgeron, orque berserker), chacun avec son arme, sa compétence et son arbre d'armes à la forge.

Aucune dépendance et aucun fichier image : tout le pixel-art (tuiles, personnages, bâtiments, arbres, icônes) est généré par code au lancement.

## Lancer le jeu

Ouvre `index.html` dans un navigateur, c'est tout.

Pour y jouer depuis un téléphone, active GitHub Pages sur ce dépôt (Settings → Pages → branche principale, dossier racine) puis ouvre l'URL fournie.

La partie est sauvegardée automatiquement dans le navigateur (localStorage).

## Commandes

| Action | Clavier | Tactile / souris |
| --- | --- | --- |
| Se déplacer | ZQSD, WASD ou flèches | Toucher le sol |
| Interagir (arbre, rocher, bâtiment, coffre, portail) | — | Toucher l'objet |
| Attaquer | Espace ou 1 | Toucher un monstre |
| Compétence du héros | 2 ou E | Bouton de la barre d'actions |
| Potion | 3 ou R | Bouton de la barre d'actions |
| Inventaire / Héros | I / H | Boutons |
| Construire / Forge / Marché | B / F / M | Boutons (au camp) |
| Menu | Échap | Bouton ≡ |

## Boucle de jeu

1. Coupe des arbres et casse des rochers pour tes premières ressources.
2. Construis des bâtiments de production (ferme → provisions, scierie → bois, carrière → pierre, mine → fer).
3. Pars en expédition depuis l'entrée du donjon (coûte des provisions). Le butin n'est rangé au camp que si tu reviens par le portail ; si tu tombes, tu en perds la moitié.
4. Vends le butin au marché, forge de meilleures armes (le dernier palier propose deux voies), améliore tes bâtiments.
5. Construis la taverne, recrute de nouveaux héros et choisis celui qui part en expédition.

Une liste d'objectifs (en haut à droite) guide les premières étapes.

## Structure du code

| Fichier | Rôle |
| --- | --- |
| `index.html`, `css/style.css` | Page, HUD et panneaux de l'interface |
| `js/core.js` | Maths, projection isométrique, tampon de pixels, police bitmap, sons |
| `js/art.js` | Génération procédurale de tous les sprites |
| `js/data.js` | Données de jeu : objets, héros, armes, bâtiments, monstres, objectifs |
| `js/world.js` | Cartes : camp (depuis la sauvegarde) et donjon procédural, A* |
| `js/entities.js` | Héros, monstres, villageois, animaux |
| `js/game.js` | Boucle, rendu iso avec tri de profondeur, éclairage jour/nuit, entrées, sauvegarde |
| `js/ui.js` | Barre d'actions et panneaux (inventaire, construction, forge, marché, héros, expédition) |

Pour équilibrer le jeu, la plupart des chiffres sont dans `js/data.js`.

## Pistes pour la suite

- Remplacer le pixel-art procédural par de vrais sprites (un pack isométrique 32×16 s'intègre directement : il suffit de remplacer les fonctions de `js/art.js`).
- Musique d'ambiance et vrais effets sonores.
- Équipement (armures, anneaux) en plus des armes, et compétences débloquées par niveau.
- Plusieurs héros en même temps dans le donjon (groupe).
- Événements au camp (attaques nocturnes, marchands ambulants).
