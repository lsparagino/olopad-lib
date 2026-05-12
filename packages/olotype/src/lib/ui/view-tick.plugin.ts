import { Plugin } from 'prosemirror-state';

/**
 * Fires `onTick` on every ProseMirror view update — including selection-only
 * changes that don't touch the doc. Toolbar components subscribe to this so
 * they can recompute active-state badging when the cursor moves between
 * blocks or marks toggle without a doc change.
 */
export function viewTickPlugin(onTick: () => void): Plugin {
  return new Plugin({
    view: () => ({
      update: () => onTick(),
    }),
  });
}
