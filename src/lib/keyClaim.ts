/**
 * A key press belongs to the innermost thing that answers it.
 *
 * Overlays and global shortcuts both listen on `document`, so without this the
 * same Escape that closes a popover also runs the global handler behind it.
 * Overlays claim the event in the capture phase; anything listening later sees
 * the claim and stands down.
 */
const claimed = new WeakSet<KeyboardEvent>()

export function claimKey(e: KeyboardEvent) {
  claimed.add(e)
}

export function isKeyClaimed(e: KeyboardEvent) {
  return claimed.has(e)
}
