/**
 * AstroMoon — UI & Session State Store (Svelte 5 Runes)
 * Workflow 4 Phases + Emergency Mode
 */

class UIState {
    currentPhase = $state('IMPORT'); // 'IMPORT', 'ALIGN', 'STUDIO', 'EXPORT'

    cameraSnapshots = $state({
        IMPORT: { tx: null, ty: null, scale: null },
        ALIGN: { tx: null, ty: null, scale: null },
        STUDIO: { tx: null, ty: null, scale: null },
        EXPORT: { tx: null, ty: null, scale: null }
    });

    emergencyMode = $state(false);
    emergencyValidated = $state(false);

    /**
     * Pivot anchor for Emergency Mode.
     * Pins the overlay to a specific crater so libration sliders rotate around it.
     * @type {{ nx: number, ny: number, geoLon: number, geoLat: number, name: string|null } | null}
     */
    pivotAnchor = $state(null);

    /** ID of the anchor currently hovered in the AnchorPanel */
    hoveredAnchorId = $state(null);

    /** Saved ephemeris values before entering emergency mode (for restoration) */
    savedEphemeris = $state(null);

    /**
     * Saves snapshot for a specific phase
     */
    saveSnapshot(phase, tx, ty, scale) {
        this.cameraSnapshots[phase] = { tx, ty, scale };
    }

    /**
     * Retrieves a snapshot for a phase
     */
    getSnapshot(phase) {
        return this.cameraSnapshots[phase];
    }

    reset() {
        this.currentPhase = 'IMPORT';
        this.emergencyMode = false;
        this.emergencyValidated = false;
        this.pivotAnchor = null;
        this.hoveredAnchorId = null;
        this.savedEphemeris = null;
        this.cameraSnapshots = {
            IMPORT: { tx: null, ty: null, scale: null },
            ALIGN: { tx: null, ty: null, scale: null },
            STUDIO: { tx: null, ty: null, scale: null },
            EXPORT: { tx: null, ty: null, scale: null }
        };
    }
}

export const uiState = new UIState();
