/**
 * AstroMoon — Project Data Store (Svelte 5 Runes)
 * Unified JSON store for project saving, importing, and undo/redo backbone.
 */

let _meta = $state({
    date: null,
    location: null,
    weather: null
});

let _geometry = $state({
    bennettData: null,
    tpsAnchors: [],
    transformMatrix: null
});

let _style = $state({
    geojsonThickness: 1.5,
    glowIntensity: 0.5,
    brightness: 1.0,
    contrast: 1.0,
    colorPalette: 0,
    opacity: 1.0,
    labelsVisible: true,
    gridVisible: false
});

let _exportConfig = $state({
    crop: null,
    texts: true, // Boolean for 'Nerd Mode' toggle
    ratio: '16:9'
});

export const projectStore = {
    get meta() { return _meta; }, set meta(v) { _meta = v; },
    get geometry() { return _geometry; }, set geometry(v) { _geometry = v; },
    get style() { return _style; }, set style(v) { _style = v; },
    get exportConfig() { return _exportConfig; }, set exportConfig(v) { _exportConfig = v; }
};
