import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import type { MarkType, NodeType, Schema } from 'prosemirror-model';
import { wrapInList } from 'prosemirror-schema-list';
import type { EditorView } from 'prosemirror-view';

/**
 * A single entry in the toolbar or bubble menu. The same shape is used for
 * built-in items and for host-contributed custom items so both surfaces
 * render uniformly.
 */
export interface OloMenuItem {
  /** Stable id. Built-in ids: see {@link OLO_MENU_ITEM_IDS}. `|` renders a separator. */
  readonly id: string;
  /**
   * Item kind:
   * - `button` (default): runs `run` on click.
   * - `separator`: renders a divider.
   * - `link`: opens the inline link editor (bubble menu only).
   */
  readonly kind?: 'button' | 'separator' | 'link';
  readonly title?: string;
  readonly iconKey?: string;
  readonly shortcut?: string;
  /** Should the button render as pressed? */
  readonly isActive?: (view: EditorView) => boolean;
  /** Should the button be enabled? Defaults to `true`. */
  readonly isEnabled?: (view: EditorView) => boolean;
  /** Click handler. Required for `button` items; ignored for `separator` / `link`. */
  readonly run?: (view: EditorView) => void;
}

/** Built-in menu item ids. Use as strings in `[toolbarItems]` / `[bubbleMenuItems]`. */
export const OLO_MENU_ITEM_IDS = [
  '|',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'paragraph',
  'heading-1',
  'heading-2',
  'heading-3',
  'bullet-list',
  'ordered-list',
  'blockquote',
  'code-block',
  'image',
] as const;

export type OloMenuItemId = (typeof OLO_MENU_ITEM_IDS)[number];

export const DEFAULT_TOOLBAR_ITEMS: readonly OloMenuItemId[] = [
  'paragraph',
  'heading-1',
  'heading-2',
  'heading-3',
  '|',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  '|',
  'bullet-list',
  'ordered-list',
  'blockquote',
  'code-block',
  '|',
  'image',
];

export const DEFAULT_BUBBLE_MENU_ITEMS: readonly OloMenuItemId[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  '|',
  'link',
];

const SEPARATOR: OloMenuItem = { id: '|', kind: 'separator' };

// ---- Active-state helpers --------------------------------------------------

export function isMarkActive(view: EditorView, type: MarkType): boolean {
  const { from, to, empty, $from } = view.state.selection;
  if (empty) return Boolean(type.isInSet(view.state.storedMarks ?? $from.marks()));
  return view.state.doc.rangeHasMark(from, to, type);
}

function isBlockTypeActive(
  view: EditorView,
  type: NodeType,
  attrs?: Record<string, unknown>,
): boolean {
  const { $from } = view.state.selection;
  const node = $from.parent;
  if (node.type !== type) return false;
  if (!attrs) return true;
  return Object.entries(attrs).every(([k, v]) => node.attrs[k] === v);
}

function isAncestorActive(view: EditorView, type: NodeType): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === type) return true;
  }
  return false;
}

// ---- Built-in item factories ----------------------------------------------

function makeMarkItem(
  schema: Schema,
  id: string,
  markName: string,
  meta: Pick<OloMenuItem, 'title' | 'iconKey' | 'shortcut'>,
): OloMenuItem | null {
  const type = schema.marks[markName];
  if (!type) return null;
  return {
    id,
    kind: 'button',
    ...meta,
    isActive: view => isMarkActive(view, type),
    run: view => {
      toggleMark(type)(view.state, view.dispatch, view);
      view.focus();
    },
  };
}

function makeBlockTypeItem(
  schema: Schema,
  id: string,
  nodeName: string,
  attrs: Record<string, unknown> | undefined,
  meta: Pick<OloMenuItem, 'title' | 'iconKey' | 'shortcut'>,
): OloMenuItem | null {
  const type = schema.nodes[nodeName];
  if (!type) return null;
  return {
    id,
    kind: 'button',
    ...meta,
    isActive: view => isBlockTypeActive(view, type, attrs),
    run: view => {
      // If we're already this block type, toggle back to paragraph for ergonomics.
      const isActive = isBlockTypeActive(view, type, attrs);
      const target = isActive ? schema.nodes['paragraph'] : type;
      if (!target) return;
      setBlockType(target, isActive ? undefined : attrs)(view.state, view.dispatch, view);
      view.focus();
    },
  };
}

function makeWrapItem(
  schema: Schema,
  id: string,
  nodeName: string,
  isListType: boolean,
  meta: Pick<OloMenuItem, 'title' | 'iconKey' | 'shortcut'>,
): OloMenuItem | null {
  const type = schema.nodes[nodeName];
  if (!type) return null;
  return {
    id,
    kind: 'button',
    ...meta,
    isActive: view => isAncestorActive(view, type),
    run: view => {
      const cmd = isListType ? wrapInList(type) : wrapIn(type);
      cmd(view.state, view.dispatch, view);
      view.focus();
    },
  };
}

