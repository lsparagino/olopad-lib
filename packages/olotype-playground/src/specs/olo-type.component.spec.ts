import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, ViewChild, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OloTypeComponent, emptyDoc, type OloDoc } from '@olopad/olotype';

@Component({
  selector: 'test-olo-type-host',
  standalone: true,
  imports: [OloTypeComponent],
  template: `<olo-type
    [(doc)]="doc"
    [readOnly]="readOnly()"
    [placeholder]="placeholder()"
    (changed)="onChange($event)"
  />`,
})
class HostComponent {
  @ViewChild(OloTypeComponent, { static: true }) editor!: OloTypeComponent;
  doc = signal<OloDoc>(emptyDoc());
  readOnly = signal(false);
  placeholder = signal('');
  changes: OloDoc[] = [];
  onChange(d: OloDoc) {
    this.changes.push(d);
  }
}

describe('OloTypeComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('renders the host editable region', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.olo-type-host')).not.toBeNull();
  });

  it('mounts an editor view with a single empty paragraph', () => {
    expect(host.editor.state).not.toBeNull();
    expect(host.editor.state!.doc.childCount).toBe(1);
    expect(host.editor.state!.doc.firstChild!.type.name).toBe('paragraph');
  });

  it('emits doc updates and a changed event when text is inserted', () => {
    const view = (host.editor as unknown as { view: () => { dispatch: Function; state: any } }).view();
    view.dispatch(view.state.tr.insertText('hello'));
    fixture.detectChanges();

    expect(host.changes.length).toBeGreaterThan(0);
    expect(host.doc().doc.content?.[0]).toMatchObject({
      type: 'paragraph',
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('applies external doc writes', () => {
    host.doc.set({
      schemaVersion: 1,
      doc: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'New title' }],
          },
        ],
      },
    });
    fixture.detectChanges();

    expect(host.editor.state!.doc.firstChild!.type.name).toBe('heading');
    expect(host.editor.state!.doc.firstChild!.textContent).toBe('New title');
  });

  it('silently rejects malformed external doc writes', () => {
    const before = host.editor.state!.doc.toJSON();
    host.doc.set({
      schemaVersion: 1,
      doc: {
        type: 'doc',
        content: [{ type: 'definitely-not-a-real-node' }],
      },
    });
    fixture.detectChanges();
    // Editor state remains unchanged.
    expect(host.editor.state!.doc.toJSON()).toEqual(before);
  });

  it('OloTypeHandle.insertNode inserts a node at the selection', () => {
    const schema = host.editor.state!.schema;
    const hr = schema.nodes['horizontalRule'].create();
    host.editor.insertNode(hr);
    fixture.detectChanges();

    const blockTypes = host.editor.state!.doc.children.map((c) => c.type.name);
    expect(blockTypes).toContain('horizontalRule');
  });

  it('OloTypeHandle.runCommand returns false when no view exists', () => {
    fixture.destroy();
    expect(host.editor.runCommand(() => true)).toBe(false);
  });

  it('toggles read-only on the host element when input flips', () => {
    host.readOnly.set(true);
    fixture.detectChanges();
    const hostEl = fixture.nativeElement.querySelector('.olo-type-host') as HTMLElement;
    expect(hostEl.classList.contains('olo-type-readonly')).toBe(true);

    host.readOnly.set(false);
    fixture.detectChanges();
    // After rebuild, the readonly class is cleared.
    expect(
      (fixture.nativeElement.querySelector('.olo-type-host') as HTMLElement).classList.contains(
        'olo-type-readonly',
      ),
    ).toBe(false);
  });

  it('reads the placeholder reactively via the live getter', () => {
    host.placeholder.set('Write something…');
    fixture.detectChanges();
    // Dispatch any tx to make the placeholder decoration plugin recompute.
    const view = (host.editor as unknown as { view: () => { dispatch: Function; state: any } }).view();
    view.dispatch(view.state.tr);
    fixture.detectChanges();
    const decoratedNode = fixture.nativeElement.querySelector('[data-placeholder]') as HTMLElement | null;
    expect(decoratedNode?.getAttribute('data-placeholder')).toBe('Write something…');
  });

  it('tears down the PM view on destroy', () => {
    const view = (host.editor as unknown as { view: () => unknown }).view() as { destroy: () => void } | null;
    const spy = vi.spyOn(view as never, 'destroy');
    fixture.destroy();
    expect(spy).toHaveBeenCalled();
  });
});
