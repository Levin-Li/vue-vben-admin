import type { CrudFieldConfig } from './types';

export interface BuildExcelXlsxOptions<T extends Record<string, any>> {
  fields: CrudFieldConfig[];
  formatCellValue: (field: CrudFieldConfig, record: T) => any;
  getFieldHeader: (field: CrudFieldConfig) => any;
  getFieldWidth?: (field: CrudFieldConfig) => number | undefined;
  records: T[];
  worksheetName?: string;
}

const EXCEL_COLUMN_WIDTH_MAX = 255;
const EXCEL_COLUMN_WIDTH_MIN = 1;

export function escapeExcelXmlValue(value: any) {
  let xmlText = '';

  for (const character of String(value ?? '')) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (
      codePoint === 9 ||
      codePoint === 10 ||
      codePoint === 13 ||
      (codePoint >= 32 &&
        (codePoint < 55_296 || codePoint > 57_343) &&
        (codePoint & 65_535) < 65_534)
    ) {
      xmlText += character;
    }
  }

  return xmlText
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function getSafeWorksheetName(name?: string) {
  const safeName = String(name || 'Sheet1')
    .replaceAll(/[\\/?*[\]:]/g, '')
    .slice(0, 31)
    .trim();

  return safeName || 'Sheet1';
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ZIP32_LIMIT = 4_294_967_295;
const XLSX_COLUMN_LIMIT = 16_384;

// OOXML 列宽按字符计数，不使用旧版 SpreadsheetML 的点数换算。
export function getXlsxColumnWidth(value: unknown) {
  const width = Number(value);

  return Number.isFinite(width) &&
    width >= EXCEL_COLUMN_WIDTH_MIN &&
    width <= EXCEL_COLUMN_WIDTH_MAX
    ? width
    : undefined;
}

function getXlsxColumnName(index: number) {
  let column = index + 1;
  let name = '';

  while (column > 0) {
    column -= 1;
    name = String.fromCodePoint(65 + (column % 26)) + name;
    column = Math.floor(column / 26);
  }

  return name;
}

// ZIP STORE 条目必须有真实 CRC32；导入测试夹具的零 CRC 不能用于 Excel 成品。
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (value & 1 ? 3_988_292_384 : 0);
  }

  return value >>> 0;
});

function getCrc32(bytes: Uint8Array) {
  let crc = 4_294_967_295;

  for (const byte of bytes) {
    crc = (crcTable[(crc ^ byte) & 255] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 4_294_967_295) >>> 0;
}

function zipStoredXml(entries: Array<[string, string]>) {
  const encoder = new TextEncoder();
  const files = entries.map(([name, xml]) => {
    const nameBytes = encoder.encode(name);
    const content = encoder.encode(xml);

    return { nameBytes, content, crc: getCrc32(content) };
  });
  const localSize = files.reduce(
    (total, file) => total + 30 + file.nameBytes.length + file.content.length,
    0,
  );
  const directorySize = files.reduce(
    (total, file) => total + 46 + file.nameBytes.length,
    0,
  );
  const totalSize = localSize + directorySize + 22;

  if (
    files.length > 65_535 ||
    files.some((file) => file.content.length > ZIP32_LIMIT) ||
    totalSize > ZIP32_LIMIT
  ) {
    throw new Error('导出文件超过 XLSX 格式大小限制');
  }

  const archive = new Uint8Array(totalSize);
  const view = new DataView(archive.buffer);
  const write16 = (offset: number, value: number) =>
    view.setUint16(offset, value, true);
  const write32 = (offset: number, value: number) =>
    view.setUint32(offset, value, true);
  const localOffsets: number[] = [];
  let offset = 0;

  // 本地条目头、文件名与 XML 内容连续写入。
  for (const file of files) {
    localOffsets.push(offset);
    write32(offset, 67_324_752);
    write16(offset + 4, 20);
    write16(offset + 6, 2048);
    write32(offset + 14, file.crc);
    write32(offset + 18, file.content.length);
    write32(offset + 22, file.content.length);
    write16(offset + 26, file.nameBytes.length);
    archive.set(file.nameBytes, offset + 30);
    archive.set(file.content, offset + 30 + file.nameBytes.length);
    offset += 30 + file.nameBytes.length + file.content.length;
  }

  // 中央目录重复记录 CRC、长度和本地头偏移，供 Excel 校验与定位。
  for (const [index, file] of files.entries()) {
    write32(offset, 33_639_248);
    write16(offset + 4, 20);
    write16(offset + 6, 20);
    write16(offset + 8, 2048);
    write32(offset + 16, file.crc);
    write32(offset + 20, file.content.length);
    write32(offset + 24, file.content.length);
    write16(offset + 28, file.nameBytes.length);
    write32(offset + 42, localOffsets[index] ?? 0);
    archive.set(file.nameBytes, offset + 46);
    offset += 46 + file.nameBytes.length;
  }

  // EOCD 标明目录大小、位置和条目数；ZIP32 不使用数据描述符。
  write32(offset, 101_010_256);
  write16(offset + 8, files.length);
  write16(offset + 10, files.length);
  write32(offset + 12, directorySize);
  write32(offset + 16, localSize);

  return archive;
}

// 单元格统一使用 inlineStr，避免证照号、长编号及公式样式文本被 Excel 改写。
export function buildExcelXlsx<T extends Record<string, any>>({
  fields,
  formatCellValue,
  getFieldHeader,
  getFieldWidth,
  records,
  worksheetName,
}: BuildExcelXlsxOptions<T>) {
  if (fields.length > XLSX_COLUMN_LIMIT) {
    throw new Error('导出字段数超过 XLSX 工作表上限');
  }

  const columns = fields
    .map((field, index) => {
      const width = getXlsxColumnWidth(getFieldWidth?.(field));

      return width === undefined
        ? ''
        : `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');
  const cell = (columnIndex: number, rowIndex: number, value: any) =>
    `<c r="${getXlsxColumnName(columnIndex)}${rowIndex}" t="inlineStr"><is><t xml:space="preserve">${escapeExcelXmlValue(value)}</t></is></c>`;
  const header = `<row r="1">${fields
    .map((field, index) => cell(index, 1, getFieldHeader(field)))
    .join('')}</row>`;
  const rows = records
    .map(
      (record, recordIndex) =>
        `<row r="${recordIndex + 2}">${fields
          .map((field, index) =>
            cell(index, recordIndex + 2, formatCellValue(field, record)),
          )
          .join('')}</row>`,
    )
    .join('');
  const sheetName = escapeExcelXmlValue(getSafeWorksheetName(worksheetName));
  const worksheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${columns ? `<cols>${columns}</cols>` : ''}<sheetData>${header}${rows}</sheetData></worksheet>`;

  return zipStoredXml([
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ],
    ['xl/worksheets/sheet1.xml', worksheet],
  ]);
}

export function downloadExcelXlsx(bytes: Uint8Array, fileName: string) {
  const content = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([content], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
