import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { OloTypeComponent, emptyDoc, type OloDoc } from '@olopad/olotype';
import { CalloutExtension } from './callout/callout.extension';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OloTypeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="shell">
      <header>
        <h1>OloType Playground</h1>
        <p class="subtitle">
          Type below. Try <code>#&nbsp;</code> for H1, <code>-&nbsp;</code> for a bullet,
          <code>1.&nbsp;</code> for a numbered list, <code>&gt;&nbsp;</code> for a quote.
          <kbd>Cmd</kbd>+<kbd>B</kbd> bolds, <kbd>Cmd</kbd>+<kbd>Z</kbd> undoes.
        </p>
      </header>

      <section class="editor-card">
        <olo-type
          [(doc)]="doc"
          [readOnly]="readOnly()"
          [toolbar]="toolbarOn()"
          [extensions]="extensions"
          placeholder="Start writing…"
          (changed)="onChange($event)"
        />
      </section>

      <aside class="controls">
        <button type="button" (click)="toggleToolbar()">
          {{ toolbarOn() ? 'Hide toolbar' : 'Show toolbar' }}
        </button>
        <button type="button" (click)="toggleReadOnly()">
          {{ readOnly() ? 'Edit' : 'Read-only' }}
        </button>
        <button type="button" (click)="reset()">Reset</button>
        <button type="button" (click)="loadSample()">Load sample</button>
        <span class="stats">{{ stats() }}</span>
      </aside>

      <section class="json-preview">
        <header>
          <h2>Persisted JSON</h2>
          <small>schemaVersion: {{ doc().schemaVersion }}</small>
        </header>
        <pre>{{ jsonPreview() }}</pre>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 56rem;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
      .subtitle { color: #6b7280; margin: 0 0 1.5rem; }
      .subtitle code, .subtitle kbd {
        background: rgba(0, 0, 0, 0.06);
        padding: 0.05rem 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.85em;
      }
      .editor-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 1.25rem 1.5rem;
        min-height: 12rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin: 1rem 0;
      }
      .controls button {
        font: inherit;
        padding: 0.4rem 0.85rem;
        border: 1px solid #d1d5db;
        background: #fff;
        border-radius: 0.5rem;
        cursor: pointer;
      }
      .controls button:hover { background: #f3f4f6; }
      .stats { margin-left: auto; color: #6b7280; font-size: 0.875rem; }
      .json-preview {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        font-size: 0.8rem;
      }
      .json-preview header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
      .json-preview h2 { margin: 0; font-size: 0.875rem; font-weight: 600; color: #cbd5e1; }
      .json-preview small { color: #94a3b8; font-family: ui-monospace, monospace; }
      .json-preview pre {
        margin: 0;
        max-height: 18rem;
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
      }

      @media (prefers-color-scheme: dark) {
        .editor-card { background: #111827; border-color: #1f2937; }
        .subtitle, .stats { color: #94a3b8; }
        .controls button { background: #1f2937; border-color: #374151; color: inherit; }
        .controls button:hover { background: #374151; }
      }
    `,
  ],
})
export class AppComponent {
  readonly doc = signal<OloDoc>(emptyDoc());
  readonly readOnly = signal(false);
  readonly toolbarOn = signal(true);
  readonly extensions = [CalloutExtension];

  readonly jsonPreview = computed(() => JSON.stringify(this.doc(), null, 2));
  readonly stats = computed(() => {
    const content = this.doc().doc.content ?? [];
    return `${content.length} block${content.length === 1 ? '' : 's'}`;
  });

  onChange(_next: OloDoc): void {
    // The signal is the source of truth; this is just here to demo the output binding.
  }

  toggleReadOnly(): void {
    this.readOnly.update(v => !v);
  }

  toggleToolbar(): void {
    this.toolbarOn.update(v => !v);
  }

  reset(): void {
    this.doc.set(emptyDoc());
  }

  loadSample(): void {
    this.doc.set({
      schemaVersion: 1,
      doc: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Hello from OloType' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'This is a Notion-style editor built on ' },
              {
                type: 'text',
                marks: [{ type: 'link', attrs: { href: 'https://prosemirror.net' } }],
                text: 'ProseMirror',
              },
              { type: 'text', text: '. Try ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
              { type: 'text', text: ', ' },
              { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
              { type: 'text', text: ', or ' },
              { type: 'text', marks: [{ type: 'code' }], text: 'inline code' },
              { type: 'text', text: '.' },
            ],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Markdown shortcuts work' }] },
                ],
              },
              {
                type: 'list_item',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'History (Cmd+Z / Cmd+Y)' }] },
                ],
              },
              {
                type: 'list_item',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Two-way bound signal' }] },
                ],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Bubble menu, slash menu, and block handle land in Phase 2.' }],
              },
            ],
          },
        ],
      },
    });
  }
}
