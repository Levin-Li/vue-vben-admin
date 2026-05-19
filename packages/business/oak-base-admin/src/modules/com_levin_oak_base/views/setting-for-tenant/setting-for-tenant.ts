export type SettingEditorKind =
  | 'code'
  | 'file-url'
  | 'image-url'
  | 'json'
  | 'json-schema'
  | 'number'
  | 'select'
  | 'switch'
  | 'text'
  | 'textarea'
  | 'video-url';

export interface TenantSettingItem {
  categoryName?: null | string;
  code?: null | string;
  editable?: boolean;
  editor?: null | string;
  enable?: boolean;
  groupName?: null | string;
  icon?: null | string;
  id?: null | string;
  inputPlaceholder?: null | string;
  name?: null | string;
  nullable?: boolean;
  optimisticLock?: number;
  orderCode?: null | number;
  remark?: null | string;
  valueContent?: any;
  valueType?: null | string;
}

export interface SettingOption {
  label: string;
  value: number | string;
}

export interface TenantSettingGroup {
  key: string;
  name: string;
  settings: TenantSettingItem[];
}

export interface TenantSettingCategory {
  groups: TenantSettingGroup[];
  key: string;
  name: string;
}

export type SettingJsonSchemaSource =
  | {
      kind: 'inline';
      schema: Record<string, any>;
    }
  | {
      kind: 'java-type';
      typeGenericStr: string;
    }
  | {
      kind: 'url';
      url: string;
    };

const DEFAULT_CATEGORY_NAME = '默认分类';
const DEFAULT_GROUP_NAME = '默认分组';

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeMatchText(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeValueType(item: TenantSettingItem) {
  return normalizeMatchText(item.valueType || 'Text');
}

function normalizeEditor(item: TenantSettingItem) {
  return normalizeMatchText(item.editor);
}

function getSettingSortText(item: TenantSettingItem) {
  return normalizeText(item.name || item.code || item.id);
}

function compareSettingItems(
  left: TenantSettingItem,
  right: TenantSettingItem,
) {
  const leftOrder = Number(left.orderCode ?? Number.MAX_SAFE_INTEGER);
  const rightOrder = Number(right.orderCode ?? Number.MAX_SAFE_INTEGER);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return getSettingSortText(left).localeCompare(
    getSettingSortText(right),
    'zh-CN',
  );
}

function getNamedKey(name: unknown, fallback: string) {
  return normalizeText(name) || fallback;
}

function tryParseJson(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const text = value.trim();
  if (!text) {
    return '';
  }

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function unwrapJsonSchemaObject(
  value: unknown,
): Record<string, any> | undefined {
  const parsed = tryParseJson(value);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  const schema = parsed as Record<string, any>;
  const nestedSchema =
    schema.schema || schema.jsonSchema || schema.json_schema || schema.data;

  if (
    nestedSchema &&
    nestedSchema !== schema &&
    (typeof nestedSchema === 'string' || typeof nestedSchema === 'object')
  ) {
    return unwrapJsonSchemaObject(nestedSchema) || schema;
  }

  return schema;
}

function isLikelyJavaType(value: string) {
  return /^[\w$]+(\.[\w$]+)+(?:\s*<.*>)?$/.test(value);
}

function toOption(item: any, index: number): SettingOption {
  if (item && typeof item === 'object') {
    const value = item.value ?? item.code ?? item.name ?? item.label ?? index;
    return {
      label: String(item.label ?? item.title ?? item.name ?? value),
      value: typeof value === 'boolean' ? String(value) : value,
    };
  }

  return {
    label: String(item),
    value: typeof item === 'boolean' ? String(item) : item,
  };
}

function getConstOption(item: any, index: number): SettingOption {
  if (item && typeof item === 'object') {
    const value = item.const ?? item.value ?? item.enum?.[0] ?? index;
    return {
      label: String(item.title ?? item.label ?? item.name ?? value),
      value: typeof value === 'boolean' ? String(value) : value,
    };
  }

  return toOption(item, index);
}

export function getSettingKey(item: TenantSettingItem) {
  return normalizeText(item.id || item.code);
}

export function getSettingDisplayName(item: TenantSettingItem) {
  return (
    normalizeText(item.name || item.groupName || item.code || item.id) ||
    '未命名配置'
  );
}

export function isSettingEditable(item: TenantSettingItem) {
  return item.editable !== false;
}

export function getSettingJsonSchema(item: TenantSettingItem) {
  const source = getSettingJsonSchemaSource(item);
  return source?.kind === 'inline' ? source.schema : undefined;
}

export function getSettingJsonSchemaSource(
  item: TenantSettingItem,
): SettingJsonSchemaSource | undefined {
  const valueType = normalizeValueType(item);
  if (valueType !== 'json' && valueType !== 'jsonschema') {
    return undefined;
  }

  const editor = normalizeText(item.editor);
  if (!editor) {
    return undefined;
  }

  const inlineSchema = unwrapJsonSchemaObject(editor);
  if (inlineSchema) {
    return {
      kind: 'inline',
      schema: inlineSchema,
    };
  }

  const classMatch = editor.match(/^class:(.+)$/i);
  if (classMatch?.[1]?.trim()) {
    return {
      kind: 'java-type',
      typeGenericStr: classMatch[1].trim(),
    };
  }

  const urlMatch = editor.match(/^url:(.+)$/i);
  if (urlMatch?.[1]?.trim()) {
    return {
      kind: 'url',
      url: urlMatch[1].trim(),
    };
  }

  if (editor.startsWith(':') && editor.slice(1).trim()) {
    return {
      kind: 'java-type',
      typeGenericStr: editor.slice(1).trim(),
    };
  }

  if (isLikelyJavaType(editor)) {
    return {
      kind: 'java-type',
      typeGenericStr: editor,
    };
  }

  return undefined;
}

export function getEditorOptions(editor?: null | string): SettingOption[] {
  const parsed = tryParseJson(editor);

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => toOption(item, index));
  }

  const schema = parsed as Record<string, any>;
  const optionSource =
    schema.options || schema.enumOptions || schema.source || schema.data;

  if (Array.isArray(optionSource)) {
    return optionSource.map((item, index) => toOption(item, index));
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((item, index) => getConstOption(item, index));
  }

  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.map((item, index) => getConstOption(item, index));
  }

  if (Array.isArray(schema.enum)) {
    const names = schema.enumNames || schema.enumTitles || [];
    return schema.enum.map((value: any, index: number) => ({
      label: String(names[index] ?? value),
      value: typeof value === 'boolean' ? String(value) : value,
    }));
  }

  return [];
}

