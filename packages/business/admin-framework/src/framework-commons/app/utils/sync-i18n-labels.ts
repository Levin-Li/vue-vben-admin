import type { AdminFrontendModule } from '@levin/admin-framework';

export type SyncI18nTreeNodeType = 'language' | 'module';

export interface SyncI18nTreeNode {
  children?: SyncI18nTreeNode[];
  key: string;
  keyCount: number;
  labels?: Record<string, string>;
  language?: string;
  moduleId: string;
  moduleTitle?: string;
  nodeType: SyncI18nTreeNodeType;
}

export interface UploadI18nModuleItem {
  languages: Record<string, Record<string, string>>;
  moduleId: string;
}

export interface UploadI18nLabelsPayload {
  appCode?: string;
  appVersion: string;
  domain?: string;
  enable?: boolean;
  modules: UploadI18nModuleItem[];
  overrideExisting?: boolean;
  siteId?: string;
  tenantId?: string;
  tenantShared?: boolean;
  terminalType?: string;
}

export interface BuildUploadI18nLabelsOptions {
  appCode?: string;
  appVersion: string;
  domain?: string;
  enable?: boolean;
  overrideExisting?: boolean;
  siteId?: string;
  tenantId?: string;
  tenantShared?: boolean;
  terminalType?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function hasText(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

function normalizeLabelValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return hasText(text) ? text : undefined;
}

function flattenLocaleMessages(
  messages: Record<string, unknown>,
  parentKey = '',
): Array<{ label: string; resKey: string }> {
  return Object.entries(messages).flatMap(([key, value]) => {
    const resKey = parentKey ? `${parentKey}.${key}` : key;

    if (isPlainObject(value)) {
      return flattenLocaleMessages(value, resKey);
    }

    const label = normalizeLabelValue(value);
    if (!label || !hasText(label)) {
      return [];
    }

    return [{ label, resKey }];
  });
}

export function flattenSyncI18nTreeNodes(
  list: SyncI18nTreeNode[],
): SyncI18nTreeNode[] {
  return list.flatMap((item) => [
    item,
    ...flattenSyncI18nTreeNodes(item.children || []),
  ]);
}

export function buildSyncI18nModuleTree(
  modules: AdminFrontendModule[],
  language?: string,
): SyncI18nTreeNode[] {
  const moduleMap = new Map<string, SyncI18nTreeNode>();

  for (const module of modules) {
    const localeEntries = Object.entries(module.locales || {}).filter(
      ([locale]) => !language || locale === language,
    );
    if (localeEntries.length === 0) {
      continue;
    }

    const moduleId = module.name;
    if (!hasText(moduleId)) {
      continue;
    }

    const moduleNode = moduleMap.get(moduleId) ?? {
      children: [],
      keyCount: 0,
      key: `module:${moduleId}`,
      moduleId,
      moduleTitle: module.title,
      nodeType: 'module' as const,
    };
    for (const [locale, messages] of localeEntries) {
      const languageKey = `lang:${moduleId}:${locale}`;
      const languageNode = moduleNode.children?.find(
        (item) => item.key === languageKey,
      ) ?? {
        key: languageKey,
        keyCount: 0,
        labels: {},
        language: locale,
        moduleId,
        moduleTitle: module.title,
        nodeType: 'language' as const,
      };

      for (const { label, resKey } of flattenLocaleMessages(messages)) {
        if (languageNode.labels?.[resKey] === undefined) {
          languageNode.labels = {
            ...languageNode.labels,
            [resKey]: label,
          };
        }
      }

      languageNode.keyCount = Object.keys(languageNode.labels || {}).length;
      if (languageNode.keyCount === 0) {
        continue;
      }

      if (!moduleNode.children?.some((item) => item.key === languageKey)) {
        moduleNode.children = [...(moduleNode.children || []), languageNode];
      }
    }

    moduleNode.keyCount = (moduleNode.children || []).reduce(
      (total, item) => total + item.keyCount,
      0,
    );

    if (!moduleMap.has(moduleId) && moduleNode.keyCount > 0) {
      moduleMap.set(moduleId, moduleNode);
    }
  }

  return [...moduleMap.values()];
}

export function buildModuleUploadI18nLabelsPayload(
  rows: SyncI18nTreeNode[],
  options: BuildUploadI18nLabelsOptions,
): UploadI18nLabelsPayload {
  const moduleMap = new Map<string, UploadI18nModuleItem>();

  rows
    .filter((row) => row.nodeType === 'language' && row.language)
    .forEach((row) => {
      const moduleItem = moduleMap.get(row.moduleId) ?? {
        languages: {},
        moduleId: row.moduleId,
      };
      moduleItem.languages[row.language as string] = row.labels || {};
      moduleMap.set(row.moduleId, moduleItem);
    });

  const payload: UploadI18nLabelsPayload = {
    appVersion: normalizeOptionalText(options.appVersion) || '',
    enable: options.enable,
    modules: [...moduleMap.values()],
    overrideExisting: options.overrideExisting,
    tenantShared: options.tenantShared,
  };

  const appCode = normalizeOptionalText(options.appCode);
  const domain = normalizeOptionalText(options.domain);
  const siteId = normalizeOptionalText(options.siteId);
  const tenantId = normalizeOptionalText(options.tenantId);
  const terminalType = normalizeOptionalText(options.terminalType);

  if (appCode) {
    payload.appCode = appCode;
  }
  if (domain) {
    payload.domain = domain;
  }
  if (siteId) {
    payload.siteId = siteId;
  }
  if (tenantId) {
    payload.tenantId = tenantId;
  }
  if (terminalType) {
    payload.terminalType = terminalType;
  }

  return payload;
}
