---
trigger: model_decision
description: Modification du moteur de rendu PixiJS
---

---
name: pixijs-2d
description: Fast, lightweight 2D rendering engine for creating interactive graphics, particle effects, and canvas-based applications using WebGL/WebGPU. Use this skill when building 2D games, particle systems, interactive canvases, sprite animations, or UI overlays on 3D scenes. Triggers on tasks involving PixiJS, 2D rendering, sprite sheets, particle effects, filters, or high-performance canvas graphics. Alternative to Canvas2D with WebGL acceleration for rendering thousands of sprites at 60 FPS.
---

# PixiJS 2D Rendering Skill

Fast, lightweight 2D rendering engine for creating interactive graphics, particle effects, and canvas-based applications using WebGL/WebGPU.

---

## When to Use This Skill

Trigger this skill when you encounter:
- "Create 2D particle effects" or "animated particles"
- "2D sprite animation" or "sprite sheet handling"
- "Interactive canvas graphics" or "2D game"
- "UI overlays on 3D scenes" or "HUD layer"
- "Draw shapes programmatically" or "vector graphics API"
- "Optimize rendering performance" or "thousands of sprites"
- "Apply visual filters" or "blur/displacement effects"
- "Lightweight 2D engine" or "alternative to Canvas2D"

**Use PixiJS for**: High-performance 2D rendering (up to 100,000+ sprites), particle systems, interactive UI, 2D games, data visualization with WebGL acceleration.

**Don't use for**: 3D graphics (use Three.js/R3F), simple animations (use Motion/GSAP), basic DOM manipulation.

---

## Core Concept

### 1. Application & Renderer

The entry point for PixiJS applications:

```javascript
import { Application } from 'pixi.js';

const app = new Application();

await app.init({
  width: 800,
  height: 600,
  backgroundColor: 0x1099bb,
  antialias: true,  // Smooth edges
  resolution: window.devicePixelRatio || 1
});

document.body.appendChild(app.canvas);
```

**Key Properties**:
- `app.stage`: Root container for all display objects
- `app.renderer`: WebGL/WebGPU renderer instance
- `app.ticker`: Update loop for animations
- `app.screen`: Canvas dimensions

---

### 2. Sprites & Textures

Core visual elements loaded from images:

```javascript
import { Assets, Sprite } from 'pixi.js';

// Load texture
const texture = await Assets.load('path/to/image.png');

// Create sprite
const sprite = new Sprite(texture);
sprite.anchor.set(0.5);  // Center pivot
sprite.position.set(400, 300);
sprite.scale.set(2);  // 2x scale
sprite.rotation = Math.PI / 4;  // 45 degrees
sprite.alpha = 0.8;  // 80% opacity
sprite.tint = 0xff0000;  // Red tint

app.stage.addChild(sprite);
```

**Quick Creation**:
```javascript
const sprite = Sprite.from('path/to/image.png');
```

---

### 3. Graphics API

Draw vector shapes programmatically:

```javascript
import { Graphics } from 'pixi.js';

const graphics = new Graphics();

// Rectangle
graphics.rect(50, 50, 100, 100).fill('blue');

// Circle with stroke
graphics.circle(200, 100, 50).fill('red').stroke({ width: 2, color: 'white' });

// Complex path
graphics
  .moveTo(300, 100)
  .lineTo(350, 150)
  .lineTo(250, 150)
  .closePath()
  .fill({ color: 0x00ff00, alpha: 0.5 });

app.stage.addChild(graphics);
```

**SVG Support**:
```javascript
graphics.svg('<svg><path d="M 100 350 q 150 -300 300 0" /></svg>');
```

---

### 4. ParticleContainer

Optimized container for rendering thousands of sprites:

```javascript
import { ParticleContainer, Particle, Texture } from 'pixi.js';

const texture = Texture.from('particle.png');

const container = new ParticleContainer({
  dynamicProperties: {
    position: true,   // Allow position updates
    scale: false,     // Static scale
    rotation: false,  // Static rotation
    color: false      // Static color
  }
});

// Add 10,000 particles
for (let i = 0; i < 10000; i++) {
  const particle = new Particle({
    texture,
    x: Math.random() * 800,
    y: Math.random() * 600
  });

  container.addParticle(particle);
}

app.stage.addChild(container);
```

