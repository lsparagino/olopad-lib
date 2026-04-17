import { InjectionToken } from '@angular/core';

/**
 * A single consent category displayed in the cookie banner.
 */
export interface ConsentCategory {
  /** Unique key used for localStorage persistence */
  key: string;
  /** Display label shown in the banner */
  label: string;
  /** Description explaining what this category covers */
  description: string;
  /**
   * Google Consent Mode v2 storage types controlled by this category.
   * When the user grants this category, all listed types are set to 'granted'.
   */
  gtagStorageTypes: string[];
  /** If true, this category cannot be toggled off (essential cookies) */
  required?: boolean;
}

/**
 * Branding options for the consent banner.
 */
export interface ConsentBranding {
  /** URL to a logo image displayed at the top of the banner */
  logoUrl?: string;
  /** Alt text for the logo image */
  logoAlt?: string;
}

/**
 * Configuration for the consent module.
 * Pass this to `provideConsent()` in your app config.
 */
export interface ConsentConfig {
  /** Google Tag Manager container ID (e.g. 'GTM-XXXXXXX') */
  gtmId: string;
  /** URL to the privacy policy page, shown as a link in the banner */
  privacyPolicyUrl: string;
  /** Optional branding for the consent banner */
  branding?: ConsentBranding;
  /**
   * Custom consent categories. If omitted, defaults are used.
   * Essential category is always prepended automatically.
   */
  categories?: ConsentCategory[];
}

/** Injection token for the consent configuration. */
export const CONSENT_CONFIG = new InjectionToken<ConsentConfig>('CONSENT_CONFIG');

/** Default consent categories when none are provided in the config. */
export const DEFAULT_CONSENT_CATEGORIES: ConsentCategory[] = [
  {
    key: 'essential',
    label: 'Essential',
    description: 'Required for the website to function properly. These cannot be disabled.',
    gtagStorageTypes: ['functionality_storage', 'security_storage'],
    required: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Help us understand how visitors interact with our website by collecting anonymous usage data.',
    gtagStorageTypes: ['analytics_storage'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Used to deliver personalized ads and measure advertising campaign performance.',
    gtagStorageTypes: ['ad_storage', 'ad_user_data', 'ad_personalization'],
  },
];
