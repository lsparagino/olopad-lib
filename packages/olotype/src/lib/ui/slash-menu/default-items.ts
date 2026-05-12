import { setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import type { OloSlashMenuContext, OloSlashMenuItem } from '../../core/types';

/**
 * Replace the `/query` range with whatever transformation `apply` performs.
 * Returns true if a transformation actually ran.
 */
function replaceRangeWith(
  ctx: OloSlashMenuContext,
  apply: (view: typeof ctx.view) => void,
): void {
  const { view, range } = ctx;
  // Delete the slash query text, then run the apply step. Doing it in two
  // dispatches keeps the apply step's command logic agnostic to the range —
  // it just operates on whatever block now holds the cursor.
  view.dispatch(view.state.tr.delete(range.from, range.to));
  apply(view);
  view.focus();
}

export const OLO_DEFAULT_SLASH_ITEMS: readonly OloSlashMenuItem[] = [
  {
    id: 'text',
    title: 'Text',
    description: 'Plain paragraph',
    keywords: ['paragraph', 'p'],
    icon: 'text',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['paragraph'];
        if (type) setBlockType(type)(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'heading-1',
    title: 'Heading 1',
    description: 'Large section title',
    keywords: ['h1', 'title'],
    icon: 'heading1',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['heading'];
        if (type) setBlockType(type, { level: 1 })(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'heading-2',
    title: 'Heading 2',
    description: 'Section subtitle',
    keywords: ['h2', 'subtitle'],
    icon: 'heading2',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['heading'];
        if (type) setBlockType(type, { level: 2 })(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'heading-3',
    title: 'Heading 3',
    keywords: ['h3'],
    icon: 'heading3',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['heading'];
        if (type) setBlockType(type, { level: 3 })(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'bullet-list',
    title: 'Bulleted list',
    description: 'Unordered list of items',
    keywords: ['ul', 'list', 'bullet'],
    icon: 'list',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['bullet_list'];
        if (type) wrapInList(type)(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'ordered-list',
    title: 'Numbered list',
    description: 'Ordered list of items',
    keywords: ['ol', 'list', 'numbered'],
    icon: 'list-ordered',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['ordered_list'];
        if (type) wrapInList(type)(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'blockquote',
    title: 'Quote',
    description: 'Pull quote',
    keywords: ['quote', 'blockquote'],
    icon: 'quote',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['blockquote'];
        if (type) wrapIn(type)(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'code-block',
    title: 'Code block',
    description: 'Preformatted code',
    keywords: ['code', 'pre'],
    icon: 'code-block',
    onSelect(ctx) {
      replaceRangeWith(ctx, view => {
        const type = view.state.schema.nodes['codeBlock'];
        if (type) setBlockType(type)(view.state, view.dispatch);
      });
    },
  },
  {
    id: 'hr',
    title: 'Divider',
    description: 'Horizontal rule',
    keywords: ['hr', 'divider', 'separator'],
    icon: 'hr',
    onSelect(ctx) {
      const { view } = ctx;
      const type = view.state.schema.nodes['horizontalRule'];
      if (!type) return;
      replaceRangeWith(ctx, () => {
        view.dispatch(view.state.tr.replaceSelectionWith(type.create()).scrollIntoView());
      });
    },
  },
];

/** Case-insensitive substring filter across title + description + keywords. */
export function filterSlashItems(
  items: readonly OloSlashMenuItem[],
  query: string,
): readonly OloSlashMenuItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(item => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.description?.toLowerCase().includes(q)) return true;
    return item.keywords?.some(k => k.toLowerCase().includes(q)) ?? false;
  });
}
