import { describe, expect, it } from 'vitest';
import { OLO_ICONS, renderIcon } from './icons';

describe('renderIcon', () => {
  it('returns empty string for undefined or empty key', () => {
    expect(renderIcon(undefined)).toBe('');
    expect(renderIcon('')).toBe('');
  });

  it('returns empty string for an unknown icon key', () => {
    expect(renderIcon('does-not-exist')).toBe('');
  });

  it.each(Object.keys(OLO_ICONS))('renders a 24x24 svg for known icon "%s"', (key) => {
    const out = renderIcon(key);
    expect(out).toMatch(/^<svg /);
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain(OLO_ICONS[key]);
  });

  it('respects a custom size', () => {
    const out = renderIcon('bold', 32);
    expect(out).toContain('width="32"');
    expect(out).toContain('height="32"');
  });

  it('passes raw svg markup through unchanged', () => {
    const raw = '<svg><path d="M0 0"/></svg>';
    expect(renderIcon(raw)).toBe(raw);
  });
});
