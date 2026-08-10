import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
  'utf8',
);
const exportPanelSource = readFileSync(
  'packages/business/admin-framework/src/framework-commons/shared/crud-export-panel.vue',
  'utf8',
);
const importPanelSource = readFileSync(
  'packages/business/admin-framework/src/framework-commons/shared/crud-import-panel.vue',
  'utf8',
);

describe('crud export template flow', () => {
  it('keeps the 50000 row export guard and warning message', () => {
    expect(source).toContain('const EXPORT_MAX_RECORDS = 50_000;');
    expect(source).toContain(
      "message.warning('最多只能导出5万条记录，请缩小导出范围');",
    );
    expect(source).toContain(
      'if (Number.isFinite(total) && total > EXPORT_MAX_RECORDS)',
    );
  });

  it('persists export aliases order and selection in saved templates', () => {
    const configBlock = source.slice(
      source.indexOf('function buildExportTemplateConfig()'),
      source.indexOf('function applyExportTemplateConfig('),
    );

    expect(configBlock).toContain('fieldAliases');
    expect(configBlock).toContain('fieldConverters');
    expect(configBlock).toContain('fieldOrderKeys');
    expect(configBlock).toContain('selectedFieldKeys');
    expect(configBlock).toContain('selected: selectedKeys.includes(key)');
  });

  it('offers save and apply entry points for export templates', () => {
    expect(source).toContain(
      ['message.success(`已应用导出模板：', 'template.name}`);'].join('${'),
    );
    expect(source).toContain("message.warning('请至少选择一个导出字段');");
    expect(source).toContain("title: '另存为导出模板'");
    expect(source).toContain('@save-template="promptSaveExportTemplate"');
    expect(exportPanelSource).toContain("emit('saveTemplate')");
    expect(exportPanelSource).toContain('updateFieldConverter:');
    expect(source).toContain('formatCrudExportValue(');
  });

  it('loads compatible export templates by type and target variants', () => {
    expect(source).toContain(
      'buildCrudExportTemplateTargetTypeVariants(context)',
    );
    expect(source).toContain(
      'inType: [...CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES]',
    );
    expect(source).toContain('dedupeCrudTemplates(');
  });

  it('offers import templates, preview, batch create, and template delete', () => {
    expect(source).toContain('v-if="canImport"');
    expect(source).toContain('@click="openImportModal"');
    expect(source).toContain('parseImportFile(file)');
    expect(source).toContain('chunkImportRecords(records)');
    expect(source).toContain('apiService.batchCreate(chunk)');
    expect(source).toContain('importStopRequested');
    expect(importPanelSource).toContain("emit('stop')");
    expect(importPanelSource).toContain('v-if="importing"');
    expect(importPanelSource).toContain(
      "{{ stopRequested ? '正在停止...' : '停止导入' }}",
    );
    expect(importPanelSource).toContain('title="导入控制台"');
    expect(source).toContain('selectedImportTemplateCanDelete');
    expect(source).toContain('deleteTemplate(selectedExportTemplate,');
  });

  it('stores import templates under the import category', () => {
    const loadExportBlock = source.slice(
      source.indexOf('async function loadExportTemplates()'),
      source.indexOf('async function loadImportTemplates()'),
    );
    const loadImportBlock = source.slice(
      source.indexOf('async function loadImportTemplates()'),
      source.indexOf('function applyExportTemplate('),
    );
    const saveExportBlock = source.slice(
      source.indexOf('async function saveExportTemplate('),
      source.indexOf('function promptSaveExportTemplate()'),
    );
    const saveImportBlock = source.slice(
      source.indexOf('async function saveImportTemplate('),
      source.indexOf('function promptSaveImportTemplate()'),
    );

    expect(loadExportBlock).toContain('category: EXPORT_TEMPLATE_CATEGORY');
    expect(loadImportBlock).toContain(
      'category: CRUD_IMPORT_TEMPLATE_CATEGORY',
    );
    expect(loadImportBlock).toContain(
      'inType: [...CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES]',
    );
    expect(saveExportBlock).toContain('category: EXPORT_TEMPLATE_CATEGORY');
    expect(saveImportBlock).toContain(
      'category: CRUD_IMPORT_TEMPLATE_CATEGORY',
    );
  });
});
