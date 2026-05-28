import { describe, expect, it } from 'vitest';

import {
  buildCrudExportTemplateTargetTypeVariants,
  CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES,
  CRUD_EXPORT_TEMPLATE_SAVE_TYPE,
  CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES,
  CRUD_IMPORT_TEMPLATE_SAVE_TYPE,
} from '../crud-export-template';
import { buildExcelXml, escapeExcelXmlValue } from '../crud-file-export';
import {
  canShowCrudTemplateDelete,
  dedupeCrudTemplates,
  normalizeCrudTemplateConfig,
} from '../crud-template-service';

describe('crud export template utils', () => {
  it('loads both export-only and import-export templates for export dropdowns', () => {
    expect(CRUD_EXPORT_TEMPLATE_SAVE_TYPE).toBe('Export');
    expect(CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES).toEqual([
      'Export',
      'ImportAndExport',
    ]);
    expect(CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES).not.toContain('Import');
  });

  it('loads both import-only and import-export templates for import dropdowns', () => {
    expect(CRUD_IMPORT_TEMPLATE_SAVE_TYPE).toBe('Import');
    expect(CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES).toEqual([
      'Import',
      'ImportAndExport',
    ]);
    expect(CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES).not.toContain('Export');
  });

  it('builds current and legacy target type variants', () => {
    expect(
      buildCrudExportTemplateTargetTypeVariants({
        apiBase: '/Role',
        apiModuleBase: '/com.levin.oak.base/V1/api',
        listPath: '/Role/list',
        listTableName: 'main',
        listTitle: '列表',
        targetType: '/com.levin.oak.base/V1/api:/Role:/Role/list:main',
        title: '角色管理',
      }),
    ).toEqual([
      '/com.levin.oak.base/V1/api:/Role:/Role/list:main',
      '/Role:/Role/list:main',
      '/com.levin.oak.base/V1/api:/Role:/Role/list',
      '/Role:/Role/list',
      '/com.levin.oak.base/V1/api:/Role',
      '/Role',
    ]);
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
});
