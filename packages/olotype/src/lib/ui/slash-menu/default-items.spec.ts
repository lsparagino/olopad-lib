import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { oloDefaultSchema } from '../../core/schema';
import type { OloSlashMenuContext, OloTypeHandle } from '../../core/types';
import { OLO_DEFAULT_SLASH_ITEMS, filterSlashItems } from './default-items';

// ---- filterSlashItems -----------------------------------------------------

describe('filterSlashItems', () => {
  it('returns the full list when the query is empty', () => {
    expect(filterSlashItems(OLO_DEFAULT_SLASH_ITEMS, '')).toEqual(OLO_DEFAULT_SLASH_ITEMS);
  });

  it('matches against the title case-insensitively', () => {
    const out = filterSlashItems(OLO_DEFAULT_SLASH_ITEMS, 'HEAD');
    expect(out.map((i) => i.id)).toEqual(
      OLO_DEFAULT_SLASH_ITEMS.filter((i) => /head/i.test(i.title)).map((i) => i.id),
    );
  });

  it('matches against the description', () => {
    const out = filterSlashItems(OLO_DEFAULT_SLASH_ITEMS, 'preformatted');
    expect(out.map((i) => i.id)).toEqual(['code-block']);
  });

  it('matches against keywords', () => {
    const out = filterSlashItems(OLO_DEFAULT_SLASH_ITEMS, 'ul');
    expect(out.map((i) => i.id)).toContain('bullet-list');
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterSlashItems(OLO_DEFAULT_SLASH_ITEMS, 'xyzzy-zzz')).toEqual([]);
  });
});

// ---- onSelect transformations --------------------------------------------

function harness(text = '/h') {
  const doc = oloDefaultSchema.nodeFromJSON({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  let state = EditorState.create({ doc, schema: oloDefaultSchema });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, text.length + 1)));

  const fakeView = {
    get state() {
      return state;
    },
    dispatch(tr: ReturnType<EditorState['tr']['constructor']>) {
      state = state.apply(tr as never);
    },
    focus: () => {},
  } as unknown as EditorView;

  const ctx: OloSlashMenuContext = {
    view: fakeView,
    range: { from: 1, to: text.length + 1 },
    handle: {} as OloTypeHandle,
  };
  return {
    get state() {
      return state;
    },
    ctx,
  };
}

describe('default slash item onSelect handlers', () => {
  it('"heading-1" replaces the slash query and converts the block to a heading', () => {
    const h = harness('/h1');
    const item = OLO_DEFAULT_SLASH_ITEMS.find((i) => i.id === 'heading-1')!;
    item.onSelect(h.ctx);
    const first = h.state.doc.firstChild!;
    expect(first.type.name).toBe('heading');
    expect(first.attrs['level']).toBe(1);
    expect(first.textContent).toBe('');
  });

  it('"text" reverts a block to a paragraph and removes the slash query', () => {
    // Start from a heading containing `/p`
    const doc = oloDefaultSchema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '/p' }] },
      ],
    });
    let state = EditorState.create({ doc, schema: oloDefaultSchema });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));
    const view = {
      get state() { return state; },
      dispatch(tr: never) {
        state = state.apply(tr);
      },
      focus() {},
    } as unknown as EditorView;

    const item = OLO_DEFAULT_SLASH_ITEMS.find((i) => i.id === 'text')!;
    item.onSelect({ view, range: { from: 1, to: 3 }, handle: {} as OloTypeHandle });

    expect(state.doc.firstChild!.type.name).toBe('paragraph');
    expect(state.doc.firstChild!.textContent).toBe('');
  });

  it('"hr" inserts a horizontal rule after stripping the slash text', () => {
    const h = harness('/hr');
    const item = OLO_DEFAULT_SLASH_ITEMS.find((i) => i.id === 'hr')!;
    item.onSelect(h.ctx);
    const blockTypes = h.state.doc.children.map((c) => c.type.name);
    expect(blockTypes).toContain('horizontalRule');
  });

  it('"bullet-list" wraps the current block in a bullet_list', () => {
    const h = harness('/li');
    const item = OLO_DEFAULT_SLASH_ITEMS.find((i) => i.id === 'bullet-list')!;
    item.onSelect(h.ctx);
    expect(h.state.doc.firstChild!.type.name).toBe('bullet_list');
  });
});
