# @olopad/style

The OloPad design system as a portable CSS package: design tokens, base styles, animations, brand image assets, and a webmanifest template. No build step, no runtime — just CSS files and static assets.

## Install

```bash
npm install @olopad/style
```

## Quick start

### Tailwind v4 project

```css
/* src/tailwind.css */
@import 'tailwindcss';
@import '@olopad/style/tailwind';
```

`@olopad/style/tailwind` registers the tokens inside an `@theme` block, so Tailwind generates utilities (`bg-primary`, `text-text-secondary`, `rounded-lg`, …) for you.

### Vanilla CSS project

```css
@import '@olopad/style';
```

The vanilla bundle exposes the tokens as `:root` custom properties. Reference them with `var(--color-primary)`.

### Pick & mix

| Sub-path | Contents |
|---|---|
| `@olopad/style` | full vanilla bundle (fonts + tokens + base + animations) |
| `@olopad/style/tailwind` | full Tailwind v4 bundle (uses `@theme`) |
| `@olopad/style/tokens` | tokens only, vanilla `:root` |
| `@olopad/style/tokens.tailwind` | tokens only, Tailwind `@theme` |
| `@olopad/style/fonts` | Google Fonts `@import` for Space Grotesk + Syncopate |
| `@olopad/style/base` | global resets (html, body, scrollbar, focus, selection) |
| `@olopad/style/animations` | keyframes + `.animate-*` and `.stagger-*` utilities |

## Design tokens

### Color

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#00FFCC` | Brand accent (cyan-mint) |
| `--color-primary-dim` | `#00CC99` | Pressed / muted accent |
| `--color-primary-glow` | `rgba(0,255,204,0.3)` | Glow effects |
| `--color-primary-subtle` | `rgba(0,255,204,0.08)` | Tinted backgrounds |
| `--color-bg` | `#121212` | Page background |
| `--color-surface` | `#181818` | Cards, panels |
| `--color-surface-hover` | `#1E1E1E` | Surface hover |
| `--color-surface-active` | `#282828` | Surface pressed |
| `--color-border` | `#282828` | Hairline borders |
| `--color-border-hover` | `#333333` | Hover border |
| `--color-text` | `#FFFFFF` | Primary text |
| `--color-text-secondary` | `#8888AA` | Secondary text |
| `--color-text-muted` | `#555577` | Tertiary / muted text |
| `--color-danger` | `#FF4466` | Errors, destructive |
| `--color-warning` | `#FFAA22` | Warnings |
| `--color-success` | `#00FFCC` | Success (= primary) |

### Typography

| Token | Value |
|---|---|
| `--font-sans` | `'Space Grotesk', sans-serif` |
| `--font-brand` | `'Syncopate', sans-serif` |

### Radii, shadows, easing, layout

| Token | Value |
|---|---|
| `--radius-sm` / `-md` / `-lg` / `-xl` / `-full` | `6px` / `8px` / `12px` / `16px` / `9999px` |
| `--shadow-glow` / `--shadow-glow-lg` | `0 0 20px` / `0 0 40px` of `--color-primary-glow` |
| `--shadow-card` / `--shadow-card-hover` | `0 4px 24px rgba(0,0,0,0.4)` / `0 8px 40px rgba(0,0,0,0.6)` |
| `--ease-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--sidebar-width` | `280px` |
| `--topbar-height` | `64px` |

## Animations

Utility classes shipped in `animations.css`:

- `.animate-fade-in` — 8px slide + fade, 0.4s
- `.animate-slide-up` — 20px slide + fade, 0.4s
- `.animate-scale-in` — 0.95 → 1 pop, 0.3s
- `.stagger-1` … `.stagger-12` — 40ms-stepped `animation-delay` for staggered children

Custom keyframes available: `fadeIn`, `slideUp`, `scaleIn`, `slideUpSheet`, `slideInLeft`, `pulse-glow`, `spin`.

## Brand assets

Image files ship under `assets/`:

| File | Use |
|---|---|
| `logo_dark.svg` | Full wordmark on dark backgrounds |
| `logo_icon.svg` | Standalone monogram |
| `favicon.svg` / `favicon.ico` / `favicon-96x96.png` | Favicons |
| `apple-touch-icon.png` | iOS home-screen icon |
| `web-app-manifest-192x192.png` / `web-app-manifest-512x512.png` | PWA icons |

Resolve them via the `./assets/*` export, e.g. in a bundler:

```ts
import logo from '@olopad/style/assets/logo_icon.svg';
```

…or copy them into your `public/` folder at build time.

## Webmanifest

`manifest.template.json` is a starter `site.webmanifest`. Replace the `{{APP_NAME}}`, `{{APP_SHORT_NAME}}`, and `{{APP_DESCRIPTION}}` placeholders, copy the icon files into your `public/`, and link it from `<head>`:

```html
<link rel="manifest" href="site.webmanifest" />
<meta name="theme-color" content="#0A0A0F" />
```

## License

MIT
