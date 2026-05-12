import { history } from 'prosemirror-history';
import {
  ellipsis,
  emDash,
  inputRules,
  smartQuotes,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import type { NodeType, Schema } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

/**
 * `# `, `## `, `### ` at the start of a textblock → heading of that level.
 * `> ` → blockquote. `- ` / `* ` → bullet list. `1. ` → ordered list.
 */
function buildInputRules(schema: Schema): Plugin {
  const rules = [...smartQuotes, ellipsis, emDash];

  const heading = schema.nodes['heading'];
  if (heading) {
    rules.push(
      textblockTypeInputRule(/^(#{1,3})\s$/, heading, match => ({ level: match[1].length })),
    );
  }

  const blockquote = schema.nodes['blockquote'];
  if (blockquote) rules.push(wrappingInputRule(/^\s*>\s$/, blockquote));

  const bulletList = schema.nodes['bullet_list'];
  if (bulletList) rules.push(wrappingInputRule(/^\s*([-+*])\s$/, bulletList));

  const orderedList = schema.nodes['ordered_list'] as NodeType | undefined;
  if (orderedList) {
    rules.push(
      wrappingInputRule(
        /^(\d+)\.\s$/,
        orderedList,
        match => ({ order: +match[1] }),
        (match, node) => node.childCount + (node.attrs['order'] as number) === +match[1],
      ),
    );
  }

  return inputRules({ rules });
}

const PLACEHOLDER_KEY = new PluginKey('olotype-placeholder');

/**
 * Show a placeholder (via CSS `::before` on an empty top-level block) when
 * the document contains only a single empty block. We render it as a
 * decoration so the actual document remains empty.
 */
function placeholderPlugin(placeholder: () => string): Plugin {
  return new Plugin({
    key: PLACEHOLDER_KEY,
    props: {
      decorations(state) {
        const text = placeholder();
        if (!text) return null;

        const doc = state.doc;
        if (doc.childCount !== 1) return null;
        const firstChild = doc.firstChild;
        if (!firstChild || firstChild.content.size !== 0) return null;
        if (firstChild.type.name !== 'paragraph' && firstChild.type.name !== 'heading') {
          return null;
        }

        const deco = Decoration.node(0, firstChild.nodeSize, {
          class: 'olo-type-empty',
          'data-placeholder': text,
        });
        return DecorationSet.create(doc, [deco]);
      },
    },
  });
}

export function buildBasePlugins(schema: Schema, placeholder: () => string): Plugin[] {
  return [history(), buildInputRules(schema), placeholderPlugin(placeholder)];
}

/** Plugin that triggers a callback on every document change. */
export function changeReporterPlugin(onChange: (view: EditorView) => void): Plugin {
  return new Plugin({
    view: () => ({
      update: (view, prev) => {
        if (!view.state.doc.eq(prev.doc)) onChange(view);
      },
    }),
  });
}
