import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { autoUpdate, computePosition, flip, offset, shift, type VirtualElement } from '@floating-ui/dom';
import { NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { renderIcon } from '../icons';
import type { OloBlockHandleState } from './block-handle.plugin';

/**
 * Block drag handle: small grip in the left gutter that appears on hover.
 * Drag it to reorder blocks (PM's native drop handling moves the
 * NodeSelection); click it to open a per-block menu.
 *
 * Drop indication is provided by `prosemirror-dropcursor`, configured in the
 * main editor's plugin list.
 */
@Component({
  selector: 'olo-block-handle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state().visible && state().rect) {
      <div
        #handle
        class="olo-block-handle"
        [class.is-dragging]="dragging()"
        draggable="true"
        role="button"
        aria-label="Drag to reorder, click for options"
        title="Drag to move, click for options"
        (mousedown)="$event.stopPropagation()"
        (dragstart)="onDragStart($event)"
        (dragend)="onDragEnd()"
        (click)="toggleMenu()"
      >
        <span class="olo-block-handle-grip" [innerHTML]="gripIcon()"></span>
      </div>

      @if (menuOpen()) {
        <div
          #menu
          class="olo-block-menu"
          role="menu"
          (mousedown)="$event.preventDefault()"
        >
          <button type="button" class="olo-block-menu-item" role="menuitem" (click)="duplicateBlock()">
            <span class="olo-block-menu-icon" [innerHTML]="iconFor('list')"></span>
            Duplicate
          </button>
          <button type="button" class="olo-block-menu-item is-danger" role="menuitem" (click)="deleteBlock()">
            <span class="olo-block-menu-icon" [innerHTML]="iconFor('strike')"></span>
            Delete
          </button>
        </div>
      }
    }
  `,
  styles: [],
})
export class OloBlockHandleComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  readonly state = input.required<OloBlockHandleState>();
  readonly view = input.required<EditorView>();

  protected readonly menuOpen = signal(false);
  protected readonly dragging = signal(false);

  private readonly handle = viewChild<ElementRef<HTMLDivElement>>('handle');
  private readonly menu = viewChild<ElementRef<HTMLDivElement>>('menu');

  private cleanupHandle: (() => void) | null = null;
  private cleanupMenu: (() => void) | null = null;

  private outsideClickHandler: ((event: MouseEvent) => void) | null = null;

  // Cache the SafeHtml for the grip icon so the [innerHTML] binding doesn't
  // produce a new sanitized value on each CD pass.
  private readonly _gripIcon = this.sanitizer.bypassSecurityTrustHtml(
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18" r="1.5" fill="currentColor"/><circle cx="15" cy="18" r="1.5" fill="currentColor"/></svg>',
  );

  private readonly iconCache = new Map<string, SafeHtml>();

  constructor() {
    // Position the handle in the gutter to the left of the hovered block.
    effect(() => {
      const s = this.state();
      const handleEl = this.handle()?.nativeElement;
      untracked(() => this.syncHandlePosition(s, handleEl ?? null));
    });

    // Position the menu next to the handle when it opens.
    effect(() => {
      const open = this.menuOpen();
      const handleEl = this.handle()?.nativeElement;
      const menuEl = this.menu()?.nativeElement;
      untracked(() => this.syncMenuPosition(open, handleEl ?? null, menuEl ?? null));
    });

    // Close the menu when the hovered block changes or the handle hides.
    effect(() => {
      const s = this.state();
      if (!s.visible && untracked(() => this.menuOpen())) {
        untracked(() => this.menuOpen.set(false));
      }
    });

    // Outside-click dismiss.
    effect(() => {
      const open = this.menuOpen();
      untracked(() => this.bindOutsideClick(open));
    });
  }

  ngOnDestroy(): void {
    this.cleanupHandle?.();
    this.cleanupMenu?.();
    this.cleanupHandle = null;
    this.cleanupMenu = null;
    this.unbindOutsideClick();
  }

  protected gripIcon(): SafeHtml {
    return this._gripIcon;
  }

  protected iconFor(key: string): SafeHtml {
    let cached = this.iconCache.get(key);
    if (!cached) {
      cached = this.sanitizer.bypassSecurityTrustHtml(renderIcon(key));
      this.iconCache.set(key, cached);
    }
    return cached;
  }

  // ---- Drag ---------------------------------------------------------------

  protected onDragStart(event: DragEvent): void {
    const view = this.view();
    const pos = this.state().pos;
    if (pos < 0 || !event.dataTransfer) return;

    const node = view.state.doc.nodeAt(pos);
    if (!node) return;

    // Make the block the current selection so PM's built-in drop handler
    // moves *this* block (not whatever was selected before).
    const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
    view.dispatch(tr);

    // Tell the browser this is a move op. Setting a payload keeps Firefox happy.
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');

    this.dragging.set(true);
    this.menuOpen.set(false);
  }

  protected onDragEnd(): void {
    this.dragging.set(false);
  }

  // ---- Menu ---------------------------------------------------------------

  protected toggleMenu(): void {
    if (this.dragging()) return;
    this.menuOpen.update(v => !v);
  }

  protected duplicateBlock(): void {
    const view = this.view();
    const pos = this.state().pos;
    const node = view.state.doc.nodeAt(pos);
    if (!node) return;
    const insertAt = pos + node.nodeSize;
    view.dispatch(view.state.tr.insert(insertAt, node));
    this.menuOpen.set(false);
    view.focus();
  }

  protected deleteBlock(): void {
    const view = this.view();
    const pos = this.state().pos;
    const node = view.state.doc.nodeAt(pos);
    if (!node) return;
    view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize));
    this.menuOpen.set(false);
    view.focus();
  }

  // ---- Positioning --------------------------------------------------------

  private syncHandlePosition(s: OloBlockHandleState, handle: HTMLDivElement | null): void {
    this.cleanupHandle?.();
    this.cleanupHandle = null;

    if (!s.visible || !s.rect || !handle) return;

    const virtual: VirtualElement = {
      getBoundingClientRect: () => {
        const cur = this.state().rect;
        if (!cur) return new DOMRect(0, 0, 0, 0);
        return new DOMRect(cur.left, cur.top, 0, cur.bottom - cur.top);
      },
    };

    this.cleanupHandle = autoUpdate(virtual, handle, () => {
      computePosition(virtual, handle, {
        placement: 'left-start',
        strategy: 'fixed',
        middleware: [offset(4), shift({ padding: 4 })],
      }).then(({ x, y }) => {
        handle.style.position = 'fixed';
        handle.style.left = `${x}px`;
        // Nudge down a hair so the handle aligns with the block's first line baseline.
        handle.style.top = `${y + 4}px`;
      });
    });
  }

  private syncMenuPosition(
    open: boolean,
    handle: HTMLDivElement | null,
    menu: HTMLDivElement | null,
  ): void {
    this.cleanupMenu?.();
    this.cleanupMenu = null;

    if (!open || !handle || !menu) return;

    this.cleanupMenu = autoUpdate(handle, menu, () => {
      computePosition(handle, menu, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        menu.style.position = 'fixed';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
      });
    });
  }

  // ---- Outside click ------------------------------------------------------

  private bindOutsideClick(open: boolean): void {
    if (!open) {
      this.unbindOutsideClick();
      return;
    }
    if (this.outsideClickHandler) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const menuEl = this.menu()?.nativeElement;
      const handleEl = this.handle()?.nativeElement;
      if (target && (menuEl?.contains(target) || handleEl?.contains(target))) return;
      this.menuOpen.set(false);
    };

    document.addEventListener('mousedown', handler, true);
    this.outsideClickHandler = handler;
  }

  private unbindOutsideClick(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }
  }
}
