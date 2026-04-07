# Migration Canvas 2D → PixiJS v8

## Contexte

L'app AstroMoon utilise actuellement un `<canvas>` 2D avec un render loop `requestAnimationFrame` manuel. Le module `Renderer` (`canvas.js`) dessine séquentiellement : background image, grille, GeoJSON, night mask, terminator, anchors, annotations.

La migration vers PixiJS v8 apporte :
- **Rendu GPU (WebGL/WebGPU)** — performance largement supérieure pour les milliers de segments GeoJSON
- **Scene graph** — containers hiérarchiques au lieu de `ctx.save()/restore()` manuels
- **Gestion native du viewport** — pan/zoom/rotation via les transforms de `Container`
- **Batching automatique** — PixiJS regroupe les draw calls

## User Review Required

> [!IMPORTANT]
> **Passage en `type="module"`** — PixiJS v8 s'importe via ESM (`import { ... } from 'pixi.js'`). Tous les `<script>` devront être convertis en modules ES6. Le fonctionnement `file:///` n'est **plus garanti** (mais tu utilises déjà `fetch()` pour les layers, donc tu es déjà sur un serveur local).

> [!WARNING]
> **Breaking change on API** — Le `Renderer` IIFE actuel (`canvas.js`) est entièrement remplacé. L'API publique change : plus de `drawBackground(ctx, ...)` mais un scene graph PixiJS géré par un nouveau module `pixi_renderer.js`.

> [!IMPORTANT]
> **GeoJSON `Graphics` rebuild** — PixiJS `Graphics` ne supporte pas bien le re-draw frame-par-frame comme Canvas 2D. Les `Graphics` seront construits une fois puis **transformés** (position/scale/rotation). Reconstruit uniquement quand les données changent (dirty flag).

---

## Architecture Cible

```
┌─────────────────────────────────────────────────────┐
│  PIXI.Application (app)                             │
│  ├── app.stage                                      │
│  │   ├── viewportContainer  (pan/zoom camera)       │
│  │   │   ├── bgSprite       (photo lunaire)         │
│  │   │   ├── geojsonContainer                       │
│  │   │   │   ├── layerGraphics[0]  (Graphics)       │
│  │   │   │   ├── layerGraphics[1]  ...              │
│  │   │   │   └── ...                                │
│  │   │   ├── nightMaskGraphics                      │
│  │   │   ├── terminatorGraphics                     │
│  │   │   ├── gridGraphics                           │
│  │   │   ├── anchorsGraphics                        │
│  │   │   └── annotationsContainer                   │
│  │   │       ├── Text (crater label)                │
│  │   │       ├── Text ...                           │
│  │   │       └── Graphics (dots)                    │
│  │   └── (HUD HTML reste en DOM overlay)            │
│  └── app.canvas  (remplace #main-canvas)            │
└─────────────────────────────────────────────────────┘
```

---

## Proposed Changes

### Modules inchangés (0 modification)
- `js/exif.js` — extraction EXIF pure
- `js/astronomy.js` — éphémérides
- `js/craters_data.js` — données statiques
- `js/tps.js` — algorithme TPS pur (maths)
- `css/style.css` — inchangé (le HUD est en HTML overlay)

---

### Module de projection GeoJSON

#### [MODIFY] [geojson.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/geojson.js)
- Convertir l'IIFE en `export` ES module
- Aucun changement logique, juste `export { parse, parseObject, project, ... }`

---

### Module de transformation affine

#### [MODIFY] [transform.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/transform.js)
- Convertir l'IIFE en `export` ES module

---

### Module TPS

#### [MODIFY] [tps.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/tps.js)  
- Convertir l'IIFE en `export` ES module

---

### Module Anchors

#### [MODIFY] [anchors.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/anchors.js)
- Convertir l'IIFE en `export` ES module
- Importer `Transform` et `TPS` au lieu de les référencer comme globales

---

### Nouveau Renderer PixiJS

#### [NEW] [pixi_renderer.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/pixi_renderer.js)
Remplace entièrement `canvas.js`. Structure :

