import type { Node as PmNode, Schema } from 'prosemirror-model';
import type { Command, EditorState, Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Type } from '@angular/core';

/**
 * Current schema version. Bump whenever the default schema gains or removes
 * nodes/marks in a way that changes the persisted shape. Migrations live in
 * {@link ./serialize.ts}.
 */
export const OLO_DOC_SCHEMA_VERSION = 1;

/**
 * ProseMirror document JSON, as produced by `Node.toJSON()`. We keep this
 * loose by design — schema validation happens when we re-hydrate the node
 * through the Schema.
 */
export type OloDocJson = {
  readonly type: 'doc';
  readonly content?: readonly unknown[];
  readonly attrs?: Readonly<Record<string, unknown>>;
};

/**
 * Versioned persistence envelope. This is what hosts store and pass in/out of
 * the editor. Always carry the schema version so we can migrate old docs.
 */
export interface OloPersistedDoc {
  readonly schemaVersion: number;
  readonly doc: OloDocJson;
}

/** Convenience alias for the in-editor live document. */
export type OloDoc = OloPersistedDoc;

/**
 * Host-registered extension. An extension can contribute schema, plugins,
 * commands, and node views without forking the editor. v1 surface is small;
 * UI surfaces (slash menu, bubble menu) are added in Phase 2.
 */
export interface OloExtension {
  /** Unique key. Used for ordering, dedup, and debugging. */
  readonly name: string;

  /**
   * Schema contribution. Both maps are merged into the default schema in the
   * order extensions are registered. Collisions throw at editor build time
   * rather than silently overwriting.
   */
  readonly schema?: {
    readonly nodes?: Readonly<Record<string, unknown>>;
    readonly marks?: Readonly<Record<string, unknown>>;
  };

  /** Plugins are appended after the built-in plugins. */
  readonly plugins?: (schema: Schema) => readonly Plugin[];

  /**
   * Imperative commands callable via the editor handle. Names are flat —
   * pick something specific (`insertPlaceCard`, not `insert`).
   */
  readonly commands?: Readonly<Record<string, (...args: never[]) => Command>>;

  /**
   * Optional Angular component used as a NodeView for the named node. The
   * Angular-aware NodeView bridge is implemented in Phase 3; this field is
   * declared now so hosts can register up-front.
   */
  readonly nodeViews?: Readonly<Record<string, Type<unknown>>>;

  /**
   * Items contributed to the slash menu. Each item runs `onSelect` when
   * chosen; the `range` is the start/end of the slash query text the user
   * typed (so the handler typically removes it before inserting content).
   */
  readonly slashMenuItems?: readonly OloSlashMenuItem[];
}

/** A single entry in the slash menu. */
export interface OloSlashMenuItem {
  /** Stable id, used for keys and dedup. */
  readonly id: string;
  /** Display title shown in the menu. */
  readonly title: string;
  /** Secondary line shown under the title. */
  readonly description?: string;
  /**
   * Alternative search terms. The menu does a case-insensitive substring match
   * against title + description + these keywords.
   */
  readonly keywords?: readonly string[];
  /** Icon key from the built-in set, or arbitrary string for custom rendering. */
  readonly icon?: string;
  /**
   * Insertion handler. `range.from` and `range.to` are the positions of the
   * `/query` text the user typed — delete it before inserting your content.
   */
  readonly onSelect: (ctx: OloSlashMenuContext) => void;
}

/** Context passed to a slash menu item's `onSelect`. */
export interface OloSlashMenuContext {
  readonly view: EditorView;
  readonly range: { from: number; to: number };
  readonly handle: OloTypeHandle;
}

/**
 * Imperative editor handle exposed by the OloType component. Hosts that need
 * to drive the editor from outside the signal-based reactive flow use this.
 */
export interface OloTypeHandle {
  focus(): void;
  blur(): void;
  /** Direct access for advanced commands. Use with care; signal-first is preferred. */
  readonly state: EditorState | null;
  insertNode(node: PmNode): void;
  runCommand(command: Command): boolean;
}

/** Optional image uploader contract used by the image extension. */
export type OloImageUploader = (file: File) => Promise<OloUploadedImage>;

export interface OloUploadedImage {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  readonly alt?: string;
}
