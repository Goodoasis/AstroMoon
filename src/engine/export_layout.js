import * as PIXI from 'pixi.js';
import { exportState } from '../stores/exportState.svelte.js';

let exportContainer = null;
let cardsContainer = null;
let highlightGfx = null;
let ghostGfx = null;
let _imgBounds = { x: 0, y: 0, w: 0, h: 0 };
let _viewportContainer = null;

// All placed cards
let placedCards = [];

const ZONES = [
    'top_outside', 'bottom_outside', 'left_outside', 'right_outside',
    'top_inside', 'bottom_inside', 'left_inside', 'right_inside'
];

let zoneAlignments = {};
ZONES.forEach(z => zoneAlignments[z] = 'center');

export function initExportLayout(parentContainer) {
    _viewportContainer = parentContainer;
    exportContainer = new PIXI.Container();
    exportContainer.visible = false;
    parentContainer.addChild(exportContainer);

    highlightGfx = new PIXI.Graphics();
    exportContainer.addChild(highlightGfx);

    cardsContainer = new PIXI.Container();
    exportContainer.addChild(cardsContainer);

    ghostGfx = new PIXI.Container();
    ghostGfx.alpha = 0.6;
    ghostGfx.visible = false;
    exportContainer.addChild(ghostGfx);
}

export function setExportVisibility(visible, imgBounds) {
    if (!exportContainer) return;
    exportContainer.visible = visible;
    if (visible && imgBounds) {
        _imgBounds = imgBounds;
        updateLayout();
    }
}

// ---- HTML Drag & Drop Interface ----

export function updateExportDrag(cardData, screenX, screenY) {
    if (!exportContainer || !exportContainer.visible) return;
    const pt = _viewportContainer.worldTransform.applyInverse({ x: screenX, y: screenY });
    
    // Create a temporary ghost structure if not exists
    if (ghostGfx.children.length === 0 || ghostGfx._cardId !== cardData.id) {
        ghostGfx.removeChildren();
        const tmp = createCardGraphic(cardData);
        ghostGfx.addChild(tmp);
        ghostGfx._cardId = cardData.id;
        ghostGfx._baseW = tmp._baseW;
        ghostGfx._baseH = tmp._baseH;
    }

    const sim = simulateDrop(pt.x, pt.y, cardData, ghostGfx._baseW, ghostGfx._baseH, null);
    
    ghostGfx.visible = true;
    
    // Ghost matches the final size and position exactly
    const ghostInner = ghostGfx.children[0];
    resizeCardGraphic(ghostInner, sim.ghost.w, sim.ghost.h);
    ghostGfx.position.set(sim.ghost.x, sim.ghost.y);

    drawHighlight(sim);
    previewLayout(sim, null);
}

export function endExportDrag(cardData, screenX, screenY) {
    if (!exportContainer || !exportContainer.visible) return;
    const pt = _viewportContainer.worldTransform.applyInverse({ x: screenX, y: screenY });
    
    const w = ghostGfx._baseW || 300;
    const h = ghostGfx._baseH || 100;

    const sim = simulateDrop(pt.x, pt.y, cardData, w, h, null);
    cancelExportDrag();

    if (sim.isValid && sim.zone) {
        const cardGfx = createCardGraphic(cardData);
        cardGfx.zone = sim.zone;
        
        // Initialize position to ghost position so sorting works correctly
        cardGfx.position.x = sim.ghost.x;
        cardGfx.position.y = sim.ghost.y;
        placedCards.push(cardGfx);
        cardsContainer.addChild(cardGfx);
        makeDraggable(cardGfx);
        updateLayout();
    }
}

export function cancelExportDrag() {
    ghostGfx.visible = false;
    highlightGfx.clear();
    updateLayout();
}

// ---- Layout Math ----

function isZoneHorizontal(zone) {
    return zone.includes('top') || zone.includes('bottom');
}

