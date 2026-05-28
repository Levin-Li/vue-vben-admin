import type { CrudFieldConfig } from './types';

import { normalizeJsonSchemaObject } from './json-schema-form';

export type JsonSchemaSourceInput =
  | null
  | Record<string, any>
  | string
  | undefined;

export type JsonSchemaSource =
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

function getSchemaInputFromRecord(record: Record<string, any>) {
  return (
    record['@JsonSchema'] ??
    record['@Jsonschema'] ??
    record['@jsonschema'] ??
    record.JsonSchema ??
    record.Jsonschema ??
    record.jsonSchema ??
    record['@jsonSchema']
  );
}

function parseObjectRecord(value: any) {
  if (typeof value === 'string') {
    const text = value.trim();

    if (!text) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;
}

export function getCrudFieldJsonSchemaInput(field: CrudFieldConfig) {
  return getSchemaInputFromRecord(field as CrudFieldConfig & Record<string, any>);
}

export function hasJsonSchemaSourceInput(input: JsonSchemaSourceInput) {
  if (typeof input === 'string') {
    return input.trim().length > 0;
  }

  return !!input && typeof input === 'object';
}

export function getJsonValueJsonSchemaInput(value: any) {
  const record = parseObjectRecord(value);
  return record ? getSchemaInputFromRecord(record) : undefined;
}

export function getJsonSchemaSourceInput(
  field: CrudFieldConfig,
  value?: any,
) {
  const valueInput = getJsonValueJsonSchemaInput(value);

  if (hasJsonSchemaSourceInput(valueInput)) {
    return valueInput;
  }

  const fieldInput = getCrudFieldJsonSchemaInput(field);

  return hasJsonSchemaSourceInput(fieldInput) ? fieldInput : undefined;
}

export function hasCrudFieldJsonSchema(field: CrudFieldConfig, value?: any) {
  return hasJsonSchemaSourceInput(getJsonSchemaSourceInput(field, value));
}

export function isCrudFieldJsonSchemaInline(field: CrudFieldConfig) {
  const rawField = field as CrudFieldConfig & Record<string, any>;

  return (
    rawField.jsonSchemaInline === true ||
    rawField.JsonSchemaInline === true ||
    rawField.JsonschemaInline === true ||
    rawField['@JsonSchemaInline'] === true ||
    rawField['@JsonschemaInline'] === true ||
    rawField.jsonSchemaMode === 'inline' ||
    rawField.JsonSchemaMode === 'inline' ||
    rawField.JsonschemaMode === 'inline' ||
    rawField['@JsonSchemaMode'] === 'inline'
  );
}

export function resolveJsonSchemaSource(
  input: JsonSchemaSourceInput,
): JsonSchemaSource | undefined {
  if (!hasJsonSchemaSourceInput(input)) {
    return undefined;
  }

  if (typeof input === 'string') {
    const text = input.trim();
    const classMatch = text.match(/^class:\s*(.+)$/i);

    if (classMatch?.[1]?.trim()) {
      return {
        kind: 'java-type',
        typeGenericStr: classMatch[1].trim(),
      };
    }

    const urlMatch = text.match(/^url:\s*(.+)$/i);

    if (urlMatch?.[1]?.trim()) {
      return {
        kind: 'url',
        url: urlMatch[1].trim(),
      };
    }

    const schema = normalizeJsonSchemaObject(text);
    return schema ? { kind: 'inline', schema } : undefined;
  }

  const explicitKind = String(input?.kind || '').toLowerCase();

  if (
    explicitKind === 'java-type' ||
    explicitKind === 'class' ||
    explicitKind === 'type'
  ) {
    const typeGenericStr = String(
      input.typeGenericStr || input.className || input.class || input.type || '',
    ).trim();

    return typeGenericStr
      ? {
          kind: 'java-type',
          typeGenericStr,
        }
      : undefined;
  }

  if (explicitKind === 'url') {
    const url = String(input.url || '').trim();
    return url ? { kind: 'url', url } : undefined;
  }

  if (typeof input.url === 'string' && input.url.trim()) {
    return {
      kind: 'url',
      url: input.url.trim(),
    };
  }

  const typeGenericStr = String(
    input.typeGenericStr || input.className || input.class || '',
  ).trim();

  if (typeGenericStr) {
    return {
      kind: 'java-type',
      typeGenericStr,
    };
  }

  const schema = normalizeJsonSchemaObject(input);
  return schema ? { kind: 'inline', schema } : undefined;
}
