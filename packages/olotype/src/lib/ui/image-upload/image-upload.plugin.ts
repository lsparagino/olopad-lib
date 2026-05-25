import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { sanitizeImageSrc } from '../../core/schema';
import type {
  OloImageUploadError,
  OloImageUploader,
  OloUploadedImage,
} from '../../core/types';

/** Options the plugin reads (via getter, so input changes don't need a view rebuild). */
export interface OloImageUploadOptions {
  readonly uploader: OloImageUploader | null;
  readonly onError: (event: OloImageUploadError) => void;
}

interface PendingUpload {
  readonly id: symbol;
  readonly pos: number;
  readonly file: File;
  readonly blobUrl: string;
  readonly abort: AbortController;
}

interface UploadState {
  readonly pending: ReadonlyMap<symbol, PendingUpload>;
}

const KEY = new PluginKey<UploadState>('olotype-image-upload');

interface UploadMeta {
  readonly add?: PendingUpload;
  readonly remove?: symbol;
}

export function imageUploadPluginKey(): PluginKey<UploadState> {
  return KEY;
}

/**
 * Returns the number of uploads currently in flight. Useful for tests and
 * for hosts that want to block navigation while uploads are pending.
 */
export function pendingUploadCount(state: import('prosemirror-state').EditorState): number {
  return KEY.getState(state)?.pending.size ?? 0;
}

export function imageUploadPlugin(getOptions: () => OloImageUploadOptions): Plugin {
  return new Plugin<UploadState>({
    key: KEY,

    state: {
      init: () => ({ pending: new Map() }),
      apply(tr, prev) {
        const meta = tr.getMeta(KEY) as UploadMeta | undefined;
        let pending = prev.pending;

        if (meta?.add) {
          const next = new Map(pending);
          next.set(meta.add.id, meta.add);
          pending = next;
        }
        if (meta?.remove !== undefined) {
          const entry = pending.get(meta.remove);
          if (entry) {
            const next = new Map(pending);
            next.delete(meta.remove);
            pending = next;
            URL.revokeObjectURL(entry.blobUrl);
          }
        }

        // Remap positions through the transaction. If a position got deleted
        // (the user undid past the placeholder), abort that upload.
        if (tr.docChanged && pending.size > 0) {
          const remapped = new Map<symbol, PendingUpload>();
          for (const [id, entry] of pending) {
            const result = tr.mapping.mapResult(entry.pos);
            if (result.deleted) {
              entry.abort.abort();
              URL.revokeObjectURL(entry.blobUrl);
              continue;
            }
            remapped.set(id, { ...entry, pos: result.pos });
          }
          pending = remapped;
        }

        return { pending };
      },
    },

    props: {
      decorations(state) {
        const ps = KEY.getState(state);
        if (!ps || ps.pending.size === 0) return null;

        const decos: Decoration[] = [];
        for (const entry of ps.pending.values()) {
          decos.push(
            Decoration.widget(entry.pos, () => renderPlaceholder(entry), {
              side: -1,
              key: entry.id.toString(),
              // Stop PM from treating the placeholder as part of selection / content
              ignoreSelection: true,
            }),
          );
        }
        return DecorationSet.create(state.doc, decos);
      },

      handlePaste(view, event) {
        const opts = getOptions();
        if (!opts.uploader || !event.clipboardData) return false;

        const files = filterImageFiles(event.clipboardData.files);
        if (files.length === 0) return false;

        event.preventDefault();
        const pos = view.state.selection.from;
        for (const file of files) {
          beginUpload(view, file, pos, opts);
        }
        return true;
      },

      handleDrop(view, event) {
        const opts = getOptions();
        if (!opts.uploader || !event.dataTransfer) return false;

        const files = filterImageFiles(event.dataTransfer.files);
        if (files.length === 0) return false;

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? view.state.selection.from;
        for (const file of files) {
          beginUpload(view, file, pos, opts);
        }
        return true;
      },
    },

    view() {
      return {
        destroy() {
          // The plugin's state is discarded when the view is torn down; abort
          // anything still in flight so the host sees the cancellation.
          // We can't dispatch a transaction (no live view) — just touch the
          // controllers and release blob URLs.
          // Reading the state from the destroyed view is unsafe; instead, we
          // rely on `beginUpload` having stored the entry in a private set.
          for (const entry of liveUploads) {
            entry.abort.abort();
            URL.revokeObjectURL(entry.blobUrl);
          }
          liveUploads.clear();
        },
      };
    },
  });
}

// Mirror of all in-flight uploads, scoped to the module. Used only by the
// plugin's `view.destroy` callback — the canonical store is plugin state.
const liveUploads = new Set<PendingUpload>();

