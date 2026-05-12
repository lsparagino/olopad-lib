/**
 * Inline SVG icon paths. Tiny, dependency-free, and styled via `currentColor`.
 *
 * Keys mirror Lucide names so hosts can pick familiar identifiers, but we ship
 * only the small subset the editor needs. Custom icons can be passed by hosts
 * as full SVG strings in {@link OloSlashMenuItem.icon}.
 */
export const OLO_ICONS: Readonly<Record<string, string>> = {
  bold: '<path d="M6 4h6a4 4 0 0 1 0 8H6zM6 12h7a4 4 0 0 1 0 8H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  italic: '<line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  underline: '<path d="M6 4v8a6 6 0 0 0 12 0V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  code: '<polyline points="16 18 22 12 16 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  unlink: '<path d="M18.84 12.25 21 10.1a5 5 0 0 0-7.07-7.07L11.7 5.34M3.41 3.41l17.18 17.18M5.43 12.86 3.34 14.95a5 5 0 0 0 7.07 7.07l2.13-2.13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  heading1: '<text x="3" y="18" font-family="ui-sans-serif,system-ui" font-size="14" font-weight="700" fill="currentColor">H1</text>',
  heading2: '<text x="3" y="18" font-family="ui-sans-serif,system-ui" font-size="14" font-weight="700" fill="currentColor">H2</text>',
  heading3: '<text x="3" y="18" font-family="ui-sans-serif,system-ui" font-size="14" font-weight="700" fill="currentColor">H3</text>',
  list: '<line x1="9" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>',
  'list-ordered': '<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="2" y="9" font-family="ui-sans-serif,system-ui" font-size="7" font-weight="600" fill="currentColor">1.</text><text x="2" y="15" font-family="ui-sans-serif,system-ui" font-size="7" font-weight="600" fill="currentColor">2.</text><text x="2" y="21" font-family="ui-sans-serif,system-ui" font-size="7" font-weight="600" fill="currentColor">3.</text>',
  quote: '<path d="M3 7h6v6H5c0 2 1 4 4 4v2c-4 0-6-3-6-6zM13 7h6v6h-4c0 2 1 4 4 4v2c-4 0-6-3-6-6z" fill="currentColor"/>',
  hr: '<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  'code-block': '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="9 9 6 12 9 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15 9 18 12 15 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  text: '<line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="20" x2="15" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

/** Render an icon key as an inline SVG string. Unknown keys render empty. */
export function renderIcon(key: string | undefined, size = 16): string {
  if (!key) return '';
  // If the host passed raw SVG markup, trust it. We only render it as innerHTML
  // through bypassSecurityTrustHtml-equivalent in components that explicitly
  // mark it safe (see bubble-menu/slash-menu templates).
  if (key.trim().startsWith('<')) return key;
  const path = OLO_ICONS[key];
  if (!path) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}
