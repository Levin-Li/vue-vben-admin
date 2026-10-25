export type JsonSchemaFieldKind =
  | 'boolean'
  | 'json'
  | 'number'
  | 'password'
  | 'section'
  | 'select'
  | 'string'
  | 'textarea';

export interface JsonSchemaFormOption {
  label: string;
  value: any;
}

export interface JsonSchemaFormField {
  description?: string;
  kind: JsonSchemaFieldKind;
  label: string;
  level: number;
  options: JsonSchemaFormOption[];
  path: string[];
  pathKey: string;
  readOnly: boolean;
  required: boolean;
  schema: Record<string, any>;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (!isRecord(value) && !Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function normalizeJsonSchemaObject(
  value: unknown,
): Record<string, any> | undefined {
  let schema = value;

  if (typeof schema === 'string') {
    const text = schema.trim();
    if (!text) {
      return undefined;
    }

    try {
      schema = JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  if (!isRecord(schema)) {
    return undefined;
  }

  const schemaContainers = [
    schema.schema,
    schema.jsonSchema,
    schema.json_schema,
    schema.data?.schema,
    schema.data?.jsonSchema,
    schema.data?.json_schema,
  ];

  for (const item of schemaContainers) {
    const normalized: Record<string, any> | undefined =
      normalizeJsonSchemaObject(item);
    if (normalized) {
      return normalized;
    }
  }

  return schema;
}

export function getJsonSchemaPathKey(path: string[]) {
  return path.map((item) => encodeURIComponent(item)).join('.');
}

export function getJsonSchemaPathValue(source: any, path: string[]) {
  return path.reduce((value, key) => value?.[key], source);
}

export function setJsonSchemaPathValue(
  source: any[] | Record<string, any>,
  path: string[],
  value: any,
) {
  if (path.length === 0) {
    return value;
  }

  const nextSource = isRecord(source) ? { ...source } : {};
  let cursor = nextSource;

  path.forEach((key, index) => {
    if (index === path.length - 1) {
      if (value === undefined) {
        delete cursor[key];
      } else {
        cursor[key] = value;
      }
      return;
    }

    const nextValue = cursor[key];
    cursor[key] = isRecord(nextValue) ? { ...nextValue } : {};
    cursor = cursor[key];
  });

  return nextSource;
}

function normalizeSchemaType(schema: Record<string, any>) {
  const type = Array.isArray(schema.type)
    ? schema.type.find((item: string) => item !== 'null')
    : schema.type;

  if (type) {
    return type;
  }

  if (schema.properties) {
    return 'object';
  }

  if (schema.items) {
    return 'array';
  }

  return 'string';
}

function getConstOption(item: any, index: number): JsonSchemaFormOption {
  if (isRecord(item)) {
    const value = Object.hasOwn(item, 'const')
      ? item.const
      : (item.value ?? item.enum?.[0] ?? index);
    return {
      label: String(item.title ?? item.label ?? item.name ?? value),
      value,
    };
  }

  return {
    label: String(item),
    value: item,
  };
}

export function hasJsonSchemaValueOptions(schema: Record<string, any>) {
  const alternatives = schema.oneOf || schema.anyOf;
  return (
    Array.isArray(alternatives) &&
    alternatives.length > 0 &&
    alternatives.every(
      (item) =>
        isRecord(item) &&
        !item.properties &&
        (Object.hasOwn(item, 'const') || Array.isArray(item.enum)),
    )
  );
}

export function getJsonSchemaFieldOptions(schema: Record<string, any>) {
  if (Array.isArray(schema.enum)) {
    const names = schema.enumNames || schema.enumTitles || [];
    return schema.enum.map((value: any, index: number) => ({
      label: String(names[index] ?? value),
      value,
    }));
  }

  if (hasJsonSchemaValueOptions(schema)) {
    return (schema.oneOf || schema.anyOf).flatMap(
      (item: Record<string, any>, index: number) =>
        Object.hasOwn(item, 'const')
          ? [getConstOption(item, index)]
          : item.enum.map((value: any) => ({
              label: String(item.title ?? value),
              value,
            })),
    );
  }

  return [];
}

export function getJsonSchemaFieldKind(
  schema: Record<string, any>,
): JsonSchemaFieldKind {
  if (schema.enum || hasJsonSchemaValueOptions(schema)) {
    return 'select';
  }

  const type = normalizeSchemaType(schema);

  if (type === 'integer' || type === 'number') {
    return 'number';
  }

  if (type === 'boolean') {
    return 'boolean';
  }

  if (type === 'object') {
    return isRecord(schema.properties) ? 'section' : 'json';
  }

  if (type === 'array') {
    return 'json';
  }

  if (
    schema.format === 'textarea' ||
    schema['ui:widget'] === 'textarea' ||
    schema['x-component'] === 'textarea'
  ) {
    return 'textarea';
  }

  return 'string';
}

function getFieldLabel(key: string, schema: Record<string, any>) {
  return String(schema.title || schema.name || key);
}

function appendFields(
  fields: JsonSchemaFormField[],
  properties: Record<string, any>,
  required: Set<string>,
  parentPath: string[],
  level: number,
) {
  Object.entries(properties).forEach(([key, rawSchema]) => {
    const schema = isRecord(rawSchema) ? rawSchema : {};
    const path = [...parentPath, key];
    const kind = getJsonSchemaFieldKind(schema);
    const field: JsonSchemaFormField = {
      description: schema.description || schema.desc,
      kind,
      label: getFieldLabel(key, schema),
      level,
      options: getJsonSchemaFieldOptions(schema),
      path,
      pathKey: getJsonSchemaPathKey(path),
      readOnly: schema.readOnly === true || schema.readonly === true,
      required: required.has(key),
      schema,
    };

    if (kind === 'section') {
      fields.push(field);
      const childRequired = new Set<string>(
        Array.isArray(schema.required) ? schema.required : [],
      );
      appendFields(fields, schema.properties, childRequired, path, level + 1);
      return;
    }

    fields.push(field);
  });
}

export function buildJsonSchemaFormFields(schema?: Record<string, any>) {
  const normalizedSchema = normalizeJsonSchemaObject(schema);
  if (!normalizedSchema) {
    return [];
  }

  const properties = normalizedSchema?.properties;

  if (!isRecord(properties)) {
    return [];
  }

  const required = new Set<string>(
    Array.isArray(normalizedSchema.required) ? normalizedSchema.required : [],
  );
  const fields: JsonSchemaFormField[] = [];
  appendFields(fields, properties, required, [], 0);
  return fields;
}

function applyDefaultsFromSchema(
  target: Record<string, any>,
  schema: Record<string, any>,
) {
  const properties = schema.properties;
  if (!isRecord(properties)) {
    return target;
  }

  Object.entries(properties).forEach(([key, rawSchema]) => {
    const childSchema = isRecord(rawSchema) ? rawSchema : {};

    if (target[key] === undefined && childSchema.default !== undefined) {
      target[key] = cloneValue(childSchema.default);
    }

    if (isRecord(childSchema.properties)) {
      const childValue = isRecord(target[key]) ? { ...target[key] } : {};
      target[key] = applyDefaultsFromSchema(childValue, childSchema);
    }
  });

  return target;
}

export function applyJsonSchemaDefaults(
  value: any,
  schema?: Record<string, any>,
): any {
  const normalizedSchema = normalizeJsonSchemaObject(schema);
  if (normalizedSchema?.type === 'array') {
    const items = Array.isArray(value) ? value : normalizedSchema.default;
    return Array.isArray(items)
      ? items.map((item) =>
          isRecord(normalizedSchema.items)
            ? applyJsonSchemaDefaults(item, normalizedSchema.items)
            : cloneValue(item),
        )
      : [];
  }
  if (normalizedSchema && normalizeSchemaType(normalizedSchema) !== 'object') {
    return cloneValue(value === undefined ? normalizedSchema.default : value);
  }
  const target = isRecord(value) ? cloneValue(value) : {};

  if (!normalizedSchema) {
    return target;
  }

  return applyDefaultsFromSchema(target, normalizedSchema);
}
