/**
 * v0.3.4: Image compression utilities for Memory Nebula.
 * Compresses uploaded images before storing in IndexedDB to save space.
 */

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_MAX_HEIGHT = 1600;
const DEFAULT_QUALITY = 0.82;

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Compress an image File into a data URL.
 * Uses Canvas to resize and re-encode as JPEG for smaller file size.
 * Falls back to FileReader if the image cannot be loaded.
 */
export async function fileToCompressedDataUrl(
  file: File,
  options?: CompressOptions
): Promise<string> {
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  // If it's already a small file, skip canvas compression
  if (file.size < 50 * 1024 && file.type === 'image/jpeg') {
    return fallbackReadAsDataURL(file);
  }

  try {
    return await compressWithCanvas(file, maxWidth, maxHeight, quality);
  } catch {
    // Fallback to raw FileReader on any error
    return fallbackReadAsDataURL(file);
  }
}

/**
 * Compress using canvas: draw at constrained size, export as JPEG.
 */
function compressWithCanvas(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(fallbackReadAsDataURL(file));
        return;
      }

      // Use better image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG for best compression (even for PNG originals)
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Fallback: simple FileReader → data URL without compression.
 */
function fallbackReadAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        resolve(reader.result as string);
      } else {
        reject(new Error('FileReader produced no result'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a fallback UUID when crypto.randomUUID() is unavailable.
 */
export function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for insecure contexts
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Extract base filename without extension.
 */
export function fileNameWithoutExt(name: string): string {
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(0, lastDot) : name;
}
