// 供应商指南仅允许安全的文本 Markdown，不透传原始 HTML 或不受信的链接。
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderInline(value: string) {
  const token =
    /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let html = '';
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(cursor, index));
    if (match[1]) {
      html += `<code>${escapeHtml(match[1])}</code>`;
    } else if (match[2] && match[3]) {
      try {
        const url = new URL(match[3]);
        html +=
          url.protocol === 'https:' && !url.username && !url.password
            ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[2])}</a>`
            : escapeHtml(match[2]);
      } catch {
        html += escapeHtml(match[2]);
      }
    } else if (match[4]) {
      html += `<strong>${escapeHtml(match[4])}</strong>`;
    } else if (match[5]) {
      html += `<em>${escapeHtml(match[5])}</em>`;
    }
    cursor = index + match[0].length;
  }
  return html + escapeHtml(value.slice(cursor));
}

// 通用块级阅读器支持标题、段落、列表、引用和代码块，未知语法仍作为安全文本显示。
export function renderSafeMarkdown(markdown: string) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const output: string[] = [];
  let list: 'ol' | 'ul' | undefined;
  let code: string[] | undefined;

  function closeList() {
    if (list) output.push(`</${list}>`);
    list = undefined;
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      closeList();
      if (code) {
        output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = undefined;
      } else {
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,6})[ \t]+(\S.*)$/);
    if (heading) {
      closeList();
      const level = (heading[1] ?? '').length;
      output.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[ \t]*[-*+][ \t]+(\S.*)$/);
    const numbered = line.match(/^[ \t]*\d+\.[ \t]+(\S.*)$/);
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        output.push(`<${kind}>`);
        list = kind;
      }
      output.push(`<li>${renderInline((bullet || numbered)?.[1] ?? '')}</li>`);
      continue;
    }
    closeList();
    const quote = line.match(/^>\s?(.*)$/);
    output.push(
      quote
        ? `<blockquote>${renderInline(quote[1] ?? '')}</blockquote>`
        : `<p>${renderInline(line)}</p>`,
    );
  }
  closeList();
  if (code)
    output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return output.join('\n');
}
