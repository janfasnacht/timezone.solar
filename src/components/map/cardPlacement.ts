/**
 * Shared placement constants for the two HTML cards on the map.
 *
 * Both are positioned in container pixels outside the map's transform, so these
 * are plain screen distances that hold at any zoom.
 */

/** Dot to the pinned source/target label. */
export const PINNED_GAP = 14

/** Dot to the hover card. A touch more than the pinned label — the card is
 *  larger, and the cursor is sitting on the dot. */
export const HOVER_GAP = 18

/**
 * A card may not be placed with its top above this. The search bar floats over
 * the top of the map, so anything higher is partly hidden — flip to the other
 * side of the dot well before the viewport edge.
 */
export const TOP_SAFE_PX = 104
