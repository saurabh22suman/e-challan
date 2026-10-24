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
const BASE = import.meta.env.BASE_URL;

export const CHARACTER_ASSETS: Record<CharacterKind, CharacterAsset> = {
  welcome: { src: `${BASE}characters/welcome-full.webp`, width: 640, height: 640 },
  'check-details': { src: `${BASE}characters/check-details.webp`, width: 480, height: 480 },
  processing: { src: `${BASE}characters/processing.webp`, width: 480, height: 480 },
  success: { src: `${BASE}characters/success.webp`, width: 480, height: 480 },
  error: { src: `${BASE}characters/error.webp`, width: 480, height: 480 },
  connection: { src: `${BASE}characters/connection.webp`, width: 480, height: 480 },
};
