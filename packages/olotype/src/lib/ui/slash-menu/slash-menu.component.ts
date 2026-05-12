import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { autoUpdate, computePosition, flip, offset, shift, type VirtualElement } from '@floating-ui/dom';
import type { EditorView } from 'prosemirror-view';
import type { OloSlashMenuItem, OloTypeHandle } from '../../core/types';
import { renderIcon } from '../icons';
import { filterSlashItems } from './default-items';
import type { OloSlashMenuState } from './slash-menu.plugin';

/**
 * Slash menu: keyboard-navigable list of insertable blocks. Filtering is
 * substring-based across title / description / keywords. Items come from the
 * caller (built-ins merged with extension-contributed items).
 */
@Component({
  selector: 'olo-slash-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (filteredItems().length > 0 && state().visible) {
      <div
        #floater
        class="olo-slash-menu"
        role="listbox"
        aria-label="Insert block"
        (mousedown)="$event.preventDefault()"
      >
        @for (item of filteredItems(); track item.id; let i = $index) {
          <button
            type="button"
            class="olo-slash-item"
            [class.is-active]="i === activeIndex()"
            role="option"
            [attr.aria-selected]="i === activeIndex()"
            (mouseenter)="activeIndex.set(i)"
            (click)="selectIndex(i)"
          >
            <span class="olo-slash-icon" [innerHTML]="iconFor(item.icon)"></span>
            <span class="olo-slash-body">
              <span class="olo-slash-title">{{ item.title }}</span>
              @if (item.description) {
                <span class="olo-slash-desc">{{ item.description }}</span>
              }
            </span>
          </button>
        }
      </div>
    }
  `,
  styles: [],
})
export class OloSlashMenuComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  readonly state = input.required<OloSlashMenuState>();
  readonly view = input.required<EditorView>();
  readonly handle = input.required<OloTypeHandle>();
  readonly items = input.required<readonly OloSlashMenuItem[]>();

  /** Emitted when an item is chosen or the menu is dismissed, so the parent can clean up. */
  readonly dismissed = output<void>();

  protected readonly activeIndex = signal(0);
  protected readonly filteredItems = computed(() => filterSlashItems(this.items(), this.state().query));

  private readonly floater = viewChild<ElementRef<HTMLDivElement>>('floater');
  private cleanup: (() => void) | null = null;
  private readonly iconCache = new Map<string, SafeHtml>();

  constructor() {
    // Reset the highlighted item whenever the filtered list changes.
    effect(() => {
      this.filteredItems();
      untracked(() => this.activeIndex.set(0));
    });

    // Attach floating-ui auto-updater when visible.
    effect(() => {
      const s = this.state();
      const floaterEl = this.floater()?.nativeElement;
      untracked(() => this.syncFloating(s, floaterEl ?? null));
    });

    // Hook keyboard events on the editor view's DOM while the menu is open.
    effect(() => {
      const view = this.view();
      const visible = this.state().visible && this.filteredItems().length > 0;
      untracked(() => this.bindKeyboard(view, visible));
    });
  }

  ngOnDestroy(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.unbindKeyboard();
  }

  protected iconFor(key = ''): SafeHtml {
    let cached = this.iconCache.get(key);
    if (!cached) {
      // Inline SVG built from a static lookup; raw SVG only enters here when
      // hosts opt in via a custom item's icon string — their responsibility.
      cached = this.sanitizer.bypassSecurityTrustHtml(renderIcon(key));
      this.iconCache.set(key, cached);
    }
    return cached;
  }

  protected selectIndex(index: number): void {
    const item = this.filteredItems()[index];
    if (!item) return;
    const range = this.state().range;
    if (!range) return;
    item.onSelect({ view: this.view(), range, handle: this.handle() });
    this.dismissed.emit();
  }

  // ---- Floating UI --------------------------------------------------------

  private syncFloating(s: OloSlashMenuState, floater: HTMLDivElement | null): void {
    this.cleanup?.();
    this.cleanup = null;

    if (!s.visible || !s.rect || !floater) return;

    const virtual: VirtualElement = {
      getBoundingClientRect: () => {
        const cur = this.state().rect;
        if (!cur) return new DOMRect(0, 0, 0, 0);
        return new DOMRect(cur.left, cur.top, 0, cur.bottom - cur.top);
      },
    };

    this.cleanup = autoUpdate(virtual, floater, () => {
      computePosition(virtual, floater, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        floater.style.position = 'fixed';
        floater.style.left = `${x}px`;
        floater.style.top = `${y}px`;
      });
    });
  }

  // ---- Keyboard handling --------------------------------------------------

  private boundView: EditorView | null = null;
  private boundHandler: ((event: KeyboardEvent) => void) | null = null;

  private bindKeyboard(view: EditorView, visible: boolean): void {
    if (!visible) {
      this.unbindKeyboard();
      return;
    }
    if (this.boundView === view && this.boundHandler) return;
    this.unbindKeyboard();

    const handler = (event: KeyboardEvent) => this.onKeyDown(event);
    view.dom.addEventListener('keydown', handler, true);
    this.boundView = view;
    this.boundHandler = handler;
  }

  private unbindKeyboard(): void {
    if (this.boundView && this.boundHandler) {
      this.boundView.dom.removeEventListener('keydown', this.boundHandler, true);
    }
    this.boundView = null;
    this.boundHandler = null;
  }

  private onKeyDown(event: KeyboardEvent): void {
    const items = this.filteredItems();
    if (items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.update(i => (i + 1) % items.length);
        return;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.update(i => (i - 1 + items.length) % items.length);
        return;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        this.selectIndex(this.activeIndex());
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.dismissed.emit();
        return;
    }
  }
}
