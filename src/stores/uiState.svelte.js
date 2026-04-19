/**
 * AstroMoon — UI & Session State Store (Svelte 5 Runes)
 * Workflow 4 Phases
 */

let _currentPhase = $state('IMPORT'); // 'IMPORT', 'ALIGN', 'STUDIO', 'EXPORT'

let _cameraSnapshots = $state({
    IMPORT: { tx: null, ty: null, scale: null },
    ALIGN: { tx: null, ty: null, scale: null },
    STUDIO: { tx: null, ty: null, scale: null },
    EXPORT: { tx: null, ty: null, scale: null }
});

export const uiState = {
    get currentPhase() { return _currentPhase; }, 
    set currentPhase(v) { _currentPhase = v; },

    get cameraSnapshots() { return _cameraSnapshots; },
    set cameraSnapshots(v) { _cameraSnapshots = v; },

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