export function resolveSettingEditorKind(
  item: TenantSettingItem,
): SettingEditorKind {
  const valueType = normalizeValueType(item);
  const editor = normalizeEditor(item);

  if (getSettingJsonSchemaSource(item)) {
    return 'json-schema';
  }

  if (getEditorOptions(item.editor).length > 0) {
    return 'select';
  }

  if (/switch|boolean|bool|checkbox/.test(editor)) {
    return 'switch';
  }

  if (/input-?number|number|digit/.test(editor)) {
    return 'number';
  }

  if (/json|schema|object|array/.test(editor)) {
    return 'json';
  }

  if (/textarea|multi-?line/.test(editor)) {
    return 'textarea';
  }

  if (/code|editor|monaco/.test(editor)) {
    return 'code';
  }

  if (/image/.test(editor)) {
    return 'image-url';
  }

  if (/video/.test(editor)) {
    return 'video-url';
  }

  if (/file/.test(editor)) {
    return 'file-url';
  }

  if (valueType === 'digit') {
    return 'number';
  }

  if (valueType === 'json' || valueType === 'jsonschema') {
    return 'json';
  }

  if (['css', 'html', 'js', 'yaml'].includes(valueType)) {
    return 'code';
  }

  if (valueType === 'image') {
    return 'image-url';
  }

  if (valueType === 'video') {
    return 'video-url';
  }

  if (valueType === 'file') {
    return 'file-url';
  }

  if (valueType === 'text') {
    return 'textarea';
  }

  return 'text';
}

export function getCodeEditorLanguage(item: TenantSettingItem) {
  const valueType = normalizeValueType(item);
  const editor = normalizeEditor(item);

  if (valueType === 'js' || editor.includes('javascript')) {
    return 'javascript';
  }

  if (valueType === 'html') {
    return 'html';
  }

  if (valueType === 'css') {
    return 'css';
  }

  if (valueType === 'yaml') {
    return 'yaml';
  }

  return 'text';
}

export function parseSettingValueForEditor(item: TenantSettingItem) {
  const kind = resolveSettingEditorKind(item);
  const value = item.valueContent;

  if (kind === 'switch') {
    if (typeof value === 'boolean') {
      return value;
    }

    return ['1', 'on', 'true', 'y', 'yes'].includes(normalizeMatchText(value));
  }

  if (kind === 'number') {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (kind === 'json' || kind === 'json-schema') {
    return tryParseJson(value);
  }

  return value ?? '';
}

export function serializeSettingValueFromEditor(
  item: TenantSettingItem,
  value: unknown,
) {
  const kind = resolveSettingEditorKind(item);

  if (value === undefined || value === null) {
    return '';
  }

  if (
    (kind === 'json' || kind === 'json-schema') &&
    typeof value !== 'string'
  ) {
    return JSON.stringify(value);
  }

  if (kind === 'switch') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

export function formatSettingValuePreview(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatSettingValueInlinePreview(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'string') {
    return value.replaceAll(/\s+/g, ' ').trim() || '-';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function isSettingValueChanged(
  item: TenantSettingItem,
  editorValue: unknown,
  originalValue: string,
) {
  return serializeSettingValueFromEditor(item, editorValue) !== originalValue;
}

export function buildTenantSettingUpdatePayload(
  item: TenantSettingItem,
  editorValue: unknown,
) {
  const payload: Record<string, any> = {
    forceUpdateFields: ['valueContent'],
    id: item.id,
    valueContent: serializeSettingValueFromEditor(item, editorValue),
  };

  if (item.optimisticLock !== undefined) {
    payload.optimisticLock = item.optimisticLock;
  }

  return payload;
}

export function buildTenantSettingCategories(
  settings: TenantSettingItem[],
): TenantSettingCategory[] {
  const categoryMap = new Map<string, TenantSettingCategory>();

  settings
    .filter((item) => item.enable !== false)
    .toSorted(compareSettingItems)
    .forEach((item) => {
      const categoryName = getNamedKey(
        item.categoryName,
        DEFAULT_CATEGORY_NAME,
      );
      const groupName = getNamedKey(item.groupName, DEFAULT_GROUP_NAME);
      const categoryKey = categoryName;
      const groupKey = `${categoryKey}::${groupName}`;

      let category = categoryMap.get(categoryKey);
      if (!category) {
        category = {
          groups: [],
          key: categoryKey,
          name: categoryName,
        };
        categoryMap.set(categoryKey, category);
      }

      let group = category.groups.find((item) => item.key === groupKey);

      if (!group) {
        group = {
          key: groupKey,
          name: groupName,
          settings: [],
        };
        category.groups.push(group);
      }

      group.settings.push(item);
    });

  return [...categoryMap.values()];
}
