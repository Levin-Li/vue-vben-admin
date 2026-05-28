import { describe, expect, it } from 'vitest';

import {
  buildDefaultImportMappings,
  buildImportRecords,
  chunkImportRecords,
  parseCsvRows,
  parseSpreadsheetText,
} from '../crud-import';

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

  it('chunks records by 2000 by default', () => {
    const records = Array.from({ length: 4001 }, (_, index) => ({ index }));

    expect(chunkImportRecords(records).map((chunk) => chunk.length)).toEqual([
      2000, 2000, 1,
    ]);
  });
});
