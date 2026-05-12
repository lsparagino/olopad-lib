import { describe, expect, it } from 'vitest';
import { oloDefaultSchema } from './schema';
import { emptyDoc, migrateDoc, parseDoc, serializeDoc } from './serialize';
import { OLO_DOC_SCHEMA_VERSION, type OloPersistedDoc } from './types';

describe('emptyDoc', () => {
  it('returns an envelope at the current schema version', () => {
    const doc = emptyDoc();
    expect(doc.schemaVersion).toBe(OLO_DOC_SCHEMA_VERSION);
    expect(doc.doc.type).toBe('doc');
  });

  it('contains exactly one empty paragraph', () => {
    const doc = emptyDoc();
    expect(doc.doc.content).toEqual([{ type: 'paragraph' }]);
  });
});

describe('migrateDoc', () => {
  it('returns the input unchanged when already at the current version', () => {
    const input = emptyDoc();
    const out = migrateDoc(input);
    expect(out.schemaVersion).toBe(OLO_DOC_SCHEMA_VERSION);
    expect(out.doc).toEqual(input.doc);
  });

  it('throws if a migration is missing for the persisted version', () => {
    const stale: OloPersistedDoc = {
      schemaVersion: OLO_DOC_SCHEMA_VERSION - 1,
      doc: { type: 'doc', content: [{ type: 'paragraph' }] },
    };
    expect(() => migrateDoc(stale)).toThrow(/no migration registered/i);
  });
});

describe('parseDoc / serializeDoc', () => {
  it('round-trips a simple document', () => {
    const original = emptyDoc();
    const node = parseDoc(oloDefaultSchema, original);
    expect(serializeDoc(node).doc).toEqual(original.doc);
  });

  it('round-trips a heading with inline marks', () => {
    const input: OloPersistedDoc = {
      schemaVersion: OLO_DOC_SCHEMA_VERSION,
      doc: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'world' },
            ],
          },
        ],
      },
    };
    const node = parseDoc(oloDefaultSchema, input);
    expect(serializeDoc(node).doc).toEqual(input.doc);
  });

  it('throws when the JSON has a node not declared in the schema', () => {
    const input: OloPersistedDoc = {
      schemaVersion: OLO_DOC_SCHEMA_VERSION,
      doc: { type: 'doc', content: [{ type: 'placeCard', attrs: { placeId: 'x' } }] },
    };
    expect(() => parseDoc(oloDefaultSchema, input)).toThrow();
  });

  it('serializeDoc tags the output with the current schema version', () => {
    const node = parseDoc(oloDefaultSchema, emptyDoc());
    expect(serializeDoc(node).schemaVersion).toBe(OLO_DOC_SCHEMA_VERSION);
  });
});
