# OloType — Plan

Standalone WYSIWYG editor library for the Olopad ecosystem. Built once, consumed by OloMaps (first), then by future Olopad apps that need rich text editing.

> This is a sibling project, not part of the OloMaps repo. OloMaps will install it as a library and use it for the Guidebook content blocks ([IMPLEMENTATION_PLAN.md §4](IMPLEMENTATION_PLAN.md)).

## Status

**Phases 0–3 shipped** (as of 2026-05-12). Phases 4–5 remain.

Currently lives as a workspace package in the `olopad-lib` monorepo (`packages/olotype/`) rather than its own repo — same eventual external shape (`@olopad/olotype`, MIT, ng-packagr) but easier to iterate on alongside the rest of the Olopad packages during early development. Promote to a standalone repo once the API stabilizes and external consumers appear. A dev-harness app lives at `packages/olotype-playground/` (private, not published).

## Goals

1. **Headless-friendly Angular component** — embed in any standalone-Angular app with one tag. Signal-based API (matches the rest of the Olopad stack).
2. **Notion-style UX** — block-based content, slash menu for inserting blocks, floating bubble menu for inline formatting, drag-to-reorder.
3. **Extensible schema** — host apps register custom node types (e.g. OloMaps's place card, itinerary embed) without forking the editor.
4. **No vendor pricing trap** — MIT licensed all the way down. No "Pro features behind paywall."
5. **Persistence format we own** — JSON document, versioned schema, deterministic round-trip.

Non-goals (for v1):
- Real-time collaboration. (Designed for it via the foundation; not shipped in v1.)
- Markdown round-tripping. (Possible later; not v1.)
- Plugin marketplace, themes, etc.

## Why ProseMirror

We're building UI on top of [**ProseMirror**](https://prosemirror.net) — the engine that TipTap, Atlassian Editor, Notion, and the NYT editor all wrap. MIT, no commercial restrictions, no vendor.

What ProseMirror gives us for free:
- Schema-driven document model (we declare allowed nodes/marks; PM enforces validity)
- Transactional state machine with undo/redo
- Operational-transform-ready primitives (sets us up for collab later)
- Selection, IME, paste sanitization, mobile selection
- Plugin system for keymaps, decorations, commands
- 15 years of edge-case bug fixing for contenteditable

What we're explicitly **not** taking:
- TipTap's wrapper — too much pricing pressure on the extension ecosystem, and it adds an abstraction layer over PM that we don't need.
- Lexical (Meta) — newer, smaller ecosystem, less battle-tested. ProseMirror's maturity wins.
- Quill 2.x — simpler but harder to extend for custom blocks like place cards.
- Pure `contenteditable` — six months of edge-case bugs nobody should re-implement.

We pay for the maturity by carrying a slightly larger bundle (~150 KB minified+gzipped for `prosemirror-*` core packages). Acceptable.

## Repository & distribution

**Separate GitHub repo:** `olopad/olotype` (or wherever the Olopad org keeps things).

**Package name:** `@olopad/olotype`.

**Distribution for v0–v1:** install directly from a git tag, no registry setup needed:

```json
// OloMaps package.json
"@olopad/olotype": "github:olopad/olotype#v0.1.0"
```

Promote to GitHub Packages (private npm) when there are >1 consumer apps or external collaborators.

**Versioning:** SemVer. The schema version is its own field on the persisted document so we can migrate when nodes change.

## Library shape

Single standalone Angular component. Signal-based two-way binding.

```html
<olo-type
  [(doc)]="docSignal"
  [extensions]="extensions"
  [readOnly]="false"
  placeholder="Write your guidebook…"
  (changed)="onChange($event)"
/>
```

| Input | Type | Notes |
|---|---|---|
| `doc` | `WritableSignal<OloDoc>` | Two-way bound document state. |
| `extensions` | `OloExtension[]` | Host-registered custom node/mark definitions. |
| `readOnly` | `boolean` | Disables editing; useful for follower views of a guidebook. |
| `placeholder` | `string` | Shown when the doc is empty. |
| `uploadImage` | `(file: File) => Promise<{ url: string; width?: number; height?: number }>` | Host-provided uploader. Library never decides where images live. |
| `theme` | `'light' \| 'dark' \| 'auto'` | Default `'auto'` (follows OS / `.dark` class). |

| Output | Type | Notes |
|---|---|---|
| `changed` | `OloDoc` | Fires on every transaction. Use sparingly; the signal is the primary source of truth. |

Hosts that need imperative control (focus, insert at cursor, etc.) get a thin imperative handle:

```ts
@ViewChild(OloType) editor!: OloType;
this.editor.focus();
this.editor.insertNode(myPlaceCardNode);
```

## Document schema (v1)

Default node/mark set. JSON-serializable, round-trippable.

### Block nodes
- `doc` — root
- `paragraph`
- `heading` (levels 1–3)
- `bulletList`, `orderedList`, `listItem`
- `blockquote`
- `horizontalRule`
- `image` — `{ src, alt, caption?, width?, height? }` (caption rendered as `<figcaption>`)
- `codeBlock` — useful for advanced users; minimal styling

### Inline nodes
- `text`
- `hardBreak`

### Marks
- `bold`
- `italic`
- `underline`
- `strike`
- `code` (inline code)
- `link` — `{ href, title? }`

That's it for v1. Host apps add their own via extensions.

### Persistence format

ProseMirror's JSON, wrapped:

```json
{
  "schemaVersion": 1,
  "doc": { "type": "doc", "content": [ ... ] }
}
```

The `schemaVersion` lets us migrate old docs forward when we add nodes. Migrations are functions `(v: number, doc: any) => any`.

## Extension API

Host apps register custom nodes/marks without forking. Each extension is a self-contained module:

```ts
import { OloExtension } from '@olopad/olotype';

export const PlaceCardExtension: OloExtension = {
  name: 'placeCard',
  schema: {
    nodes: {
      placeCard: {
        group: 'block',
        atom: true,
        selectable: true,
        attrs: { placeId: { default: '' }, title: { default: '' } },
        toDOM: node => ['div', { class: 'olo-place-card', 'data-place-id': node.attrs.placeId }, node.attrs.title],
        parseDOM: [{ tag: 'div.olo-place-card', getAttrs: dom => ({
          placeId: dom.getAttribute('data-place-id'),
          title: dom.textContent
        }) }]
      }
    }
  },
  nodeViews: {
    // Optional Angular component to render the node interactively
    placeCard: PlaceCardNodeViewComponent
  },
  commands: {
    insertPlaceCard: (attrs: { placeId: string; title: string }) => (state, dispatch) => { /* … */ }
  },
  slashMenuItems: [{
    title: 'Place card',
    description: 'Embed a place from your guidebook',
    icon: 'map-pin',
    onSelect: (editor, range) => editor.commands.insertPlaceCard({ placeId: '…', title: '…' })
  }]
};
```

OloMaps's place card and itinerary embeds live in OloMaps's own codebase, not in OloType. OloType only ships the runtime that loads them.

### NodeViews bridge

ProseMirror's NodeView API is plain DOM. We wrap it so custom nodes can be Angular components with full DI. The bridge handles:
- Creating an `Injector` per node instance
- Forwarding PM's `update`/`destroy` lifecycle to Angular
- Passing the PM `Node` and `getPos` callback as signals to the Angular component

This is the most complex piece of the library and where the early effort should focus — getting it right makes domain blocks trivial.

## UI surfaces

Three menus, all built on the same primitives:

1. **Floating bubble menu** — appears on selection. Inline marks (bold/italic/link/etc.).
2. **Slash menu** — typing `/` at the start of a block opens a fuzzy-searchable command palette. Block-level inserts: heading, list, image, place card, etc.
3. **Block drag handle** — gutter handle on the left of each block for drag-to-reorder. Click opens a per-block menu (delete, duplicate, turn into…).

A fixed top toolbar is **not** part of v1 — modern editors have moved away from it and it eats vertical space on mobile.

## Image upload

The library never decides where images live. Host provides an async upload function:

```ts
const uploadImage = async (file: File) => {
  // OloMaps version: hit a presigned-URL endpoint, return the resulting CDN URL
  const { url } = await fetch('/upload-presigned', ...).then(r => r.json());
  await fetch(url, { method: 'PUT', body: file });
  return { url: cdnUrlFor(url), width: ..., height: ... };
};
```

While the upload is in flight, the editor shows a temporary in-DOM blob URL with a loading state. On success, the node's `src` attribute is swapped to the returned URL. On failure, the node is removed and the user sees a toast.

Paste-from-clipboard and drag-and-drop both flow through the same uploader.

## Mobile & accessibility

- **Mobile**: bubble menu becomes a sticky bottom sheet (thumb-reachable). Slash menu works with on-screen keyboard. Tested on iOS Safari + Android Chrome.
- **Keyboard**: full keymap (Cmd+B, Cmd+I, Cmd+K for link, Cmd+Z, etc.). Slash menu is fully keyboard-navigable.
- **Screen readers**: ProseMirror's contenteditable + proper ARIA on menu items. The bubble/slash menus implement WAI-ARIA combobox patterns.
- **High contrast / dark mode**: theme tokens via CSS variables; consumers can override.

## Tech stack

- **TypeScript strict** end to end.
- **Angular 21** (matches OloMaps). Standalone components, signals only. No NgModules.
- **ProseMirror** core packages (`prosemirror-state`, `-model`, `-view`, `-commands`, `-keymap`, `-history`, `-schema-list`, `-inputrules`).
- **Build**: `ng-packagr` for the library, output as Angular Package Format.
- **Tests**: Vitest (matches OloMaps testing convention).
- **Lint/format**: Prettier + EditorConfig (mirror OloMaps `.editorconfig`: 2-space, single quotes, 100-col, trim trailing whitespace).

## Repo layout (proposed)

```
olotype/
├── projects/
│   └── olotype/          # the publishable library
│       ├── src/
│       │   ├── core/             # ProseMirror integration, schema, commands
│       │   ├── extensions/       # built-in extensions (links, images, lists)
│       │   ├── ui/               # bubble menu, slash menu, block handle
│       │   ├── theme/            # CSS tokens
│       │   └── public-api.ts
│       ├── ng-package.json
│       └── package.json
├── projects/
│   └── playground/       # local dev harness — an Angular app that loads the lib
└── package.json          # workspace root
```

The playground is a normal Angular app used for development — `ng serve playground` gives a live editor against the local library build. No publishing needed during development.

## Roadmap

**Phase 0 — scaffold** ✅ *shipped*
- ~~New repo~~ Workspace package in `olopad-lib` with library + playground
- ProseMirror packages installed
- Hello-world editor rendering in playground

**Phase 1 — core editing** ✅ *shipped*
- Default schema (headings, paragraphs, lists, marks, link, image, hr, code block)
- Keymap bindings
- History (undo/redo)
- Placeholder
- Persistence: doc as JSON in/out via signal, versioned envelope with migration hook

**Phase 2 — UI surfaces** ✅ *shipped*
- Bubble menu (selection-aware, positioned via Floating UI; inline link editor)
- Slash menu (keyboard navigable, fuzzy substring filter)
- Block handle (drag-to-reorder via NodeSelection + `prosemirror-dropcursor`; per-block Duplicate/Delete menu)
- **Bonus**: optional fixed toolbar (opt-in); both toolbar and bubble items customizable via a unified menu-item registry

**Phase 3 — extension API** ✅ *shipped*
- `OloExtension` interface (schema, plugins, nodeViews, slashMenuItems)
- Angular-aware NodeView bridge: per-node `Injector`, `OLO_NODE_VIEW_CONTEXT` token with `node`/`selected` signals, `[data-olo-content]` slot for non-atom node content
- Demo extension in playground: non-atom `callout` block with variant cycling

**Phase 4 — image upload (~2–3 days)** ⏳ *next*
- `uploadImage` host function plumbing
- Upload-in-progress placeholder state
- Drag/drop + paste support

**Phase 5 — polish (~1 week)** ⏳ *pending*
- Mobile bottom-sheet bubble menu
- Keyboard accessibility audit
- Theme tokens (CSS vars) — partially shipped, finalize the documented token set
- v0.1.0 tag, install in OloMaps as `github:olopad/olotype#v0.1.0`

**Phase 6 — first real integration (in OloMaps)** ⏳ *pending*
- OloMaps writes its own `PlaceCardExtension` + `ItineraryExtension`
- Guidebook content types (text-block / image-block) become OloType docs
- Existing TravelItem tree gains content fields where appropriate

**Later (not v1)**
- Collaborative editing via Yjs (`y-prosemirror`)
- Comments / suggestions / track changes
- Markdown export/import
- Tables (PM has a separate package — adds ~50 KB, only if a real use case appears)

## Open questions

- **Persisted-doc size limits.** Same DynamoDB 400 KB cap applies — a long text-heavy guidebook is realistically fine, but should we plan for a "split content into chunks" model from day one? Probably no, deferred until anyone actually hits the limit.
- **Read-only rendering off the critical path.** Should OloType ship a standalone "renderer" build for SSR / non-interactive read views? Probably yes for v2 — for v1, mount the editor in `readOnly` mode (it tree-shakes nothing but works).
- **Sharing the schema with OloMaps.** Custom node attrs (`placeId`) reference data in the host. If a guidebook is shared/forked, do the referenced places travel with it, or do place cards become "broken refs"? Design decision needed before public sharing ships.
- **Styling boundary.** Editor needs minimal default styles to be usable, but consumers will want to skin it. CSS variables are the right primitive; the exact token set should be sketched before Phase 5.
