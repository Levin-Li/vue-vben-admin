/** 受控服务端PNG页表示；不接受任意图片URL或服务端HTML。 */
export interface ControlledDocumentPage {
  contentBase64: string;
  mimeType: 'image/png';
  pageCount: number;
  pageNo: number;
}

/** 字段、编码、PNG签名和像素边界都通过后才允许绑定img。 */
export function documentPageSource(value: unknown, expectedPage: number) {
  if (!value || typeof value !== 'object')
    throw new Error('文档分页响应格式无效。');
  const page = value as Partial<ControlledDocumentPage>;
  if (
    page.mimeType !== 'image/png' ||
    page.pageNo !== expectedPage ||
    !Number.isInteger(page.pageCount) ||
    !page.pageCount ||
    page.pageCount > 200 ||
    expectedPage < 1 ||
    expectedPage > page.pageCount
  ) {
    throw new Error('文档页码、总页数或图片格式无效。');
  }
  const content = page.contentBase64;
  if (
    typeof content !== 'string' ||
    content.length < 44 ||
    content.length > 4 * Math.ceil((4 * 1024 * 1024) / 3) ||
    content.length % 4 !== 0 ||
    !/^[A-Z0-9+/]+={0,2}$/i.test(content)
  ) {
    throw new Error('文档分页图片编码无效或超过4MiB限制。');
  }
  let bytes: string;
  try {
    bytes = atob(content);
  } catch {
    throw new Error('文档分页图片编码无效。');
  }
  if (
    bytes.length > 4 * 1024 * 1024 ||
    !bytes.startsWith('\u0089PNG\r\n\u001A\n') ||
    bytes.slice(12, 16) !== 'IHDR'
  ) {
    throw new Error('文档分页内容不是受支持的PNG图片。');
  }
  const header = Uint8Array.from(
    bytes.slice(16, 24),
    (byte) => byte.codePointAt(0) ?? 0,
  );
  const dimensions = new DataView(header.buffer);
  const width = dimensions.getUint32(0);
  const height = dimensions.getUint32(4);
  if (width < 1 || height < 1 || width > 1600 || height > 1600)
    throw new Error('文档分页图片尺寸超限。');
  return {
    pageCount: page.pageCount,
    source: `data:image/png;base64,${content}`,
  };
}
