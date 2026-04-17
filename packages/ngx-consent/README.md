# @olopad/ngx-consent

A self-contained, GDPR-compliant cookie consent solution for Angular applications with Google Tag Manager (GTM) and Google Consent Mode v2 integration.

## Features

- **Google Consent Mode v2** — Sets consent defaults to `denied` before GTM loads, then updates based on user choice
- **Dynamic GTM injection** — No manual `<script>` tags needed in `index.html`
- **Cookie banner UI** — Slide-up glass-effect banner with Accept All / Reject All / Customize options
- **Configurable categories** — Essential (always on), Analytics, Marketing, or custom
- **Branding** — Optional logo image in the banner
- **SSR-safe** — All browser APIs guarded with `isPlatformBrowser`
- **Persistent** — User choices saved to `localStorage` and restored on next visit
- **Themeable** — OloPad dark theme by default, fully customizable via CSS custom properties

## Installation

```bash
npm install @olopad/ngx-consent
```

## Quick Start

### 1. Add `provideConsent()` to your app config

```typescript
import { provideConsent } from '@olopad/ngx-consent';

export const appConfig: ApplicationConfig = {
  providers: [
    provideConsent({
      gtmId: 'GTM-XXXXXXX',
      privacyPolicyUrl: '/privacy',
      branding: {
        logoUrl: '/img/logo.svg',
        logoAlt: 'My App',
      },
    }),
  ],
};
```

### 2. Add the banner component to your app template

```typescript
import { ConsentBannerComponent } from '@olopad/ngx-consent';

@Component({
  imports: [ConsentBannerComponent],
  template: `
    <!-- your app content -->
    <olopad-consent-banner />
  `,
})
export class App {}
```

### 3. (Optional) Add a "Cookie Settings" link

```typescript
import { ConsentService } from '@olopad/ngx-consent';

export class FooterComponent {
  private readonly consent = inject(ConsentService);

  onCookieSettings(): void {
    this.consent.showBanner();
  }
}
```

## Configuration

| Property | Type | Required | Description |
|---|---|---|---|
| `gtmId` | `string` | ✅ | Google Tag Manager container ID (e.g. `'GTM-XXXXXXX'`) |
| `privacyPolicyUrl` | `string` | ✅ | URL shown as a link in the consent banner |
| `branding.logoUrl` | `string` | ❌ | Logo image URL displayed in the banner header |
| `branding.logoAlt` | `string` | ❌ | Alt text for the logo image |
| `categories` | `ConsentCategory[]` | ❌ | Custom consent categories (defaults provided) |

## Default Categories

| Category | Key | Google Consent Types | Required |
|---|---|---|---|
| Essential | `essential` | `functionality_storage`, `security_storage` | ✅ Always on |
| Analytics | `analytics` | `analytics_storage` | ❌ |
| Marketing | `marketing` | `ad_storage`, `ad_user_data`, `ad_personalization` | ❌ |

## Theming

The banner ships with the **OloPad dark theme** by default. Override any of these CSS custom properties on the `olopad-consent-banner` element or a parent:

| Variable | Default | Description |
|---|---|---|
| `--olopad-consent-primary` | `#00FFCC` | Primary accent color |
| `--olopad-consent-primary-light` | `#66FFE0` | Primary hover color |
| `--olopad-consent-bg` | `#0A0A0F` | Banner background |
| `--olopad-consent-bg-secondary` | `rgba(255,255,255,0.02)` | Card/item background |
| `--olopad-consent-text` | `#E8E8ED` | Primary text color |
| `--olopad-consent-text-secondary` | `#A0A0B0` | Secondary text color |
| `--olopad-consent-text-muted` | `#707080` | Muted/description text |
| `--olopad-consent-border` | `#2A2A35` | Border color |
| `--olopad-consent-border-hover` | `#3A3A48` | Border hover color |
| `--olopad-consent-surface` | `#1E1E28` | Toggle background |
| `--olopad-consent-font-heading` | `system-ui, sans-serif` | Heading font family |
| `--olopad-consent-radius` | `20px` | Banner border radius |

### Example: Light theme override

```css
olopad-consent-banner {
  --olopad-consent-primary: #0066CC;
  --olopad-consent-bg: #FFFFFF;
  --olopad-consent-text: #1A1A2E;
  --olopad-consent-border: #E0E0E0;
}
```

## ConsentService API

| Method | Description |
|---|---|
| `initialize()` | Sets up consent defaults, checks localStorage, injects GTM. Called automatically via `APP_INITIALIZER` |
| `acceptAll()` | Grants all categories and hides the banner |
| `rejectAll()` | Denies all optional categories (essential stays granted) and hides the banner |
| `savePreferences(choices)` | Saves custom choices from the customize view |
| `getConsent(key)` | Returns `'granted'` or `'denied'` for a category key |
| `showBanner()` | Shows the consent banner (e.g. from a "Cookie Settings" link) |
| `hideBanner()` | Hides the consent banner |

| Signal | Description |
|---|---|
| `bannerVisible` | Whether the banner is currently shown |
| `hasConsented` | Whether the user has made any consent choice |

## GTM Setup

See [`@olopad/consent-setup`](https://www.npmjs.com/package/@olopad/consent-setup) for an automated CLI tool that sets up GTM + GA4 with Consent Mode v2.
