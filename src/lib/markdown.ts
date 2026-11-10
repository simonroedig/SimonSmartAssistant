/**
 * A small Markdown reader for text written by Claude (the daily briefing): headings,
 * lists, paragraphs, rules, **bold**, *italic*, `code` and links. It only ever yields
 * text and http(s) links – never HTML – so nothing in the text can run.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" };

/** A link only if it leads to a web page. */
export function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

// Earliest match wins; links before emphasis so "[**x**](url)" stays one link.
const INLINE =
  /\[([^\]\n]+)\]\(\s*<?((?:[^()\s>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)|`([^`\n]+)`|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])|(?<![\w_])_(?!\s)([^_\n]+?)_(?![\w_])|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  const pushText = (t: string) => {
    if (!t) return;
    const last = out.at(-1);
    if (last?.type === "text") last.text += t;
    else out.push({ type: "text", text: t });
  };
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      pushText(rest);
      break;
    }
    pushText(rest.slice(0, m.index));
    const [whole, label, url, code, bold1, bold2, em1, em2, angle, bare] = m;
    if (label !== undefined) {
      const href = safeHref(url);
      if (href) out.push({ type: "link", href, children: parseInline(label) });
      else out.push(...parseInline(label));
    } else if (code !== undefined) out.push({ type: "code", text: code });
    else if (bold1 !== undefined || bold2 !== undefined) {
      out.push({ type: "bold", children: parseInline(bold1 ?? bold2) });
    } else if (em1 !== undefined || em2 !== undefined) {
      out.push({ type: "italic", children: parseInline(em1 ?? em2) });
    } else {
      const raw = angle ?? bare;
      const href = safeHref(raw);
      if (href) out.push({ type: "link", href, children: [{ type: "text", text: raw }] });
      else pushText(whole);
    }
    rest = rest.slice(m.index + whole.length);
  }
  return out;
}

const BULLET = /^\s*[-*+•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, children: parseInline(heading[2]) });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ type: "rule" });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flush();
      blocks.push({ type: "quote", children: parseInline(quote[1]) });
      continue;
    }
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    const item = bullet ?? numbered;
    if (item) {
      const ordered = !!numbered;
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push(item[1]);
      continue;
    }
    // An indented line goes on with the list item above it.
    if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (list) flush();
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
