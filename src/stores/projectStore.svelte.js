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
    }
}

export const projectStore = new ProjectStore();
