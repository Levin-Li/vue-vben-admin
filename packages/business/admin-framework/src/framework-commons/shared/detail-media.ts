export interface DetailMediaResource {
  name: string;
  pdf: boolean;
  url?: string;
}

/** 只消费上传字段约定的单 URL 或 URL 数组，不猜测普通字段语义。 */
export function getDetailMediaResources(
  value: unknown,
  baseUrl: string,
): DetailMediaResource[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item, index) => {
    const unavailable = { name: `资源 ${index + 1}`, pdf: false };
    if (typeof item !== 'string' || !item.trim()) return unavailable;
    const url = item.trim();
    // 禁止浏览器对控制字符或反斜杠进行隐式 URL 规范化。
    if (
      [...url].some(
        (character) =>
          (character.codePointAt(0) ?? 0) < 32 ||
          character.codePointAt(0) === 127 ||
          character === '\\',
      )
    )
      return unavailable;
    try {
      const parsed = new URL(url, baseUrl);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        return unavailable;
      const segment = parsed.pathname.split('/').pop() || unavailable.name;
      let name = segment;
      try {
        name = decodeURIComponent(segment);
      } catch {
        // 非法转义不影响有效资源 URL，文件名保留未解码片段。
      }
      return { name, pdf: /\.pdf$/i.test(parsed.pathname), url };
    } catch {
      return unavailable;
    }
  });
}
