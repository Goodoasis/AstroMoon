import UTIF from 'utif';
import heic2any from 'heic2any';
import fitsRaw from 'fitsjs/lib/fits.js?raw';

/**
 * AstroMoon — Image Decoder
 * Decodes specialized formats (TIFF, FITS, HEIC) to a standard Blob.
 */
export async function decodeToBlob(file, dispatchToast) {
  const name = file.name.toLowerCase();
  
  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    if (dispatchToast) dispatchToast("Décodage HEIC en cours...");
    try {
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
      return Array.isArray(blob) ? blob[0] : blob;
    } catch (e) {
      console.error("HEIC decode error:", e);
      throw new Error("Impossible de décoder le fichier HEIC.");
    }
  }
  
  if (name.endsWith('.tif') || name.endsWith('.tiff')) {
    if (dispatchToast) dispatchToast("Décodage TIFF en cours...");
    try {
      const buffer = await file.arrayBuffer();
      const ifds = UTIF.decode(buffer);
      const ifd = ifds[0];
      UTIF.decodeImage(buffer, ifd);
      const rgba = UTIF.toRGBA8(ifd);
      
      const canvas = document.createElement('canvas');
      canvas.width = ifd.width;
      canvas.height = ifd.height;
      const ctx = canvas.getContext('2d');
      const imageData = new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Erreur conversion Canvas -> Blob"));
        }, 'image/png');
      });
    } catch (e) {
      console.error("TIFF decode error:", e);
      throw new Error("Impossible de décoder le fichier TIFF.");
    }
  }

  if (name.endsWith('.fit') || name.endsWith('.fits')) {
    if (dispatchToast) dispatchToast("Décodage FITS en cours...");
    try {
      return new Promise((resolve, reject) => {
        if (!window.astro) window.astro = {};
        if (!window.astro.FITS) {
          try {
            const fn = new Function(fitsRaw);
            fn.call(window);
          } catch (err) {
            console.error("Failed to initialize FITS decoder:", err);
            reject(new Error("Erreur d'initialisation du décodeur FITS."));
            return;
          }
        }

        const FITS = window.astro.FITS;
        if (!FITS) {
          reject(new Error("Bibliothèque FITS introuvable après initialisation."));
          return;
        }
        
        const fits = new FITS(file, () => {
          try {
            const hdu = fits.getHDU();
            if (!hdu || !hdu.hasData()) {
              reject(new Error("Aucune donnée d'image trouvée dans le fichier FITS."));
              return;
            }
            const image = hdu.data;
            
            // FITS js fournit l'image dans hdu.data (instance de astro.FITS.Image)
            // L'appel getFrame retourne les pixels pour l'image
            image.getFrame(image.frame, (pixels) => {
              let min = Infinity;
              let max = -Infinity;
              
              // Étirement basique de l'histogramme (min-max stretch)
              for (let i = 0; i < pixels.length; i++) {
                if (pixels[i] < min) min = pixels[i];
                if (pixels[i] > max) max = pixels[i];
              }
              if (min === Infinity) min = 0;
              if (max === -Infinity) max = 255;
              
              const range = max - min || 1;
              const canvas = document.createElement('canvas');
              canvas.width = image.width;
              canvas.height = image.height;
              const ctx = canvas.getContext('2d');
              const imgData = ctx.createImageData(image.width, image.height);
              const data = imgData.data;
              
              for (let i = 0; i < pixels.length; i++) {
                // Normalisation 0-255
                let v = Math.max(0, Math.min(255, ((pixels[i] - min) / range) * 255));
                
                // Inversion de l'axe Y car FITS stocke de bas en haut
                const x = i % image.width;
                const y = image.height - 1 - Math.floor(i / image.width);
                const idx = (y * image.width + x) * 4;
                
                data[idx] = v;     // R
                data[idx+1] = v;   // G
                data[idx+2] = v;   // B
                data[idx+3] = 255; // A
              }
              
              ctx.putImageData(imgData, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Erreur conversion Canvas -> Blob"));
              }, 'image/png');
            });
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (e) {
      console.error("FITS decode error:", e);
      throw new Error("Impossible de décoder le fichier FITS.");
    }
  }

  // Fichiers natifs (JPG, PNG) : pas de décodage nécessaire
  return file;
}
