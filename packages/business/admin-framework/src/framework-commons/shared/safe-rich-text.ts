const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'u',
  'ul',
]);

const DROP_WITH_CONTENT = new Set([
  'audio',
  'embed',
  'form',
  'iframe',
  'math',
  'object',
  'script',
  'style',
  'svg',
  'template',
  'video',
]);

export function isSafeRichTextLink(value: string): boolean {
  const href = value.trim();
  return /^(?:https?:\/\/|mailto:|#(?!\/)|\/(?!\/))/i.test(href);
}

/** 只复制允许的节点和链接地址，避免把原始 HTML 注入当前应用。 */
export function sanitizeRichText(value: string): string {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const output = parsed.createElement('div');

  function appendSafeNodes(source: Node, target: Element): void {
    for (const child of source.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        target.append(parsed.createTextNode(child.textContent || ''));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const element = child as Element;
      const tag = element.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) continue;
      if (!ALLOWED_TAGS.has(tag)) {
        appendSafeNodes(element, target);
        continue;
      }

      const safeElement = parsed.createElement(tag);
      if (tag === 'a') {
        const href = element.getAttribute('href');
        if (href && isSafeRichTextLink(href))
          safeElement.setAttribute('href', href.trim());
      }
      appendSafeNodes(element, safeElement);
      target.append(safeElement);
    }
  }

  appendSafeNodes(parsed.body, output);
  return output.innerHTML;
}
