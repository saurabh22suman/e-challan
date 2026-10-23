/**
 * Self-hosted IBM Plex fonts (F-04).
 *
 * The woff2 files ship inside the pinned `@fontsource` packages and are bundled by
 * Vite, so no request ever leaves for a font CDN and the field tablet works without
 * external connectivity. Weights: sans 400/500/600 for body, labels and headings;
 * mono 400/500 for identifiers (registrations, gate-pass numbers, challan numbers)
 * so 0/O and 1/I/l are distinguishable under glare.
 */
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

/** Approved font stacks. `system-ui`/`ui-monospace` remain as offline fallbacks. */
export const FONT_SANS =
  '"IBM Plex Sans", "Noto Sans Devanagari", "Noto Sans Gujarati", system-ui, -apple-system, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';

// Load both families eagerly. Fonts are fetched lazily on first use, and an empty
// identifier field would otherwise leave the mono face unloaded until typed into;
// preloading keeps the identifier typography reliable from the first paint. The
// files are bundled from the pinned @fontsource packages, never a CDN.
const fontHost = globalThis as unknown as {
  document?: { fonts?: { load: (font: string) => Promise<unknown> } };
};
if (fontHost.document?.fonts !== undefined) {
  void fontHost.document.fonts.load(`400 16px ${FONT_SANS.split(',')[0]}`);
  void fontHost.document.fonts.load(`400 16px ${FONT_MONO.split(',')[0]}`);
  void fontHost.document.fonts.load(`600 16px ${FONT_SANS.split(',')[0]}`);
}
