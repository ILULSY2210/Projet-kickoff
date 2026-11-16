# PROJET ORBITA — TRANSFORMATION EN JEU MOBILE ADDICTIF

*(cahier des charges fourni par le porteur du projet, reproduit tel quel)*

Tu es un développeur senior spécialisé dans les jeux mobiles, game design, psychologie du joueur, UX/UI et mécaniques de jeux arcade à fort potentiel viral.

Je souhaite transformer mon jeu ORBITA en un véritable jeu mobile arcade, extrêmement satisfaisant, accessible à tous et avec une excellente rejouabilité.

Je vais te fournir des captures d’écran de mon jeu actuel. Elles constituent la référence visuelle à respecter et à améliorer. *(voir `docs/reference/captures-actuelles.jpg`)*

## 1. CONCEPT DU JEU

Le principe est simple :

Le joueur doit lancer des aiguilles (piques) sur une sphère qui tourne au centre de l’écran.

Chaque aiguille lancée doit se planter dans la sphère sans toucher les aiguilles déjà présentes.

Si deux aiguilles se touchent, la partie est perdue.

Le joueur doit également réussir à planter des aiguilles sous certaines étoiles pour les récupérer.

Règle fondamentale : une seule action pour jouer. Le joueur touche l’écran pour lancer une aiguille.

Le gameplay doit être facile à comprendre en moins de 5 secondes, mais difficile à maîtriser.

## 2. GAMEPLAY : LE RENDRE EXTRÊMEMENT SATISFAISANT

Améliore les mécaniques existantes :

* Rotation de la sphère avec différentes vitesses.
* Rotation dans les deux sens.
* Changements de direction soudains.
* Accélérations et ralentissements.
* Aiguilles déjà plantées qui créent des zones de danger.
* Espacement de plus en plus difficile à gérer.
* Étoiles à récupérer en réussissant certains tirs.
* Niveaux avec des configurations différentes.
* Apparition de bonus et de mécanismes spéciaux.

Ajoute une physique et des animations très satisfaisantes.

Lorsqu’une aiguille touche la sphère :

* Animation rapide et fluide.
* Petit effet lumineux à l’impact.
* Vibration légère du téléphone.
* Son métallique distinctif.
* Légère réaction visuelle de la sphère.

Lorsqu’un joueur rate :

* Ralentissement très court.
* Effet de collision spectaculaire.
* Les aiguilles se brisent ou explosent.
* Écran de défaite rapide avec possibilité de recommencer immédiatement.

Évite les animations trop longues qui cassent le rythme.

## 3. SYSTÈME DE PROGRESSION

Construis une progression sur plusieurs centaines de niveaux.

Organise les niveaux en mondes avec des identités différentes :

* Monde 1 : Émeraude — découverte.
* Monde 2 : Ambre — accélération.
* Monde 3 : Rubis — précision.
* Monde 4 : Saphir — rotations inversées.
* Monde 5 : Obsidienne — difficulté élevée.
* Monde 6 : Cosmos — défis extrêmes.

Chaque monde doit introduire progressivement de nouvelles mécaniques.

Les premiers niveaux doivent être accessibles. La difficulté doit augmenter intelligemment et ne jamais donner l’impression d’être injuste.

Ajoute :

* Des boss tous les 10 niveaux.
* Des niveaux spéciaux.
* Des défis quotidiens.
* Des objectifs secondaires.
* Des étoiles à collectionner.
* Des récompenses pour les séries de victoires.

## 4. MÉCANIQUES QUI DONNENT ENVIE DE REJOUER

Je veux plusieurs systèmes :

**Combo**

* Réussir plusieurs tirs consécutifs augmente le multiplicateur.
* Réaliser un tir parfait rapporte un bonus.
* Les combos doivent être visuellement impressionnants.

**Perfect Shot**

* Récompense lorsque l’aiguille est plantée dans une fenêtre de précision définie.
* Effet lumineux spécifique.
* Son unique.
* Bonus de score.

**Système de score**

* Score par niveau.
* Record personnel.
* Meilleur combo.
* Nombre de tirs parfaits.
* Classement général.

**Collection**

* Débloquer différents modèles d’aiguilles.
* Débloquer différentes sphères.
* Débloquer des effets lumineux.
* Débloquer des thèmes visuels.
* Débloquer des animations d’impact.

Les objets cosmétiques ne doivent pas donner d’avantage injuste.

## 5. BOSS ET NIVEAUX SPÉCIAUX

Les boss doivent apporter de véritables changements au gameplay.

Exemples :

