import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { oloDefaultSchema } from '../../core/schema';
import {
  beginUpload,
  imageUploadPlugin,
  imageUploadPluginKey,
  pendingUploadCount,
  type OloImageUploadOptions,
} from './image-upload.plugin';
import type { OloImageUploadError } from '../../core/types';

let view: EditorView;
let host: HTMLDivElement;
let errors: OloImageUploadError[];
let optionsRef: { current: OloImageUploadOptions };

// happy-dom may or may not implement URL.createObjectURL — stub to be safe.
let createdBlobs: string[];
let revoked: string[];
const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;

beforeEach(() => {
  createdBlobs = [];
  revoked = [];
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:olo-test/${createdBlobs.length}`;
    createdBlobs.push(url);
    void blob;
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });
});

afterEach(() => {
  view?.destroy();
  host?.remove();
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
});

function mount(uploader: OloImageUploadOptions['uploader']): void {
  errors = [];
  optionsRef = {
    current: { uploader, onError: e => errors.push(e) },
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  const state = EditorState.create({
    schema: oloDefaultSchema,
    doc: oloDefaultSchema.nodeFromJSON({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    }),
    plugins: [imageUploadPlugin(() => optionsRef.current)],
  });
  view = new EditorView(host, { state });
}

function fakeFile(name = 'cat.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

describe('imageUploadPlugin', () => {
  it('starts with no pending uploads', () => {
    mount(async () => ({ url: 'https://cdn.example.com/a.png' }));
    expect(pendingUploadCount(view.state)).toBe(0);
  });

  it('beginUpload registers a pending entry and creates a blob URL', () => {
    mount(() => new Promise(() => { /* never resolves */ }));
    beginUpload(view, fakeFile(), 1, optionsRef.current);
    expect(pendingUploadCount(view.state)).toBe(1);
    expect(createdBlobs).toHaveLength(1);
  });

  it('completes successfully by inserting an image node and clearing the placeholder', async () => {
    mount(async () => ({ url: 'https://cdn.example.com/cat.png', width: 100, height: 80 }));
    beginUpload(view, fakeFile(), 1, optionsRef.current);
    expect(pendingUploadCount(view.state)).toBe(1);

    // Wait for the uploader promise to resolve and the resulting transaction to apply.
    await vi.waitFor(() => {
      expect(pendingUploadCount(view.state)).toBe(0);
    });

    // The doc should now contain an image node.
    let imageCount = 0;
    view.state.doc.descendants(node => {
      if (node.type.name === 'image') {
        imageCount++;
        expect(node.attrs['src']).toBe('https://cdn.example.com/cat.png');
        expect(node.attrs['width']).toBe(100);
      }
    });
    expect(imageCount).toBe(1);
    expect(revoked.length).toBeGreaterThan(0);
  });

  it('emits uploadError and removes the placeholder when the uploader rejects', async () => {
    const err = new Error('Network down');
    mount(async () => {
      throw err;
    });
    beginUpload(view, fakeFile('boom.png'), 1, optionsRef.current);

    await vi.waitFor(() => {
      expect(pendingUploadCount(view.state)).toBe(0);
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe(err);
    expect(errors[0].file.name).toBe('boom.png');
  });

  it('rejects URLs with script-executable schemes and surfaces an uploadError', async () => {
    mount(async () => ({ url: 'javascript:alert(1)' }));
    beginUpload(view, fakeFile('xss.png'), 1, optionsRef.current);

    await vi.waitFor(() => {
      expect(pendingUploadCount(view.state)).toBe(0);
    });
    // Doc should still have only the original paragraph (no image).
    let hasImage = false;
    view.state.doc.descendants(node => {
      if (node.type.name === 'image') hasImage = true;
    });
    expect(hasImage).toBe(false);
    // The user must see *something* — we surface a descriptive error.
    expect(errors).toHaveLength(1);
    expect(errors[0].file.name).toBe('xss.png');
    expect(String((errors[0].error as Error).message)).toMatch(/disallowed scheme/i);
  });

  it('accepts data: URLs returned by the host uploader (image src, not a script vector)', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    mount(async () => ({ url: dataUrl }));
    beginUpload(view, fakeFile(), 1, optionsRef.current);

    await vi.waitFor(() => {
      expect(pendingUploadCount(view.state)).toBe(0);
    });
    let inserted: string | null = null;
    view.state.doc.descendants(node => {
      if (node.type.name === 'image') inserted = node.attrs['src'] as string;
    });
    expect(inserted).toBe(dataUrl);
    expect(errors).toHaveLength(0);
  });

  it('aborts the upload when the placeholder is deleted before resolve', async () => {
    let abortedFromFetch = false;
    mount(
      (_file, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            abortedFromFetch = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    beginUpload(view, fakeFile(), 1, optionsRef.current);
    expect(pendingUploadCount(view.state)).toBe(1);

    // Replace the whole doc — this maps the placeholder position to deleted.
    const replacement = oloDefaultSchema.nodeFromJSON({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, replacement.content));

    // The remap-on-delete branch in `apply` aborts and clears the entry.
    expect(pendingUploadCount(view.state)).toBe(0);
    // Give the rejection microtask a chance to run.
    await Promise.resolve();
    await Promise.resolve();
    expect(abortedFromFetch).toBe(true);
    // AbortError must NOT surface as an uploadError event.
    expect(errors).toHaveLength(0);
  });

  it('does nothing when no uploader is configured', () => {
    mount(null);
    beginUpload(view, fakeFile(), 1, optionsRef.current);
    expect(pendingUploadCount(view.state)).toBe(0);
  });

  it('remaps the upload position as the doc shifts', async () => {
    mount(async () => ({ url: 'https://cdn.example.com/cat.png' }));
    // Pos 1 = start of paragraph "hello".
    beginUpload(view, fakeFile(), 1, optionsRef.current);

    // Insert text before the placeholder; the upload's pos should shift forward.
    view.dispatch(view.state.tr.insertText('PREFIX ', 1));

    const ps = imageUploadPluginKey().getState(view.state);
    expect(ps).toBeDefined();
    const entry = ps && Array.from(ps.pending.values())[0];
    expect(entry?.pos).toBe(1 + 'PREFIX '.length);

    // Let it finish.
    await vi.waitFor(() => {
      expect(pendingUploadCount(view.state)).toBe(0);
    });
  });

  it('handlePaste with no image files returns false (lets PM handle it)', () => {
    mount(async () => ({ url: 'https://cdn.example.com/cat.png' }));
    view.focus();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    // Construct an empty FileList via DataTransfer.
    const dt = new DataTransfer();
    const event = new ClipboardEvent('paste', { clipboardData: dt });
    // The plugin's handlePaste is invoked through `view.someProp`; simulate by
    // dispatching the event to the editable DOM. PM forwards into the plugin's
    // handler internally — we accept that pasting non-images leaves the doc
    // unchanged.
    view.dom.dispatchEvent(event);
    expect(pendingUploadCount(view.state)).toBe(0);
  });
});