function getVerticalInsideThickness(z, simZone, simMaxW, ignoreCard) {
    if (simZone === z) return simMaxW + 16 * 2;
    const cards = placedCards.filter(c => c.zone === z && c !== ignoreCard);
    if (cards.length === 0) return 0;
    return Math.max(...cards.map(c => c._baseW)) + 16 * 2;
}

/**
 * Simulates dropping a card at (x, y).
 * Calculates the best zone, the insertion index, unifying sizes,
 * limit validation, and the final exact (x,y,w,h) slot.
 */
function simulateDrop(x, y, cardData, cardBaseW, cardBaseH, ignoreCard) {
    const imgL = _imgBounds.x;
    const imgR = _imgBounds.x + _imgBounds.w;
    const imgT = _imgBounds.y;
    const imgB = _imgBounds.y + _imgBounds.h;

    let bestZone = null;
    let minDist = Infinity;

    const dists = {
        'top_outside': Math.abs(y - imgT) + (y > imgT ? 1000 : 0),
        'bottom_outside': Math.abs(y - imgB) + (y < imgB ? 1000 : 0),
        'left_outside': Math.abs(x - imgL) + (x > imgL ? 1000 : 0),
        'right_outside': Math.abs(x - imgR) + (x < imgR ? 1000 : 0),
        
        'top_inside': Math.abs(y - imgT) + (y < imgT ? 1000 : 0),
        'bottom_inside': Math.abs(y - imgB) + (y > imgB ? 1000 : 0),
        'left_inside': Math.abs(x - imgL) + (x < imgL ? 1000 : 0),
        'right_inside': Math.abs(x - imgR) + (x > imgR ? 1000 : 0),
    };

    for (const z of ZONES) {
        let d = dists[z];
        if (z.includes('top') || z.includes('bottom')) {
            if (x < imgL || x > imgR) d += 500;
        } else {
            if (y < imgT || y > imgB) d += 500;
        }
        if (d < minDist) {
            minDist = d;
            bestZone = z;
        }
    }
    if (!bestZone) bestZone = 'top_inside';

    const isHoriz = isZoneHorizontal(bestZone);
    const spacing = 16;
    
    let simCards = placedCards.filter(c => c.zone === bestZone && c !== ignoreCard);
    
    const allBaseW = [...simCards.map(c => c._baseW), cardBaseW];
    const maxW = Math.max(...allBaseW);

    let effImgL = imgL;
    let effImgR = imgR;
    if (bestZone === 'top_inside' || bestZone === 'bottom_inside') {
        effImgL += getVerticalInsideThickness('left_inside', bestZone, maxW, ignoreCard);
        effImgR -= getVerticalInsideThickness('right_inside', bestZone, maxW, ignoreCard);
    }

    let effImgT = imgT;
    let effImgB = imgB;
    
    // Sort visually so insertion index is accurate
    if (isHoriz) simCards.sort((a, b) => (a._targetX ?? a.x) - (b._targetX ?? b.x));
    else simCards.sort((a, b) => (a._targetY ?? a.y) - (b._targetY ?? b.y));

    let index = simCards.length;
    if (isHoriz) {
        for (let i = 0; i < simCards.length; i++) {
            if (x < (simCards[i]._targetX ?? simCards[i].x)) { index = i; break; }
        }
    } else {
        for (let i = 0; i < simCards.length; i++) {
            if (y < (simCards[i]._targetY ?? simCards[i].y)) { index = i; break; }
        }
    }

    // Stable alignment: only update if the zone is empty
    if (simCards.length === 0) {
        if (isHoriz) {
            if (x < effImgL + (effImgR - effImgL) * 0.33) zoneAlignments[bestZone] = 'start';
            else if (x > effImgL + (effImgR - effImgL) * 0.66) zoneAlignments[bestZone] = 'end';
            else zoneAlignments[bestZone] = 'center';
        } else {
            if (y < effImgT + (effImgB - effImgT) * 0.33) zoneAlignments[bestZone] = 'start';
            else if (y > effImgT + (effImgB - effImgT) * 0.66) zoneAlignments[bestZone] = 'end';
            else zoneAlignments[bestZone] = 'center';
        }
    }
    const align = zoneAlignments[bestZone];

    const allBaseH = [...simCards.map(c => c._baseH), cardBaseH];
    const maxH = Math.max(...allBaseH);

    let totalW = 0, totalH = 0;
    const layoutItems = [];
    
    let i_sim = 0;
    for (let i = 0; i <= simCards.length; i++) {
        const isNew = i === index;
        const c = isNew ? null : simCards[i_sim];
        const baseW = isNew ? cardBaseW : c._baseW;
        const baseH = isNew ? cardBaseH : c._baseH;
        
        const w = isHoriz ? baseW : maxW;
        const h = isHoriz ? maxH : baseH;
        
        layoutItems.push({ isNew, w, h, card: c });
        if (!isNew) i_sim++;
        
        if (isHoriz) totalW += w; else totalH += h;
    }

    if (isHoriz) totalW += spacing * (layoutItems.length - 1);
    else totalH += spacing * (layoutItems.length - 1);

    let isValid = true;
    if (isHoriz && totalW > (effImgR - effImgL)) isValid = false;
    if (!isHoriz && totalH > (effImgB - effImgT)) isValid = false;

    let ghostResult = null;

    if (isHoriz) {
        let cx = effImgL + (effImgR - effImgL - totalW) / 2;
        if (align === 'start') cx = effImgL + spacing;
        if (align === 'end') cx = effImgR - totalW - spacing;

        for (const item of layoutItems) {
            let cy = 0;
            if (bestZone === 'top_outside') cy = imgT - maxH / 2 - spacing;
            if (bestZone === 'bottom_outside') cy = imgB + maxH / 2 + spacing;
            if (bestZone === 'top_inside') cy = imgT + maxH / 2 + spacing;
            if (bestZone === 'bottom_inside') cy = imgB - maxH / 2 - spacing;
            
            item.x = cx + item.w / 2;
            item.y = cy;
            cx += item.w + spacing;
            
            if (item.isNew) ghostResult = item;
        }
    } else {
        let cy = effImgT + (effImgB - effImgT - totalH) / 2;
        if (align === 'start') cy = effImgT + spacing;
        if (align === 'end') cy = effImgB - totalH - spacing;

        for (const item of layoutItems) {
            let cx = 0;
            if (bestZone === 'left_outside') cx = imgL - maxW / 2 - spacing;
            if (bestZone === 'right_outside') cx = imgR + maxW / 2 + spacing;
            if (bestZone === 'left_inside') cx = imgL + maxW / 2 + spacing;
            if (bestZone === 'right_inside') cx = imgR - maxW / 2 - spacing;

            item.x = cx;
            item.y = cy + item.h / 2;
            cy += item.h + spacing;

            if (item.isNew) ghostResult = item;
        }
    }

    return { zone: bestZone, align, isValid, ghost: ghostResult, maxW, maxH, items: layoutItems };
}

