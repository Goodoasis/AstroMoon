# Référence Projet : AstroMoon Web

## Résumé du Projet
AstroMoon est un outil web interactif (superposition sélénographique) conçu pour l'astrophotographie lunaire. Il permet de charger une photo de la lune et d'y superposer, aligner et déformer des calques de données géologiques pour identifier précisément les structures lunaires.

## Choix Techniques Actuels
- **Technologies End-User :** HTML5, Vanilla JavaScript (ES6+), CSS natif (pas de framework lourd).
- **Moteur de Rendu :** API HTML5 `<canvas>` (dessin manuel des images, lignes vectorielles, grilles de déformation et labels annotatifs).
- **Formats de Données :**
  - **GeoJSON** principalement pour les géométries complexes (lignes de crêtes, mers, bassins). Chargement utilisateur via FileReader.
  - Fichiers de données statiques (ex: liste des cratères) encapsulés depuis du JSON vers du JS (variable globale) pour garantir un fonctionnement "offline" sous le protocole `file:///`, contournant ainsi les règles CORS qui bloquent `fetch()`.
- **Ajustement Spatial (Image) :**
  - Manipulations spatiales (Pan, Zoom, Rotation).
  - Système d'ancrages interactifs (punaises) permettant une déformation non-linéaire sur l'image via l'algorithme **Thin Plate Spline (TPS)**.
- **Widgets de Contexte (Temps & Localisation) :**
  - Extracteur EXIF binaire natif développé "from scratch" en Vanilla JS (0 dépendance) pour la récupération de la Date de capture et des Coordonnées GPS IFD.
  - Outil de recherche prédictive et reverse-geocoding utilisant l'API publique libre **OpenStreetMap Nominatim**.
  - Hiérarchie d'application intelligente pour le Temps (Filename > Exif > Manuel) et la Localisation (Exif > Geoloc API > Recherche Nominatim).

## Règles de Session (Instructions pour Gemini)
- **Style de communication :** Ne pas être trop verbeux. Sois direct, concis et privilégie le code ou l'explication technique brute aux longues phrases de politesse ou transitions.
- **Périmètre de recherche/analyse :** Ignorer le dossier `data/` et les sous-dossiers de `user_exemple/`.
- **GIT :** Ne pas commit ou check out sans que je ne te le demande.

## Direction Artistique & UI/UX (Design System)
L'application vise une expérience premium, immersive et technique, traduite par les partis pris suivants :
- **Atmosphère globale :** "Dark Mode" profond (`#06060c`) orienté espace/astronomie, pensé pour maximiser le contraste des photographies lunaires et minimiser la fatigue visuelle.
- **Glassmorphism & Superposition :** Les barres d'outils et panneaux d'information sont flottants, dotés de fonds translucides (`rgba`) couplés à un effet de flou (`backdrop-filter: blur`), évoquant un HUD logiciel de pointe. Formes adoucies (boutons circulaires, barres en forme de pilules).
- **Halo Néon sur les panneaux flottants :** **Tout** panneau flottant (toolbar, HUD pill, side-panel, toast, popup, dropdown) **doit** utiliser le token CSS `--shadow-hud-glow` dans son `box-shadow` pour produire un léger halo cyan/violet qui le détache visuellement du fond sombre. Règle : `box-shadow: var(--shadow-card), var(--shadow-hud-glow);`. Ce token est défini dans `:root` de `style.css`.
- **Nuancier & Textures (Neon Glow) :**
  - **Couleurs accentuées :** Cyan (`#00d4ff`) et Violet (`#7b2ff7`), souvent fusionnés en dégradés pour le branding ou l'activation d'outils. 
  - **Feedback visuel :** Utilisation intensive d'ombres portées lumineuses (box-shadow) simulant un effet néon/LED au survol ou à l'activation des boutons, afin de confirmer les interactions utilisateur.
- **Typographie :** Combinaison d'une police sans-serif moderne pour l'interface (*Space Grotesk*) et d'une police à chasse fixe type code (*JetBrains Mono*) pour les données télémétriques (FPS, Lat/Lon, ID d'ancrage), renforçant l'aspect d'outil de précision.
- **Micro-animations dynamiques :** L'UI réagit avec fluidité (transitions rapides, effets de `scale`, rotation des icônes SVG, pulsations) pour rendre l'interface engageante et vivante sans surcharger l'attention.