**Performance**: Up to 10x faster than regular Container for static properties.

---

### 5. Filters

Apply per-pixel effects using WebGL shaders:

```javascript
import { BlurFilter, DisplacementFilter, ColorMatrixFilter } from 'pixi.js';

// Blur
const blurFilter = new BlurFilter({ strength: 8, quality: 4 });
sprite.filters = [blurFilter];

// Multiple filters
sprite.filters = [
  new BlurFilter({ strength: 4 }),
  new ColorMatrixFilter()  // Color transforms
];

// Custom filter area for performance
sprite.filterArea = new Rectangle(0, 0, 200, 100);
```

**Available Filters**:
- `BlurFilter`: Gaussian blur
- `ColorMatrixFilter`: Color transformations (sepia, grayscale, etc.)
- `DisplacementFilter`: Warp/distort pixels
- `AlphaFilter`: Flatten alpha across children
- `NoiseFilter`: Random grain effect
- `FXAAFilter`: Anti-aliasing

---

### 6. Text Rendering

Display text with styling:

```javascript
import { Text, BitmapText, TextStyle } from 'pixi.js';

// Standard Text
const style = new TextStyle({
  fontFamily: 'Arial',
  fontSize: 36,
  fill: '#ffffff',
  stroke: { color: '#000000', width: 4 },
  filters: [new BlurFilter()]  // Bake filter into texture
});

const text = new Text({ text: 'Hello PixiJS!', style });
text.position.set(100, 100);

// BitmapText (faster for dynamic text)
const bitmapText = new BitmapText({
  text: 'Score: 0',
  style: { fontFamily: 'MyBitmapFont', fontSize: 24 }
});
```

**Performance Tip**: Use `BitmapText` for frequently changing text (scores, counters).

---

## Common Patterns

### Pattern 1: Basic Interactive Sprite

```javascript
import { Application, Assets, Sprite } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

const texture = await Assets.load('bunny.png');
const bunny = new Sprite(texture);

bunny.anchor.set(0.5);
bunny.position.set(400, 300);
bunny.eventMode = 'static';  // Enable interactivity
bunny.cursor = 'pointer';

// Events
bunny.on('pointerdown', () => {
  bunny.scale.set(1.2);
});

bunny.on('pointerup', () => {
  bunny.scale.set(1.0);
});

bunny.on('pointerover', () => {
  bunny.tint = 0xff0000;  // Red on hover
});

bunny.on('pointerout', () => {
  bunny.tint = 0xffffff;  // Reset
});

app.stage.addChild(bunny);

// Animation loop
app.ticker.add((ticker) => {
  bunny.rotation += 0.01 * ticker.deltaTime;
});
```

---

### Pattern 2: Drawing with Graphics

```javascript
import { Graphics, Application } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

const graphics = new Graphics();

// Rectangle with gradient
graphics.rect(50, 50, 200, 100).fill({
  color: 0x3399ff,
  alpha: 0.8
});

// Circle with stroke
graphics.circle(400, 300, 80)
  .fill('yellow')
  .stroke({ width: 4, color: 'orange' });

// Star shape
graphics.star(600, 300, 5, 50, 0).fill({ color: 0xffdf00, alpha: 0.9 });

// Custom path
graphics
  .moveTo(100, 400)
  .bezierCurveTo(150, 300, 250, 300, 300, 400)
  .stroke({ width: 3, color: 'white' });

// Holes
graphics
  .rect(450, 400, 150, 100).fill('red')
  .beginHole()
  .circle(525, 450, 30)
  .endHole();

app.stage.addChild(graphics);

// Dynamic drawing (animation)
app.ticker.add(() => {
  graphics.clear();

  const time = Date.now() * 0.001;
  const x = 400 + Math.cos(time) * 100;
  const y = 300 + Math.sin(time) * 100;

  graphics.circle(x, y, 20).fill('cyan');
});
```

