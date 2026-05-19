import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

export type SimpleContentResourceKind = 'api' | 'form' | 'page';
export type SimpleContentEditorKind = 'code' | 'json' | 'textarea';

export interface SimpleContentEditorMeta {
  kind: SimpleContentEditorKind;
  language: string;
  title: string;
}

export interface SimpleContentResourceService extends CrudApiService {
  retrieve?: (params?: any, options?: any) => Promise<any>;
  update?: (data?: any, options?: any) => Promise<any>;
}

const RESERVED_FIELD_KEYS = new Set(['content', 'requireAuthorizations']);

function normalizeType(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function omitSimpleManagedFields(values: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(values || {}).filter(
      ([key]) => !RESERVED_FIELD_KEYS.has(key),
    ),
  );
}

export function withSimpleManagedSubmit(
  config: CrudPageConfig,
): CrudPageConfig {
  return {
    ...config,
    async transformSubmit(values, editingRecord) {
      const transformed = config.transformSubmit
        ? await config.transformSubmit(values, editingRecord)
        : values;

      return omitSimpleManagedFields(transformed);
    },
  };
}

export function resolveSimpleContentEditorMeta(
  kind: SimpleContentResourceKind,
  record: Record<string, any>,
): SimpleContentEditorMeta {
  if (kind === 'api') {
    const language = normalizeType(record.language);

    return {
      kind: 'code',
      language: language === 'javascript' ? 'javascript' : language || 'groovy',
      title: language === 'javascript' ? 'JavaScript' : 'Groovy',
    };
  }

  const type = normalizeType(record.type);

  if (type === 'json' || type === 'jsonschema') {
    return {
      kind: 'json',
      language: 'json',
      title: type === 'jsonschema' ? 'JSON Schema' : 'JSON',
    };
  }

  const codeLanguageMap: Record<string, string> = {
    freemark: 'html',
    freemarker: 'html',
    ftlh: 'html',
    groovy: 'groovy',
    html: 'html',
    java: 'java',
    js: 'javascript',
    jsonp: 'javascript',
  };

  if (codeLanguageMap[type]) {
    return {
      kind: 'code',
      language: codeLanguageMap[type],
      title: codeLanguageMap[type],
    };
  }

  return {
    kind: 'textarea',
    language: 'text',
    title: '文本',
  };
}

export function parseSimpleContentValue(
  meta: SimpleContentEditorMeta,
  value: any,
) {
  if (meta.kind !== 'json') {
    return value == null ? '' : String(value);
  }

  if (value === undefined || value === null || value === '') {
    return {};
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function serializeSimpleContentValue(
  meta: SimpleContentEditorMeta,
  value: any,
) {
  if (meta.kind !== 'json') {
    return value == null ? '' : String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

export function normalizeSimpleDetailRecord(data: any) {
  return data?.data || data?.record || data?.item || data;
}
