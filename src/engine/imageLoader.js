/**
 * AstroMoon — Image & Metadata Loader
 * Handles file uploads, EXIF parsing, date/GPS extraction.
 */

import { viewportState } from '../stores/viewportState.svelte.js';
import { temporalState } from '../stores/temporalState.svelte.js';
import { spatialState } from '../stores/spatialState.svelte.js';
import { layerState } from '../stores/layerState.svelte.js';
import { MiniExif } from './exif.js';
import { PixiRenderer } from './pixi_renderer.js';
import { uiState } from '../stores/uiState.svelte.js';
import { Transform } from './transform.js';
import { Anchors } from './anchors.js';

export function extractDateFromName(filename) {
  // Support YYYY-MM-DD-HHhMM etc...
  const rx1 = /(\d{4})[-\._\s]?(\d{2})[-\._\s]?(\d{2})(?:[-\._\sTt]*(\d{2})[-\._\shH:]*(\d{2})?[-\._\smM:]*(\d{2})?[sS]?)?/;
  // Support DD-MM-YYYY-HHhMM etc...
  const rx2 = /(\d{2})[-\._\s]?(\d{2})[-\._\s]?(\d{4})(?:[-\._\sTt]*(\d{2})[-\._\shH:]*(\d{2})?[-\._\smM:]*(\d{2})?[sS]?)?/;

  let m = filename.match(rx1);
  if (m && m[1] >= 1900 && m[1] <= 2100 && m[2] >= 1 && m[2] <= 12 && m[3] >= 1 && m[3] <= 31) {
    const d = new Date(m[1], m[2] - 1, m[3], m[4] || 0, m[5] || 0, m[6] || 0);
    if (!isNaN(d.getTime())) return d;
  }

  m = filename.match(rx2);
  if (m && m[3] >= 1900 && m[3] <= 2100 && m[2] >= 1 && m[2] <= 12 && m[1] >= 1 && m[1] <= 31) {
    const d = new Date(m[3], m[2] - 1, m[1], m[4] || 0, m[5] || 0, m[6] || 0);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export async function handleImageUpload(file, dispatchToast) {
  if (!file) return;

  const parsedNameDate = extractDateFromName(file.name);
  temporalState.parsedNameDate = parsedNameDate;

  try {
    const meta = await MiniExif.extractMetaData(file);
    temporalState.parsedExifDate = meta.date;
    spatialState.parsedExifGps = meta.gps;
  } catch (err) {
    temporalState.parsedExifDate = null;
    spatialState.parsedExifGps = null;
  }

  // Update temporal source
  if (parsedNameDate) {
    temporalState.source = 'name';
    temporalState.time = parsedNameDate;
    temporalState.userManualDate = new Date(parsedNameDate.getTime());
  } else if (temporalState.parsedExifDate) {
    temporalState.source = 'exif';
    temporalState.time = temporalState.parsedExifDate;
    temporalState.userManualDate = new Date(temporalState.parsedExifDate.getTime());
  } else {
    temporalState.source = 'manual';
    const now = new Date();
    temporalState.userManualDate = now;
    temporalState.time = now;
  }

  // Update spatial source
  if (spatialState.parsedExifGps) {
    spatialState.locSource = 'exif-loc';
    spatialState.lat = spatialState.parsedExifGps.lat;
    spatialState.lon = spatialState.parsedExifGps.lon;
  } else {
    spatialState.locSource = 'ville';
    spatialState.lat = spatialState.userManualLocation.lat;
    spatialState.lon = spatialState.userManualLocation.lon;
  }

  // Read image via FileReader using Promises to coordinate async properly
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        viewportState.backgroundImage = img;
        PixiRenderer.setBackgroundImage(img, viewportState.canvasW, viewportState.canvasH);
        
        // Reset layer transformation and viewport for the new image
        Transform.reset(viewportState.canvasW, viewportState.canvasH);
        viewportState.tx = 0;
        viewportState.ty = 0;
        viewportState.scale = 1;
        
        // Clear old phase snapshots
        uiState.cameraSnapshots = {
          IMPORT: { tx: null, ty: null, scale: null },
          ALIGN: { tx: null, ty: null, scale: null },
          STUDIO: { tx: null, ty: null, scale: null },
          EXPORT: { tx: null, ty: null, scale: null }
        };
        
        // Clear all previous anchors/punaises
        Anchors.clear();
        layerState.layerTransformDirty = true;
        layerState.anchorRevision++;
        
        if (dispatchToast) {
          dispatchToast(`Image: ${file.name}`);
        }
        
        resolve(img);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
