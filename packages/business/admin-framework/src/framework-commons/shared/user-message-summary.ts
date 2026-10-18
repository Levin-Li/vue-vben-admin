/** 工作流通知摘要约定为 Markdown；普通消息保持原来的文本语义。 */
export function formatPersonalMessageSummary(
  message: { sourceType?: string; summary?: string },
  fallback = '暂无摘要',
): string {
  const summary = String(message.summary || '');
  if (message.sourceType !== 'Workflow') return summary || fallback;

  // 先保护服务端按纯文本转义的业务值，避免剥格式时吞掉变量原有标点。
  const literals: string[] = [];
  let marker = '\uE000';
  while (summary.includes(marker)) marker += '\uE000';
  const protectedSummary = summary.replaceAll(
    /\\([\\`*_{}[\]()#+\-.!<>|~])/g,
    (_, value: string) => {
      literals.push(value);
      return `${marker}${literals.length - 1}\uE001`;
    },
  );

  // 列表和铃铛只插值文本，不渲染 HTML，不加载链接或图片。
  const text = protectedSummary
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/!?\[([^\]\r\n]*)\]\([^\r\n)]*\)/g, '$1')
    .replaceAll(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replaceAll(/^\s*```[^\r\n]*$/gm, '')
    .replaceAll('**', '')
    .replaceAll('__', '')
    .replaceAll('`', '');
  return (
    text
      .replaceAll(
        new RegExp(`${marker}(\\d+)\uE001`, 'g'),
        (_, index: string) => literals[Number(index)] ?? '',
      )
      .trim() || fallback
  );
}
