import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OLO_NODE_VIEW_CONTEXT } from '@olopad/olotype';

type CalloutVariant = 'info' | 'warning' | 'success' | 'danger';

const VARIANT_ICONS: Record<CalloutVariant, string> = {
  info: 'ℹ',
  warning: '⚠',
  success: '✓',
  danger: '⛔',
};

const CYCLE: readonly CalloutVariant[] = ['info', 'warning', 'success', 'danger'];

/**
 * NodeView for a non-atom `callout` block. Demonstrates:
 * - Reading the PM node via the injected context's signals.
 * - Rendering custom Angular UI (variant icon, click-to-cycle).
 * - Mounting PM-managed content in a designated slot via [data-olo-content].
 * - Dispatching a transaction that updates node attrs.
 */
@Component({
  selector: 'demo-callout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="callout"
      [class.callout--info]="variant() === 'info'"
      [class.callout--warning]="variant() === 'warning'"
      [class.callout--success]="variant() === 'success'"
      [class.callout--danger]="variant() === 'danger'"
    >
      <button
        type="button"
        class="callout-icon"
        contenteditable="false"
        title="Click to change variant"
        (click)="cycleVariant()"
      >
        {{ icon() }}
      </button>
      <div class="callout-body" data-olo-content></div>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .callout {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 0.875rem 1rem;
        border-radius: 0.5rem;
        border: 1px solid;
        margin: 0.75rem 0;
      }
      .callout--info    { background: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
      .callout--warning { background: #fffbeb; border-color: #fde68a; color: #78350f; }
      .callout--success { background: #f0fdf4; border-color: #bbf7d0; color: #14532d; }
      .callout--danger  { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
      .callout-icon {
        font: inherit;
        background: transparent;
        border: 0;
        padding: 0;
        line-height: 1;
        font-size: 1.25rem;
        cursor: pointer;
        user-select: none;
      }
      .callout-body {
        flex: 1;
        min-width: 0;
      }
      .callout-body :first-child { margin-top: 0; }
      .callout-body :last-child  { margin-bottom: 0; }

      @media (prefers-color-scheme: dark) {
        .callout--info    { background: #1e3a8a33; border-color: #1e40af; color: #bfdbfe; }
        .callout--warning { background: #78350f33; border-color: #92400e; color: #fde68a; }
        .callout--success { background: #14532d33; border-color: #166534; color: #bbf7d0; }
        .callout--danger  { background: #7f1d1d33; border-color: #991b1b; color: #fecaca; }
      }
    `,
  ],
})
export class CalloutComponent {
  private readonly ctx = inject(OLO_NODE_VIEW_CONTEXT);

  protected readonly variant = computed<CalloutVariant>(() => {
    const v = this.ctx.node().attrs['variant'] as string;
    return CYCLE.includes(v as CalloutVariant) ? (v as CalloutVariant) : 'info';
  });

  protected readonly icon = computed(() => VARIANT_ICONS[this.variant()]);

  protected cycleVariant(): void {
    const pos = this.ctx.getPos();
    if (pos === undefined) return;
    const current = this.variant();
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    const view = this.ctx.view;
    const node = view.state.doc.nodeAt(pos);
    if (!node) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, variant: next }));
  }
}
