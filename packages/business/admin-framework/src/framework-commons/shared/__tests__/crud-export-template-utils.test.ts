import { describe, expect, it } from 'vitest';

import {
  CRUD_EXPORT_TEMPLATE_SAVE_TYPE,
  CRUD_IMPORT_TEMPLATE_SAVE_TYPE,
} from '../crud-export-template';
import {
  buildExcelXml,
  escapeExcelXmlValue,
  getSpreadsheetMlColumnWidth,
} from '../crud-file-export';
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
    expect(
      buildExcelXml({
        fields: [{ key: 'name', label: '名称' }],
        formatCellValue: (_field, record) => record.name,
        getFieldHeader: (field) => field.label,
        records: [{ name: 'A&B' }],
        worksheetName: 'Demo',
      }),
    ).toContain('A&amp;B');
  });

  it('writes configured export widths as SpreadsheetML columns', () => {
    expect(getSpreadsheetMlColumnWidth(20)).toBe(105);
    expect(getSpreadsheetMlColumnWidth(0)).toBeUndefined();
    expect(getSpreadsheetMlColumnWidth(256)).toBeUndefined();

    expect(
      buildExcelXml({
        fields: [{ key: 'name', label: '名称' }],
        formatCellValue: (_field, record) => record.name,
        getFieldHeader: (field) => field.label,
        getFieldWidth: () => 20,
        records: [{ name: 'A' }],
      }),
    ).toContain('<Column ss:AutoFitWidth="0" ss:Width="105"/>');
  });
});
