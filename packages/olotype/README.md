# @olopad/olotype

Notion-style block editor for Angular, built on [ProseMirror](https://prosemirror.net).

Standalone component. Signal-based API. Extensible schema. MIT.

> Design rationale, roadmap and full scope are documented in [OLOTYPE_PLAN.md](./OLOTYPE_PLAN.md). This README covers the parts shipped today.

## Status

**Phases 0–4 shipped.** Core editing, bubble menu, slash menu, fixed toolbar, block drag handle, Angular NodeView bridge, and image upload are all in. Polish (mobile, a11y, `v0.1.0` tag) is in progress under Phase 5.

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

## Image upload

The library **never decides where images live.** Host apps provide an async function that takes a `File` (and an `AbortSignal`) and returns a final URL. Wire it up via the `[uploadImage]` input — the editor handles everything else: drop / paste interception, in-flight placeholder, swap-on-success, error surfacing, cancellation on undo.

### Minimal example

```ts
import { Component, signal } from '@angular/core';
import {
  OloTypeComponent,
  emptyDoc,
  type OloDoc,
  type OloImageUploader,
  type OloImageUploadError,
} from '@olopad/olotype';

@Component({
  standalone: true,
  imports: [OloTypeComponent],
  template: `
    <olo-type
      [(doc)]="doc"
      [uploadImage]="uploadImage"
      (uploadError)="onUploadError($event)"
    />
  `,
})
export class GuidebookEditor {
  readonly doc = signal<OloDoc>(emptyDoc());

  readonly uploadImage: OloImageUploader = async (file, signal) => {
    // 1. Ask your backend for a presigned PUT URL.
    const presign = await fetch('/api/images/presign', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, type: file.type }),
      signal,
    }).then(r => r.json() as Promise<{ uploadUrl: string; cdnUrl: string }>);

    // 2. PUT the file directly to storage (S3, R2, whatever).
    await fetch(presign.uploadUrl, { method: 'PUT', body: file, signal });

    // 3. Return the final URL the editor should embed.
    return { url: presign.cdnUrl, alt: file.name };
  };

  onUploadError(event: OloImageUploadError): void {
    // Surface a toast, notify error tracking, etc. The placeholder is
    // already removed by the time this fires.
    console.error('Upload failed:', event.file.name, event.error);
  }
}
```

### Entry points

Once `[uploadImage]` is wired, the editor exposes **four** ways for users to add an image. All four route through the same upload pipeline:

1. **Drag & drop** an image file onto the editor
2. **Paste** an image from the clipboard
3. **`/image`** (or `/photo`, `/picture`, `/img`, `/upload`) in the slash menu
4. **Image button** in the toolbar (when `[toolbar]="true"`)

If `[uploadImage]` is `null` or omitted, image drop / paste / slash item / toolbar button are all silently disabled — existing image nodes in the document still render.

### Contract

```ts
type OloImageUploader = (
  file: File,
  signal: AbortSignal,
) => Promise<OloUploadedImage>;

interface OloUploadedImage {
  readonly url: string;        // required; goes through sanitizeImageSrc
  readonly width?: number;
  readonly height?: number;
  readonly alt?: string;
}

interface OloImageUploadError {
  readonly file: File;
  readonly error: unknown;
}
```

**Honor the `AbortSignal`.** It fires when:
- the user undoes past the placeholder (Cmd+Z)
- the placeholder is deleted via the block-handle menu
- the editor is destroyed before the upload resolves

Forwarding the signal to your `fetch` (or SDK call) means cancelled uploads stop using bandwidth. The editor swallows `AbortError` rejections — they're not surfaced via `(uploadError)`.

### What happens on the wire

1. User drops / pastes / picks an image → a placeholder appears at the drop position immediately (blurred preview from a `URL.createObjectURL(file)` blob + spinner).
2. Your `uploadImage` is invoked with the `File` and a fresh `AbortSignal`.
3. While in flight, position tracking remaps through any concurrent edits. If the placeholder is deleted, the signal fires and the result is discarded.
4. On resolve, the returned URL flows through `sanitizeImageSrc` (rejects `javascript:` and `vbscript:` only — `data:`, `blob:`, `http(s):`, and relative URLs all pass) and replaces the placeholder with a real `image` node. The blob URL is revoked.
5. On reject (other than `AbortError`), the placeholder is removed and `(uploadError)` fires.

### Programmatic insertion

If you need your own entry point (a custom button, a paste shim, an external file-picker integration), call `openImagePicker(view, opts, pos?)` or `beginUpload(view, file, pos, opts)` directly — the same helpers the built-ins use:

```ts
import { openImagePicker } from '@olopad/olotype';

// Inside a component method, with view = editor handle's PM view:
openImagePicker(view, {
  uploader: this.uploadImage,
  onError: err => this.toast.show(err),
});
```

## Persistence format

```json
{
  "schemaVersion": 1,
  "doc": { "type": "doc", "content": [ /* ProseMirror JSON */ ] }
}
```

The wrapper carries a `schemaVersion` so we can migrate old docs forward as the default schema evolves. Migrations are pure functions registered in [`serialize.ts`](./src/lib/core/serialize.ts).

## Theming

The library ships a minimal default stylesheet at `@olopad/olotype/theme/olo-type.css`. Every visual surface is parameterized via CSS custom properties; override at any scope (`:root`, your app shell, a specific editor instance) to skin without touching library CSS. Tokens use `:where()` so consumer overrides win without specificity wars.

| Token | Default (light) | Used for |
|---|---|---|
| `--olo-type-fg` | `#1f2937` | Editor text |
| `--olo-type-muted` | `#6b7280` | Secondary text (placeholders, descriptions, slash-menu meta) |
| `--olo-type-bg` | `transparent` | Editor background |
| `--olo-type-border` | `#e5e7eb` | Toolbar, slash menu, divider borders |
| `--olo-type-accent` | `#2563eb` | Active button, focus ring, drop cursor, link color |
| `--olo-type-code-bg` | `#f3f4f6` | Inline code and code-block background |
| `--olo-type-blockquote-border` | `#d1d5db` | Blockquote left border |
| `--olo-type-toolbar-bg` | inherits `--olo-type-bg` | Fixed toolbar background |
| `--olo-type-menu-bg` | `#111827` | Bubble menu background |
| `--olo-type-menu-fg` | `#f9fafb` | Bubble menu foreground |
| `--olo-type-font-sans` | `ui-sans-serif, system-ui, …` | Text in the editor and all menus |
| `--olo-type-font-mono` | `ui-monospace, SFMono-Regular, …` | Inline code and code blocks |
| `--olo-type-line-height` | `1.6` | Editor content line height |

Dark-mode defaults are applied automatically via `prefers-color-scheme: dark` and use the same token names — override the tokens once at any scope to opt out.

The default theme also adapts at runtime:
- **Touch devices** (`pointer: coarse`): the bubble menu becomes a sticky bottom sheet
- **Reduced motion** (`prefers-reduced-motion: reduce`): upload spinners stop spinning and block-handle hover transitions are removed
- **Focus-visible**: keyboard focus draws a `--olo-type-accent` outline on every interactive element; mouse clicks don't

## Security

- Two URL sanitizers, one strict and one relaxed:
  - **`sanitizeUrl`** (paste-time defense): rejects `javascript:`, `vbscript:`, **and** `data:`. Used for `link.href` parsing — `data:` in `<a href>` can carry encoded script payloads.
  - **`sanitizeImageSrc`** (trusted-source): rejects only `javascript:` and `vbscript:`. Used for `image.src` and for URLs returned by the host's `uploadImage`. `data:` / `blob:` / `http(s):` / relative URLs all pass — none execute when consumed by `<img>`.
- External links serialize with `rel="noopener noreferrer"` and `target="_blank"`.
- The schema is the trust boundary for paste — only declared nodes and marks survive.
- No `innerHTML` is used in the Angular layer; all DOM goes through ProseMirror's view.

## License

MIT
