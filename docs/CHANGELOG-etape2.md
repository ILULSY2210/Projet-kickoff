# Étape 2 — journal pour le porteur du projet

Ce qui change pour le joueur à l'étape 2 « Structure 6 × 50 et difficulté progressive » (mesures et écarts au plan :
`docs/ANALYSE-ET-PLAN.md`, annexe D).

1. Six mondes de 50 niveaux (Émeraude, Ambre, Rubis, Saphir, Obsidienne, Cosmos), chacun avec sa palette et son astre,
   puis COSMOS ∞ sans fin ; la sélection des niveaux se fait par monde, en sections repliables.
2. Une idée à la fois : chaque nouvelle mécanique arrive dans un niveau court et lent, annoncé par un bandeau qui reste
   2,6 s à l'écran et se relit dans la pause et dans la sélection des niveaux.
3. De nouvelles mécaniques : accélération à chaque aiguille, demi-tours annoncés, rampe, rotation irrégulière, fentes,
   zones pulsées et glissantes, inversion à l'impact, anneaux à portes (un, deux, trois, portes pulsées), deux
   sentinelles opposées.
4. Les chevrons du pas de tir annoncent 0,45 s à l'avance chaque arrêt, reprise ou inversion ; le HUD nomme la règle de
   rotation du niveau (accélération, demi-tour, rampe…).
5. Un boss tous les 10 niveaux et un spécial en x7 se jouent déjà avec la mécanique de leur archétype (leur mise en
   scène arrive à l'étape 4).
6. Le jeu est nettement plus dur à la fin : chaque niveau est réglé par un joueur simulé qui joue le vrai code du jeu.
   Un joueur précis (30 ms) gagne au moins 75 % de ses parties sur chaque niveau mesuré ; COSMOS ∞ rejoue, en miroir un
   cycle sur deux, une réserve de 100 niveaux tous mesurés. Rotations lisibles, pour qu'un joueur qui tire sans anticiper
   (il lit les chevrons, les zones et les losanges des anneaux) ne décroche pas sur les niveaux à arrêts, inversions ou
   vitesse variable (mesures en cours, annexe D) : à-coups et rotation irrégulière ne dépassent plus 1,8 fois leur vitesse moyenne (ni 7 rad/s),
   le ressac avance par paliers puis recule brièvement, et un demi-tour au rythme laisse l'astre faire plus d'un tour
   entre deux annonces. Chaque niveau propre tient dans la durée prévue pour son monde (boss : repris à l'étape 4).
7. Taper à l'aveugle ne fait plus passer de niveau après le premier monde.
8. La progression de l'ancienne version est gardée (niveau atteint, son), sans étoiles offertes sur les nouveaux
   niveaux ; CONTINUER propose d'abord les niveaux d'apprentissage pas encore joués.
9. Feuilles de victoire et d'échec lisibles sur les niveaux à anneaux (l'anneau fautif reste visible au-dessus du
   panneau), pause sans compteurs sous les boutons ; sur un téléphone en paysage, anneaux et bandeaux à leur place.
10. À trancher : la teinte d'Obsidienne, `#b48cff` ou `#9a6bff` (planche `docs/reference/obsidienne-violets.png`).
