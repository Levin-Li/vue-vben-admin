import { describe, expect, it } from 'vitest';

import {
  CRUD_EXPORT_TEMPLATE_SAVE_TYPE,
  CRUD_IMPORT_TEMPLATE_SAVE_TYPE,
} from '../crud-export-template';
import {
  buildExcelXlsx,
  escapeExcelXmlValue,
  getXlsxColumnWidth,
} from '../crud-file-export';
import { parseXlsxBuffer } from '../crud-import';
import {
  canShowCrudTemplateDelete,
  dedupeCrudTemplates,
  normalizeCrudTemplateConfig,
} from '../crud-template-service';

describe('crud export template utils', () => {
  it('keeps distinct saved template types for export and import', () => {
    expect(CRUD_EXPORT_TEMPLATE_SAVE_TYPE).toBe('Export');
    expect(CRUD_IMPORT_TEMPLATE_SAVE_TYPE).toBe('Import');
  });

  it('deduplicates templates and normalizes stored config', () => {
    expect(
      dedupeCrudTemplates([
        { id: 1, name: 'A' },
        { id: 1, name: 'A2' },
        { code: 'B', name: 'B' },
      ]),
    ).toHaveLength(2);
    expect(
      normalizeCrudTemplateConfig('{"selectedFieldKeys":["name"]}'),
    ).toEqual({
      selectedFieldKeys: ['name'],
    });
  });

  it('checks template delete ownership and escapes Excel XML', () => {
    expect(
      canShowCrudTemplateDelete({
        hasDeletePermission: true,
        template: { editable: true, name: 'T', ownerId: 'u1' },
        userInfo: { id: 'u1' },
      }),
    ).toBe(true);
    expect(escapeExcelXmlValue('<tag a="1">&')).toBe(
      '&lt;tag a=&quot;1&quot;&gt;&amp;',
    );
    expect(escapeExcelXmlValue('A\u0000B')).toBe('AB');
  });

  it('writes configured export widths as XLSX character columns', () => {
    expect(getXlsxColumnWidth(20)).toBe(20);
    expect(getXlsxColumnWidth(0)).toBeUndefined();
    expect(getXlsxColumnWidth(256)).toBeUndefined();

    const workbook = buildExcelXlsx({
      fields: [{ key: 'name', label: '名称' }],
      formatCellValue: (_field, record) => record.name,
      getFieldHeader: (field) => field.label,
      getFieldWidth: () => 20,
      records: [{ name: 'A' }],
    });
    expect(new TextDecoder().decode(workbook)).toContain(
      '<col min="1" max="1" width="20" customWidth="1"/>',
    );
  });

  it('生成真实 XLSX，并按文本回读编号、中文和公式样式内容', async () => {
    const bytes = buildExcelXlsx({
      fields: [
        { key: 'code', label: '编号' },
        { key: 'remark', label: '备注' },
      ],
      formatCellValue: (field, record) =>
        (record as Record<string, string>)[String(field.key)],
      getFieldHeader: (field) => field.label,
      getFieldWidth: (field) => (field.key === 'code' ? 20 : undefined),
      records: [{ code: '00123', remark: '=1+1,中文 & <x>\n第二行' }],
      worksheetName: '导出/测试',
    });

    expect(bytes.slice(0, 4)).toEqual(Uint8Array.of(80, 75, 3, 4));
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    await expect(parseXlsxBuffer(buffer)).resolves.toEqual({
      headers: ['编号', '备注'],
      rows: [['00123', '=1+1,中文 & <x>\n第二行']],
    });
  });
});
