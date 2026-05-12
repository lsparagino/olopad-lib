import { InjectionToken, type Signal } from '@angular/core';
import type { Node as PmNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

/**
 * Reactive context provided to every Angular NodeView component. Injected
 * via {@link OLO_NODE_VIEW_CONTEXT}.
 *
 * - `node` and `selected` are signals, so reading them in the template makes
 *   the component re-render on attr changes / selection moves.
 * - `getPos` returns the *current* document position of this node — call it
 *   at the moment you dispatch a transaction (positions shift after edits).
 * - `view` is stable for the lifetime of this NodeView and can be used to
 *   dispatch transactions or read schema.
 * - `contentDOM` is the element PM uses to render this node's inline / block
 *   children. It's `null` for atom nodes. For non-atom nodes, the Angular
 *   template must include an element marked `data-olo-content` — the bridge
 *   sets that element as the contentDOM after first render.
 */
export interface OloNodeViewContext {
  readonly node: Signal<PmNode>;
  readonly selected: Signal<boolean>;
  readonly view: EditorView;
  readonly getPos: () => number | undefined;
  readonly contentDOM: HTMLElement | null;
}

export const OLO_NODE_VIEW_CONTEXT = new InjectionToken<OloNodeViewContext>(
  'OLO_NODE_VIEW_CONTEXT',
);
