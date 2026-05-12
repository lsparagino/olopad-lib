import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * State of the block drag handle. The handle is shown when the mouse is over
 * a top-level block (a direct child of `doc`). `pos` is the doc position at
 * the start of that block; `rect` is its viewport-space bounding rect.
 */
export interface OloBlockHandleState {
  readonly visible: boolean;
  readonly pos: number;
  readonly rect: { left: number; top: number; right: number; bottom: number } | null;
}

const EMPTY_STATE: OloBlockHandleState = { visible: false, pos: -1, rect: null };

/**
 * Plugin that watches `mousemove` over the editor DOM and reports which
 * top-level block is being hovered. Uses `view.posAtCoords` to map the
 * pointer to a doc position, then walks up to depth 1.
 *
 * The handle is hidden while the editor is read-only or while the user is
 * dragging — the plugin keeps the handle visible across mousemove only, so
 * the parent component decides when to render it vs. hide.
 */
export function blockHandlePlugin(
  onChange: (state: OloBlockHandleState) => void,
  enabled: () => boolean,
): Plugin {
  return new Plugin({
    view(view) {
      let lastPos = -2;

      const emit = (next: OloBlockHandleState) => {
        if (next.pos === lastPos) return;
        lastPos = next.pos;
        onChange(next);
      };

      const handleMove = (event: MouseEvent) => {
        if (!enabled()) {
          emit(EMPTY_STATE);
          return;
        }
        const next = resolveHover(view, event.clientX, event.clientY);
        emit(next);
      };

      const handleLeave = () => emit(EMPTY_STATE);

      view.dom.addEventListener('mousemove', handleMove);
      view.dom.addEventListener('mouseleave', handleLeave);
      window.addEventListener('scroll', handleLeave, { passive: true, capture: true });

      return {
        update(view) {
          // Doc/selection changed — re-resolve the last position so the rect
          // stays correct after an edit shifts the layout.
          if (lastPos < 0) return;
          const node = view.state.doc.nodeAt(lastPos);
          if (!node) {
            lastPos = -2;
            onChange(EMPTY_STATE);
            return;
          }
          const dom = view.nodeDOM(lastPos) as HTMLElement | null;
          if (!dom) return;
          const rect = dom.getBoundingClientRect();
          onChange({
            visible: enabled(),
            pos: lastPos,
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          });
        },
        destroy() {
          view.dom.removeEventListener('mousemove', handleMove);
          view.dom.removeEventListener('mouseleave', handleLeave);
          window.removeEventListener('scroll', handleLeave, { capture: true });
          onChange(EMPTY_STATE);
        },
      };
    },
  });
}

function resolveHover(view: EditorView, x: number, y: number): OloBlockHandleState {
  const coords = view.posAtCoords({ left: x, top: y });
  if (!coords) return EMPTY_STATE;

  const $pos = view.state.doc.resolve(coords.pos);
  if ($pos.depth === 0) return EMPTY_STATE;

  // Walk up to depth 1 — the position just before the top-level child of `doc`.
  const blockPos = $pos.before(1);
  const node = view.state.doc.nodeAt(blockPos);
  if (!node) return EMPTY_STATE;

  const dom = view.nodeDOM(blockPos) as HTMLElement | null;
  if (!dom || typeof dom.getBoundingClientRect !== 'function') return EMPTY_STATE;

  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return EMPTY_STATE;

  return {
    visible: true,
    pos: blockPos,
    rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
  };
}
