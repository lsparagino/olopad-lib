import {
  ApplicationRef,
  EnvironmentInjector,
  Injector,
  Type,
  createComponent,
  signal,
} from '@angular/core';
import type { Node as PmNode } from 'prosemirror-model';
import type {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView,
  NodeViewConstructor,
} from 'prosemirror-view';
import { OLO_NODE_VIEW_CONTEXT, type OloNodeViewContext } from './node-view-context';

/**
 * Bridge from a PM NodeView to an Angular component. The bridge takes care of:
 * - Creating a per-node `Injector` (so each NodeView instance has its own DI scope).
 * - Bootstrapping the Angular component into the NodeView's host element with
 *   {@link createComponent}.
 * - Exposing PM's `node` and `selected` state to the component as signals.
 * - Wiring PM's `contentDOM` for non-atom nodes — the Angular template marks
 *   the slot with `data-olo-content`.
 * - Forwarding PM's `update` / `selectNode` / `deselectNode` / `destroy`.
 */
export class OloNodeViewBridge {
  constructor(
    private readonly parentInjector: Injector,
    private readonly appRef: ApplicationRef,
    private readonly environmentInjector: EnvironmentInjector,
  ) {}

  /** Build a PM `NodeViewConstructor` from an Angular component class. */
  build(component: Type<unknown>): NodeViewConstructor {
    return (node, view, getPos) => this.create(component, node, view, getPos);
  }

  private create(
    component: Type<unknown>,
    initialNode: PmNode,
    view: EditorView,
    getPos: () => number | undefined,
  ): NodeView {
    const isInline = !!initialNode.type.spec.inline;
    const dom = document.createElement(isInline ? 'span' : 'div');
    dom.classList.add('olo-angular-node-view');
    if (isInline) dom.classList.add('olo-angular-node-view--inline');

    const nodeSignal = signal(initialNode);
    const selectedSignal = signal(false);

    // The contentDOM is filled in after the first CD pass for non-atom nodes
    // (the Angular template renders a `[data-olo-content]` element which we
    // adopt). For atom nodes it stays null.
    let contentDOM: HTMLElement | null = null;

    // We need to expose `contentDOM` before the component renders so the
    // template can mount it. But PM only needs it on the returned NodeView —
    // and PM reads `contentDOM` once after the constructor returns. So we
    // initialize the context with `null` and update both the context (which
    // the component reads via injection) and the NodeView's returned field
    // synchronously after detectChanges.
    //
    // The context is a frozen object passed to the injector; we don't mutate
    // it after creation. The component's template uses `data-olo-content` as
    // a static marker — the bridge then finds it and reports it to PM.

    const context: OloNodeViewContext = {
      node: nodeSignal.asReadonly(),
      selected: selectedSignal.asReadonly(),
      view,
      getPos,
      get contentDOM() {
        // Read-through getter so the component can access it after creation.
        return contentDOM;
      },
    };

    const elementInjector = Injector.create({
      providers: [{ provide: OLO_NODE_VIEW_CONTEXT, useValue: context }],
      parent: this.parentInjector,
    });

    const componentRef = createComponent(component, {
      environmentInjector: this.environmentInjector,
      hostElement: dom,
      elementInjector,
    });

    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();

    if (!initialNode.type.isAtom) {
      const marker = dom.querySelector('[data-olo-content]');
      if (marker instanceof HTMLElement) {
        contentDOM = marker;
      } else {
        // Soft warning: a non-atom node view should mark its content slot.
        // PM will treat the node as having no children; pasting/typing inside
        // will fail. Make the misconfiguration visible in dev.
        // eslint-disable-next-line no-console
        console.warn(
          `OloType: Angular NodeView for node "${initialNode.type.name}" is not atomic ` +
            'but its template has no `[data-olo-content]` slot. PM children will not render.',
        );
      }
    }

    return {
      dom,
      contentDOM,

      update(updatedNode: PmNode, _decorations: readonly Decoration[], _innerDecorations: DecorationSource) {
        if (updatedNode.type !== initialNode.type) return false;
        nodeSignal.set(updatedNode);
        return true;
      },

      selectNode() {
        selectedSignal.set(true);
        dom.classList.add('olo-node-selected');
      },

      deselectNode() {
        selectedSignal.set(false);
        dom.classList.remove('olo-node-selected');
      },

      stopEvent() {
        // Defer to ProseMirror for keyboard / selection events. Components
        // that want fully-interactive children (form inputs, etc.) should
        // wrap them with `(pointerdown)="$event.stopPropagation()"` or
        // similar — by default we let PM drive the editor.
        return false;
      },

      ignoreMutation(mutation) {
        // Mutations inside the Angular-rendered DOM should not be observed by
        // PM, *except* mutations inside contentDOM which are PM's own.
        if (!contentDOM) return true;
        return !contentDOM.contains(mutation.target) && contentDOM !== mutation.target;
      },

      destroy() {
        if (componentRef.hostView.destroyed) return;
        try {
          componentRef.destroy();
        } catch {
          /* already torn down by an ancestor */
        }
      },
    };
  }
}