export function tickExportLayout() {
    if (!exportContainer || !exportContainer.visible) return;
    for (const card of placedCards) {
        if (card._targetX !== undefined && card._targetY !== undefined) {
            card.position.x += (card._targetX - card.position.x) * 0.2;
            card.position.y += (card._targetY - card.position.y) * 0.2;
        }
    }
}

function previewLayout(sim, ignoreCard) {
    const spacing = 16;
    const imgL = _imgBounds.x;
    const imgR = _imgBounds.x + _imgBounds.w;
    const imgT = _imgBounds.y;
    const imgB = _imgBounds.y + _imgBounds.h;

    for (const z of ZONES) {
        if (sim && z === sim.zone) {
            for (const item of sim.items) {
                if (!item.isNew && item.card) {
                    item.card._targetX = item.x;
                    item.card._targetY = item.y;
                    resizeCardGraphic(item.card, item.w, item.h);
                }
            }
        } else {
            const zoneCards = placedCards.filter(c => c.zone === z && c !== ignoreCard);
            if (zoneCards.length === 0) continue;

            const isHoriz = isZoneHorizontal(z);
            if (isHoriz) zoneCards.sort((a, b) => (a._targetX ?? a.x) - (b._targetX ?? b.x));
            else zoneCards.sort((a, b) => (a._targetY ?? a.y) - (b._targetY ?? b.y));

            const maxW = Math.max(...zoneCards.map(c => c._baseW));
            const maxH = Math.max(...zoneCards.map(c => c._baseH));

            let effImgL = imgL;
            let effImgR = imgR;
            let effImgT = imgT;
            let effImgB = imgB;

            if (z === 'top_inside' || z === 'bottom_inside') {
                const simZone = sim ? sim.zone : null;
                const simMaxW = sim ? sim.maxW : 0;
                effImgL += getVerticalInsideThickness('left_inside', simZone, simMaxW, ignoreCard);
                effImgR -= getVerticalInsideThickness('right_inside', simZone, simMaxW, ignoreCard);
            }

            let totalW = 0, totalH = 0;
            for (const c of zoneCards) {
                if (isHoriz) {
                    resizeCardGraphic(c, c._baseW, maxH);
                    totalW += c._baseW;
                } else {
                    resizeCardGraphic(c, maxW, c._baseH);
                    totalH += c._baseH;
                }
            }
            
            if (isHoriz) totalW += spacing * (zoneCards.length - 1);
            else totalH += spacing * (zoneCards.length - 1);

            const align = zoneAlignments[z] || 'center';

            if (isHoriz) {
                let cx = effImgL + (effImgR - effImgL - totalW) / 2;
                if (align === 'start') cx = effImgL + spacing;
                if (align === 'end') cx = effImgR - totalW - spacing;

                for (const c of zoneCards) {
                    let cy = 0;
                    if (z === 'top_outside') cy = imgT - maxH / 2 - spacing;
                    if (z === 'bottom_outside') cy = imgB + maxH / 2 + spacing;
                    if (z === 'top_inside') cy = imgT + maxH / 2 + spacing;
                    if (z === 'bottom_inside') cy = imgB - maxH / 2 - spacing;
                    
                    c._targetX = cx + c._baseW / 2;
                    c._targetY = cy;
                    cx += c._baseW + spacing;
                }
            } else {
                let cy = effImgT + (effImgB - effImgT - totalH) / 2;
                if (align === 'start') cy = effImgT + spacing;
                if (align === 'end') cy = effImgB - totalH - spacing;

                for (const c of zoneCards) {
                    let cx = 0;
                    if (z === 'left_outside') cx = imgL - maxW / 2 - spacing;
                    if (z === 'right_outside') cx = imgR + maxW / 2 + spacing;
                    if (z === 'left_inside') cx = imgL + maxW / 2 + spacing;
                    if (z === 'right_inside') cx = imgR - maxW / 2 - spacing;

                    c._targetX = cx;
                    c._targetY = cy + c._baseH / 2;
                    cy += c._baseH + spacing;
                }
            }
        }
    }
}