// ----------------------------------------------------------------------------
// Orchestration
// ----------------------------------------------------------------------------

/**
 * Open a hidden `<input type="file" accept="image/*">`, and on selection
 * dispatch an upload at the requested doc position (defaults to the cursor).
 *
 * Used by the built-in slash menu / toolbar image entry points; exported so
 * hosts can wire their own "Insert image" button without re-implementing the
 * file-picker boilerplate.
 */
export function openImagePicker(
  view: EditorView,
  opts: OloImageUploadOptions,
  pos: number = view.state.selection.from,
): void {
  if (!opts.uploader) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'));
    for (const file of files) beginUpload(view, file, pos, opts);
    input.remove();
  });
  // Some browsers ignore `click` on detached inputs; attach, click, detach.
  document.body.appendChild(input);
  input.click();
}

/**
 * Kick off an upload at the given doc position. Registers a placeholder,
 * calls the host uploader, and on resolve replaces the placeholder with a
 * real `image` node. On failure or abort, removes the placeholder.
 *
 * Exported so hosts can implement their own entry points (file picker, etc.).
 */
export function beginUpload(
  view: EditorView,
  file: File,
  pos: number,
  opts: OloImageUploadOptions,
): void {
  if (!opts.uploader) return;
  if (!view.state.schema.nodes['image']) return;

  const id = Symbol('upload');
  const blobUrl = URL.createObjectURL(file);
  const abort = new AbortController();
  const entry: PendingUpload = { id, pos, file, blobUrl, abort };
  liveUploads.add(entry);

  const meta: UploadMeta = { add: entry };
  view.dispatch(view.state.tr.setMeta(KEY, meta));

  opts
    .uploader(file, abort.signal)
    .then((image) => completeUpload(view, id, image, opts))
    .catch((err) => {
      // AbortError = silent. Anything else: emit to host.
      if (abort.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
        // Already removed via remap-on-delete or via destroy; ensure cleanup.
        removeUploadEntry(view, id);
        return;
      }
      removeUploadEntry(view, id);
      opts.onError({ file, error: err });
    });
}

function completeUpload(
  view: EditorView,
  id: symbol,
  image: OloUploadedImage,
  opts: OloImageUploadOptions,
): void {
  const ps = KEY.getState(view.state);
  if (!ps) return;
  const entry = ps.pending.get(id);
  if (!entry) return; // Already aborted / removed.

  const safeUrl = sanitizeImageSrc(image.url);
  if (!safeUrl) {
    // Host returned a scheme we refuse to insert (javascript:, vbscript:).
    // Surface this rather than silently dropping the placeholder.
    removeUploadEntry(view, id);
    opts.onError({
      file: entry.file,
      error: new Error(
        `OloType: rejected image URL with disallowed scheme: ${String(image.url).slice(0, 80)}`,
      ),
    });
    return;
  }

  const imageType = view.state.schema.nodes['image'];
  if (!imageType) {
    removeUploadEntry(view, id);
    opts.onError({
      file: entry.file,
      error: new Error('OloType: schema has no `image` node — upload aborted.'),
    });
    return;
  }

  const node = imageType.create({
    src: safeUrl,
    alt: image.alt ?? null,
    width: image.width ?? null,
    height: image.height ?? null,
  });

  const meta: UploadMeta = { remove: id };
  const tr = view.state.tr.insert(entry.pos, node).setMeta(KEY, meta);
  view.dispatch(tr);
  liveUploads.delete(entry);
}

function removeUploadEntry(view: EditorView, id: symbol): void {
  const ps = KEY.getState(view.state);
  const entry = ps?.pending.get(id);
  if (entry) liveUploads.delete(entry);

  const meta: UploadMeta = { remove: id };
  view.dispatch(view.state.tr.setMeta(KEY, meta));
}

// ----------------------------------------------------------------------------
// DOM helpers
// ----------------------------------------------------------------------------

function filterImageFiles(list: FileList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list.item(i);
    if (f && f.type.startsWith('image/')) out.push(f);
  }
  return out;
}

function renderPlaceholder(entry: PendingUpload): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'olo-image-uploading';
  wrap.setAttribute('aria-label', `Uploading ${entry.file.name}`);
  wrap.setAttribute('role', 'img');
  wrap.contentEditable = 'false';

  const img = document.createElement('img');
  img.src = entry.blobUrl;
  img.alt = '';
  img.className = 'olo-image-uploading-preview';
  wrap.appendChild(img);

  const spinner = document.createElement('span');
  spinner.className = 'olo-image-uploading-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  wrap.appendChild(spinner);

  return wrap;
}
