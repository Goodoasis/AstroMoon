/**
 * AstroMoon — Mini EXIF Parser
 * Lightweight EXIF extractor in Vanilla JS.
 * Extracts DateTimeOriginal and GPS Coordinates (Lat/Lon) parsing the embedded TIFF structure.
 */

const MiniExif = (() => {
  'use strict';

  function extractMetaData(file) {
    return new Promise(resolve => {
      // 128KB is usually more than enough to capture APP1 Header + full IFD tables
      const slice = file.slice(0, 131072);
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const view = new DataView(buffer);
          let offset = 0;

          // Check JPEG SOI
          if (view.getUint16(0, false) !== 0xFFD8) return resolve(parseFallbackDate(buffer));

          // Find APP1 marker
          offset = 2;
          while (offset < view.byteLength) {
            const marker = view.getUint16(offset, false);
            if (marker === 0xFFE1) break;
            offset += 2 + view.getUint16(offset + 2, false);
          }
          if (offset >= view.byteLength) return resolve(parseFallbackDate(buffer));

          offset += 4; // Skip marker + length
          // Check "Exif\0\0"
          if (view.getUint32(offset, false) !== 0x45786966) return resolve(parseFallbackDate(buffer));
          offset += 6;

          const tiffOffset = offset;
          // II (Little Endian) or MM (Big Endian)
          const endian = view.getUint16(tiffOffset, false);
          const littleEndian = (endian === 0x4949);

          // Get IFD0 offset
          const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);

          const result = { date: null, gps: null };

          let gpsOffset = null;
          let exifOffset = null;

          // Read IFD0 tags
          const ifd0Tags = view.getUint16(ifd0Offset, littleEndian);
          for (let i = 0; i < ifd0Tags; i++) {
            const tagOffset = ifd0Offset + 2 + (i * 12);
            const tag = view.getUint16(tagOffset, littleEndian);
            if (tag === 0x8825) gpsOffset = tiffOffset + view.getUint32(tagOffset + 8, littleEndian);
            if (tag === 0x8769) exifOffset = tiffOffset + view.getUint32(tagOffset + 8, littleEndian);
          }

          // Parse EXIF IFD for Date
          if (exifOffset) {
            const exifTags = view.getUint16(exifOffset, littleEndian);
            for (let i = 0; i < exifTags; i++) {
              const tagOffset = exifOffset + 2 + (i * 12);
              const tag = view.getUint16(tagOffset, littleEndian);
              if (tag === 0x9003) { // DateTimeOriginal
                const strOffset = tiffOffset + view.getUint32(tagOffset + 8, littleEndian);
                const strLen = view.getUint32(tagOffset + 4, littleEndian);
                let dateStr = "";
                for (let j = 0; j < strLen - 1; j++) dateStr += String.fromCharCode(view.getUint8(strOffset + j));
                const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
                if (match) {
                  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`);
                  if (!isNaN(d.getTime())) result.date = d;
                }
              }
            }
          }

          if (!result.date) {
            const fallback = parseFallbackDate(buffer);
            if (fallback.date) result.date = fallback.date;
          }

          // Parse GPS IFD for Coordinates
          if (gpsOffset) {
            const gpsTags = view.getUint16(gpsOffset, littleEndian);
            let latRef = 'N', lonRef = 'E';
            let lat = null, lon = null;

            for (let i = 0; i < gpsTags; i++) {
              const tagOffset = gpsOffset + 2 + (i * 12);
              const tag = view.getUint16(tagOffset, littleEndian);

              if (tag === 1) latRef = String.fromCharCode(view.getUint8(tagOffset + 8));
              else if (tag === 3) lonRef = String.fromCharCode(view.getUint8(tagOffset + 8));
              else if (tag === 2) lat = readGPSCoordinate(view, tagOffset, tiffOffset, littleEndian);
              else if (tag === 4) lon = readGPSCoordinate(view, tagOffset, tiffOffset, littleEndian);
            }

            if (lat !== null && lon !== null) {
              if (latRef === 'S') lat = -lat;
              if (lonRef === 'W') lon = -lon;
              result.gps = { lat, lon };
            }
          }

          resolve(result);

        } catch (err) {
          console.warn("EXIF Parser fallback:", err);
          resolve(parseFallbackDate(e.target.result));
        }
      };

      reader.onerror = () => resolve({ date: null, gps: null });
      reader.readAsArrayBuffer(slice);
    });
  }

  function readGPSCoordinate(view, tagOffset, tiffOffset, littleEndian) {
    const dataOffset = tiffOffset + view.getUint32(tagOffset + 8, littleEndian);
    const degNum = view.getUint32(dataOffset, littleEndian);
    const degDen = view.getUint32(dataOffset + 4, littleEndian);
    const minNum = view.getUint32(dataOffset + 8, littleEndian);
    const minDen = view.getUint32(dataOffset + 12, littleEndian);
    const secNum = view.getUint32(dataOffset + 16, littleEndian);
    const secDen = view.getUint32(dataOffset + 20, littleEndian);
    
    // Convert to decimal degrees
    return (degNum/degDen) + ((minNum/minDen)/60) + ((secNum/secDen)/3600);
  }

  // Fallback full-scan text date search (our previous robust method)
  function parseFallbackDate(buffer) {
    const text = new TextDecoder('ascii').decode(new Uint8Array(buffer));
    const match = text.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const d = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`);
      if (!isNaN(d.getTime())) return { date: d, gps: null };
    }
    return { date: null, gps: null };
  }

  // Backwards compatibility
  function extractDate(file) {
    return extractMetaData(file).then(res => res.date);
  }

  return { extractDate, extractMetaData };
})();