function updateLayout() {
    previewLayout(null, null);
    
    // Snap everything to final exactly to avoid drift
    for (const z of ZONES) {
        const zoneCards = placedCards.filter(c => c.zone === z);
        for (const c of zoneCards) {
            if (c._targetX !== undefined) c.position.x = c._targetX;
            if (c._targetY !== undefined) c.position.y = c._targetY;
        }
    }
}

function drawDashedRoundRect(gfx, x, y, w, h, radius, dash = 8, gap = 8) {
    const points = [];
    const step = 2; // sample every 2 pixels
    
    const addLine = (x1, y1, x2, y2) => {
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const steps = Math.max(1, Math.floor(dist / step));
        for (let i = 0; i < steps; i++) {
            points.push({ x: x1 + dx * (i/steps), y: y1 + dy * (i/steps) });
        }
    };
    
    const addArc = (cx, cy, r, startAngle, endAngle) => {
        const dist = Math.abs(endAngle - startAngle) * r;
        const steps = Math.max(1, Math.floor(dist / step));
        for (let i = 0; i < steps; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i/steps);
            points.push({ x: cx + Math.cos(angle)*r, y: cy + Math.sin(angle)*r });
        }
    };
    
    // Build contour points clockwise
    addLine(x + radius, y, x + w - radius, y);
    addArc(x + w - radius, y + radius, radius, -Math.PI/2, 0);
    addLine(x + w, y + radius, x + w, y + h - radius);
    addArc(x + w - radius, y + h - radius, radius, 0, Math.PI/2);
    addLine(x + w - radius, y + h, x + radius, y + h);
    addArc(x + radius, y + h - radius, radius, Math.PI/2, Math.PI);
    addLine(x, y + h - radius, x, y + radius);
    addArc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
    
    if (points.length === 0) return;
    
    // Dash along the path
    let isDrawing = true;
    let distAccum = 0;
    gfx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i-1];
        const p2 = points[i];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        
        distAccum += d;
        
        if (isDrawing) {
            gfx.lineTo(p2.x, p2.y);
            if (distAccum >= dash) {
                isDrawing = false;
                distAccum = 0;
            }
        } else {
            gfx.moveTo(p2.x, p2.y);
            if (distAccum >= gap) {
                isDrawing = true;
                distAccum = 0;
            }
        }
    }
}

