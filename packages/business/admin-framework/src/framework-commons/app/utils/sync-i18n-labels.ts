import type { AdminFrontendModule } from '@levin/admin-framework';

export interface SyncI18nLabelItem {
  category?: string;
  enable?: boolean;
  label: string;
  language: string;
  moduleId?: string;
  moduleTitle?: string;
  overrideExisting?: boolean;
  resKey: string;
}

export interface SyncI18nLabelsPayload {
  labelList: SyncI18nLabelItem[];
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

function getLabelKey(item: SyncI18nLabelItem) {
  return [item.moduleId || '', item.language, item.resKey].join('\n');
}

function dedupeSyncI18nLabels(items: SyncI18nLabelItem[]) {
  const keys = new Set<string>();
  return items.filter((item) => {
    const key = getLabelKey(item);
    if (keys.has(key)) {
      return false;
    }
    keys.add(key);
    return true;
  });
}

export function buildModuleSyncI18nLabelsPayload(
  modules: AdminFrontendModule[],
): SyncI18nLabelsPayload {
  return {
    labelList: dedupeSyncI18nLabels(
      modules.flatMap((module) =>
        Object.entries(module.locales || {}).flatMap(([language, messages]) =>
          flattenLocaleMessages(messages).map(({ label, resKey }) => ({
            category: resKey.split('.')[0],
            label,
            language,
            moduleId: module.name,
            moduleTitle: module.title,
            resKey,
          })),
        ),
      ),
    ),
  };
}
