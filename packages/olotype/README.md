# @olopad/olotype

Notion-style block editor for Angular, built on [ProseMirror](https://prosemirror.net).

Standalone component. Signal-based API. Extensible schema. MIT.

> Design rationale, roadmap and full scope are documented in [OLOTYPE_PLAN.md](./OLOTYPE_PLAN.md). This README only covers what is implemented today (Phase 0 + slice of Phase 1).

## Status

**Phase 0 + 1 (core editing).** Bubble menu, slash menu, block handle, NodeView Angular bridge, and the image uploader are not yet shipped — see the plan.

## Install

```sh
npm install @olopad/olotype \
  prosemirror-state prosemirror-model prosemirror-view prosemirror-commands \
  prosemirror-keymap prosemirror-history prosemirror-schema-list prosemirror-inputrules
```

Then in your global styles (e.g. `styles.css`):

```css
@import '@olopad/olotype/theme/olo-type.css';
```

## Usage

```ts
import { Component, signal } from '@angular/core';
import { OloTypeComponent, emptyDoc, type OloDoc } from '@olopad/olotype';

@Component({
  standalone: true,
  imports: [OloTypeComponent],
  template: `
    <olo-type
      [(doc)]="doc"
      placeholder="Write your guidebook…"
      (changed)="onChange($event)"
    />
  `,
})
export class GuidebookEditor {
  readonly doc = signal<OloDoc>(emptyDoc());

  onChange(next: OloDoc) {
    // Persist `next` — this is JSON-safe with a versioned schema envelope.
  }
}
```

### Inputs

| Input | Type | Notes |
|---|---|---|
| `doc` | `WritableSignal<OloDoc>` (model) | Two-way bound persisted document. |
| `extensions` | `readonly OloExtension[]` | Host-registered nodes/marks/plugins. |
| `readOnly` | `boolean` | Disables editing. |
| `placeholder` | `string` | Shown when the doc is a single empty block. |

### Output

| Output | Type | Notes |
|---|---|---|
| `changed` | `OloDoc` | Fires on every document-changing transaction. The signal is the primary source of truth — use this output only when you need an imperative hook. |

### Imperative handle

```ts
import { ViewChild } from '@angular/core';
import { OloType } from '@olopad/olotype';

@ViewChild(OloType) editor!: OloType;
this.editor.focus();
this.editor.insertNode(someNode);
```

## Persistence format

```json
{
  "schemaVersion": 1,
  "doc": { "type": "doc", "content": [ /* ProseMirror JSON */ ] }
}
```

The wrapper carries a `schemaVersion` so we can migrate old docs forward as the default schema evolves. Migrations are pure functions registered in [`serialize.ts`](./src/lib/core/serialize.ts).

## Security

- Pasted URLs in `link.href` and `image.src` are sanitized: `javascript:`, `vbscript:`, and `data:` schemes are rejected.
- External links serialize with `rel="noopener noreferrer"` and `target="_blank"`.
- The schema is the trust boundary for paste — only declared nodes and marks survive.
- No `innerHTML` is used in the Angular layer; all DOM goes through ProseMirror's view.

## License

MIT