function drawHighlight(sim) {
    highlightGfx.clear();
    if (!sim.zone) return;

    const color = sim.isValid ? 0xFFFFFF : 0xFF8C00;
    const alpha = sim.isValid ? 0.05 : 0.2; // Opacité très faible demandée

    const spacing = 16;
    const isHoriz = isZoneHorizontal(sim.zone);
    
    // On calcule la bounding box de la ZONE entière
    let zx, zy, zw, zh;
    
    if (isHoriz) {
        let effImgL = _imgBounds.x;
        let effImgR = _imgBounds.x + _imgBounds.w;
        if (sim.zone === 'top_inside' || sim.zone === 'bottom_inside') {
            effImgL += getVerticalInsideThickness('left_inside', sim.zone, sim.maxW, null);
            effImgR -= getVerticalInsideThickness('right_inside', sim.zone, sim.maxW, null);
        }
        zw = effImgR - effImgL;
        zh = sim.maxH + spacing * 2;
        zx = effImgL;
        zy = 0;
        if (sim.zone === 'top_outside') zy = _imgBounds.y - zh;
        if (sim.zone === 'bottom_outside') zy = _imgBounds.y + _imgBounds.h;
        if (sim.zone === 'top_inside') zy = _imgBounds.y;
        if (sim.zone === 'bottom_inside') zy = _imgBounds.y + _imgBounds.h - zh;
    } else {
        zw = sim.maxW + spacing * 2;
        zh = _imgBounds.h;
        zy = _imgBounds.y;
        zx = 0;
        if (sim.zone === 'left_outside') zx = _imgBounds.x - zw;
        if (sim.zone === 'right_outside') zx = _imgBounds.x + _imgBounds.w;
        if (sim.zone === 'left_inside') zx = _imgBounds.x;
        if (sim.zone === 'right_inside') zx = _imgBounds.x + _imgBounds.w - zw;
    }

    // Draw full zone background
    highlightGfx.roundRect(zx, zy, zw, zh, 12);
    highlightGfx.fill({ color, alpha });
    
    // Draw full zone dashed border
    highlightGfx.stroke({ width: 0 }); // clear
    highlightGfx.beginPath();
    drawDashedRoundRect(highlightGfx, zx, zy, zw, zh, 12, 10, 10);
    highlightGfx.stroke({ width: 2, color: color, alpha: 0.8 });
}

