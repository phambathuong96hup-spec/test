/**
 * Vietnamese font helper for jsPDF
 * 
 * Loads Roboto font dynamically at runtime to support Vietnamese diacritics.
 * Uses async fetch to avoid bundling ~150KB base64 into the main JS bundle.
 */
import type jsPDF from 'jspdf';

const FONT_URL = 'https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxP.ttf';
const FONT_NAME = 'Roboto';

let fontCache: ArrayBuffer | null = null;

/**
 * Registers the Roboto font with a jsPDF instance for Vietnamese text support.
 * Falls back silently to Helvetica if font loading fails.
 * 
 * @example
 * ```ts
 * const doc = new jsPDF();
 * await registerViFont(doc);
 * doc.text('BÁO CÁO TỔNG QUAN', 10, 10);
 * ```
 */
export async function registerViFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!fontCache) {
      const response = await fetch(FONT_URL);
      if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`);
      fontCache = await response.arrayBuffer();
    }

    // Convert ArrayBuffer to base64
    const uint8 = new Uint8Array(fontCache);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    // Register with jsPDF
    doc.addFileToVFS('Roboto-Regular.ttf', base64);
    doc.addFont('Roboto-Regular.ttf', FONT_NAME, 'normal');
    doc.setFont(FONT_NAME);
    return true;
  } catch (error) {
    console.warn('[registerViFont] Could not load Vietnamese font, falling back to Helvetica:', error);
    doc.setFont('helvetica');
    return false;
  }
}
