import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import type { EditorView } from 'prosemirror-view';
import { renderIcon } from '../icons';
import type { OloMenuItem } from '../menu-items';

/**
 * Fixed toolbar rendered above the editor. Opt-in via the OloType
 * `[toolbar]` input. Items are configurable via `[toolbarItems]` and share
 * the same registry as the bubble menu.
 *
 * The toolbar does not own a link editor in v1 — clicking the `link` item
 * while no text is selected does nothing. Once text is selected, the bubble
 * menu appears with the link editor.
 */
@Component({
  selector: 'olo-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="olo-toolbar"
      role="toolbar"
      aria-label="Editor toolbar"
      (mousedown)="$event.preventDefault()"
    >
      @for (item of items(); track $index) {
        @switch (item.kind) {
          @case ('separator') {
            <span class="olo-toolbar-sep" aria-hidden="true"></span>
          }
          @default {
            <button
              type="button"
              class="olo-toolbar-btn"
              [class.is-active]="isActive(item)"
              [attr.aria-pressed]="isActive(item)"
              [disabled]="!isEnabled(item) || null"
              [title]="titleFor(item)"
              [innerHTML]="iconFor(item.iconKey)"
              (click)="run(item)"
            ></button>
          }
        }
      }
    </div>
  `,
  styles: [],
})
export class OloToolbarComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly items = input.required<readonly OloMenuItem[]>();
  readonly view = input.required<EditorView>();
  /**
   * Tick value that increments on every PM view update. Reading it inside
   * isActive/isEnabled makes the toolbar re-evaluate active state on cursor
   * moves and mark toggles.
   */
  readonly tick = input.required<number>();

  private readonly iconCache = new Map<string, SafeHtml>();

  protected iconFor(key = ''): SafeHtml {
    let cached = this.iconCache.get(key);
    if (!cached) {
      // Inline SVG from a static lookup table; raw SVG only via host opt-in.
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
    this.tick();
    return item.isActive?.(this.view()) ?? false;
  }

  protected isEnabled(item: OloMenuItem): boolean {
    this.tick();
    return item.isEnabled?.(this.view()) ?? true;
  }

  protected run(item: OloMenuItem): void {
    if (item.kind === 'link') {
      // No-op: link editor lives in the bubble menu, which appears as soon
      // as text is selected.
      return;
    }
    item.run?.(this.view());
  }
}