/** Options for {@link buildMenuRegistry}. */
export interface OloMenuRegistryOptions {
  /**
   * If provided, the `image` item appears in the registry and runs this
   * callback on click. The callback typically opens a file picker and
   * forwards the chosen file through the configured `uploadImage` host
   * function. When omitted, the `image` id is silently dropped.
   */
  readonly onUploadImage?: (view: EditorView) => void;
}

/**
 * Build the registry of built-in menu items against a given schema. Items for
 * marks/nodes the schema doesn't include are simply omitted.
 */
export function buildMenuRegistry(
  schema: Schema,
  options?: OloMenuRegistryOptions,
): ReadonlyMap<string, OloMenuItem> {
  const candidates: (OloMenuItem | null)[] = [
    SEPARATOR,
    makeMarkItem(schema, 'bold', 'bold', { title: 'Bold', iconKey: 'bold', shortcut: 'Cmd+B' }),
    makeMarkItem(schema, 'italic', 'italic', { title: 'Italic', iconKey: 'italic', shortcut: 'Cmd+I' }),
    makeMarkItem(schema, 'underline', 'underline', { title: 'Underline', iconKey: 'underline', shortcut: 'Cmd+U' }),
    makeMarkItem(schema, 'strike', 'strike', { title: 'Strikethrough', iconKey: 'strike' }),
    makeMarkItem(schema, 'code', 'code', { title: 'Inline code', iconKey: 'code', shortcut: 'Cmd+`' }),
    {
      id: 'link',
      kind: 'link',
      title: 'Link',
      iconKey: 'link',
      shortcut: 'Cmd+K',
      isActive: view => {
        const linkType = view.state.schema.marks['link'];
        return linkType ? isMarkActive(view, linkType) : false;
      },
      isEnabled: view => !view.state.selection.empty,
    },
    makeBlockTypeItem(schema, 'paragraph', 'paragraph', undefined, {
      title: 'Paragraph',
      iconKey: 'text',
      shortcut: 'Shift+Cmd+0',
    }),
    makeBlockTypeItem(schema, 'heading-1', 'heading', { level: 1 }, {
      title: 'Heading 1',
      iconKey: 'heading1',
      shortcut: 'Shift+Cmd+1',
    }),
    makeBlockTypeItem(schema, 'heading-2', 'heading', { level: 2 }, {
      title: 'Heading 2',
      iconKey: 'heading2',
      shortcut: 'Shift+Cmd+2',
    }),
    makeBlockTypeItem(schema, 'heading-3', 'heading', { level: 3 }, {
      title: 'Heading 3',
      iconKey: 'heading3',
      shortcut: 'Shift+Cmd+3',
    }),
    makeWrapItem(schema, 'bullet-list', 'bullet_list', true, {
      title: 'Bulleted list',
      iconKey: 'list',
      shortcut: 'Shift+Cmd+8',
    }),
    makeWrapItem(schema, 'ordered-list', 'ordered_list', true, {
      title: 'Numbered list',
      iconKey: 'list-ordered',
      shortcut: 'Shift+Cmd+7',
    }),
    makeWrapItem(schema, 'blockquote', 'blockquote', false, { title: 'Quote', iconKey: 'quote' }),
    makeBlockTypeItem(schema, 'code-block', 'codeBlock', undefined, {
      title: 'Code block',
      iconKey: 'code-block',
    }),
    options?.onUploadImage && schema.nodes['image']
      ? {
          id: 'image',
          kind: 'button',
          title: 'Image',
          iconKey: 'image',
          run: options.onUploadImage,
        }
      : null,
  ];

  const map = new Map<string, OloMenuItem>();
  for (const item of candidates) {
    if (item) map.set(item.id, item);
  }
  return map;
}

/**
 * Resolve a list of item ids and/or full items against a registry. Unknown
 * ids are dropped silently. `|` always becomes a fresh separator.
 */
export function resolveMenuItems(
  registry: ReadonlyMap<string, OloMenuItem>,
  ids: readonly (string | OloMenuItem)[],
): readonly OloMenuItem[] {
  const out: OloMenuItem[] = [];
  for (const entry of ids) {
    if (typeof entry === 'string') {
      if (entry === '|') {
        out.push(SEPARATOR);
        continue;
      }
      const found = registry.get(entry);
      if (found) out.push(found);
    } else {
      out.push(entry);
    }
  }
  return out;
}
