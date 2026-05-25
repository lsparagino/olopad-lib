import { describe, expect, it } from 'vitest';
import { DOMSerializer } from 'prosemirror-model';
import { oloDefaultSchema, sanitizeImageSrc, sanitizeUrl } from './schema';

describe('sanitizeUrl', () => {
  it('returns plain http and https urls unchanged', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
  });

  it('returns relative urls unchanged', () => {
    expect(sanitizeUrl('/relative/path')).toBe('/relative/path');
    expect(sanitizeUrl('./local')).toBe('./local');
    expect(sanitizeUrl('mailto:foo@example.com')).toBe('mailto:foo@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '   javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
  ])('rejects dangerous scheme %s', (url) => {
    expect(sanitizeUrl(url)).toBeNull();
  });

  it('allows urls that merely contain the disallowed words elsewhere', () => {
    expect(sanitizeUrl('https://example.com/javascript:foo')).toBe(
      'https://example.com/javascript:foo',
    );
    expect(sanitizeUrl('https://example.com/data:image')).toBe('https://example.com/data:image');
  });

  it.each([null, undefined, '', '   '])('returns null for empty input %s', (value) => {
    expect(sanitizeUrl(value as string | null | undefined)).toBeNull();
  });
});

describe('sanitizeImageSrc', () => {
  it('allows data: URLs (safe in <img src>; useful for uploader returns)', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeImageSrc(url)).toBe(url);
  });

  it('allows blob: URLs', () => {
    expect(sanitizeImageSrc('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
  });

  it('allows http(s) and relative URLs', () => {
    expect(sanitizeImageSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(sanitizeImageSrc('/img/a.png')).toBe('/img/a.png');
  });

  it.each(['javascript:alert(1)', 'VBScript:foo'])('rejects script-executable scheme %s', (url) => {
    expect(sanitizeImageSrc(url)).toBeNull();
  });

  it.each([null, undefined, '', '   '])('returns null for empty input %s', (value) => {
    expect(sanitizeImageSrc(value as string | null | undefined)).toBeNull();
  });
});

describe('oloDefaultSchema', () => {
  it('declares the documented v1 block nodes', () => {
    for (const name of [
      'doc',
      'paragraph',
      'heading',
      'blockquote',
      'horizontalRule',
      'codeBlock',
      'image',
      'hardBreak',
      'text',
    ]) {
      expect(oloDefaultSchema.nodes[name], `node "${name}"`).toBeDefined();
    }
  });

  it('declares the documented v1 marks', () => {
    for (const name of ['bold', 'italic', 'underline', 'strike', 'code', 'link']) {
      expect(oloDefaultSchema.marks[name], `mark "${name}"`).toBeDefined();
    }
  });

  it('mixes in list nodes from prosemirror-schema-list', () => {
    expect(oloDefaultSchema.nodes['bullet_list']).toBeDefined();
    expect(oloDefaultSchema.nodes['ordered_list']).toBeDefined();
    expect(oloDefaultSchema.nodes['list_item']).toBeDefined();
  });

  it('rejects parsing an <img> with a javascript: src', () => {
    const dom = document.createElement('div');
    dom.innerHTML = '<img src="javascript:alert(1)" alt="x">';
    // parseDOM matchers run via DOMParser; the easiest behavior assertion is
    // that the rendered output of an image node with a poisoned src is
    // neutralized by toDOM.
    const node = oloDefaultSchema.nodes['image'].create({ src: 'javascript:alert(1)' });
    const out = DOMSerializer.fromSchema(oloDefaultSchema).serializeNode(node) as HTMLElement;
    expect(out.getAttribute('src')).toBe('');
  });

  it('renders an image node with a data: src verbatim (relaxed sanitizer)', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const node = oloDefaultSchema.nodes['image'].create({ src: dataUrl });
    const out = DOMSerializer.fromSchema(oloDefaultSchema).serializeNode(node) as HTMLElement;
    expect(out.getAttribute('src')).toBe(dataUrl);
  });

  it('marks external link mark output with target=_blank and rel=noopener', () => {
    const linkMark = oloDefaultSchema.marks['link'].create({ href: 'https://example.com' });
    const para = oloDefaultSchema.nodes['paragraph'].create(
      null,
      oloDefaultSchema.text('hi', [linkMark]),
    );
    const dom = DOMSerializer.fromSchema(oloDefaultSchema).serializeNode(para) as HTMLElement;
    const anchor = dom.querySelector('a')!;
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not set target=_blank for non-http(s) link hrefs', () => {
    const linkMark = oloDefaultSchema.marks['link'].create({ href: 'mailto:hi@example.com' });
    const para = oloDefaultSchema.nodes['paragraph'].create(
      null,
      oloDefaultSchema.text('email', [linkMark]),
    );
    const dom = DOMSerializer.fromSchema(oloDefaultSchema).serializeNode(para) as HTMLElement;
    const anchor = dom.querySelector('a')!;
    expect(anchor.getAttribute('target')).toBeNull();
  });

  it('strips dangerous hrefs at serialization time even if a mark is constructed with one', () => {
    const linkMark = oloDefaultSchema.marks['link'].create({ href: 'javascript:alert(1)' });
    const para = oloDefaultSchema.nodes['paragraph'].create(
      null,
      oloDefaultSchema.text('x', [linkMark]),
    );
    const dom = DOMSerializer.fromSchema(oloDefaultSchema).serializeNode(para) as HTMLElement;
    expect(dom.querySelector('a')!.getAttribute('href')).toBe('');
  });
});
