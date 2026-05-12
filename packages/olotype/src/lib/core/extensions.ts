import { Schema, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import type { Plugin } from 'prosemirror-state';
import { oloDefaultSchema } from './schema';
import type { OloExtension } from './types';

/**
 * Build a Schema from the default OloType schema plus any host extensions.
 * Collisions on node/mark names throw — silent overwrite would let an
 * extension hijack a built-in node like `paragraph`.
 */
export function buildSchema(extensions: readonly OloExtension[]): Schema {
  if (extensions.length === 0) return oloDefaultSchema;

  const nodes: Record<string, NodeSpec> = {};
  oloDefaultSchema.spec.nodes.forEach((name, spec) => {
    nodes[name] = spec;
  });

  const marks: Record<string, MarkSpec> = {};
  oloDefaultSchema.spec.marks.forEach((name, spec) => {
    marks[name] = spec;
  });

  for (const ext of extensions) {
    if (ext.schema?.nodes) {
      for (const [name, spec] of Object.entries(ext.schema.nodes)) {
        if (name in nodes) {
          throw new Error(`OloType extension "${ext.name}" redefines node "${name}"`);
        }
        nodes[name] = spec as NodeSpec;
      }
    }
    if (ext.schema?.marks) {
      for (const [name, spec] of Object.entries(ext.schema.marks)) {
        if (name in marks) {
          throw new Error(`OloType extension "${ext.name}" redefines mark "${name}"`);
        }
        marks[name] = spec as MarkSpec;
      }
    }
  }

  return new Schema({
    nodes: nodes as unknown as Schema['spec']['nodes'],
    marks: marks as unknown as Schema['spec']['marks'],
  });
}

export function collectExtensionPlugins(
  extensions: readonly OloExtension[],
  schema: Schema,
): Plugin[] {
  const plugins: Plugin[] = [];
  for (const ext of extensions) {
    if (ext.plugins) plugins.push(...ext.plugins(schema));
  }
  return plugins;
}