* Boss 1 : sphère qui accélère progressivement.
* Boss 2 : sphère qui change brutalement de direction.
* Boss 3 : plusieurs anneaux qui tournent à des vitesses différentes.
* Boss 4 : sphère avec des zones interdites.
* Boss 5 : rotation irrégulière avec des obstacles mobiles.

Chaque boss doit avoir une identité visuelle et une mécanique spécifique.

Prévois une animation d’introduction courte et une animation de victoire satisfaisante.

## 6. DIRECTION ARTISTIQUE

Conserve l’identité graphique actuelle d’ORBITA.

Je veux un univers :

* Futuriste.
* Minimaliste.
* Spatial.
* Néon.
* Premium.
* Très fluide.

Palette de couleurs :

* Émeraude : vert néon.
* Ambre : orange doré.
* Rubis : rouge lumineux.
* Saphir : bleu électrique.
* Obsidienne : violet sombre.

Conserve :

* Le fond noir profond.
* Les cercles orbitaux.
* Les graduations circulaires.
* Les typographies futuristes.
* Les animations lumineuses.
* Les interfaces géométriques.

Améliore la lisibilité sur smartphone.

L’interface doit être moderne, élégante et immédiatement reconnaissable.

## 7. SON ET IMMERSION

Crée une véritable identité sonore :

* Son de lancement d’aiguille.
* Son d’impact.
* Son de combo.
* Son de récupération d’étoile.
* Son de changement de monde.
* Son de victoire.
* Son de défaite.

Ajoute une ambiance sonore électronique discrète.

La musique doit pouvoir être désactivée indépendamment des effets sonores.

## 8. FONCTIONNALITÉS SOCIALES

Prépare les fonctionnalités suivantes :

* Classement mondial.
* Classement entre amis.
* Partage des records.
* Défis quotidiens.
* Défis hebdomadaires.
* Comparaison des performances.
* Succès et trophées.

Prévois également un mode défi dans lequel deux joueurs peuvent comparer leurs résultats sur le même niveau.

Ne simule jamais un classement mondial sans véritable système de données.

## 9. RÉTENTION ET MONÉTISATION

Je veux un modèle économique respectueux des joueurs.

Prévois :

* Publicités récompensées facultatives pour obtenir une seconde chance.
* Personnalisation cosmétique.
* Version Premium sans publicité.
* Récompenses quotidiennes.
* Défis renouvelés régulièrement.

Pas de publicité imposée après chaque niveau, pas de mécanique pay-to-win et pas de progression artificiellement bloquée.

Le joueur doit avoir envie de revenir grâce au plaisir du gameplay et à sa progression.

## 10. OPTIMISATION MOBILE

Le jeu doit être pensé en priorité pour les smartphones.

Exigences :

* Commandes tactiles très réactives.
* Interface adaptée aux différentes tailles d’écran.
* 60 FPS comme objectif.
* Chargement rapide.
* Faible consommation de batterie.
* Animations fluides.
* Sauvegarde automatique de la progression.
* Reprise après fermeture de l’application.

## 11. CE QUE JE VEUX QUE TU FASSES CONCRÈTEMENT

Ne te contente pas de proposer des idées.

Je veux que tu travailles directement sur mon projet existant.

Procède dans cet ordre :

1. Analyse complètement le code existant.
2. Identifie les mécaniques déjà fonctionnelles.
3. Identifie les défauts du gameplay et de l’interface.
4. Propose une architecture d’amélioration sans détruire les fonctionnalités existantes.
5. Améliore le système de lancer et de collision des aiguilles.
6. Développe une difficulté progressive et équilibrée.
7. Ajoute le système de combos, de score et d’étoiles.
8. Développe les boss.
9. Améliore les animations et les effets visuels.
10. Développe les menus, les mondes et les récompenses.
11. Optimise le jeu pour mobile.

Travaille par étapes et teste chaque mécanique.

Ne réécris pas entièrement le projet sans nécessité. Conserve les éléments fonctionnels et assure la compatibilité avec l’architecture existante.

Ne crée pas de boutons décoratifs sans fonctionnalité. Chaque fonctionnalité ajoutée doit réellement fonctionner.

## OBJECTIF FINAL

Je veux faire d’ORBITA un jeu arcade capable de toucher un très large public.

Le joueur doit pouvoir comprendre le jeu immédiatement, progresser rapidement au début, rencontrer des défis de plus en plus techniques et avoir constamment envie de battre son record.

La priorité absolue reste le GAMEPLAY.

Un jeu simple à comprendre, difficile à maîtriser et extrêmement satisfaisant à jouer.

Commence par analyser mon projet actuel et développe une première version améliorée et entièrement jouable avant de passer aux fonctionnalités secondaires.
