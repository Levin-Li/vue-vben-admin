import type { CrudFieldConfig } from './types';

import {
  convertCrudValue,
  CRUD_IMPORT_CONVERTER_OPTIONS,
  type CrudImportConverter,
} from './crud-value-converter';

export {
  CRUD_IMPORT_CONVERTER_OPTIONS,
  type CrudImportConverter,
} from './crud-value-converter';

export const CRUD_IMPORT_BATCH_SIZE = 2000;

export interface CrudImportMapping {
  converter?: CrudImportConverter;
  defaultValue?: any;
  fieldKey: string;
  header?: string;
  required?: boolean;
}

export interface CrudImportTemplateConfig {
  mappings?: CrudImportMapping[];
  version?: number;
}

export interface ParsedImportSheet {
  headers: string[];
  rows: string[][];
}

export interface BuildImportRecordsResult {
  records: Record<string, any>[];
  rowErrors: Array<{
    message: string;
    rowIndex: number;
  }>;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeHeader(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function stripBom(text: string) {
  return text.codePointAt(0) === 65_279 ? text.slice(1) : text;
}

export function parseCsvRows(text: string) {
  const source = stripBom(text || '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';

      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((item) => item.some((value) => normalizeText(value)));
}

function parseXmlWorkbookRows(text: string) {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const doc = new DOMParser().parseFromString(text, 'text/xml');

  if (doc.querySelector('parsererror')) {
    return [];
  }

  const rowNodes = [...doc.querySelectorAll('Row')];

  return rowNodes
    .map((rowNode) =>
      [...rowNode.querySelectorAll('Cell')].map((cellNode) => {
        const dataNode = cellNode.querySelectorAll('Data')[0];
        return dataNode?.textContent ?? cellNode.textContent ?? '';
      }),
    )
    .filter((row) => row.some((value) => normalizeText(value)));
}

function parseHtmlTableRows(text: string) {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const doc = new DOMParser().parseFromString(text, 'text/html');
  const firstTable = doc.querySelector('table');

  if (!firstTable) {
    return [];
  }

  return [...firstTable.querySelectorAll('tr')]
    .map((rowNode) =>
      [...rowNode.querySelectorAll('th,td')].map(
        (cellNode) => cellNode.textContent ?? '',
      ),
    )
    .filter((row) => row.some((value) => normalizeText(value)));
}

export function parseSpreadsheetText(text: string, fileName = '') {
  const name = fileName.toLowerCase();
  const trimmed = stripBom(text || '').trimStart();
  let rows: string[][];

  if (name.endsWith('.csv') || trimmed.includes(',')) {
    rows = parseCsvRows(text);
  } else if (trimmed.startsWith('<?xml') || trimmed.includes('<Workbook')) {
    rows = parseXmlWorkbookRows(text);
  } else if (trimmed.includes('<table')) {
    rows = parseHtmlTableRows(text);
  } else {
    rows = parseCsvRows(text);
  }

  if (rows.length === 0) {
    return {
      headers: [],
      rows: [],
    };
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header, index) => {
    const normalized = normalizeText(header);

    return normalized || `列${index + 1}`;
  });

  return {
    headers,
    rows: dataRows,
  };
}

export async function parseImportFile(file: File): Promise<ParsedImportSheet> {
  const fileName = file.name || '';

  if (fileName.toLowerCase().endsWith('.xlsx')) {
    return parseXlsxBuffer(await file.arrayBuffer());
  }

  return parseSpreadsheetText(await file.text(), fileName);
}

function readZipUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readZipUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

async function inflateZipEntry(data: Uint8Array, compression: number) {
  if (compression === 0) {
    return data;
  }

  if (
    compression !== 8 ||
    typeof (globalThis as any).DecompressionStream !== 'function'
  ) {
    throw new Error(
      '当前浏览器无法解压该 XLSX 文件，请改用 CSV 或系统导出的 .xls 文件。',
    );
  }

  const stream = new Blob([data])
    .stream()
    .pipeThrough(new (globalThis as any).DecompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readXlsxZipEntries(buffer: ArrayBuffer) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const minimumEndRecordOffset = Math.max(0, data.length - 65_557);
  let endOffset = -1;

  for (
    let offset = data.length - 22;
    offset >= minimumEndRecordOffset;
    offset -= 1
  ) {
    if (readZipUint32(view, offset) === 0x0605_4b50) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset < 0) {
    throw new Error('不是有效的 XLSX 文件。');
  }

  const entryCount = readZipUint16(view, endOffset + 10);
  let directoryOffset = readZipUint32(view, endOffset + 16);
  const decoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();

  for (let index = 0; index < entryCount; index += 1) {
    if (readZipUint32(view, directoryOffset) !== 0x0201_4b50) {
      throw new Error('XLSX 文件目录损坏。');
    }

    const compression = readZipUint16(view, directoryOffset + 10);
    const compressedSize = readZipUint32(view, directoryOffset + 20);
    const fileNameLength = readZipUint16(view, directoryOffset + 28);
    const extraLength = readZipUint16(view, directoryOffset + 30);
    const commentLength = readZipUint16(view, directoryOffset + 32);
    const localOffset = readZipUint32(view, directoryOffset + 42);
    const fileName = decoder.decode(
      data.slice(directoryOffset + 46, directoryOffset + 46 + fileNameLength),
    );

    if (readZipUint32(view, localOffset) !== 0x0403_4b50) {
      throw new Error('XLSX 文件条目损坏。');
    }

    const localNameLength = readZipUint16(view, localOffset + 26);
    const localExtraLength = readZipUint16(view, localOffset + 28);
    const contentOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.slice(
      contentOffset,
      contentOffset + compressedSize,
    );

    entries.set(fileName, await inflateZipEntry(compressed, compression));
    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function getXlsxCellColumnIndex(reference: string | null) {
  const column = reference?.match(/^[A-Z]+/i)?.[0];

  if (!column) {
    return undefined;
  }

  return (
    [...column.toUpperCase()].reduce(
      (result, char) => result * 26 + char.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

function getXlsxEntryText(entries: Map<string, Uint8Array>, name: string) {
  const entry = entries.get(name);

  return entry ? new TextDecoder().decode(entry) : undefined;
}

function getFirstXlsxSheetPath(entries: Map<string, Uint8Array>) {
  const workbook = getXlsxEntryText(entries, 'xl/workbook.xml');
  const relationships = getXlsxEntryText(entries, 'xl/_rels/workbook.xml.rels');

  if (!workbook || !relationships || typeof DOMParser === 'undefined') {
    return 'xl/worksheets/sheet1.xml';
  }

  const workbookDoc = new DOMParser().parseFromString(workbook, 'text/xml');
  const relationDoc = new DOMParser().parseFromString(
    relationships,
    'text/xml',
  );
  const relationId = workbookDoc.querySelector('sheet')?.getAttribute('r:id');
  const target = [...relationDoc.querySelectorAll('Relationship')]
    .find((item) => item.getAttribute('Id') === relationId)
    ?.getAttribute('Target');

  if (!target) {
    return 'xl/worksheets/sheet1.xml';
  }

  return `xl/${target.replace(/^\/+/, '').replace(/^xl\//, '')}`;
}

export async function parseXlsxBuffer(
  buffer: ArrayBuffer,
): Promise<ParsedImportSheet> {
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境不支持 XLSX 解析。');
  }

  const entries = await readXlsxZipEntries(buffer);
  const worksheet = getXlsxEntryText(entries, getFirstXlsxSheetPath(entries));

  if (!worksheet) {
    throw new Error('XLSX 文件中没有可读取的工作表。');
  }

  const sharedStringsDoc = getXlsxEntryText(entries, 'xl/sharedStrings.xml');
  const sharedStrings = sharedStringsDoc
    ? [
        ...new DOMParser()
          .parseFromString(sharedStringsDoc, 'text/xml')
          .querySelectorAll('si'),
      ].map((item) => item.textContent || '')
    : [];
  const worksheetDoc = new DOMParser().parseFromString(worksheet, 'text/xml');
  const rows = [...worksheetDoc.querySelectorAll('sheetData > row')].map(
    (rowNode) => {
      const row: string[] = [];

      for (const cell of [...rowNode.querySelectorAll('c')]) {
        const index = getXlsxCellColumnIndex(cell.getAttribute('r'));
        const value = cell.querySelector('v')?.textContent || '';
        const inlineText = cell.querySelector('is')?.textContent || '';
        const cellValue =
          cell.getAttribute('t') === 's'
            ? sharedStrings[Number(value)] || ''
            : cell.getAttribute('t') === 'inlineStr'
              ? inlineText
              : value;

        if (index !== undefined) {
          row[index] = cellValue;
        } else {
          row.push(cellValue);
        }
      }

      return row;
    },
  );

  const [headerRow = [], ...dataRows] = rows;

  return {
    headers: headerRow.map(
      (header, index) => normalizeText(header) || `列${index + 1}`,
    ),
    rows: dataRows.filter((row) => row.some((value) => normalizeText(value))),
  };
}

export function buildDefaultImportMappings(
  headers: string[],
  fields: CrudFieldConfig[],
): CrudImportMapping[] {
  const headerMap = new Map(
    headers.map((header) => [normalizeHeader(header), header] as const),
  );

  return fields
    .filter((field) => field.key && field.editable !== false)
    .map((field) => {
      const fieldKey = String(field.key);
      const matchedHeader =
        headerMap.get(normalizeHeader(field.label)) ||
        headerMap.get(normalizeHeader(fieldKey));

      return {
        converter: inferImportConverter(field),
        fieldKey,
        header: matchedHeader,
        required: field.required === true,
      };
    });
}

export function inferImportConverter(
  field: CrudFieldConfig,
): CrudImportConverter {
  if (field.type === 'number') {
    return 'number';
  }

  if (field.type === 'switch') {
    return 'boolean';
  }

  if (field.type === 'date') {
    return 'date';
  }

  if (field.type === 'datetime') {
    return 'datetime';
  }

  if (field.type === 'json') {
    return 'json';
  }

  return 'trim';
}

function getRowValue(row: string[], headers: string[], header?: string) {
  if (!header) {
    return '';
  }

  const index = headers.indexOf(header);

  return index === -1 ? '' : row[index] || '';
}

export function buildImportRecords(
  sheet: ParsedImportSheet,
  mappings: CrudImportMapping[],
): BuildImportRecordsResult {
  const records: Record<string, any>[] = [];
  const rowErrors: BuildImportRecordsResult['rowErrors'] = [];
  const activeMappings = mappings.filter((mapping) => {
    if (!mapping.header) {
      return false;
    }

    if (sheet.headers.includes(mapping.header)) {
      return true;
    }

    rowErrors.push({
      message: `${mapping.fieldKey}: 找不到来源列：${mapping.header}`,
      rowIndex: 1,
    });
    return false;
  });

  sheet.rows.forEach((row, rowIndex) => {
    const record: Record<string, any> = {};

    for (const mapping of activeMappings) {
      const rawValue = getRowValue(row, sheet.headers, mapping.header);
      const value =
        normalizeText(rawValue) || mapping.defaultValue === undefined
          ? rawValue
          : mapping.defaultValue;

      if (mapping.required && !normalizeText(value)) {
        rowErrors.push({
          message: `${mapping.fieldKey} 不能为空`,
          rowIndex: rowIndex + 2,
        });
        continue;
      }

      if (!normalizeText(value)) {
        continue;
      }

      try {
        record[mapping.fieldKey] = convertCrudValue(
          value,
          mapping.converter || 'trim',
        );
      } catch (error) {
        rowErrors.push({
          message:
            error instanceof Error
              ? `${mapping.fieldKey}: ${error.message}`
              : `${mapping.fieldKey}: 转换失败`,
          rowIndex: rowIndex + 2,
        });
      }
    }

    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  });

  return {
    records,
    rowErrors,
  };
}

export function chunkImportRecords<T>(
  records: T[],
  batchSize = CRUD_IMPORT_BATCH_SIZE,
) {
  const chunks: T[][] = [];

  for (let index = 0; index < records.length; index += batchSize) {
    chunks.push(records.slice(index, index + batchSize));
  }

  return chunks;
}

export function normalizeImportTemplateConfig(
  value: CrudImportTemplateConfig | null | string | undefined,
): CrudImportTemplateConfig {
  if (!value) {
    return {};
  }

  let config = value;

  if (typeof value === 'string') {
    try {
      config = JSON.parse(value) || {};
    } catch {
      return {};
    }
  }

  if (!config || typeof config !== 'object') {
    return {};
  }

  if (Array.isArray(config.mappings)) {
    return config;
  }

  const legacyFields = (config as any).fields;

  if (!Array.isArray(legacyFields)) {
    return config;
  }

  return {
    ...config,
    mappings: legacyFields
      .filter((field) => field?.target)
      .map((field) => ({
        converter: field.converter,
        defaultValue: field.defaultValue,
        fieldKey: String(field.target),
        header: field.source ? String(field.source) : undefined,
        required: field.required === true,
      })),
  };
}
