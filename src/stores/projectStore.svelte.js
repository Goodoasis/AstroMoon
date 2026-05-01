/**
 * AstroMoon — Project Data Store (Svelte 5 Runes)
 * Unified JSON store for project saving, importing, and undo/redo backbone.
 */

class ProjectStore {
    meta = $state({
        date: null,
        location: null,
        weather: null
    });

    geometry = $state({
        bennettData: null,
        tpsAnchors: [],
        transformMatrix: null
    });

    style = $state({
        geojsonThickness: 1.5,
        glowIntensity: 0.5,
        brightness: 1.0,
        contrast: 1.0,
        colorPalette: 0,
        opacity: 1.0,
        labelsVisible: true,
        gridVisible: false
    });

    exportConfig = $state({
        crop: null,
        texts: true, // Boolean for 'Nerd Mode' toggle
        ratio: '16:9'
    });

    signature = $state({
        text: 'AstroMoon',
        styleId: 21,
        bias: 0.75,
        strokeWidth: 0.75,
        activeText: 'AstroMoon',
        activeStyle: 21,
        activeBias: 0.75,
        activeStrokeWidth: 0.75,
        triggerSeed: 0
    });

    reset() {
        this.meta = {
            date: null,
            location: null,
            weather: null
        };
        this.geometry = {
            bennettData: null,
            tpsAnchors: [],
            transformMatrix: null
        };
        this.style = {
            geojsonThickness: 1.5,
            glowIntensity: 0.5,
            brightness: 1.0,
            contrast: 1.0,
            colorPalette: 0,
            opacity: 1.0,
            labelsVisible: true,
            gridVisible: false
        };
        this.exportConfig = {
            crop: null,
            texts: true,
            ratio: '16:9'
        };
        this.signature = {
            text: 'AstroMoon',
            styleId: 21,
            bias: 0.75,
            strokeWidth: 0.75,
            activeText: 'AstroMoon',
            activeStyle: 21,
            activeBias: 0.75,
            activeStrokeWidth: 0.75,
            triggerSeed: 0
        };
    }
}

export const projectStore = new ProjectStore();
