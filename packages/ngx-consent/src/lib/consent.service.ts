import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { CONSENT_CONFIG, ConsentCategory, DEFAULT_CONSENT_CATEGORIES } from './consent.config';

const STORAGE_KEY = 'cookie_consent';

interface StoredConsent {
  /** ISO timestamp of when consent was given/updated */
  timestamp: string;
  /** Map of category key → granted/denied */
  choices: Record<string, boolean>;
}

/**
 * Core consent service that manages:
 * - Google Consent Mode v2 default/update lifecycle
 * - GTM script injection
 * - User consent persistence via localStorage
 * - Banner visibility state
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly config = inject(CONSENT_CONFIG);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  /** All consent categories (essential + optional) */
  readonly categories: ConsentCategory[];

  /** Whether the consent banner should be visible */
  readonly bannerVisible = signal(false);

  /** Whether the user has made a consent choice (persisted) */
  readonly hasConsented = signal(false);

  constructor() {
    const customCategories = this.config.categories;
    if (customCategories) {
      this.categories = customCategories;
    } else {
      this.categories = DEFAULT_CONSENT_CATEGORIES;
    }
  }

  /**
   * Initializes the consent system. Called via APP_INITIALIZER.
   * 1. Sets consent defaults (all denied)
   * 2. Checks localStorage for existing consent
   * 3. Injects GTM script
   */
  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initDataLayer();
    this.setConsentDefaults();

    const stored = this.loadStoredConsent();
    if (stored) {
      this.hasConsented.set(true);
      this.pushConsentUpdate(stored.choices);
    } else {
      this.bannerVisible.set(true);
    }

    this.injectGtmScript();
    this.injectGtmNoscript();
  }

  /** Accept all optional consent categories */
  acceptAll(): void {
    const choices: Record<string, boolean> = {};
    for (const cat of this.categories) {
      choices[cat.key] = true;
    }
    this.saveAndApply(choices);
  }

  /** Reject all optional consent categories (essential stays granted) */
  rejectAll(): void {
    const choices: Record<string, boolean> = {};
    for (const cat of this.categories) {
      choices[cat.key] = !!cat.required;
    }
    this.saveAndApply(choices);
  }

  /** Save custom preferences from the customize view */
  savePreferences(choices: Record<string, boolean>): void {
    // Ensure essential categories are always granted
    for (const cat of this.categories) {
      if (cat.required) {
        choices[cat.key] = true;
      }
    }
    this.saveAndApply(choices);
  }

  /** Get the current consent status for a category key */
  getConsent(categoryKey: string): 'granted' | 'denied' {
    if (!isPlatformBrowser(this.platformId)) {
      return 'denied';
    }
    const stored = this.loadStoredConsent();
    return stored?.choices[categoryKey] ? 'granted' : 'denied';
  }

  /** Show the consent banner (e.g. from footer "Cookie Settings" link) */
  showBanner(): void {
    this.bannerVisible.set(true);
  }

  /** Hide the consent banner */
  hideBanner(): void {
    this.bannerVisible.set(false);
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  private saveAndApply(choices: Record<string, boolean>): void {
    this.persistConsent(choices);
    this.hasConsented.set(true);
    this.pushConsentUpdate(choices);
    this.hideBanner();
  }

  private initDataLayer(): void {
    const win = this.document.defaultView as (Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }) | null;
    if (!win) return;

    win.dataLayer = win.dataLayer || [];
    if (!win.gtag) {
      win.gtag = function (...args: unknown[]) {
        win.dataLayer!.push(args);
      };
    }
  }

  private setConsentDefaults(): void {
    const consentMap: Record<string, string> = {};

    for (const cat of this.categories) {
      const value = cat.required ? 'granted' : 'denied';
      for (const type of cat.gtagStorageTypes) {
        consentMap[type] = value;
      }
    }

    this.gtag('consent', 'default', {
      ...consentMap,
      wait_for_update: 500,
    });
  }

  private pushConsentUpdate(choices: Record<string, boolean>): void {
    const consentMap: Record<string, string> = {};

    for (const cat of this.categories) {
      const granted = choices[cat.key] ?? !!cat.required;
      for (const type of cat.gtagStorageTypes) {
        consentMap[type] = granted ? 'granted' : 'denied';
      }
    }

    this.gtag('consent', 'update', consentMap);
  }

  private gtag(...args: unknown[]): void {
    const win = this.document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    if (!win?.dataLayer) return;
    win.dataLayer.push(args);
  }

  private injectGtmScript(): void {
    const win = this.document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const head = this.document.head;
    if (!win || !head) return;

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${this.config.gtmId}`;

    // Push gtm.start directly (not through gtag — it must be a plain object)
    win.dataLayer = win.dataLayer || [];
    win.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js',
    });

    head.appendChild(script);
  }

  private injectGtmNoscript(): void {
    const body = this.document.body;
    if (!body) return;

    const noscript = this.document.createElement('noscript');
    const iframe = this.document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${this.config.gtmId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);

    body.insertBefore(noscript, body.firstChild);
  }

  private persistConsent(choices: Record<string, boolean>): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const data: StoredConsent = {
      timestamp: new Date().toISOString(),
      choices,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable (private browsing, etc.)
    }
  }

  private loadStoredConsent(): StoredConsent | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredConsent;
    } catch {
      return null;
    }
  }
}
