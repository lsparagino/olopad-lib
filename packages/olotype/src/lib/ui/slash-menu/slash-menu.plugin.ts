import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * State emitted by the slash menu plugin. The Angular component renders the
 * menu when `visible` is true, positioned at `rect`. Items are not owned by
 * the plugin — the component computes them from the editor's extensions and
 * filters them by `query`.
 */
export interface OloSlashMenuState {
  readonly visible: boolean;
  readonly query: string;
  /** Range [from, to] of the `/query` text the user has typed. */
  readonly range: { from: number; to: number } | null;
  /** Viewport-space caret rect (for positioning the menu). */
  readonly rect: { left: number; top: number; bottom: number } | null;
}

const EMPTY_STATE: OloSlashMenuState = { visible: false, query: '', range: null, rect: null };
const KEY = new PluginKey<OloSlashMenuState>('olotype-slash');

export function slashMenuPluginKey(): PluginKey<OloSlashMenuState> {
  return KEY;
}

/**
 * Slash menu trigger detection.
 *
 * Activates when the cursor sits inside a textblock (paragraph or heading)
 * whose content starts with `/`, with no intervening spaces between `/` and
 * the cursor. The query is the text between `/` and the cursor.
 *
 * Hides on:
 * - selection becoming non-empty
 * - cursor leaving the slash range
 * - any character that breaks the pattern (space, newline)
 * - explicit dismissal (Escape) — handled in the component
 */
export function slashMenuPlugin(onChange: (state: OloSlashMenuState) => void): Plugin {
  return new Plugin({
    key: KEY,
    view: () => ({
      update(view) {
        const next = computeState(view);
        onChange(next);
      },
      destroy() {
        onChange(EMPTY_STATE);
      },
    }),
  });
}

function computeState(view: EditorView): OloSlashMenuState {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return EMPTY_STATE;

  const $cursor = selection.$cursor;
  if (!$cursor) return EMPTY_STATE;

  // Only inside textblocks that accept inline content (not code blocks).
  const parent = $cursor.parent;
  if (parent.type.spec.code) return EMPTY_STATE;
  if (!parent.isTextblock) return EMPTY_STATE;

  // Text content from start of the textblock up to the cursor.
  const blockStart = $cursor.start();
  const textBefore = parent.textBetween(0, $cursor.parentOffset, '\n', '\0');

  // Pattern: leading `/` followed by zero or more non-space chars, anchored at end.
  const match = /^\/([^\s/]*)$/.exec(textBefore);
  if (!match) return EMPTY_STATE;

  const query = match[1];
  const from = blockStart;
  const to = $cursor.pos;

  let rect: { left: number; top: number; bottom: number };
  try {
    const coords = view.coordsAtPos(to);
    rect = { left: coords.left, top: coords.top, bottom: coords.bottom };
  } catch {
    return EMPTY_STATE;
  }

  return { visible: true, query, range: { from, to }, rect };
}