---

### Pattern 3: Particle System with ParticleContainer

```javascript
import { Application, ParticleContainer, Particle, Texture } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600, backgroundColor: 0x000000 });
document.body.appendChild(app.canvas);

const texture = Texture.from('spark.png');

const particles = new ParticleContainer({
  dynamicProperties: {
    position: true,  // Update positions every frame
    scale: true,     // Fade out by scaling
    rotation: true,  // Rotate particles
    color: false     // Static color
  }
});

const particleData = [];

// Create particles
for (let i = 0; i < 5000; i++) {
  const particle = new Particle({
    texture,
    x: 400,
    y: 300,
    scaleX: 0.5,
    scaleY: 0.5
  });

  particles.addParticle(particle);

  particleData.push({
    particle,
    vx: (Math.random() - 0.5) * 5,
    vy: (Math.random() - 0.5) * 5 - 2,  // Slight upward bias
    life: 1.0
  });
}

app.stage.addChild(particles);

// Update loop
app.ticker.add((ticker) => {
  particleData.forEach(data => {
    // Physics
    data.particle.x += data.vx * ticker.deltaTime;
    data.particle.y += data.vy * ticker.deltaTime;
    data.vy += 0.1 * ticker.deltaTime;  // Gravity

    // Fade out
    data.life -= 0.01 * ticker.deltaTime;
    data.particle.scaleX = data.life * 0.5;
    data.particle.scaleY = data.life * 0.5;

    // Reset particle
    if (data.life <= 0) {
      data.particle.x = 400;
      data.particle.y = 300;
      data.vx = (Math.random() - 0.5) * 5;
      data.vy = (Math.random() - 0.5) * 5 - 2;
      data.life = 1.0;
    }
  });
});
```

---

### Pattern 4: Applying Filters

```javascript
import { Application, Sprite, Assets, BlurFilter, DisplacementFilter } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

const texture = await Assets.load('photo.jpg');
const photo = new Sprite(texture);
photo.position.set(100, 100);

// Blur filter
const blurFilter = new BlurFilter({ strength: 5, quality: 4 });

// Displacement filter (wavy effect)
const displacementTexture = await Assets.load('displacement.jpg');
const displacementSprite = Sprite.from(displacementTexture);
const displacementFilter = new DisplacementFilter({
  sprite: displacementSprite,
  scale: 50
});

// Apply multiple filters
photo.filters = [blurFilter, displacementFilter];

// Optimize with filterArea
photo.filterArea = new Rectangle(0, 0, photo.width, photo.height);

app.stage.addChild(photo);

// Animate displacement
app.ticker.add((ticker) => {
  displacementSprite.x += 1 * ticker.deltaTime;
  displacementSprite.y += 0.5 * ticker.deltaTime;
});
```

---

### Pattern 5: Custom Filter with Shaders

```javascript
import { Filter, GlProgram } from 'pixi.js';

const vertex = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord() {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main() {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

const fragment = `
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform float uTime;

  void main() {
    vec2 uv = vTextureCoord;

    // Wave distortion
    float wave = sin(uv.y * 10.0 + uTime) * 0.05;
    vec4 color = texture(uTexture, vec2(uv.x + wave, uv.y));

    gl_FragColor = color;
  }
`;

const customFilter = new Filter({
  glProgram: new GlProgram({ fragment, vertex }),
  resources: {
    timeUniforms: {
      uTime: { value: 0.0, type: 'f32' }
    }
  }
});

sprite.filters = [customFilter];

// Update uniform
app.ticker.add((ticker) => {
  customFilter.resources.timeUniforms.uniforms.uTime += 0.04 * ticker.deltaTime;
});
```

---

### Pattern 6: Sprite Sheet Animation

```javascript
import { Application, Assets, AnimatedSprite } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

// Load sprite sheet
await Assets.load('spritesheet.json');

// Create animation from frames
const frames = [];
for (let i = 0; i < 10; i++) {
  frames.push(Texture.from(`frame_${i}.png`));
}

const animation =