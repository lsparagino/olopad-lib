# CLAUDE.md — `@olopad/style`

Design guidelines for the OloPad design system. Read this before adding tokens, animations, or assets, and before changing colour values.

## What this package is

A **pure-CSS design system**: tokens, base resets, animations, brand image assets, and a webmanifest template. There is **no build step** — files are published as-authored. There is **no JavaScript** — anything that needs JS belongs in a different `@olopad/*` package.

If a change requires bundling, transpiling, or runtime code, it does not belong here.

## Visual identity at a glance

- **Mood**: dark, high-contrast, neon. Think late-night studio: black surfaces, a single saturated cyan-mint accent, generous breathing room.
- **Accent**: a single brand colour — `--color-primary: #00FFCC`. Resist adding a second saturated hue; use opacity/glow variants of primary instead.
- **Type**: `Space Grotesk` for body/UI, `Syncopate` reserved for brand/display moments. Don't introduce a third family.
- **Shape**: soft, not pill-shaped. Default radius is `--radius-md` (8px); reach for `--radius-lg`/`-xl` for cards, `--radius-full` only for chips/avatars/scrollbar.
- **Motion**: 0.3–0.4s, `--ease-smooth` for entrances, `--ease-bounce` only for playful pops. Avoid >0.5s — feels sluggish.

## Token system

### How to use tokens (in consuming apps and inside this package)

- **Always** reference design values through the token, never with raw hex / px. `var(--color-primary)`, not `#00FFCC`. The two flavours of the token file (`tokens.css` and `tokens.tailwind.css`) must stay in lock-step — the same set of names with the same values.
- **Don't** introduce per-component tokens here. If you find yourself wanting `--color-button-primary-bg`, the answer is: the button component (in the consuming app or a future `@olopad/ngx-ui`) composes from the existing tokens. Keep this layer atomic.
- **Compose with `var()` inside other tokens** when one value is genuinely derived (`--shadow-glow` reads `--color-primary-glow`). Don't restate values.

### Naming

Token names follow `--<category>-<role>[-<variant>]`:

- `category`: `color`, `font`, `radius`, `shadow`, `ease`, plus layout primitives (`sidebar-width`, `topbar-height`).
- `role`: semantic, not visual — `text-secondary`, not `gray-light`. Renaming a hex must not require a token rename.
- `variant`: `-hover`, `-active`, `-dim`, `-glow`, `-subtle`, `-lg`, `-sm`. Stay within this vocabulary; don't invent `-darker2` or `-superhover`.

### Adding a token

1. It must be **reused in ≥2 places** or replace an existing inline value. One-offs stay inline.
2. Add to **both** `tokens.css` (`:root`) and `tokens.tailwind.css` (`@theme`) with the same name and value.
3. Document it in `README.md` (the relevant table) and add a one-line use note.
4. Bump version per the rules in [versioning](#versioning--breaking-changes) below.

### Changing a token's value

A colour or radius shift propagates everywhere — that's the point. Before changing:

- Confirm the new value preserves contrast against `--color-bg` (≥4.5:1 for text, ≥3:1 for UI controls).
- Confirm the change is intentional across **all** consumers, not motivated by a single screen.
- Treat as breaking unless visually indistinguishable. See [versioning](#versioning--breaking-changes).

## Surface hierarchy

Layered dark surfaces from back to front:

```
--color-bg          (page)
  └─ --color-surface           (card / panel)
       └─ --color-surface-hover   (hover state)
            └─ --color-surface-active  (pressed / selected)
```

Borders step the same way: `--color-border` → `--color-border-hover`. **Don't** introduce intermediate levels — if you need a fifth tier, the design has gone wrong.

## Type

- **Body / UI**: `--font-sans` (Space Grotesk), weights 300–700 are loaded.
- **Brand / display**: `--font-brand` (Syncopate), weights 400 & 700. Use sparingly — page titles, marketing moments, the wordmark — never for body copy.
- The fonts are loaded via Google Fonts in `fonts.css`. If you add a weight, update the URL in `fonts.css` **and** the `<link>` example in any READMEs that show one.

## Animation

- All standard motion uses `--ease-smooth`. `--ease-bounce` is for one-shot, attention-grabbing entrances (a toast, a confirm-success). Don't use bounce for transitions that fire on every interaction — it gets nauseating.
- Durations: 0.3s (small/scale), 0.4s (slide/fade). Anything else needs a reason.
- New keyframes go in `animations.css`. Keep them generic (`pulse-glow`, not `notifications-bell-shake`). App-specific motion lives in the app.
- The `.stagger-N` utilities go up to 12. If you find yourself needing 13+, you're animating too many siblings — virtualise or animate the container.

## Assets

- `assets/` holds **brand-owned** images only: logos, favicons, PWA icons. Don't add screenshots, illustrations, or app-specific imagery.
- SVGs must be hand-cleaned (no Sketch/Illustrator metadata blobs, no inline `<style>` overriding fills) so consumers can recolour with `currentColor` where appropriate.
- The cyan colour in `logo_icon.svg` is hard-coded as `#00FFCC` — keep it numerically in sync with `--color-primary`. If primary moves, every logo file moves with it (and that is a breaking change).
- Raster icon sizes (`192`, `512`, `96`, `apple-touch-icon`) are fixed by PWA / iOS conventions. Don't add custom sizes.

## Webmanifest

`manifest.template.json` is a **template, not a runtime file**. Consumers copy it, fill the `{{APP_NAME}}`/`{{APP_SHORT_NAME}}`/`{{APP_DESCRIPTION}}` placeholders, and ship their own. Keep the placeholders mustache-style so the same template works with simple sed/PowerShell substitution and with template engines.

`theme_color` and `background_color` should match `--color-primary` and a near-black surface respectively. Don't drift these without bumping the package — they affect the OS-level chrome of installed PWAs.

## Versioning & breaking changes

Follow semver. For this package:

- **Patch**: docs, asset re-export, new keyframe that no consumer relies on, additive utility class with a clearly-namespaced selector.
- **Minor**: new token, new asset file, new exported sub-path, new `.animate-*` utility.
- **Major (breaking)**: renamed/removed token, changed token value (unless visually identical), removed asset, changed asset filename, changed manifest placeholder syntax, replaced font family.

When in doubt, treat it as breaking. Consumers depend on `var(--color-primary)` resolving to the brand mint — if you change it to teal, you've changed every screen they ship.

## Don't

- Don't bake component styles in (no `.olopad-button`, no `.olopad-card`). This is a token + primitives layer.
- Don't add a JS dependency or a runtime `index.js`. Pure CSS only.
- Don't ship light-theme tokens here — OloPad is dark-first; a light-theme variant would be a separate import path designed deliberately, not bolted on.
- Don't import from this package's source files other than via the documented `exports` map. If you need a path that isn't exported, add it to `exports` in `package.json` first.
- Don't introduce vendor prefixes by hand. Modern browsers handle the properties used here.

## Don't (process)

- Don't bump the version manually. Use the repo-root `release.ps1 style` script.
- Don't publish locally — the GitHub Actions workflow at `.github/workflows/publish.yml` handles publishing on push to `main` when `package.json` changes.
- Don't commit changes to `assets/` without re-checking `logo_icon.svg`'s fill colour against `--color-primary`.