```javascript
import { Application, Container, Sprite, Graphics, Text, Texture } from 'pixi.js CDN';

// Scene graph references
let app, viewportContainer, bgSprite;
let geojsonContainer, layerGraphics = [];
let nightMaskGfx, terminatorGfx, gridGfx, anchorsGfx;
let annotationsContainer;

// Palette colors (identique à l'actuel)
const LAYER_PALETTE = [...];

export async function init(canvasContainer) {
  app = new Application();
  await app.init({ background: 0x06060c, resizeTo: window, antialias: true });
  canvasContainer.appendChild(app.canvas);
  // Build scene tree...
}

export function setBackgroundImage(htmlImage) {
  // Texture.from(image) → bgSprite
}

export function rebuildGeoJSON(projectedFeatures) {
  // Clear & rebuild Graphics per layer
  // Called only when data changes (dirty), NOT every frame
}

export function updateViewport(vp) {
  viewportContainer.position.set(vp.tx, vp.ty);
  viewportContainer.scale.set(vp.scale);
}

export function rebuildAnchors(anchors, activeId, vp) { ... }
export function rebuildGrid(transformFn) { ... }
export function rebuildNightMask(transformFn) { ... }
export function rebuildTerminator(transformFn) { ... }
export function rebuildAnnotations(transformFn, cratersDB, vp, canvasW, canvasH) { ... }

export function toggleGrid() { gridGfx.visible = !gridGfx.visible; }
export function toggleLabels() { annotationsContainer.visible = !annotationsContainer.visible; }
```

**Points clés :**
- Les `Graphics` sont reconstruits seulement quand `layerTransformDirty = true` (ancrage déplacé, nouvelle projection)
- Le viewport (pan/zoom) est géré par `viewportContainer.position` et `.scale` → **0 re-draw** pour un simple pan/zoom
- Le render loop est géré par `app.ticker` (plus besoin de `requestAnimationFrame` manuel)

---

#### [DELETE] [canvas.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/canvas.js)
Remplacé par `pixi_renderer.js`.

---

### Application principale

#### [MODIFY] [app.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/app.js)
Changements majeurs :
1. Convertir en ES module (`import`/`export`)
2. Importer PixiJS renderer : `import * as PixiRenderer from './pixi_renderer.js'`
3. Importer les autres modules locaux
4. `init()` devient `async` (attendre `PixiRenderer.init()`)
5. Remplacer tous les appels `Renderer.drawXxx(ctx, ...)` par `PixiRenderer.rebuildXxx(...)`
6. Le render loop change :
   - Plus de `ctx.clearRect()` + draw calls séquentiels
   - Le ticker PixiJS gère le rendu automatiquement
   - On ne rebuild les Graphics que quand `layerTransformDirty` change
7. Viewport : `PixiRenderer.updateViewport(viewport)` au lieu de passer `vp` à chaque draw call
8. `resizeCanvas()` simplifié — PixiJS gère le resize via `resizeTo: window`

---

### Entry point HTML

#### [MODIFY] [index.html](file:///e:/dev/git_hub/Projet_astroaz_web/index.html)
- Supprimer `<canvas id="main-canvas">` (PixiJS crée son propre canvas)
- Ajouter un `<div id="pixi-container">` pour accueillir le canvas PixiJS
- Convertir les `<script>` en un seul `<script type="module" src="js/app.js">` (les imports se font en cascade)
- Garder les scripts non-module (`astronomy.js`, `craters_data.js`) comme `<script>` classiques (ils exposent des globals `window.Astronomy`, `window.CRATERS_RAW_DATA`) car ils sont trop gros pour être convertis

---

### Module EXIF

#### [MODIFY] [exif.js](file:///e:/dev/git_hub/Projet_astroaz_web/js/exif.js)
- Convertir IIFE → named export

---

## Open Questions

> [!IMPORTANT]
> **astronomy.js et craters_data.js** — Ces deux fichiers sont très gros (430KB + 224KB) et exposent des globales (`window.Astronomy`, `window.CRATERS_RAW_DATA`). Les convertir en ES modules forcerait le navigateur à les parser comme modules (plus lent au chargement). **Proposition :** les garder en `<script>` classiques et les consommer via `window.*` dans les modules. OK pour toi ?

> [!IMPORTANT]
> **Fichiers GeoJSON `_original.js`** — Les 4 fichiers `geojson_data_*_original.js` (7.8MB total) sont des globales JS legacy. Ils semblent ne plus être utilisés (remplacés par le chargement dynamique via `fetch()`). **Peut-on les ignorer/supprimer ?**

---

## Verification Plan

### Automated Tests
1. `npm install -g http-server && http-server -p 8080` — servir l'app localement
2. Vérifier dans le browser :
   - Welcome screen s'affiche avec starfield
   - Upload d'image → l'image apparaît comme Sprite
   - GeoJSON layers se dessinent correctement (couleurs par layer)
   - Pan (clic-droit drag), Zoom (scroll), Rotation (shift+drag) fonctionnent
   - Mode ancrage : pose/déplace/supprime des punaises
   - Deformation TPS visible sur les lignes GeoJSON
   - Grille (G), Labels (L) toggle fonctionnent
   - Terminateur + night mask visibles
   - FPS counter dans la toolbar
   - HUD panels (time, location, mount) fonctionnent

### Manual Verification
- Comparer visuellement l'ancien et le nouveau rendu
- Vérifier la performance FPS avec les 4+ layers GeoJSON chargés
