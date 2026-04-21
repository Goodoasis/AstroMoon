/**
 * AstroMoon — UI & Session State Store (Svelte 5 Runes)
 * Workflow 4 Phases + Emergency Mode
 */

let _currentPhase = $state('IMPORT'); // 'IMPORT', 'ALIGN', 'STUDIO', 'EXPORT'

let _cameraSnapshots = $state({
    IMPORT: { tx: null, ty: null, scale: null },
    ALIGN: { tx: null, ty: null, scale: null },
    STUDIO: { tx: null, ty: null, scale: null },
    EXPORT: { tx: null, ty: null, scale: null }
});

let _emergencyMode = $state(false);
let _emergencyValidated = $state(false);

/**
 * Pivot anchor for Emergency Mode.
 * Pins the overlay to a specific crater so libration sliders rotate around it.
 * @type {{ nx: number, ny: number, geoLon: number, geoLat: number, name: string|null } | null}
 */
let _pivotAnchor = $state(null);

/** ID of the anchor currently hovered in the AnchorPanel */
let _hoveredAnchorId = $state(null);

/** Saved ephemeris values before entering emergency mode (for restoration) */
let _savedEphemeris = null;

export const uiState = {
    get currentPhase() { return _currentPhase; }, 
    set currentPhase(v) { _currentPhase = v; },

    get cameraSnapshots() { return _cameraSnapshots; },
    set cameraSnapshots(v) { _cameraSnapshots = v; },

    get emergencyMode() { return _emergencyMode; },
    set emergencyMode(v) { _emergencyMode = v; },

    get emergencyValidated() { return _emergencyValidated; },
    set emergencyValidated(v) { _emergencyValidated = v; },

    get pivotAnchor() { return _pivotAnchor; },
    set pivotAnchor(v) { _pivotAnchor = v; },

    get hoveredAnchorId() { return _hoveredAnchorId; },
    set hoveredAnchorId(v) { _hoveredAnchorId = v; },

    get savedEphemeris() { return _savedEphemeris; },
    set savedEphemeris(v) { _savedEphemeris = v; },

    /**
     * Saves snapshot for a specific phase
     */
    saveSnapshot(phase, tx, ty, scale) {
        _cameraSnapshots[phase] = { tx, ty, scale };
    },

    /**
     * Retrieves a snapshot for a phase
     */
    getSnapshot(phase) {
        return _cameraSnapshots[phase];
    }
};
