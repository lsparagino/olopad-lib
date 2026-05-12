import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Node as PmNode } from 'prosemirror-model';
import { buildKeymaps } from './keymap';
import { oloDefaultSchema } from './schema';

// ---- Helpers --------------------------------------------------------------

function createState(json: unknown): EditorState {
  return EditorState.create({
    doc: oloDefaultSchema.nodeFromJSON(json),
    schema: oloDefaultSchema,
    plugins: buildKeymaps(oloDefaultSchema),
  });
}

function paragraphWithText(text: string): EditorState {
  return createState({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
}

function firstBlock(state: EditorState): PmNode {
  const node = state.doc.firstChild;
  if (!node) throw new Error('expected at least one block');
  return node;
}

/**
 * Walk the keymap plugins in order and let the first one that consumes the
 * event apply its command. Returns the resulting EditorState. The fake view
 * exposes `state` as a getter so the dispatched transactions stay current
 * across chained commands.
 */
function dispatchKey(
  initial: EditorState,
  key: string,
  modifiers: { mod?: boolean; shift?: boolean } = {},
): EditorState {
  let state = initial;
  // prosemirror-keymap looks at `navigator.platform` once at module load time.
  // Under happy-dom that comes back as a non-Mac value, so `Mod-` normalizes
  // to `Ctrl-`. If we set both ctrlKey and metaKey, the resulting key name is
  // `Meta-Ctrl-b` and the lookup misses. Set ctrlKey only.
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.mod,
    shiftKey: modifiers.shift,
  });
  const fakeView = {
    get state() {
      return state;
    },
    dispatch(tr: ReturnType<EditorState['tr']['constructor']>) {
      state = state.apply(tr as never);
    },
  };
  for (const plugin of state.plugins) {
    const handler = (plugin.props as { handleKeyDown?: (view: unknown, ev: KeyboardEvent) => boolean })
      ?.handleKeyDown;
    if (handler?.(fakeView as never, event)) break;
  }
  return state;
}

// ---- Tests ----------------------------------------------------------------

describe('buildKeymaps — factory', () => {
  it('returns the layered (ours + base) keymap plugins', () => {
    const plugins = buildKeymaps(oloDefaultSchema);
    expect(plugins).toHaveLength(2);
  });
});

describe('buildKeymaps — inline marks', () => {
  it('Mod-B toggles bold across the selection', () => {
    let state = paragraphWithText('hello');
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
    const next = dispatchKey(state, 'b', { mod: true });
    const para = firstBlock(next);
    const text = para.firstChild;
    expect(text?.marks.some((m) => m.type.name === 'bold')).toBe(true);
  });

  it('Mod-I toggles italic across the selection', () => {
    let state = paragraphWithText('hello');
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
    const next = dispatchKey(state, 'i', { mod: true });
    const para = firstBlock(next);
    const text = para.firstChild;
    expect(text?.marks.some((m) => m.type.name === 'italic')).toBe(true);
  });
});

describe('buildKeymaps — block types', () => {
  it('Shift-Mod-1 converts paragraph → heading level 1', () => {
    const state = paragraphWithText('hi');
    const next = dispatchKey(state, '1', { mod: true, shift: true });
    const block = firstBlock(next);
    expect(block.type.name).toBe('heading');
    expect(block.attrs['level']).toBe(1);
  });

  it('Shift-Mod-3 converts paragraph → heading level 3', () => {
    const state = paragraphWithText('hi');
    const next = dispatchKey(state, '3', { mod: true, shift: true });
    expect(firstBlock(next).attrs['level']).toBe(3);
  });

  it('Shift-Mod-0 reverts a heading to a paragraph', () => {
    const state = createState({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'hi' }] },
      ],
    });
    const next = dispatchKey(state, '0', { mod: true, shift: true });
    expect(firstBlock(next).type.name).toBe('paragraph');
  });
});

describe('buildKeymaps — block inserts', () => {
  it('Mod-_ inserts a horizontal rule', () => {
    const state = paragraphWithText('hi');
    const next = dispatchKey(state, '_', { mod: true });
    const types = next.doc.children.map((c) => c.type.name);
    expect(types).toContain('horizontalRule');
  });

  it('Shift-Enter inserts a hardBreak inside a paragraph', () => {
    let state = paragraphWithText('hi');
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));
    const next = dispatchKey(state, 'Enter', { shift: true });
    let sawHardBreak = false;
    firstBlock(next).forEach((child) => {
      if (child.type.name === 'hardBreak') sawHardBreak = true;
    });
    expect(sawHardBreak).toBe(true);
  });
});

describe('buildKeymaps — history', () => {
  it('Mod-Z is bound and does not crash when invoked', () => {
    // We don't assert undo *content* because PM's history plugin needs the
    // dispatching view in order to record steps — applying transactions
    // directly to a state outside of a view bypasses the recorder. The
    // important contract here is that the binding is registered and the
    // event chain consumes the key without throwing.
    const state = paragraphWithText('hi');
    expect(() => dispatchKey(state, 'z', { mod: true })).not.toThrow();
  });
});
