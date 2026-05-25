import { describe, expect, it } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { oloDefaultSchema } from '../core/schema';
import {
  buildMenuRegistry,
  DEFAULT_BUBBLE_MENU_ITEMS,
  DEFAULT_TOOLBAR_ITEMS,
  isMarkActive,
  resolveMenuItems,
  type OloMenuItem,
} from './menu-items';

// ---- Helpers --------------------------------------------------------------

function fakeView(state: EditorState): EditorView {
  return { state, dispatch: () => {}, focus: () => {} } as unknown as EditorView;
}

function paragraphState(text = 'hello') {
  const doc = oloDefaultSchema.nodeFromJSON({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  return EditorState.create({ doc, schema: oloDefaultSchema });
}

// ---- buildMenuRegistry ----------------------------------------------------

describe('buildMenuRegistry', () => {
  it('contains entries for every default toolbar id present in the schema (with image uploader)', () => {
    const registry = buildMenuRegistry(oloDefaultSchema, { onUploadImage: () => {} });
    for (const id of DEFAULT_TOOLBAR_ITEMS) {
      if (id === '|') continue;
      expect(registry.has(id), `registry missing "${id}"`).toBe(true);
    }
  });

  it('omits the image item when no onUploadImage is provided', () => {
    const registry = buildMenuRegistry(oloDefaultSchema);
    expect(registry.has('image')).toBe(false);
  });

  it('returns a separator entry under the "|" id', () => {
    const registry = buildMenuRegistry(oloDefaultSchema);
    expect(registry.get('|')?.kind).toBe('separator');
  });

  it('emits the link item as kind="link" with an isEnabled gate on non-empty selection', () => {
    const registry = buildMenuRegistry(oloDefaultSchema);
    const link = registry.get('link')!;
    expect(link.kind).toBe('link');

    const empty = paragraphState();
    expect(link.isEnabled!(fakeView(empty))).toBe(false);

    const withSel = empty.apply(
      empty.tr.setSelection(TextSelection.create(empty.doc, 1, 4)),
    );
    expect(link.isEnabled!(fakeView(withSel))).toBe(true);
  });

  it('omits items whose mark/node type is missing from the schema', () => {
    // Rebuild the schema without italic, by shrinking the mark set. The
    // registry should then have no `italic` entry but still keep `bold`.
    const reduced = new Schema({
      nodes: oloDefaultSchema.spec.nodes,
      marks: oloDefaultSchema.spec.marks.remove('italic'),
    });
    const registry = buildMenuRegistry(reduced);
    expect(registry.has('italic')).toBe(false);
    expect(registry.has('bold')).toBe(true);
  });
});

// ---- resolveMenuItems -----------------------------------------------------

describe('resolveMenuItems', () => {
  // Build with onUploadImage so the image item is present — the toolbar
  // default list includes 'image'.
  const registry = buildMenuRegistry(oloDefaultSchema, { onUploadImage: () => {} });

  it('returns matching registry items in the order requested', () => {
    const out = resolveMenuItems(registry, ['bold', 'italic']);
    expect(out.map((i) => i.id)).toEqual(['bold', 'italic']);
  });

  it('always converts "|" into a separator', () => {
    const out = resolveMenuItems(registry, ['bold', '|', 'italic']);
    expect(out[1].kind).toBe('separator');
  });

  it('drops unknown ids silently', () => {
    const out = resolveMenuItems(registry, ['bold', 'nope', 'italic']);
    expect(out.map((i) => i.id)).toEqual(['bold', 'italic']);
  });

  it('passes full OloMenuItem objects through unchanged', () => {
    const custom: OloMenuItem = { id: 'custom', kind: 'button', title: 'X' };
    const out = resolveMenuItems(registry, [custom]);
    expect(out).toEqual([custom]);
  });

  it('resolves all DEFAULT_TOOLBAR_ITEMS without dropouts', () => {
    const out = resolveMenuItems(registry, DEFAULT_TOOLBAR_ITEMS);
    expect(out.length).toBe(DEFAULT_TOOLBAR_ITEMS.length);
  });

  it('resolves all DEFAULT_BUBBLE_MENU_ITEMS without dropouts', () => {
    const out = resolveMenuItems(registry, DEFAULT_BUBBLE_MENU_ITEMS);
    expect(out.length).toBe(DEFAULT_BUBBLE_MENU_ITEMS.length);
  });
});

// ---- isMarkActive ---------------------------------------------------------

describe('isMarkActive', () => {
  const boldType = oloDefaultSchema.marks['bold'];

  it('returns false when the selection is empty and no stored bold mark is set', () => {
    const state = paragraphState();
    expect(isMarkActive(fakeView(state), boldType)).toBe(false);
  });

  it('returns true when the entire selection carries the mark', () => {
    const doc = oloDefaultSchema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }],
        },
      ],
    });
    let state = EditorState.create({ doc, schema: oloDefaultSchema });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 3)));
    expect(isMarkActive(fakeView(state), boldType)).toBe(true);
  });

  it('returns true when any part of the selection carries the mark (any-of semantics)', () => {
    // doc: paragraph(text "a" + bold("b") + text "c"). The toolbar's bold
    // button is "active" if the selection touches *any* bold character —
    // this is the Notion/Docs UX (toggling then strips the partial mark).
    const doc = oloDefaultSchema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'c' },
          ],
        },
      ],
    });
    let state = EditorState.create({ doc, schema: oloDefaultSchema });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 4)));
    expect(isMarkActive(fakeView(state), boldType)).toBe(true);
  });

  it('returns false when no character in the selection carries the mark', () => {
    const doc = oloDefaultSchema.nodeFromJSON({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }],
    });
    let state = EditorState.create({ doc, schema: oloDefaultSchema });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
    expect(isMarkActive(fakeView(state), boldType)).toBe(false);
  });
});
