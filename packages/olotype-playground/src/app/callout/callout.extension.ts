import type { OloExtension } from '@olopad/olotype';
import type { Node as PmNode, NodeSpec } from 'prosemirror-model';
import { CalloutComponent } from './callout.component';

const calloutNode: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: { variant: { default: 'info' } },
  toDOM: (node: PmNode) => [
    'aside',
    {
      class: `olo-callout olo-callout--${node.attrs['variant']}`,
      'data-variant': node.attrs['variant'],
    },
    0,
  ],
  parseDOM: [
    {
      tag: 'aside.olo-callout',
      getAttrs: (dom: HTMLElement) => ({
        variant: dom.dataset['variant'] ?? 'info',
      }),
    },
  ],
};

/**
 * Demo extension: a non-atom `callout` block. The block carries a `variant`
 * attr (info/warning/success/danger), wraps inline-or-block content, and is
 * rendered by an Angular component through the NodeView bridge.
 */
export const CalloutExtension: OloExtension = {
  name: 'callout',
  schema: { nodes: { callout: calloutNode } },
  nodeViews: {
    callout: CalloutComponent,
  },
  slashMenuItems: [
    {
      id: 'callout-info',
      title: 'Callout',
      description: 'Highlighted block with variants',
      keywords: ['info', 'warning', 'note', 'tip', 'aside'],
      icon: 'quote',
      onSelect: ({ view, range }) => {
        const type = view.state.schema.nodes['callout'];
        const paragraph = view.state.schema.nodes['paragraph'];
        if (!type || !paragraph) return;
        const node = type.create({ variant: 'info' }, paragraph.create());
        view.dispatch(view.state.tr.replaceRangeWith(range.from, range.to, node).scrollIntoView());
        view.focus();
      },
    },
  ],
};
