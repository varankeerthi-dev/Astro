// Minimal Markdown → safe-HTML renderer (editor v1, shared by admin preview
// and public pages). All input is HTML-escaped first; only generated tags
// survive, so the output is safe to render verbatim.
// Supports: ATX headings, bold/italic, inline code, links, ul/ol lists,
// blockquotes, fenced code, hr, pipe tables, and callouts
// (`> [!note|tip|warning|danger] …`) rendered as styled boxes.
// Also extracts the heading tree for the sticky table of contents.

export interface RenderedMarkdown {
  html: string;
  toc: { id: string; level: number; text: string }[];
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const INLINE_RULES: [RegExp, string][] = [
  [/`([^`]+)`/g, '<code>$1</code>'],
  [/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'],
  [/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>'],
  [/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>'],
];

function inline(s: string): string {
  let out = esc(s);
  for (const [re, rep] of INLINE_RULES) out = out.replace(re, rep);
  return out;
}

function headingId(text: string, taken: Set<string>): string {
  let id = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  if (taken.has(id)) {
    let n = 2;
    while (taken.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  taken.add(id);
  return id;
}

const CALLOUT_PALETTE: Record<string, string> = {
  note: 'border-blue-300 bg-blue-50 text-blue-900',
  tip: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-red-300 bg-red-50 text-red-900',
};

export function renderMarkdown(body: string): RenderedMarkdown {
  // Normalize CRLF / lone CR to LF first — regexes like /^#{1,6}\s+(.*)$/
  // can't match lines terminated by \r (`.` excludes it, `$` doesn't anchor
  // before it), which previously made the renderer spin forever on CRLF input.
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const toc: RenderedMarkdown['toc'] = [];
  const taken = new Set<string>();
  let i = 0;

  const flushList = (buf: string[], ordered: boolean) => {
    out.push(`<${ordered ? 'ol' : 'ul'}>`);
    for (const item of buf) out.push(`<li>${inline(item)}</li>`);
    out.push(`</${ordered ? 'ol' : 'ul'}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const fence: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        fence.push(esc(lines[i]));
        i++;
      }
      i++; // closing fence
      out.push(`<pre><code>${fence.join('\n')}</code></pre>`);
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = headingId(text, taken);
      toc.push({ id, level, text });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^---+$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        q.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const joined = q.join(' ');
      const callout = /^\[!(note|tip|warning|danger)\]\s?(.*)$/i.exec(joined);
      if (callout) {
        const kind = callout[1].toLowerCase();
        out.push(
          `<div class="callout rounded-xl border px-4 py-3 my-4 ${CALLOUT_PALETTE[kind]}">${inline(callout[2])}</div>`,
        );
      } else {
        out.push(`<blockquote>${inline(joined)}</blockquote>`);
      }
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      flushList(buf, false);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      flushList(buf, true);
      continue;
    }

    if (line.startsWith('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        i++;
      }
      out.push(
        '<table><thead><tr>' + rows[0].map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>',
      );
      for (const r of rows.slice(1)) {
        out.push('<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      }
      out.push('</tbody></table>');
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>|\||\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return { html: out.join('\n'), toc };
}

export function readingTime(md: string): number {
  const words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
