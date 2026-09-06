/**
 * The key every name lookup is made under. A non-Latin script normalizes to
 * `""`, which is not a key — never treat it as a cache slot.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[^a-z0-9 ]/g, '')      // strip non-alphanumeric (keep spaces)
    .trim()
}
