export type CharacterKind =
  'welcome' | 'check-details' | 'processing' | 'success' | 'error' | 'connection';

export interface CharacterAsset {
  src: string;
  width: number;
  height: number;
}

/**
 * Transparent WebP derivatives of the six supplied safety-worker illustrations.
 * The welcome asset keeps the full body; every other state is a waist-up crop
 * that preserves the face, hands and identifying prop. Originals remain in
 * `assets/` and are prepared by `tools/prepare-character-assets.py`.
 */
export const CHARACTER_ASSETS: Record<CharacterKind, CharacterAsset> = {
  welcome: { src: '/characters/welcome-full.webp', width: 640, height: 640 },
  'check-details': { src: '/characters/check-details.webp', width: 480, height: 480 },
  processing: { src: '/characters/processing.webp', width: 480, height: 480 },
  success: { src: '/characters/success.webp', width: 480, height: 480 },
  error: { src: '/characters/error.webp', width: 480, height: 480 },
  connection: { src: '/characters/connection.webp', width: 480, height: 480 },
};
