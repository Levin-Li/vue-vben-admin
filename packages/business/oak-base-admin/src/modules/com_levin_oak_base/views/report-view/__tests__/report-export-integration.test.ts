import { describe, expect, it } from 'vitest';

import { buildExcelXlsx } from '@levin/admin-framework/framework-commons/shared/crud-file-export';
import { parseXlsxBuffer } from '@levin/admin-framework/framework-commons/shared/crud-import';

import { formatReportNumber } from '../report-number-format';

describe('报表导出工作簿', () => {
  it('业务列名按文本写入工作簿，公式样式名称不会变成公式', async () => {
    const title = '=HYPERLINK("https://example.invalid","客户")';
    const bytes = buildExcelXlsx({
      fields: [{ key: 'value', label: title }], records: [{ value: '虚构数据' }], worksheetName: '报表',
      getFieldHeader: (field) => field.label, formatCellValue: (_field, record) => record.value,
    });
    const xml = new TextDecoder().decode(bytes);
    expect(xml).toContain('t="inlineStr"');
    expect(xml).not.toContain('<f>');
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await expect(parseXlsxBuffer(buffer)).resolves.toEqual({ headers: [title], rows: [['虚构数据']] });
  });

  it('以文本保留大金额精度，并安全保存公式样式内容', async () => {
    const fields = [
      { key: 'amount', label: '金额' },
      { key: 'description', label: '说明' },
    ];
    const bytes = buildExcelXlsx({
      fields,
      records: [{ amount: '12345678901234567890.0100', description: '=1+1' }],
      worksheetName: '报表',
      getFieldHeader: (field) => field.label,
      formatCellValue: (field, record) => field.key === 'amount'
        ? formatReportNumber(record.amount, { kind: 'MONEY', unit: '' }).text
        : record.description,
    });
    const xml = new TextDecoder().decode(bytes);
    expect(xml).toContain('t="inlineStr"');
    expect(xml).not.toContain('<f>');
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await expect(parseXlsxBuffer(buffer)).resolves.toEqual({
      headers: ['金额', '说明'],
      rows: [['1234,5678,9012,3456,7890.0100', '=1+1']],
    });
  });

  it('隐藏的金额导出为缺失标记而不是零', async () => {
    const bytes = buildExcelXlsx({
      fields: [{ key: 'amount', label: '金额' }], records: [{ amount: null }], worksheetName: '报表',
      getFieldHeader: (field) => field.label,
      formatCellValue: (_field, record) => formatReportNumber(record.amount, { kind: 'MONEY' }).text,
    });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await expect(parseXlsxBuffer(buffer)).resolves.toEqual({ headers: ['金额'], rows: [['—']] });
  });
});
