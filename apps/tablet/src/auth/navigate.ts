/**
 * Small navigation seam.
 *
 * Kept separate from the handoff component so component tests can assert the
 * destination without letting jsdom attempt a real navigation.
 */
export function replaceLocation(url: string): void {
  window.location.replace(url);
}
