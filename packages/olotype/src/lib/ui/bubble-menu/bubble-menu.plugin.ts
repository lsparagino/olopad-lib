import type { MarkType } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * State emitted by the bubble menu plugin to the Angular layer. The plugin
 * itself doesn't render anything — it just reports when and where the bubble
 * should appear and which marks are active in the current selection.
 */
export interface OloBubbleMenuState {
  readonly visible: boolean;
  /** Viewport-space rect of the current selection, or null when hidden. */
  readonly rect: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null;
  /** Names of marks present across the entire selection. */
  readonly activeMarks: ReadonlySet<string>;
  /** Current href if the selection sits inside a single link mark; otherwise null. */
  readonly linkHref: string | null;
}

const EMPTY_STATE: OloBubbleMenuState = {
  visible: false,
  rect: null,
  activeMarks: new Set(),
  linkHref: null,
};

const KEY = new PluginKey<OloBubbleMenuState>('olotype-bubble');

export function bubbleMenuPluginKey(): PluginKey<OloBubbleMenuState> {
  return KEY;
}

export function bubbleMenuPlugin(onChange: (state: OloBubbleMenuState) => void): Plugin {
  return new Plugin({
    key: KEY,
    view: () => ({
      update(view, prev) {
        // Recompute only when something that affects the bubble may have changed.
        // (doc change, selection change, or focus change — PM fires `update` for all.)
        const next = computeState(view);
        if (statesEqual(next, prev ? readPrev(prev) : EMPTY_STATE)) return;
        onChange(next);
      },
      destroy() {
        onChange(EMPTY_STATE);
      },
    }),
  });
}

// Stash the last emitted state on the plugin's `EditorState` slot so we can
// dedupe updates without keeping a closure variable across reconfigurations.
function readPrev(state: EditorState): OloBubbleMenuState {
  return KEY.getState(state) ?? EMPTY_STATE;
}

function computeState(view: EditorView): OloBubbleMenuState {
  if (!view.hasFocus()) return EMPTY_STATE;

  const { selection, schema } = view.state;

  if (!(selection instanceof TextSelection)) return EMPTY_STATE;
  if (selection.empty) return EMPTY_STATE;

  // Don't show inside code blocks — they don't carry marks.
  if (selection.$from.parent.type.spec.code) return EMPTY_STATE;

  let fromCoords: { left: number; top: number; right: number; bottom: number };
  let toCoords: { left: number; top: number; right: number; bottom: number };
  try {
    fromCoords = view.coordsAtPos(selection.from);
    toCoords = view.coordsAtPos(selection.to);
  } catch {
    return EMPTY_STATE;
  }

  const left = Math.min(fromCoords.left, toCoords.left);
  const right = Math.max(fromCoords.right, toCoords.right);
  const top = Math.min(fromCoords.top, toCoords.top);
  const bottom = Math.max(fromCoords.bottom, toCoords.bottom);

  const activeMarks = new Set<string>();
  for (const name of Object.keys(schema.marks)) {
    const markType = schema.marks[name];
    if (markType && isMarkActive(view.state, markType)) activeMarks.add(name);
  }

  return {
    visible: true,
    rect: { left, top, right, bottom, width: right - left, height: bottom - top },
    activeMarks,
    linkHref: activeMarks.has('link') ? extractLinkHref(view.state) : null,
  };
}

function isMarkActive(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
  return state.doc.rangeHasMark(from, to, type);
}

function extractLinkHref(state: EditorState): string | null {
  const linkType = state.schema.marks['link'];
  if (!linkType) return null;
  const { from, to } = state.selection;
  let href: string | null = null;
  state.doc.nodesBetween(from, to, node => {
    const mark = node.marks.find(m => m.type === linkType);
    if (mark) href = (mark.attrs['href'] as string) ?? null;
  });
  return href;
}

function statesEqual(a: OloBubbleMenuState, b: OloBubbleMenuState): boolean {
  if (a === b) return true;
  if (a.visible !== b.visible) return false;
  if (a.linkHref !== b.linkHref) return false;
  if (a.activeMarks.size !== b.activeMarks.size) return false;
  for (const m of a.activeMarks) if (!b.activeMarks.has(m)) return false;
  if (a.rect && b.rect) {
    return (
      a.rect.left === b.rect.left &&
      a.rect.top === b.rect.top &&
      a.rect.right === b.rect.right &&
      a.rect.bottom === b.rect.bottom
    );
  }
  return a.rect === b.rect;
}
