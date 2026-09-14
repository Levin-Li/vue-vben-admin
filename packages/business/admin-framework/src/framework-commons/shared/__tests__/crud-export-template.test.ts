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

  it('persists export aliases, widths, order and selection in saved templates', () => {
    const configBlock = source.slice(
      source.indexOf('function buildExportTemplateConfig()'),
      source.indexOf('function applyExportTemplateConfig('),
    );

    expect(configBlock).toContain('fieldAliases');
    expect(configBlock).toContain('fieldConverters');
    expect(configBlock).toContain('fieldWidths');
    expect(configBlock).toContain('fieldOrderKeys');
    expect(configBlock).toContain('selectedFieldKeys');
    expect(configBlock).toContain('selected: selectedKeys.includes(key)');
    expect(configBlock).toContain('width: fieldWidths[key]');
  });

  it('uses current visible columns by default and exposes the width field', () => {
    const openExportBlock = source.slice(
      source.indexOf('async function openExportModal()'),
      source.indexOf('function resetImportState()'),
    );

    expect(openExportBlock).toContain('resetExportFieldConfig();');
    expect(source).toContain('getDefaultSelectedExportFieldKeys()');
    expect(source).toContain('orderedVisibleTableFields.value');
    expect(source).toContain('const headerLength = Array.from(');
    expect(source).toContain(
      'return Math.min(Math.max(headerLength * 2 + 6, 1), 255);',
    );
    expect(source).toContain(':field-widths="displayedExportFieldWidths"');
    expect(exportPanelSource).toContain('<span>导出字段</span>');
    expect(exportPanelSource).toContain('<span>导出列宽</span>');
    expect(exportPanelSource).toContain('updateFieldWidth:');
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

  it('loads each template selector once with exact visibility filters', () => {
    const loadExportBlock = source.slice(
      source.indexOf('async function loadExportTemplates()'),
      source.indexOf('async function loadImportTemplates()'),
    );
    const loadImportBlock = source.slice(
      source.indexOf('async function loadImportTemplates()'),
      source.indexOf('function handleExportTemplateChange('),
    );

    for (const block of [loadExportBlock, loadImportBlock]) {
      expect(block).toContain('const result = await list(');
      expect(block).toContain('enable: true');
      expect(block).toContain('fileType: EXPORT_TEMPLATE_FILE_TYPE');
      expect(block).toContain('orgShared: true');
      expect(block).toContain('...getTemplateIdentityParams(context),');
      expect(block).toContain('tenantShared: true');
      expect(block).not.toContain('Promise.all(');
      expect(block).not.toContain('buildCrudTemplateScopeQueryVariants');
      expect(block).not.toContain('buildCrudExportTemplateTargetTypeVariants');
      expect(block).not.toContain('category: context.listTableName');
    }

    expect(loadExportBlock).toContain('type: EXPORT_TEMPLATE_TYPE');
    expect(loadImportBlock).toContain('type: IMPORT_TEMPLATE_TYPE');
    expect(source).toContain('getCrudTemplateOwnershipLabel(item)');
    expect(source).toContain('[pageEntryPath, activeListTableName.value]');
    expect(source).toContain('function getTemplateIdentityParams(');
  });

  it('offers import templates, preview, batch create, and template delete', () => {
    expect(source).toContain('v-if="canImport && isListOperationVisible');
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

  it('keeps the import dialog open after a successful batch import', () => {
    const importConfirmBlock = source.slice(
      source.indexOf('async function handleImportConfirm()'),
      source.indexOf('async function fetchExportRecords()'),
    );

    expect(importConfirmBlock).toContain(
      'appendImportConsole(`导入完成，成功 ${successCount} 条`);',
    );
    expect(importConfirmBlock).not.toContain('importModalOpen.value = false;');
  });

  it('marks required import fields and blocks incomplete small-file mappings', () => {
    expect(source).toContain('CRUD_IMPORT_REQUIRED_FIELD_PRECHECK_MAX_ROWS');
    expect(source).toContain('getMissingRequiredImportMappings(');
    expect(source).toContain(
      'missingRequiredImportFieldLabels.value.length > 0',
    );
    expect(importPanelSource).toContain('v-if="mapping.required"');
    expect(importPanelSource).toContain('必填字段缺少来源列或默认值');
  });

  it('uses readable sizing for import template and file controls', () => {
    expect(importPanelSource).toContain('min-height: 40px;');
    expect(importPanelSource).toContain('font-size: 14px;');
    expect(importPanelSource).toContain('padding: 2px 0;');
  });

  it('does not use category when loading or saving templates', () => {
    const loadExportBlock = source.slice(
      source.indexOf('async function loadExportTemplates()'),
      source.indexOf('async function loadImportTemplates()'),
    );
    const loadImportBlock = source.slice(
      source.indexOf('async function loadImportTemplates()'),
      source.indexOf('function handleExportTemplateChange('),
    );
    const saveExportBlock = source.slice(
      source.indexOf('async function saveExportTemplate('),
      source.indexOf('function promptSaveExportTemplate()'),
    );
    const saveImportBlock = source.slice(
      source.indexOf('async function saveImportTemplate('),
      source.indexOf('function promptSaveImportTemplate()'),
    );

    for (const block of [
      loadExportBlock,
      loadImportBlock,
      saveExportBlock,
      saveImportBlock,
    ]) {
      expect(block).not.toContain('category:');
      expect(block).toContain('...getTemplateIdentityParams(context),');
    }
    expect(loadExportBlock).toContain('type: EXPORT_TEMPLATE_TYPE');
    expect(loadImportBlock).toContain('type: IMPORT_TEMPLATE_TYPE');
    expect(saveExportBlock).toContain('type: EXPORT_TEMPLATE_TYPE');
    expect(saveImportBlock).toContain('type: IMPORT_TEMPLATE_TYPE');
    expect(source).toContain("replace(/^\\/+/, '')");
  });
});
