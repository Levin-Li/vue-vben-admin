import { describe, expect, it } from 'vitest';

import {
  buildDefaultImportMappings,
  buildImportRecords,
  chunkImportRecords,
  parseCsvRows,
  parseSpreadsheetText,
  parseXlsxBuffer,
  normalizeImportTemplateConfig,
} from '../crud-import';

function createStoredZip(entries: Record<string, string>) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directoryParts: Uint8Array[] = [];
  let offset = 0;

  const writeUint16 = (view: DataView, offset: number, value: number) =>
    view.setUint16(offset, value, true);
  const writeUint32 = (view: DataView, offset: number, value: number) =>
    view.setUint32(offset, value, true);

  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const content = encoder.encode(text);
    const local = new Uint8Array(30 + nameBytes.length + content.length);
    const localView = new DataView(local.buffer);

    writeUint32(localView, 0, 0x0403_4b50);
    writeUint16(localView, 4, 20);
    writeUint32(localView, 18, content.length);
    writeUint32(localView, 22, content.length);
    writeUint16(localView, 26, nameBytes.length);
    local.set(nameBytes, 30);
    local.set(content, 30 + nameBytes.length);
    parts.push(local);

    const directory = new Uint8Array(46 + nameBytes.length);
    const directoryView = new DataView(directory.buffer);

    writeUint32(directoryView, 0, 0x0201_4b50);
    writeUint16(directoryView, 4, 20);
    writeUint16(directoryView, 6, 20);
    writeUint32(directoryView, 20, content.length);
    writeUint32(directoryView, 24, content.length);
    writeUint16(directoryView, 28, nameBytes.length);
    writeUint32(directoryView, 42, offset);
    directory.set(nameBytes, 46);
    directoryParts.push(directory);
    offset += local.length;
  }

  const directorySize = directoryParts.reduce(
    (total, part) => total + part.length,
    0,
  );
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  writeUint32(endView, 0, 0x0605_4b50);
  writeUint16(endView, 8, directoryParts.length);
  writeUint16(endView, 10, directoryParts.length);
  writeUint32(endView, 12, directorySize);
  writeUint32(endView, 16, offset);
  const result = new Uint8Array(offset + directorySize + end.length);
  let resultOffset = 0;

  for (const part of [...parts, ...directoryParts, end]) {
    result.set(part, resultOffset);
    resultOffset += part.length;
  }

  return result.buffer;
}

describe('crud import utilities', () => {
  it('parses quoted csv content', () => {
    expect(parseCsvRows('name,amount\n"oak, demo",9\nplain,10')).toEqual([
      ['name', 'amount'],
      ['oak, demo', '9'],
      ['plain', '10'],
    ]);
  });

  it('parses exported excel xml text', () => {
    expect(
      parseSpreadsheetText(
        `<?xml version="1.0"?><Workbook><Worksheet><Table><Row><Cell><Data>名称</Data></Cell><Cell><Data>金额</Data></Cell></Row><Row><Cell><Data>A</Data></Cell><Cell><Data>8</Data></Cell></Row></Table></Worksheet></Workbook>`,
        'demo.xls',
      ),
    ).toEqual({
      headers: ['名称', '金额'],
      rows: [['A', '8']],
    });
  });

  it('parses the first sheet of a standard xlsx workbook', async () => {
    const workbook = createStoredZip({
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>`,
      'xl/sharedStrings.xml': `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>名称</t></si><si><t>金额</t></si><si><t>Oak</t></si></sst>`,
      'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" r:id="rId1"/></sheets></workbook>`,
      'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>9</v></c></row></sheetData></worksheet>`,
    });

    await expect(parseXlsxBuffer(workbook)).resolves.toEqual({
      headers: ['名称', '金额'],
      rows: [['Oak', '9']],
    });
  });

  it('builds default mappings from field labels and keys', () => {
    expect(
      buildDefaultImportMappings(['名称', 'amount'], [
        { key: 'name', label: '名称' },
        { key: 'amount', label: '金额', type: 'number' },
      ] as any),
    ).toMatchObject([
      { fieldKey: 'name', header: '名称' },
      { converter: 'number', fieldKey: 'amount', header: 'amount' },
    ]);
  });

  it('does not convert legacy field-based import template mappings', () => {
    expect(normalizeImportTemplateConfig({
      fields: [{ converter: 'number', defaultValue: '0', required: true, source: '金额', target: 'amount' }],
    } as any)).toMatchObject({
      fields: [{ converter: 'number', defaultValue: '0', required: true, source: '金额', target: 'amount' }],
    });
  });

  it('converts mapped records and reports row conversion errors', () => {
    const result = buildImportRecords(
      {
        headers: ['name', 'amount'],
        rows: [
          ['oak', '9'],
          ['bad', 'x'],
        ],
      },
      [
        { fieldKey: 'name', header: 'name' },
        { converter: 'number', fieldKey: 'amount', header: 'amount' },
      ],
    );

    expect(result.records).toEqual([
      { amount: 9, name: 'oak' },
      { name: 'bad' },
    ]);
    expect(result.rowErrors).toEqual([
      { message: 'amount: 不是有效数字：x', rowIndex: 3 },
    ]);
  });

  it('blocks a saved mapping when its source header is absent from the selected file', () => {
    expect(
      buildImportRecords(
        { headers: ['名称'], rows: [['Oak']] },
        [
          {
            converter: 'number',
            fieldKey: 'amount',
            header: '金额',
            required: true,
          },
        ],
      ),
    ).toEqual({
      records: [],
      rowErrors: [
        { message: 'amount: 找不到来源列：金额', rowIndex: 1 },
      ],
    });
  });

  it('chunks records by 2000 by default', () => {
    const records = Array.from({ length: 4001 }, (_, index) => ({ index }));

    expect(chunkImportRecords(records).map((chunk) => chunk.length)).toEqual([
      2000, 2000, 1,
    ]);
  });
});
