import { Node as PmNode, type Schema } from 'prosemirror-model';
import { OLO_DOC_SCHEMA_VERSION, type OloDocJson, type OloPersistedDoc } from './types';

/**
 * A migration is invoked once per version step until the document reaches
 * {@link OLO_DOC_SCHEMA_VERSION}. Keep migrations pure and deterministic.
 */
export type OloDocMigration = (doc: OloDocJson) => OloDocJson;

const MIGRATIONS: ReadonlyMap<number, OloDocMigration> = new Map([
  // Example future entry:
  // [1, (doc) => /* migrate v1 → v2 */ doc],
]);

export function migrateDoc(persisted: OloPersistedDoc): OloPersistedDoc {
  let { schemaVersion, doc } = persisted;
  while (schemaVersion < OLO_DOC_SCHEMA_VERSION) {
    const migrate = MIGRATIONS.get(schemaVersion);
    if (!migrate) {
      throw new Error(`OloType: no migration registered for schema version ${schemaVersion}`);
    }
    doc = migrate(doc);
    schemaVersion += 1;
  }
  return { schemaVersion, doc };
}

/** Build an empty persisted doc with a single empty paragraph. */
export function emptyDoc(): OloPersistedDoc {
  return {
    schemaVersion: OLO_DOC_SCHEMA_VERSION,
    doc: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}

export function parseDoc(schema: Schema, persisted: OloPersistedDoc): PmNode {
  const migrated = migrateDoc(persisted);
  // `Node.fromJSON` validates against the schema and throws on mismatch.
  return schema.nodeFromJSON(migrated.doc);
}

export function serializeDoc(node: PmNode): OloPersistedDoc {
  return {
    schemaVersion: OLO_DOC_SCHEMA_VERSION,
    doc: node.toJSON() as OloDocJson,
  };
}
