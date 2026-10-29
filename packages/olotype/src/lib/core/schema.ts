import { Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { addListNodes } from 'prosemirror-schema-list';

/** URL schemes a link may use. Anything else (`javascript:`, `data:`, …) is dropped. */
const ALLOWED_LINK_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel']);

/** URL schemes an image src may use; none of these execute inside `<img>`. */
const ALLOWED_IMAGE_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'data', 'blob']);

/**
 * The scheme the browser will resolve `url` with (lower-cased), or `null` for
 * a relative URL. Mirrors the URL parser's preprocessing, which a regex on the
 * raw string misses: leading C0 controls and spaces are stripped, and tab/LF/CR
 * are removed anywhere — so `java\tscript:` and `\x01javascript:`
 * both run as `javascript:`.
 */
function urlScheme(url: string): string | null {
  const cleaned = url.replace(/^[\u0000- ]+/, '').replace(/[\t\n\r]/g, '');
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  return match ? match[1].toLowerCase() : null;
}

function sanitizeWith(url: string | null | undefined, allowed: ReadonlySet<string>): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const scheme = urlScheme(trimmed);
  if (scheme !== null && !allowed.has(scheme)) return null;
  return trimmed;
}

/**
 * Return the url (trimmed) if it is safe as a link `href`; otherwise null.
 * Applied when parsing pasted HTML, when the user enters a link, and when a
 * stored document is rendered — so a hostile stored `href` never reaches the DOM.
 *
 * Allowlist: `http:`, `https:`, `mailto:`, `tel:` and relative URLs.
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  return sanitizeWith(url, ALLOWED_LINK_SCHEMES);
}

/**
 * Relaxed URL sanitizer for image sources. Allows `http(s):`, `data:`,
 * `blob:` and relative URLs, none of which execute when consumed by `<img>`;
 * rejects every other scheme (`javascript:`, `vbscript:`, …).
 *
 * Use {@link sanitizeUrl} for link targets.
 */
export function sanitizeImageSrc(url: string | null | undefined): string | null {
  return sanitizeWith(url, ALLOWED_IMAGE_SCHEMES);
}

// ---- Block nodes -----------------------------------------------------------

const doc: NodeSpec = { content: 'block+' };

const paragraph: NodeSpec = {
  group: 'block',
  content: 'inline*',
  parseDOM: [{ tag: 'p' }],
  toDOM: (): DOMOutputSpec => ['p', 0],
};

const heading: NodeSpec = {
  group: 'block',
  content: 'inline*',
  defining: true,
  attrs: { level: { default: 1 } },
  parseDOM: [1, 2, 3].map(level => ({ tag: `h${level}`, attrs: { level } })),
  toDOM: (node): DOMOutputSpec => [`h${node.attrs['level']}`, 0],
};

const blockquote: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  parseDOM: [{ tag: 'blockquote' }],
  toDOM: (): DOMOutputSpec => ['blockquote', 0],
};

const horizontalRule: NodeSpec = {
  group: 'block',
  parseDOM: [{ tag: 'hr' }],
  toDOM: (): DOMOutputSpec => ['hr'],
};

const codeBlock: NodeSpec = {
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
  toDOM: (): DOMOutputSpec => ['pre', ['code', 0]],
};

const image: NodeSpec = {
  group: 'block',
  inline: false,
  draggable: true,
  attrs: {
    src: { default: '' },
    alt: { default: null },
    title: { default: null },
    width: { default: null },
    height: { default: null },
  },
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs: (dom: HTMLElement) => {
        // Image srcs use the relaxed sanitizer: data:/blob:/http(s) are all
        // safe in `<img>` (no script execution). Only javascript:/vbscript:
        // get rejected.
        const safeSrc = sanitizeImageSrc(dom.getAttribute('src'));
        if (!safeSrc) return false; // PM rejects this match
        return {
          src: safeSrc,
          alt: dom.getAttribute('alt'),
          title: dom.getAttribute('title'),
          width: dom.getAttribute('width') ? Number(dom.getAttribute('width')) : null,
          height: dom.getAttribute('height') ? Number(dom.getAttribute('height')) : null,
        };
      },
    },
  ],
  toDOM: (node): DOMOutputSpec => {
    const { src, alt, title, width, height } = node.attrs;
    const safeSrc = sanitizeImageSrc(src as string) ?? '';
    return [
      'img',
      {
        src: safeSrc,
        alt: alt ?? '',
        ...(title ? { title } : {}),
        ...(width ? { width: String(width) } : {}),
        ...(height ? { height: String(height) } : {}),
      },
    ];
  },
};

const hardBreak: NodeSpec = {
  inline: true,
  group: 'inline',
  selectable: false,
  parseDOM: [{ tag: 'br' }],
  toDOM: (): DOMOutputSpec => ['br'],
};

const text: NodeSpec = { group: 'inline' };

// ---- Marks -----------------------------------------------------------------

const bold: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    // Word/Google Docs paste sometimes ships `<b style="font-weight: normal">` — reject those.
    { tag: 'b', getAttrs: (dom: HTMLElement) => dom.style.fontWeight !== 'normal' && null },
    { style: 'font-weight=400', clearMark: m => m.type.name === 'bold' },
    {
      style: 'font-weight',
      getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
    },
  ],
  toDOM: (): DOMOutputSpec => ['strong', 0],
};

const italic: MarkSpec = {
  parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
  toDOM: (): DOMOutputSpec => ['em', 0],
};

const underline: MarkSpec = {
  parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
  toDOM: (): DOMOutputSpec => ['u', 0],
};

const strike: MarkSpec = {
  parseDOM: [
    { tag: 's' },
    { tag: 'strike' },
    { tag: 'del' },
    { style: 'text-decoration=line-through' },
  ],
  toDOM: (): DOMOutputSpec => ['s', 0],
};

const code: MarkSpec = {
  excludes: '_',
  parseDOM: [{ tag: 'code' }],
  toDOM: (): DOMOutputSpec => ['code', 0],
};

const link: MarkSpec = {
  inclusive: false,
  attrs: {
    href: { default: '' },
    title: { default: null },
  },
  parseDOM: [
    {
      tag: 'a[href]',
      getAttrs: (dom: HTMLElement) => {
        const safeHref = sanitizeUrl(dom.getAttribute('href'));
        if (!safeHref) return false;
        return { href: safeHref, title: dom.getAttribute('title') };
      },
    },
  ],
  toDOM: (mark): DOMOutputSpec => {
    const href = sanitizeUrl(mark.attrs['href'] as string) ?? '';
    const isExternal = /^https?:\/\//i.test(href);
    return [
      'a',
      {
        href,
        ...(mark.attrs['title'] ? { title: mark.attrs['title'] } : {}),
        rel: 'noopener noreferrer',
        ...(isExternal ? { target: '_blank' } : {}),
      },
      0,
    ];
  },
};

/**
 * Default OloType schema. We compose with `addListNodes` from
 * `prosemirror-schema-list` to get bullet/ordered/list-item with the standard
 * keymap behavior.
 */
const baseNodes = {
  doc,
  paragraph,
  heading,
  blockquote,
  horizontalRule,
  codeBlock,
  image,
  hardBreak,
  text,
};

const baseMarks = { bold, italic, underline, strike, code, link };

const tempSchema = new Schema({ nodes: baseNodes, marks: baseMarks });
const nodesWithLists = addListNodes(tempSchema.spec.nodes, 'paragraph block*', 'block');

export const oloDefaultSchema = new Schema({
  nodes: nodesWithLists,
  marks: tempSchema.spec.marks,
});
