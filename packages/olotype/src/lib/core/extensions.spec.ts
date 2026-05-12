import { describe, expect, it, vi } from 'vitest';
import type { NodeSpec, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { buildSchema, collectExtensionPlugins } from './extensions';
import { oloDefaultSchema } from './schema';
import type { OloExtension } from './types';

const calloutNode: NodeSpec = {
  group: 'block',
  content: 'inline*',
  attrs: { variant: { default: 'info' } },
  toDOM: () => ['div', { class: 'olo-callout' }, 0],
};

const calloutExtension: OloExtension = {
  name: 'callout',
  schema: { nodes: { callout: calloutNode } },
};

const customMarkExtension: OloExtension = {
  name: 'highlight',
  schema: {
    marks: {
      highlight: {
        toDOM: () => ['mark', 0],
        parseDOM: [{ tag: 'mark' }],
      },
    },
  },
};

describe('buildSchema', () => {
  it('returns the default schema when no extensions are provided', () => {
    expect(buildSchema([])).toBe(oloDefaultSchema);
  });

  it('merges extension-contributed nodes into the schema', () => {
    const schema = buildSchema([calloutExtension]);
    expect(schema.nodes['callout']).toBeDefined();
    expect(schema.nodes['paragraph']).toBeDefined();
  });

  it('merges extension-contributed marks into the schema', () => {
    const schema = buildSchema([customMarkExtension]);
    expect(schema.marks['highlight']).toBeDefined();
    expect(schema.marks['bold']).toBeDefined();
  });

  it('throws when an extension redefines a built-in node name', () => {
    const evil: OloExtension = {
      name: 'evil',
      schema: { nodes: { paragraph: calloutNode } },
    };
    expect(() => buildSchema([evil])).toThrow(/redefines node "paragraph"/);
  });

  it('throws when two extensions claim the same node name', () => {
    const a: OloExtension = { name: 'a', schema: { nodes: { foo: calloutNode } } };
    const b: OloExtension = { name: 'b', schema: { nodes: { foo: calloutNode } } };
    expect(() => buildSchema([a, b])).toThrow(/extension "b" redefines node "foo"/);
  });

  it('throws when an extension redefines a built-in mark name', () => {
    const evil: OloExtension = {
      name: 'evil',
      schema: { marks: { bold: { toDOM: () => ['b', 0] } } },
    };
    expect(() => buildSchema([evil])).toThrow(/redefines mark "bold"/);
  });
});

describe('collectExtensionPlugins', () => {
  function fakePlugin(): Plugin {
    return new Plugin({});
  }

  it('returns an empty array when no extensions contribute plugins', () => {
    expect(collectExtensionPlugins([], oloDefaultSchema)).toEqual([]);
  });

  it('flattens plugins in the order extensions were registered', () => {
    const pA = fakePlugin();
    const pB1 = fakePlugin();
    const pB2 = fakePlugin();
    const a: OloExtension = { name: 'a', plugins: () => [pA] };
    const b: OloExtension = { name: 'b', plugins: () => [pB1, pB2] };
    expect(collectExtensionPlugins([a, b], oloDefaultSchema)).toEqual([pA, pB1, pB2]);
  });

  it('passes the built schema through to each extensions plugin factory', () => {
    const factory = vi.fn((_schema: Schema) => [] as Plugin[]);
    const ext: OloExtension = { name: 'x', plugins: factory };
    collectExtensionPlugins([ext], oloDefaultSchema);
    expect(factory).toHaveBeenCalledWith(oloDefaultSchema);
  });
});