function createCardGraphic(cardData) {
    const card = new PIXI.Container();
    card.interactive = true;
    card.cursor = 'grab';
    card._cardData = cardData;

    const bg = new PIXI.Graphics();
    bg.label = "bg";
    card.addChild(bg);

    const title = new PIXI.Text({
        text: cardData.title,
        style: { fontFamily: 'Space Grotesk', fontSize: 18, fill: '#00E5FF', fontWeight: 'bold' }
    });
    title.label = "title";
    title.position.set(16, 16);
    card.addChild(title);

    const content = new PIXI.Text({
        text: cardData.content,
        style: { fontFamily: 'Inter', fontSize: 14, fill: '#FFFFFF', wordWrap: true, wordWrapWidth: 250 }
    });
    content.label = "content";
    content.position.set(16, 40);
    card.addChild(content);

    const bounds = card.getLocalBounds();
    const padding = 16;
    const w = Math.max(300, bounds.width + padding * 2);
    const h = bounds.height + padding * 2;

    card._baseW = w;
    card._baseH = h;
    
    resizeCardGraphic(card, w, h);

    return card;
}

function resizeCardGraphic(card, w, h) {
    const bg = card.getChildByLabel("bg");
    bg.clear();
    bg.roundRect(-w/2, -h/2, w, h, 12); // Drawn around center pivot
    bg.fill({ color: 0x0A0B10, alpha: 0.85 });
    bg.stroke({ color: 0x00E5FF, width: 2, alpha: 0.5 });
    
    const title = card.getChildByLabel("title");
    const content = card.getChildByLabel("content");
    
    // Reposition text relative to new center
    title.position.set(-w/2 + 16, -h/2 + 16);
    content.position.set(-w/2 + 16, -h/2 + 40);
}

function makeDraggable(card) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    let initialZone = card.zone;

    card.on('pointerdown', (e) => {
        isDragging = true;
        card.cursor = 'grabbing';
        card.visible = false; // Hide the real card completely
        exportState.isDraggingCard = true;  
        
        const globalPt = e.data.global;
        const localPt = card.parent.worldTransform.applyInverse(globalPt);
        offset.x = card.x - localPt.x;
        offset.y = card.y - localPt.y;
        
        cardsContainer.addChild(card); // bring to front
        
        // Setup ghost
        ghostGfx.removeChildren();
        const tmp = createCardGraphic(card._cardData);
        ghostGfx.addChild(tmp);
        ghostGfx._cardId = card._cardData.id;
        ghostGfx._baseW = card._baseW;
        ghostGfx._baseH = card._baseH;
        ghostGfx.visible = true;
    });

    card.on('pointermove', (e) => {
        if (!isDragging) return;
        const globalPt = e.data.global;
        const localPt = card.parent.worldTransform.applyInverse(globalPt);
        
        const sim = simulateDrop(localPt.x + offset.x, localPt.y + offset.y, card._cardData, card._baseW, card._baseH, card);
        
        const ghostInner = ghostGfx.children[0];
        resizeCardGraphic(ghostInner, sim.ghost.w, sim.ghost.h);
        ghostGfx.position.set(sim.ghost.x, sim.ghost.y);

        drawHighlight(sim);
        previewLayout(sim, card);
    });

    card.on('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        card.cursor = 'grab';
        card.visible = true;
        exportState.isDraggingCard = false;
        
        ghostGfx.visible = false;
        highlightGfx.clear();

        const globalPt = e.data.global;
        if (globalPt.x > window.innerWidth - 300) {
            placedCards = placedCards.filter(c => c !== card);
            card.destroy();
            updateLayout();
            return;
        }

        const localPt = card.parent.worldTransform.applyInverse(globalPt);
        const sim = simulateDrop(localPt.x + offset.x, localPt.y + offset.y, card._cardData, card._baseW, card._baseH, card);
        
        if (sim.isValid) {
            card.zone = sim.zone;
            card.position.x = sim.ghost.x;
            card.position.y = sim.ghost.y;
            // Add to placedCards, updateLayout will handle sorting and piling
            placedCards = placedCards.filter(c => c !== card);
            placedCards.push(card);
        }
        updateLayout();
    });

    card.on('pointerupoutside', (e) => {
        if (!isDragging) return;
        isDragging = false;
        card.cursor = 'grab';
        card.visible = true;
        exportState.isDraggingCard = false;
        
        ghostGfx.visible = false;
        highlightGfx.clear();
        updateLayout();
    });
}
