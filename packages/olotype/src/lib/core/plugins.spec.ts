import { describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { oloDefaultSchema } from './schema';
import { buildBasePlugins, changeReporterPlugin } from './plugins';

// ---- Helpers --------------------------------------------------------------

function createState(json: unknown, placeholder = ''): EditorState {
  return EditorState.create({
    doc: oloDefaultSchema.nodeFromJSON(json),
    schema: oloDefaultSchema,
    plugins: buildBasePlugins(oloDefaultSchema, () => placeholder),
  });
}

function mountView(initialDoc: unknown): { view: EditorView; host: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const state = EditorState.create({
    schema: oloDefaultSchema,
    doc: oloDefaultSchema.nodeFromJSON(initialDoc),
    plugins: buildBasePlugins(oloDefaultSchema, () => ''),
  });
  const view = new EditorView(host, { state });
  return { view, host };
}

function typeText(view: EditorView, text: string): void {
  let tr = view.state.tr;
  for (const ch of text) tr = tr.insertText(ch);
  view.dispatch(tr);
}

function mountWithChangeReporter(
  doc: unknown,
  onChange: (view: EditorView) => void = () => {},
): { view: EditorView; host: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const state = EditorState.create({
    schema: oloDefaultSchema,
    doc: oloDefaultSchema.nodeFromJSON(doc),
    plugins: [changeReporterPlugin(onChange)],
  });
  return { view: new EditorView(host, { state }), host };
}

// ---- Tests ----------------------------------------------------------------

describe('placeholderPlugin', () => {
  // The placeholder plugin is the third entry returned by buildBasePlugins
  // (after `history()` and `buildInputRules`).
  const PLACEHOLDER_INDEX = 2;

  it('emits a placeholder decoration on a single empty paragraph', () => {
    const state = createState({ type: 'doc', content: [{ type: 'paragraph' }] }, 'Write…');
    const decoSet = state.plugins[PLACEHOLDER_INDEX].props?.decorations?.(state);
    expect(decoSet?.find().length).toBe(1);
  });

  it('does not render a placeholder when content is present', () => {
    const state = createState(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
      'Write…',
    );
    const decoSet = state.plugins[PLACEHOLDER_INDEX].props?.decorations?.(state);
    expect(decoSet?.find().length ?? 0).toBe(0);
  });

  it('does not render a placeholder when the doc has multiple blocks', () => {
    const state = createState(
      { type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph' }] },
      'Write…',
    );
    const decoSet = state.plugins[PLACEHOLDER_INDEX].props?.decorations?.(state);
    expect(decoSet?.find().length ?? 0).toBe(0);
  });

  it('does not render a placeholder when the placeholder text is empty', () => {
    const state = createState({ type: 'doc', content: [{ type: 'paragraph' }] }, '');
    const decoSet = state.plugins[PLACEHOLDER_INDEX].props?.decorations?.(state);
    expect(decoSet).toBeNull();
  });

  it('renders a placeholder over an empty heading block', () => {
    const state = createState(
      { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] },
      'Title…',
    );
    const decoSet = state.plugins[PLACEHOLDER_INDEX].props?.decorations?.(state);
    expect(decoSet?.find().length).toBe(1);
  });
});

describe('buildInputRules', () => {
  // PM's input rules require keyboard-driven text input via the DOM; happy-dom
  // does not synthesize beforeinput events the way PM expects, so we limit
  // ourselves to verifying the plugin set up cleanly and typing through the
  // transaction API does not throw.

  it('registers a plugin that does not break on text insertion via transactions', () => {
    const { view, host } = mountView({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(view.state.plugins.length).toBeGreaterThan(0);
    expect(() => typeText(view, 'hello')).not.toThrow();
    view.destroy();
    host.remove();
  });
});

describe('changeReporterPlugin', () => {
  it('fires on a document-changing transaction', () => {
    const onChange = vi.fn();
    const { view, host } = mountWithChangeReporter(
      { type: 'doc', content: [{ type: 'paragraph' }] },
      onChange,
    );
    view.dispatch(view.state.tr.insertText('hi'));
    expect(onChange).toHaveBeenCalledTimes(1);
    view.destroy();
    host.remove();
  });

  it('does not fire on a pure selection change', () => {
    const onChange = vi.fn();
    const { view, host } = mountWithChangeReporter(
      {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'abcd' }] }],
      },
      onChange,
    );
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    expect(onChange).not.toHaveBeenCalled();
    view.destroy();
    host.remove();
  });
});
