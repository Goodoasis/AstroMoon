/**
 * AstroMoon — Canvas Renderer
 * Handles all rendering: background image, GeoJSON overlay, anchors, debug grid.
 * 
 * VIEWPORT: A separate camera transform (pan + zoom) is applied to EVERYTHING.
 * This allows the user to navigate freely without being stuck off-frame.
 * Pipeline: world coords → viewport transform → screen pixels
 */

const Renderer = (() => {
  'use strict';

  // ─── Layer color palette (for distinguishing merged layers) ───
  const LAYER_PALETTE = [
    { stroke: 'rgba(0, 212, 255, 0.75)',   fill: 'rgba(0, 212, 255, 0.06)',   name: 'Cyan' },
    { stroke: 'rgba(255, 107, 53, 0.75)',   fill: 'rgba(255, 107, 53, 0.06)',   name: 'Orange' },
    { stroke: 'rgba(163, 106, 255, 0.75)',  fill: 'rgba(163, 106, 255, 0.06)',  name: 'Violet' },
    { stroke: 'rgba(255, 215, 0, 0.75)',    fill: 'rgba(255, 215, 0, 0.06)',    name: 'Gold' },
    { stroke: 'rgba(0, 255, 136, 0.75)',    fill: 'rgba(0, 255, 136, 0.06)',    name: 'Vert' },
    { stroke: 'rgba(255, 105, 180, 0.75)',  fill: 'rgba(255, 105, 180, 0.06)',  name: 'Rose' },
    { stroke: 'rgba(100, 200, 255, 0.75)',  fill: 'rgba(100, 200, 255, 0.06)',  name: 'Bleu clair' },
    { stroke: 'rgba(255, 160, 80, 0.75)',   fill: 'rgba(255, 160, 80, 0.06)',   name: 'Pêche' },
  ];

  const LAYER_POINT_COLOR = '#00d4ff';
  const ANCHOR_SRC_COLOR = '#ff6b35';
  const ANCHOR_DST_COLOR = '#00ff88';
  const ANCHOR_LINE_COLOR = 'rgba(255, 255, 255, 0.3)';
  const GRID_COLOR = 'rgba(255, 255, 255, 0.7)';
  const LABEL_COLOR = 'rgba(255, 255, 255, 1.0)';

  let showGrid = false;
  let showLabels = false;

  /**
   * Get color info for a given layer index.
   */
  function getLayerColor(layerIndex) {
    return LAYER_PALETTE[layerIndex % LAYER_PALETTE.length];
  }

  /**
   * Get the palette (for UI legend).
   */
  function getPalette() {
    return LAYER_PALETTE;
  }

  /**
   * Draw the background moon image, transformed by the viewport.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLImageElement} image
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {Object} vp - Viewport {tx, ty, scale}
   */
  function drawBackground(ctx, image, canvasW, canvasH, vp) {
    if (!image) return;

    // Contain image within canvas (base position)
    const imgAspect = image.width / image.height;
    const canvasAspect = canvasW / canvasH;

    let drawW, drawH, drawX, drawY;
    if (imgAspect > canvasAspect) {
      drawW = canvasW;
      drawH = canvasW / imgAspect;
    } else {
      drawH = canvasH;
      drawW = canvasH * imgAspect;
    }
    drawX = (canvasW - drawW) / 2;
    drawY = (canvasH - drawH) / 2;

    // Apply viewport transform
    ctx.save();
    ctx.translate(vp.tx, vp.ty);
    ctx.scale(vp.scale, vp.scale);
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  /**
   * Draw GeoJSON features using pre-calculated rendered coordinates.
   * Each feature has a layerIndex for color differentiation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} projectedFeatures - Features with renderedCoords and layerIndex
   * @param {Object} vp - Viewport {tx, ty, scale}
   * @param {boolean} hasDeformation - Whether TPS is active
   */
  function drawGeoJSON(ctx, projectedFeatures, vp, hasDeformation) {
    if (!projectedFeatures || projectedFeatures.length === 0) return;

    ctx.save();
    ctx.translate(vp.tx, vp.ty);
    ctx.scale(vp.scale, vp.scale);

    ctx.lineWidth = 1.5 / vp.scale; // Keep consistent line width
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let currentLayerIndex = -1;

    for (const feature of projectedFeatures) {
      if (!feature.renderedCoords) continue;

      // Set color based on layer index
      if (feature.layerIndex !== currentLayerIndex) {
        currentLayerIndex = feature.layerIndex;
        const colors = getLayerColor(currentLayerIndex);
        ctx.strokeStyle = colors.stroke;
        ctx.fillStyle = colors.fill;
      }

      if (feature.type === 'polygon') {
        ctx.beginPath();
        let hasAnyPolygons = false;
        for (const ring of feature.renderedCoords) {
          if (ring.length < 2) continue;
          let started = false;
          for (let i = 0; i < ring.length; i++) {
            if (ring[i].x === null) {
              started = false; 
              continue;
            }
            if (!started) {
              ctx.moveTo(ring[i].x, ring[i].y);
              started = true;
            } else {
              ctx.lineTo(ring[i].x, ring[i].y);
            }
          }
          if (started) {
             ctx.closePath();
             hasAnyPolygons = true;
          }
        }
        if (hasAnyPolygons) {
           ctx.fill('evenodd');
           ctx.stroke();
        }
      } else {
        // Point and LineString types
        for (const ring of feature.renderedCoords) {
          if (ring.length < 2 && feature.type !== 'point') continue;

          if (feature.type === 'point') {
            const pointColor = getLayerColor(currentLayerIndex).stroke;
            for (const pt of ring) {
              if (pt.x === null) continue; // Skip hidden points
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 3 / vp.scale, 0, Math.PI * 2);
              ctx.fillStyle = pointColor;
              ctx.fill();
            }
          } else if (feature.type === 'line') {
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < ring.length; i++) {
              if (ring[i].x === null) {
                started = false; // Break the line
                continue;
              }
              if (!started) {
                ctx.moveTo(ring[i].x, ring[i].y);
                started = true;
              } else {
                ctx.lineTo(ring[i].x, ring[i].y);
              }
            }
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  }

  function drawNightMask(ctx, transformFn, vp) {
    const state = window.appMoonState;
    if (!state || !state.terminatorGeoPoints || state.terminatorGeoPoints.length === 0) return;

    const pts = [];
    for (const [lon, lat] of state.terminatorGeoPoints) {
      pts.push(GeoJSON.projectPoint(lon, lat));
    }

    const n = pts.length;
    let startIdx = 0;
    let found = false;
    for (let i = 0; i < n; i++) {
       if (pts[i] !== null && pts[(i - 1 + n) % n] === null) {
           startIdx = i;
           found = true;
           break;
       }
    }
    if (!found) {
       startIdx = pts.findIndex(p => p !== null);
       if (startIdx === -1) return;
    }

    const visiblePoints = [];
    for (let i = 0; i < n; i++) {
        const p = pts[(startIdx + i) % n];
        if (p !== null) visiblePoints.push(p);
        else if (visiblePoints.length > 0) break;
    }

    if (visiblePoints.length < 2) return;

    const first = visiblePoints[0];
    const last = visiblePoints[visiblePoints.length - 1];

    ctx.save();
    ctx.translate(vp.tx, vp.ty);
    ctx.scale(vp.scale, vp.scale);

    ctx.beginPath();
    let moved = false;
    for (const p of visiblePoints) {
       const pt = transformFn(p[0], p[1]);
       if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
       else { ctx.lineTo(pt.x, pt.y); }
    }

    const cx = 0.5, cy = 0.5;
    const aLast = Math.atan2(last[1] - cy, last[0] - cx);
    const aFirst = Math.atan2(first[1] - cy, first[0] - cx);

    let diff = aFirst - aLast;
    if (diff < 0) diff += Math.PI * 2;
    const aMid1 = aLast + diff / 2;
    const testNx = 0.5 + 0.49 * Math.cos(aMid1);
    const testNy = 0.5 + 0.49 * Math.sin(aMid1);
    
    let isNight1 = false;
    const geo = GeoJSON.inverseProject(testNx, testNy);
    if (geo) {
        const sLon = state.sunLon * Math.PI / 180;
        const sLat = (state.sunLat || 0) * Math.PI / 180;
        const geoLon = geo.lon * Math.PI / 180;
        const geoLat = geo.lat * Math.PI / 180;
        const px = Math.cos(geoLat) * Math.cos(geoLon);
        const py = Math.cos(geoLat) * Math.sin(geoLon);
        const pz = Math.sin(geoLat);
        const sx = Math.cos(sLat) * Math.cos(sLon);
        const sy = Math.cos(sLat) * Math.sin(sLon);
        const sz = Math.sin(sLat);
        isNight1 = (sx*px + sy*py + sz*pz) < 0;
    } else {
        // Fallback robust check (if test point fails inversion due to floating point near limb)
        const testNx2 = 0.5 + 0.45 * Math.cos(aMid1);
        const testNy2 = 0.5 + 0.45 * Math.sin(aMid1);
        const geo2 = GeoJSON.inverseProject(testNx2, testNy2);
        if (geo2) {
            const sLon = state.sunLon * Math.PI / 180;
            const sLat = (state.sunLat || 0) * Math.PI / 180;
            const geoLon = geo2.lon * Math.PI / 180;
            const geoLat = geo2.lat * Math.PI / 180;
            const px = Math.cos(geoLat) * Math.cos(geoLon);
            const py = Math.cos(geoLat) * Math.sin(geoLon);
            const pz = Math.sin(geoLat);
            const sx = Math.cos(sLat) * Math.cos(sLon);
            const sy = Math.cos(sLat) * Math.sin(sLon);
            const sz = Math.sin(sLat);
            isNight1 = (sx*px + sy*py + sz*pz) < 0;
        }
    }

    const steps = 40;
    if (isNight1) {
        for(let i=1; i<=steps; i++) {
           let a = aLast + diff * (i / steps);
           let nx = 0.5 + 0.5 * Math.cos(a);
           let ny = 0.5 + 0.5 * Math.sin(a);
           let pt = transformFn(nx, ny);
           ctx.lineTo(pt.x, pt.y);
        }
    } else {
        let diffCCW = aLast - aFirst;
        if (diffCCW < 0) diffCCW += Math.PI * 2;
        for(let i=1; i<=steps; i++) {
           let a = aLast - diffCCW * (i / steps);
           let nx = 0.5 + 0.5 * Math.cos(a);
           let ny = 0.5 + 0.5 * Math.sin(a);
           let pt = transformFn(nx, ny);
           ctx.lineTo(pt.x, pt.y);
        }
    }

    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 6, 12, 0.75)'; // Assombrissement type espace profond
    ctx.fill();
    ctx.restore();
  }

  function drawTerminator(ctx, transformFn, vp) {
    const state = window.appMoonState;
    if (!state || !state.terminatorGeoPoints || state.terminatorGeoPoints.length === 0) return;

    ctx.save();
    ctx.translate(vp.tx, vp.ty);
    ctx.scale(vp.scale, vp.scale);

    ctx.globalAlpha = 1.0; // Ensure terminator is opaque
    ctx.strokeStyle = '#e0faff'; // Plus blanc/cyan
    ctx.lineWidth = 3.0 / vp.scale; // Plus épais
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 25; // Néon plus fort
    ctx.shadowColor = '#00d4ff';

    ctx.beginPath();
    let moved = false;
    for (const [lon, lat] of state.terminatorGeoPoints) {
      const proj = GeoJSON.projectPoint(lon, lat);
      if (proj) {
        const pt = transformFn(proj[0], proj[1]);
        if (!moved) {
          ctx.moveTo(pt.x, pt.y);
          moved = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      } else {
        moved = false;
      }
    }
    ctx.stroke();

    // Ajouter un "core" blanc intense par dessus pour accentuer l'effet néon
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.5 / vp.scale;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw anchor markers using Global-only transform, within viewport.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} anchors
   * @param {Object} vp - Viewport {tx, ty, scale}
   * @param {number|null} activeAnchorId
   */
  function drawAnchors(ctx, anchors, vp, activeAnchorId) {
    if (anchors.length === 0) return;

    ctx.save();
    ctx.translate(vp.tx, vp.ty);
    ctx.scale(vp.scale, vp.scale);

    const invScale = 1 / vp.scale; // For consistent marker sizes

    for (const a of anchors) {
      const src = Transform.apply(a.sx, a.sy);
      const dst = Transform.apply(a.dx, a.dy);
      const isActive = a.id === activeAnchorId;

      const dist = Math.hypot(dst.x - src.x, dst.y - src.y);
      if (dist > 2) {
        // Connecting line
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(dst.x, dst.y);
        ctx.strokeStyle = ANCHOR_LINE_COLOR;
        ctx.lineWidth = 1 * invScale;
        ctx.setLineDash([4 * invScale, 4 * invScale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Source (orange)
        ctx.beginPath();
        ctx.arc(src.x, src.y, 5 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = ANCHOR_SRC_COLOR;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1 * invScale;
        ctx.stroke();
      }

      // Destination (green)
      const dstRadius = (isActive ? 9 : 7) * invScale;

      if (isActive) {
        ctx.beginPath();
        ctx.arc(dst.x, dst.y, 18 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(dst.x, dst.y, dstRadius, 0, Math.PI * 2);
      ctx.fillStyle = ANCHOR_DST_COLOR;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = (isActive ? 2.5 : 1.5) * invScale;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `${10 * invScale}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`#${a.id}`, dst.x, dst.y - dstRadius - 6 * invScale);
    }

    ctx.restore();
  }

  /**
   * Draw georeferenced globally absolute grid (Orthographic spherical view).
   */
  function drawGrid(ctx, transformFn, vp) {
    if (!showGrid) return;

    ctx.save();
    ctx.translate(vp.tx, vp.ty);
    ctx.scale(vp.scale, vp.scale);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1.5 / vp.scale;

    // Draw text labels
    ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'; // Gold for grid labels
    ctx.font = `${12 / vp.scale}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    function getNorm(lon, lat) {
      const proj = GeoJSON.projectPoint(lon, lat);
      if (!proj) return null;
      return { nx: proj[0], ny: proj[1] };
    }

    for (let lon = -90; lon <= 90; lon += 10) {
      ctx.beginPath();
      let moved = false;
      for (let lat = 90; lat >= -90; lat -= 2) {
        const norm = getNorm(lon, lat);
        if (!norm) continue;
        const pt = transformFn(norm.nx, norm.ny);
        if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      if (lon % 30 === 0 && lon !== -90 && lon !== 90) { 
        const norm = getNorm(lon, 0); 
        if (norm) {
          const pt = transformFn(norm.nx, norm.ny);
          ctx.fillText(` ${lon}°`, pt.x, pt.y - (10 / vp.scale));
        }
      }
    }

    // Latitude lines [-90 to +90]
    ctx.textAlign = 'left';
    for (let lat = -90; lat <= 90; lat += 10) {
      ctx.beginPath();
      let moved = false;
      for (let lon = -90; lon <= 90; lon += 2) {
        const norm = getNorm(lon, lat);
        if (!norm) continue;
        const pt = transformFn(norm.nx, norm.ny);
        if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Label at Prime Meridian (lon 0)
      if (lat % 20 === 0 && lat !== 0) {
        const norm = getNorm(0, lat);
        const pt = transformFn(norm.nx, norm.ny);
        ctx.fillText(` ${lat}°`, pt.x + (5 / vp.scale), pt.y);
      }
    }

    // Draw horizon circle (outline of the moon)
    ctx.beginPath();
    for (let angle = 0; angle <= 360; angle += 5) {
      // The horizon is just a circle of radius 0.5 at center 0.5, 0.5
      const rad = angle * Math.PI / 180;
      const nx = 0.5 + 0.5 * Math.cos(rad);
      const ny = 0.5 + 0.5 * Math.sin(rad);
      const pt = transformFn(nx, ny);
      if (angle === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, 0.6)`;
    ctx.lineWidth = 1.5 / vp.scale;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw dynamic crater annotations based on Zoom Level (LOD).
   */
  function drawAnnotations(ctx, transformFn, vp, cratersDB, canvasW, canvasH) {
    if (!showLabels || !cratersDB || cratersDB.length === 0) return;

    ctx.save();

    // High quality text rendering
    ctx.font = 'bold 15px Arial, sans-serif'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dynamic Level of Detail threshold
    // 10km ensures most visible features are labeled.
    const minDiameter = 10 / vp.scale; 
    const margin = 150; // Screen boundary margin in pixels
    // Determine opacity based on size relative to threshold
    function getLayerOpacity(diam, minD) {
      if (diam > minD * 3) return 1.0; 
      // Fades from 0.4 (clearly visible) to 1.0
      return 0.4 + (0.6 * Math.max(0, (diam - minD) / (minD * 2)));
    }

      for (const crater of cratersDB) {
      if (crater.diameter >= minDiameter && crater.name !== "--" && crater.nx !== null) {
        const pt = transformFn(crater.nx, crater.ny);
        
        const sx = pt.x * vp.scale + vp.tx;
        const sy = pt.y * vp.scale + vp.ty;
        
        if (sx > -200 && sx < canvasW + 200 && sy > -200 && sy < canvasH + 200) {
            const txt = crater.name;
            const tw = ctx.measureText(txt).width;
            
            // Set opacity based on size
            let op = getLayerOpacity(crater.diameter, minDiameter);

            // ─── Shadow detection (Dimming) ───
            if (window.appMoonState && typeof window.appMoonState.sunLon === 'number') {
                const rLon = crater.longitude * Math.PI / 180;
                const rLat = crater.latitude * Math.PI / 180;
                const sLon = window.appMoonState.sunLon * Math.PI / 180;
                const sLat = window.appMoonState.sunLat * Math.PI / 180;
                
                // Lambertian illumination check
                const cosI = Math.sin(rLat) * Math.sin(sLat) + Math.cos(rLat) * Math.cos(sLat) * Math.cos(rLon - sLon);
                if (cosI < 0) {
                    op *= 0.25; // Significant dimming in shadow
                } else if (cosI < 0.1) {
                    op *= 0.25 + (0.75 * (cosI / 0.1)); // Smooth transition at terminator
                }
            }
            
            ctx.globalAlpha = op;

            // 1. Semi-transparent dark "pill" background for maximum contrast
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(sx - (tw/2) - 6, sy - 14 - 9, tw + 12, 18, 6);
            } else {
                ctx.rect(sx - (tw/2) - 6, sy - 14 - 9, tw + 12, 18);
            }
            ctx.fill();
            
            // 2. High-contrast white text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(txt, sx, sy - 14);
            
            // 3. Clear center marker (dot)
            ctx.fillStyle = 'rgba(255, 75, 75, 1)';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1.0; // Reset for next iteration
        }
      }
    }

    ctx.restore();
  }


  function toggleLabels() {
    showLabels = !showLabels;
    return showLabels;
  }

  function isLabelsEnabled() {
    return showLabels;
  }

  function toggleGrid() {
    showGrid = !showGrid;
    return showGrid;
  }

  return {
    drawBackground,
    drawGeoJSON,
    drawAnchors,
    drawGrid,
    drawAnnotations,
    drawNightMask,
    drawTerminator,
    toggleGrid,
    toggleLabels,
    showLabels: isLabelsEnabled,
    getLayerColor,
    getPalette
  };
})();
