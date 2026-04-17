import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ConsentService } from '../consent.service';
import { CONSENT_CONFIG, ConsentConfig } from '../consent.config';

@Component({
  selector: 'olopad-consent-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consent-banner.html',
  styleUrl: './consent-banner.css',
})
export class ConsentBannerComponent {
  protected readonly consent = inject(ConsentService);
  protected readonly config = inject<ConsentConfig>(CONSENT_CONFIG);

  /** Whether we're showing the customize view */
  protected readonly customizeView = signal(false);

  /** Current toggle state for each category in customize view */
  protected readonly categoryChoices = signal<Record<string, boolean>>({});

  protected get brandingLogoUrl(): string | undefined {
    return this.config.branding?.logoUrl;
  }

  protected get brandingLogoAlt(): string {
    return this.config.branding?.logoAlt || '';
  }

  protected onAcceptAll(): void {
    this.consent.acceptAll();
  }

  protected onRejectAll(): void {
    this.consent.rejectAll();
  }

  protected onCustomize(): void {
    // Initialize toggle states: required = always on, others = current value or false
    const choices: Record<string, boolean> = {};
    for (const cat of this.consent.categories) {
      if (cat.required) {
        choices[cat.key] = true;
      } else {
        choices[cat.key] = this.consent.getConsent(cat.key) === 'granted';
      }
    }
    this.categoryChoices.set(choices);
    this.customizeView.set(true);
  }

  protected onToggle(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.categoryChoices.update(prev => ({ ...prev, [key]: checked }));
  }

  protected onSavePreferences(): void {
    this.consent.savePreferences({ ...this.categoryChoices() });
    this.customizeView.set(false);
  }

  protected onBack(): void {
    this.customizeView.set(false);
  }
}
