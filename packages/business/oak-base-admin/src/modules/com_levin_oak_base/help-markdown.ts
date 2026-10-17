// 文档中心仅渲染白名单 Markdown 标签；源文档中的 HTML 始终作为文字显示。
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHref(value: string) {
  if (/^\?doc=[a-z0-9]+(?:-[a-z0-9]+)*(?:#[\p{L}\p{N}._~%-]+)?$/u.test(value)) {
    return value;
  }
  if (/^#[\p{L}\p{N}._~%-]+$/u.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return url.href;
  } catch {
    // 非允许的相对路径与协议只显示链接文字。
  }
  return undefined;
}

function renderInline(value: string) {
  const token =
    /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let html = '';
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(cursor, index));
    if (match[1]) html += `<code>${escapeHtml(match[1])}</code>`;
    else if (match[2] && match[3]) {
      const href = safeHref(match[3]);
      const label = escapeHtml(match[2]);
      html += href
        ? `<a href="${escapeHtml(href)}"${href.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
        : label;
    } else if (match[4]) html += `<strong>${escapeHtml(match[4])}</strong>`;
    else if (match[5]) html += `<em>${escapeHtml(match[5])}</em>`;
    cursor = index + match[0].length;
  }
  return html + escapeHtml(value.slice(cursor));
}

export function helpHeadingId(title: string) {
  const normalized = title
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/[`*_#]/g, '')
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
    .replaceAll(/\s+/g, '-');
  return normalized || 'section';
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function renderHelpMarkdown(markdown: string) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const output: string[] = [];
  const headingCounts = new Map<string, number>();
  let list: 'ol' | 'ul' | undefined;
  let code: string[] | undefined;
  let paragraph: string[] = [];

  function closeParagraph() {
    if (paragraph.length > 0)
      output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }
  function closeList() {
    if (list) output.push(`</${list}>`);
    list = undefined;
  }
  function closeBlocks() {
    closeParagraph();
    closeList();
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (line.trim().startsWith('```')) {
      closeBlocks();
      if (code) {
        output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = undefined;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      closeBlocks();
      continue;
    }
    const heading = line.match(/^#{1,6}(?=[ \t])/);
    if (heading) {
      closeBlocks();
      const level = heading[0].length;
      const title = line.slice(level).trim();
      const base = helpHeadingId(title);
      const count = (headingCounts.get(base) ?? 0) + 1;
      headingCounts.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      output.push(
        `<h${level} id="${escapeHtml(id)}">${renderInline(title)}</h${level}>`,
      );
      continue;
    }
    if (line.includes('|') && isTableDivider(lines[index + 1] ?? '')) {
      closeBlocks();
      const headers = tableCells(line);
      output.push(
        '<div class="help-table-scroll"><table><thead><tr>',
        ...headers.map((cell) => `<th>${renderInline(cell)}</th>`),
        '</tr></thead><tbody>',
      );
      index++;
      while (
        index + 1 < lines.length &&
        (lines[index + 1] ?? '').includes('|')
      ) {
        const row = tableCells(lines[++index] ?? '');
        output.push(
          '<tr>',
          ...headers.map(
            (_, cellIndex) => `<td>${renderInline(row[cellIndex] ?? '')}</td>`,
          ),
          '</tr>',
        );
      }
      output.push('</tbody></table></div>');
      continue;
    }
    const trimmed = line.trimStart();
    const bullet = trimmed.match(/^[-*+](?=[ \t])/);
    const numbered = trimmed.match(/^\d+\.(?=[ \t])/);
    if (bullet || numbered) {
      closeParagraph();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        list = kind;
        output.push(`<${kind}>`);
      }
      output.push(
        `<li>${renderInline(trimmed.slice((bullet || numbered)?.[0].length ?? 0).trim())}</li>`,
      );
      continue;
    }
    closeList();
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeParagraph();
      output.push(`<blockquote>${renderInline(quote[1] ?? '')}</blockquote>`);
    } else paragraph.push(line.trim());
  }
  closeBlocks();
  if (code)
    output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return output.join('\n');
}
