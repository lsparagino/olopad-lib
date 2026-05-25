import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { autoUpdate, computePosition, flip, offset, shift, type VirtualElement } from '@floating-ui/dom';
import type { EditorView } from 'prosemirror-view';
import { sanitizeUrl } from '../../core/schema';
import { renderIcon } from '../icons';
import type { OloMenuItem } from '../menu-items';
import type { OloBubbleMenuState } from './bubble-menu.plugin';

/**
 * Bubble menu: floating inline-formatting toolbar that appears on text
 * selection. Rendered with `position: fixed` so it escapes any clipping
 * ancestor, and positioned by Floating UI against a virtual element at the
 * selection's rect.
 */
@Component({
  selector: 'olo-bubble-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state().visible) {
      <div
        #floater
        class="olo-bubble-menu"
        [class.is-bottom-sheet]="isBottomSheet()"
        role="toolbar"
        aria-label="Text formatting"
        (mousedown)="$event.preventDefault()"
      >
        @if (linkEditorOpen()) {
          <form class="olo-bubble-link-editor" (submit)="applyLink($event)">
            <input
              #linkInput
              type="url"
              placeholder="Paste a URL"
              [value]="linkDraft()"
              (input)="linkDraft.set($any($event.target).value)"
              (keydown.escape)="closeLinkEditor()"
              aria-label="Link URL"
            />
            <button type="submit" class="olo-bubble-link-apply">Apply</button>
            @if (state().linkHref) {
              <button type="button" class="olo-bubble-link-remove" (click)="removeLink()">Remove</button>
            }
          </form>
        } @else {
          @for (item of items(); track $index) {
            @switch (item.kind) {
              @case ('separator') {
                <span class="olo-bubble-sep" aria-hidden="true"></span>
              }
              @case ('link') {
                <button
                  type="button"
                  class="olo-bubble-btn"
                  [class.is-active]="isActive(item)"
                  [attr.aria-pressed]="isActive(item)"
                  [title]="titleFor(item)"
                  [innerHTML]="iconFor(item.iconKey)"
                  (click)="openLinkEditor()"
                ></button>
              }
              @default {
                <button
                  type="button"
                  class="olo-bubble-btn"
                  [class.is-active]="isActive(item)"
                  [attr.aria-pressed]="isActive(item)"
                  [title]="titleFor(item)"
                  [innerHTML]="iconFor(item.iconKey)"
                  (click)="run(item)"
                ></button>
              }
            }
          }
        }
      </div>
    }
  `,
  styles: [],
})
export class OloBubbleMenuComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);

  /** Plugin-emitted state. Drives visibility and position. */
  readonly state = input.required<OloBubbleMenuState>();
  /** EditorView. Required to dispatch commands. */
  readonly view = input.required<EditorView>();
  /** Items to render. Built by OloType from the configured ids. */
  readonly items = input.required<readonly OloMenuItem[]>();

  protected readonly linkEditorOpen = signal(false);
  protected readonly linkDraft = signal('');

  /** True on touch devices — flips the menu into a sticky bottom sheet. */
  protected readonly isBottomSheet = signal(false);

  private readonly floater = viewChild<ElementRef<HTMLDivElement>>('floater');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  private cleanup: (() => void) | null = null;
  private mql: MediaQueryList | null = null;
  private mqlChange: (() => void) | null = null;
  private readonly iconCache = new Map<string, SafeHtml>();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.mql = window.matchMedia('(pointer: coarse)');
      this.isBottomSheet.set(this.mql.matches);
      const onChange = (e: MediaQueryListEvent) => this.isBottomSheet.set(e.matches);
      this.mql.addEventListener('change', onChange);
      // Capture for cleanup
      this.mqlChange = () => this.mql?.removeEventListener('change', onChange);
    }

    effect(() => {
      const s = this.state();
      const floaterEl = this.floater()?.nativeElement;
      untracked(() => this.syncFloating(s, floaterEl ?? null));
    });

    // Close the link editor when the bubble hides.
    effect(() => {
      if (!this.state().visible && untracked(() => this.linkEditorOpen())) {
        untracked(() => this.closeLinkEditor());
      }
    });

    // Auto-focus the URL input when the link editor opens.
    effect(() => {
      const open = this.linkEditorOpen();
      const input = this.linkInput();
      if (open && input) {
        queueMicrotask(() => input.nativeElement.focus());
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.mqlChange?.();
    this.mqlChange = null;
  }

  protected iconFor(key = ''): SafeHtml {
    let cached = this.iconCache.get(key);
    if (!cached) {
      // Icons are inline SVG built from a known-good static lookup table —
      // see ../icons.ts. No user-provided HTML reaches here unless a host
      // explicitly registers a custom item with a raw SVG string, which is
      // their responsibility to vet.
      cached = this.sanitizer.bypassSecurityTrustHtml(renderIcon(key));
      this.iconCache.set(key, cached);
    }
    return cached;
  }

  protected titleFor(item: OloMenuItem): string {
    if (!item.title) return '';
    return item.shortcut ? `${item.title} (${item.shortcut})` : item.title;
  }

  protected isActive(item: OloMenuItem): boolean {
    // Re-track state() so this is reactive across PM updates that change
    // active marks within the visible selection.
    this.state();
    return item.isActive?.(this.view()) ?? false;
  }

  protected run(item: OloMenuItem): void {
    item.run?.(this.view());
  }

  protected openLinkEditor(): void {
    this.linkDraft.set(this.state().linkHref ?? '');
    this.linkEditorOpen.set(true);
  }

  protected closeLinkEditor(): void {
    this.linkEditorOpen.set(false);
    this.linkDraft.set('');
    this.view().focus();
  }

  protected applyLink(event: Event): void {
    event.preventDefault();
    const safe = sanitizeUrl(this.linkDraft());
    if (!safe) {
      this.closeLinkEditor();
      return;
    }
    const view = this.view();
    const linkType = view.state.schema.marks['link'];
    if (!linkType) return;
    const { from, to } = view.state.selection;
    const tr = view.state.tr.addMark(from, to, linkType.create({ href: safe }));
    view.dispatch(tr);
    this.closeLinkEditor();
  }

  protected removeLink(): void {
    const view = this.view();
    const linkType = view.state.schema.marks['link'];
    if (!linkType) return;
    const { from, to } = view.state.selection;
    view.dispatch(view.state.tr.removeMark(from, to, linkType));
    this.closeLinkEditor();
  }

  private syncFloating(s: OloBubbleMenuState, floater: HTMLDivElement | null): void {
    this.cleanup?.();
    this.cleanup = null;

    if (!s.visible || !s.rect || !floater) return;

    // Bottom-sheet mode: CSS owns positioning. Clear any inline styles left
    // over from a prior fine-pointer render.
    if (this.isBottomSheet()) {
      floater.style.position = '';
      floater.style.left = '';
      floater.style.top = '';
      return;
    }

    const virtual: VirtualElement = {
      getBoundingClientRect: () => {
        const cur = this.state().rect;
        if (!cur) return new DOMRect(0, 0, 0, 0);
        return new DOMRect(cur.left, cur.top, cur.width, cur.height);
      },
    };

    this.cleanup = autoUpdate(virtual, floater, () => {
      computePosition(virtual, floater, {
        placement: 'top',
        strategy: 'fixed',
        middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        floater.style.position = 'fixed';
        floater.style.left = `${x}px`;
        floater.style.top = `${y}px`;
      });
    });
  }
}
