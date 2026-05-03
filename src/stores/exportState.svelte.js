class ExportState {
    availableCards = $state([
        { id: 'mat', type: 'equipment', title: 'MATÉRIEL', content: 'Télescope 200/800\nCaméra ASI533MC Pro\nFocale: 800mm (f/4)' },
        { id: 'eph', type: 'ephemeris', title: 'ÉPHÉMÉRIDES', content: 'Phase: 80%\nAge: 12.3 jours\nIllumination: 75%' },
        { id: 'geo', type: 'location', title: 'GÉOLOCALISATION', content: 'Lat: 48.85 N\nLon: 2.35 E\nAlt: 35m' },
        { id: 'txt', type: 'text', title: 'TEXTE LIBRE', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' }
    ]);

    isDraggingCard = $state(false);
    draggedCardData = $state(null);

    reset() {
        this.isDraggingCard = false;
        this.draggedCardData = null;
    }
}

export const exportState = new ExportState();
