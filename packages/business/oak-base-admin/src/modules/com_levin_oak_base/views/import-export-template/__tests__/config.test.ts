import { describe, expect, it, vi } from 'vitest';

import { importExportTemplatePageCrudConfig } from '../config';

vi.mock('../../../api/import-export-template-service', () => ({
  importExportTemplateService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '70%',
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('import export template page config', () => {
  it('uses the import export template API and core template fields', () => {
    const fields = importExportTemplatePageCrudConfig.fields;

    expect(importExportTemplatePageCrudConfig.apiBase).toBe(
      '/ImportExportTemplate',
    );
    expect(importExportTemplatePageCrudConfig.title).toBe(
      '导入导出模板管理',
    );
    expect(fields.find((field) => field.key === 'name')).toMatchObject({
      key: 'name',
      required: true,
      table: true,
    });
    expect(
      fields.find((field) => field.key === 'code' && field.table),
    ).toMatchObject({
      disabledOnEdit: true,
      key: 'code',
      required: true,
      table: true,
    });
    expect(fields.find((field) => field.key === 'config')).toMatchObject({
      fullRow: true,
      key: 'config',
      type: 'json',
    });
    expect(fields.find((field) => field.key === 'templateFileUrl')).toMatchObject(
      {
        span: 2,
      },
    );
  });
});
