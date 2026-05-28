import type { CrudExportTemplateContext } from './types';

export const CRUD_EXPORT_TEMPLATE_CATEGORY = 'CrudExport';
export const CRUD_IMPORT_TEMPLATE_CATEGORY = 'CrudImport';
export const CRUD_EXPORT_TEMPLATE_FILE_TYPE = 'Excel';
export const CRUD_EXPORT_TEMPLATE_SAVE_TYPE = 'Export';
export const CRUD_IMPORT_TEMPLATE_SAVE_TYPE = 'Import';
export const CRUD_IMPORT_EXPORT_TEMPLATE_SAVE_TYPE = 'ImportAndExport';
export const CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES = [
  'Export',
  'ImportAndExport',
] as const;
export const CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES = [
  'Import',
  'ImportAndExport',
] as const;

function normalizeTargetPart(value?: string) {
  return String(value || '').trim();
}

function addTargetTypeVariant(
  variants: string[],
  seen: Set<string>,
  parts: Array<string | undefined>,
) {
  const targetType = parts
    .map((part) => normalizeTargetPart(part))
    .filter(Boolean)
    .join(':');

  if (!targetType || seen.has(targetType)) {
    return;
  }

  seen.add(targetType);
  variants.push(targetType);
}

export function buildCrudExportTemplateTargetTypeVariants(
  context: CrudExportTemplateContext,
) {
  const variants: string[] = [];
  const seen = new Set<string>();
  const moduleBase = normalizeTargetPart(context.apiModuleBase);
  const apiBase = normalizeTargetPart(context.apiBase);
  const listPath = normalizeTargetPart(context.listPath);
  const tableName = normalizeTargetPart(context.listTableName);

  addTargetTypeVariant(variants, seen, [context.targetType]);
  addTargetTypeVariant(variants, seen, [
    moduleBase,
    apiBase,
    listPath,
    tableName,
  ]);
  addTargetTypeVariant(variants, seen, [apiBase, listPath, tableName]);
  addTargetTypeVariant(variants, seen, [moduleBase, apiBase, listPath]);
  addTargetTypeVariant(variants, seen, [apiBase, listPath]);
  addTargetTypeVariant(variants, seen, [moduleBase, apiBase]);
  addTargetTypeVariant(variants, seen, [apiBase]);

  return variants;
}
