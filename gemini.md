# Référence Projet : AstroMoon Web

## Résumé du Projet
AstroMoon est un outil web interactif (superposition sélénographique) conçu pour l'astrophotographie lunaire. Il permet de charger une photo de la lune et d'y superposer, aligner et déformer des calques de données géologiques pour identifier précisément les structures lunaires.

## Choix Techniques Actuels
- **Technologies End-User :** HTML5, Vanilla JavaScript (ES6+), CSS natif (pas de framework lourd).
- **Moteur de Rendu :** **PixiJS (v8)**. Accélération matérielle (WebGL/WebGPU) pour le rendu haute performance de l'image de base, des géométries vectorielles GeoJSON (via `Graphics`) et du texte (via `BitmapText` ou `Text`).
- **Formats de Données :**
  - **GeoJSON** : Chargement dynamique asynchrone via `fetch()`. L'architecture s'appuie sur le fichier de configuration central `calque_geojson/layers.json` pour la découverte et le chargement à la volée des calques géologiques.
- **Configuration Centralisée :** `js/config.js` — Toutes les constantes tunables (LOD, grille, labels, culling, rendu, performance) sont centralisées dans un seul fichier. Ne jamais hardcoder de magic numbers dans les modules.
- **LOD Multi-Résolution :** Simplification Douglas-Peucker itérative (niveaux dynamiques configurables par calque, typiquement 4) générée au chargement via Web Worker. Sélection dynamique selon le zoom. Les epsilons sont en **espace degrés** (lon/lat), pas normalisé.
- **Ajustement Spatial (Image) :**
  - Manipulations spatiales : Pan, Zoom, Rotation.
  - Déformation non-linéaire : Système d'ancrages interactifs (punaises) manipulant une grille via l'algorithme **Thin Plate Spline (TPS)**.
- **Widgets de Contexte (Temps & Localisation) :**
  - Parseur EXIF binaire natif développé from scratch pour l'extraction de la date et des coordonnées GPS.
  - Recherche prédictive et reverse-geocoding via l'API **OpenStreetMap Nominatim**.
  - Fallbacks intelligents : Temps (Fichier > Exif > Manuel) et Localisation (Exif > Geoloc API > Nominatim).

## Règles de Session & Interaction (Instructions IA)
- **Style de communication :** Sois direct, concis, technique. Privilégier le code brut et les explications architecturales aux formules de politesse.
- **Périmètre d'intervention :** NE PAS scanner ni modifier le dossier `data/` et les sous-dossiers de `user_exemple/`.
- **Workspace Git :** Ne JAMAIS initier de commit, push, ou de changement de branche sans accord explicite.
- **Config centralisée :** Toute constante tunable (seuils, limites, couleurs de rendu) doit être dans `js/config.js`, **absolument jamais** codée en dur dans les modules comme `pixi_renderer.js` ou `app.js`. La source de vérité est unique.

## Lignes Directrices : Optimisation & Performance (Focus)
Puisque nous sommes dans le cycle d'optimisation :
- **Boucle de Rendu (PixiJS) :** Tirer parti du Scene Graph. Minimiser les recréations d'objets `Graphics`. Préférer la mise à jour des géométries/transformations (via modifications des propriétés).
  - *Astuce Z-Indexing PixiJS v8* : Pour superposer correctement plusieurs traits sur le même objet `Graphics` (ex: un *glow* en dessous d'un trait pur), il est impératif de tracer le tracé complet, de le `.stroke()`, puis de le re-tracer entièrement et appliquer à nouveau `.stroke()`. L'ordre de déclaration force l'empilement optimal.
- **Gestion Mémoire & Textes :** Attention aux instanciations de `Text` (création de textures VRAM). Privilégier `BitmapText` pour les étiquettes en masse (cratères). Éviter la pression sur le GC dans les algorithmes comme le TPS (pré-allocation d'arrays, `TypedArrays` pour les matrices).
- **Performance Calculatoire :** Garder un seuil maximal de 60 FPS constant. Les tâches lourdes doivent tendre vers une optimisation fine (voire Web Workers si c'est strictement indispensable).
- **LOD :** Le système LOD est piloté par `js/config.js` (section `LOD`). Les epsilons Douglas-Peucker sont en espace degrés. La grille sélénographique adapte aussi sa densité selon le LOD.

## Direction Artistique & UI/UX (Design System)
L'application vise une UX premium, ancrée dans la "hard-tech" et l'immersif :
- **Atmosphère Globale :** "Dark Mode" profond (`#06060c`), optimisé pour le contraste astrophotographique.
- **Glassmorphism & HUD :** Barres d'outils et outils d'information (pills) avec fonds translucides et flou d'arrière-plan (`backdrop-filter: blur`), évoquant une interface d'ingénierie spatiale. Formes arrondies.
- **Halo Néon Obligatoire :** Chaque panneau flottant interactif **doit obligatoirement** inclure un léger halo dans son ombre : `box-shadow: var(--shadow-card), var(--shadow-hud-glow);`. Le token `hud-glow` crée une lueur ambiante cyan ou violette délicate.
- **Nuancier d'Accentuation :** Cyan (`#00d4ff`) et Violet (`#7b2ff7`). Très souvent utilisés combinés via des gradients linéaires. Feedback visuel de focus et de clic accentué par des "glows" (ombres lumineuses).
- **Typographie Hybride :** *Space Grotesk* (sans-serif) pour la lisibilité standard et *JetBrains Mono* (monospace) pour les éléments analytiques en mouvement constant (coordonnées, FPS, métriques).
- **Animation :** Implémenter des micro-interactions visuelles (scale au hover, transitions d'opacité/couleur) rendant l'interface dynamique et tactile, tout en restant discrète.
