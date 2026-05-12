import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EnvironmentInjector,
  Injector,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type { Node as PmNode } from 'prosemirror-model';
import { dropCursor } from 'prosemirror-dropcursor';
import { EditorState, type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { buildSchema, collectExtensionPlugins } from '../core/extensions';
import { buildKeymaps } from '../core/keymap';
import { buildBasePlugins, changeReporterPlugin } from '../core/plugins';
import { emptyDoc, parseDoc, serializeDoc } from '../core/serialize';
import type {
  OloDoc,
  OloExtension,
  OloSlashMenuItem,
  OloTypeHandle,
} from '../core/types';
import {
  blockHandlePlugin,
  type OloBlockHandleState,
} from '../ui/block-handle/block-handle.plugin';
import { OloBlockHandleComponent } from '../ui/block-handle/block-handle.component';
import {
  bubbleMenuPlugin,
  type OloBubbleMenuState,
} from '../ui/bubble-menu/bubble-menu.plugin';
import { OloBubbleMenuComponent } from '../ui/bubble-menu/bubble-menu.component';
import {
  slashMenuPlugin,
  type OloSlashMenuState,
} from '../ui/slash-menu/slash-menu.plugin';
import { OloSlashMenuComponent } from '../ui/slash-menu/slash-menu.component';
import { OLO_DEFAULT_SLASH_ITEMS } from '../ui/slash-menu/default-items';
import { OloToolbarComponent } from '../ui/toolbar/toolbar.component';
import { viewTickPlugin } from '../ui/view-tick.plugin';
import { OloNodeViewBridge } from '../node-view/angular-node-view';
import {
  DEFAULT_BUBBLE_MENU_ITEMS,
  DEFAULT_TOOLBAR_ITEMS,
  buildMenuRegistry,
  resolveMenuItems,
  type OloMenuItem,
} from '../ui/menu-items';

const HIDDEN_BUBBLE: OloBubbleMenuState = {
  visible: false,
  rect: null,
  activeMarks: new Set(),
  linkHref: null,
};

const HIDDEN_SLASH: OloSlashMenuState = {
  visible: false,
  query: '',
  range: null,
  rect: null,
};

const HIDDEN_HANDLE: OloBlockHandleState = { visible: false, pos: -1, rect: null };

/**
 * `<olo-type>` — Notion-style block editor.
 *
 * Reactive surface: `doc` is a two-way model signal. The editor pushes a new
 * value on every transaction; consumers can also write to the signal to
 * replace the document (e.g. loading from storage). External writes are
 * detected by identity (we ignore echoes of our own emissions).
 */
@Component({
  selector: 'olo-type',
  standalone: true,
  imports: [OloBlockHandleComponent, OloBubbleMenuComponent, OloSlashMenuComponent, OloToolbarComponent],
  template: `
    @if (toolbar() && view()) {
      <olo-toolbar [items]="resolvedToolbarItems()" [view]="view()!" [tick]="viewTick()" />
    }

    <div #host class="olo-type-host" [attr.aria-readonly]="readOnly() || null"></div>

    @if (bubbleMenu() && bubbleState().visible && view()) {
      <olo-bubble-menu
        [state]="bubbleState()"
        [view]="view()!"
        [items]="resolvedBubbleItems()"
      />
    }

    @if (slashMenu() && slashState().visible && view()) {
      <olo-slash-menu
        [state]="slashState()"
        [view]="view()!"
        [handle]="this"
        [items]="effectiveSlashItems()"
        (dismissed)="dismissSlashMenu()"
      />
    }

    @if (blockHandle() && !readOnly() && blockHandleState().visible && view()) {
      <olo-block-handle [state]="blockHandleState()" [view]="view()!" />
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }
      .olo-type-host {
        outline: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'olo-type' },
})
export class OloTypeComponent implements OnDestroy, OloTypeHandle {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  /** Per-editor NodeView bridge. Reused across rebuilds. */
  private readonly nodeViewBridge = new OloNodeViewBridge(
    this.injector,
    this.appRef,
    this.environmentInjector,
  );

  /** Two-way bound document. */
  readonly doc = model<OloDoc>(emptyDoc());

  readonly extensions = input<readonly OloExtension[]>([]);
  readonly readOnly = input<boolean>(false);
  readonly placeholder = input<string>('');

  /** Show the floating bubble menu on text selection. Default `true`. */
  readonly bubbleMenu = input<boolean>(true);

  /** Enable the `/` slash menu for inserting blocks. Default `true`. */
  readonly slashMenu = input<boolean>(true);

  /** Show a fixed toolbar above the editor. Default `false`. */
  readonly toolbar = input<boolean>(false);

  /** Show a left-gutter drag handle on hover, for reordering blocks. Default `true`. */
  readonly blockHandle = input<boolean>(true);

  /**
   * Items shown in the toolbar. Mix built-in ids (e.g. `'bold'`, `'heading-1'`,
   * `'|'` for separators) and full `OloMenuItem` objects. Defaults to a
   * standard set; pass `[]` to render an empty toolbar.
   */
  readonly toolbarItems = input<readonly (string | OloMenuItem)[]>(DEFAULT_TOOLBAR_ITEMS);

  /**
   * Items shown in the bubble menu. Same shape as {@link toolbarItems}.
   * Defaults to inline marks + link.
   */
  readonly bubbleMenuItems = input<readonly (string | OloMenuItem)[]>(DEFAULT_BUBBLE_MENU_ITEMS);

  /** Fires on every document-changing transaction. The signal is the primary source of truth. */
  readonly changed = output<OloDoc>();

  /** Internal: tracks the last value we emitted so we can ignore echoes. */
  private lastEmitted: OloDoc | null = null;

  /** Live PM view, exposed as a signal so menu components react to its identity. */
  protected readonly view = signal<EditorView | null>(null);

  protected readonly bubbleState = signal<OloBubbleMenuState>(HIDDEN_BUBBLE);
  protected readonly slashState = signal<OloSlashMenuState>(HIDDEN_SLASH);
  protected readonly blockHandleState = signal<OloBlockHandleState>(HIDDEN_HANDLE);

  /** Increments on every PM view update. Read by toolbar items for active-state recompute. */
  protected readonly viewTick = signal(0);

  private readonly schema = computed(() => buildSchema(this.extensions()));

  private readonly menuRegistry = computed(() => buildMenuRegistry(this.schema()));

  protected readonly resolvedToolbarItems = computed(() =>
    resolveMenuItems(this.menuRegistry(), this.toolbarItems()),
  );

  protected readonly resolvedBubbleItems = computed(() =>
    resolveMenuItems(this.menuRegistry(), this.bubbleMenuItems()),
  );

  /** Merged slash-menu item list: built-ins first, then extension-contributed items. */
  protected readonly effectiveSlashItems = computed<readonly OloSlashMenuItem[]>(() => {
    const fromExtensions = this.extensions().flatMap(ext => ext.slashMenuItems ?? []);
    return [...OLO_DEFAULT_SLASH_ITEMS, ...fromExtensions];
  });

  constructor() {
    // Build / rebuild the view when schema or readOnly changes. Placeholder
    // changes are picked up reactively via a getter passed to the plugin.
    effect(() => {
      const schema = this.schema();
      const readOnly = this.readOnly();
      // Recreate on schema/readOnly changes. Document content is preserved
      // by re-parsing the current doc value.
      untracked(() => this.rebuildView(schema, readOnly));
    });

    // Apply external doc writes (when caller swaps the value).
    effect(() => {
      const next = this.doc();
      const view = this.view();
      if (!view || !next || next === this.lastEmitted) return;
      untracked(() => this.applyExternalDoc(next));
    });
  }

  ngOnDestroy(): void {
    this.view()?.destroy();
    this.view.set(null);
  }

  // ---- OloTypeHandle ------------------------------------------------------

  focus(): void {
    this.view()?.focus();
  }

  blur(): void {
    this.view()?.dom?.blur();
  }

  get state(): EditorState | null {
    return this.view()?.state ?? null;
  }

  insertNode(node: PmNode): void {
    const view = this.view();
    if (!view) return;
    const tr = view.state.tr.replaceSelectionWith(node).scrollIntoView();
    view.dispatch(tr);
  }

  runCommand(command: Command): boolean {
    const view = this.view();
    if (!view) return false;
    return command(view.state, view.dispatch, view);
  }

  protected dismissSlashMenu(): void {
    this.slashState.set(HIDDEN_SLASH);
    this.view()?.focus();
  }

  // ---- Internal -----------------------------------------------------------

  private rebuildView(schema: ReturnType<typeof buildSchema>, readOnly: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const hostEl = this.host().nativeElement;

    // Preserve the current doc value across rebuilds. If parsing against the
    // new schema fails (e.g. an extension was removed and its node lives in
    // the current doc), fall back to an empty doc.
    const currentDoc = this.doc();
    let initialNode: PmNode;
    try {
      initialNode = parseDoc(schema, currentDoc);
    } catch {
      initialNode = parseDoc(schema, emptyDoc());
    }

    this.view()?.destroy();

    const plugins = [
      ...buildBasePlugins(schema, () => this.placeholder()),
      ...buildKeymaps(schema),
      ...collectExtensionPlugins(this.extensions(), schema),
      bubbleMenuPlugin(state => this.bubbleState.set(state)),
      slashMenuPlugin(state => this.slashState.set(state)),
      blockHandlePlugin(
        state => this.blockHandleState.set(state),
        () => this.blockHandle() && !this.readOnly(),
      ),
      dropCursor({ color: 'var(--olo-type-accent, #2563eb)', width: 2 }),
      viewTickPlugin(() => this.viewTick.update(n => n + 1)),
      changeReporterPlugin(view => this.emitChange(view)),
    ];

    const state = EditorState.create({ doc: initialNode, schema, plugins });

    const nodeViews: Record<string, ReturnType<OloNodeViewBridge['build']>> = {};
    for (const ext of this.extensions()) {
      if (!ext.nodeViews) continue;
      for (const [nodeName, componentClass] of Object.entries(ext.nodeViews)) {
        if (!schema.nodes[nodeName]) continue; // Skip if the node wasn't registered
        nodeViews[nodeName] = this.nodeViewBridge.build(componentClass);
      }
    }

    const view = new EditorView(hostEl, {
      state,
      editable: () => !this.readOnly(),
      attributes: {
        class: 'olo-type-editor',
        role: 'textbox',
        'aria-multiline': 'true',
      },
      nodeViews,
    });

    this.view.set(view);

    // Apply readOnly visually as well (PM's editable() handles input gating).
    hostEl.classList.toggle('olo-type-readonly', readOnly);
  }

  private applyExternalDoc(next: OloDoc): void {
    const view = this.view();
    if (!view) return;
    let node: PmNode;
    try {
      node = parseDoc(view.state.schema, next);
    } catch {
      return; // Reject malformed external writes silently — leave editor as-is.
    }
    // Avoid pushing a no-op transaction; reduces work when the host re-emits the same value.
    if (node.eq(view.state.doc)) return;
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, node.content);
    view.dispatch(tr);
  }

  private emitChange(view: EditorView): void {
    const serialized = serializeDoc(view.state.doc);
    this.lastEmitted = serialized;
    this.doc.set(serialized);
    this.changed.emit(serialized);
  }
}

// Alias used in the plan's snippets (`@ViewChild(OloType) editor!: OloType`).
// Kept alongside the canonical `OloTypeComponent` symbol.
export { OloTypeComponent as OloType };
