import {
  type JsonSchemaFormField,
  getJsonSchemaFieldKind,
  getJsonSchemaFieldOptions,
  getJsonSchemaPathKey,
  normalizeJsonSchemaObject,
} from './json-schema-form';

export type JsonSchemaFormNode =
  | JsonSchemaFormField
  | JsonSchemaFormGroupNode
  | JsonSchemaFormCollectionNode
  | JsonSchemaFormBranchNode;

export interface JsonSchemaFormGroupNode {
  children: JsonSchemaFormNode[];
  description?: string;
  kind: 'group';
  label: string;
  level: number;
  path: string[];
  pathKey: string;
  required: boolean;
  schema: Record<string, any>;
}

export interface JsonSchemaFormCollectionNode {
  description?: string;
  itemSchema: Record<string, any>;
  kind: 'collection';
  label: string;
  level: number;
  path: string[];
  pathKey: string;
  required: boolean;
  schema: Record<string, any>;
}

export interface JsonSchemaFormBranchNode {
  branches: Array<{ label: string; schema: Record<string, any> }>;
  description?: string;
  kind: 'branch';
  label: string;
  level: number;
  path: string[];
  pathKey: string;
  required: boolean;
  schema: Record<string, any>;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getLabel(key: string, schema: Record<string, any>) {
  return String(schema.title || schema.name || key);
}

function isSensitiveSchema(schema: Record<string, any>) {
  return (
    schema.writeOnly === true ||
    schema.format === 'password' ||
    schema['ui:widget'] === 'password'
  );
}

function toField(
  key: string,
  schema: Record<string, any>,
  required: boolean,
  path: string[],
  level: number,
): JsonSchemaFormField {
  const kind = isSensitiveSchema(schema)
    ? 'password'
    : getJsonSchemaFieldKind(schema);

  return {
    description: schema.description || schema.desc,
    kind,
    label: getLabel(key, schema),
    level,
    options: getJsonSchemaFieldOptions(schema),
    path,
    pathKey: getJsonSchemaPathKey(path),
    readOnly: schema.readOnly === true || schema.readonly === true,
    required,
    schema,
  };
}

function buildNodes(
  properties: Record<string, any>,
  required: Set<string>,
  parentPath: string[],
  level: number,
): JsonSchemaFormNode[] {
  return Object.entries(properties).map(([key, rawSchema]) => {
    const schema = isRecord(rawSchema) ? rawSchema : {};
    const path = [...parentPath, key];
    const common = {
      description: schema.description || schema.desc,
      label: getLabel(key, schema),
      level,
      path,
      pathKey: getJsonSchemaPathKey(path),
      required: required.has(key),
      schema,
    };

    if (isRecord(schema.properties)) {
      return {
        ...common,
        children: buildNodes(
          schema.properties,
          new Set<string>(Array.isArray(schema.required) ? schema.required : []),
          path,
          level + 1,
        ),
        kind: 'group',
      } satisfies JsonSchemaFormGroupNode;
    }

    if (schema.type === 'array' && isRecord(schema.items?.properties)) {
      return {
        ...common,
        itemSchema: schema.items,
        kind: 'collection',
      } satisfies JsonSchemaFormCollectionNode;
    }

    const branchSchemas = schema.oneOf || schema.anyOf;
    if (Array.isArray(branchSchemas)) {
      return {
        ...common,
        branches: branchSchemas.map((item: unknown, index: number) => {
          const branch = isRecord(item) ? item : {};
          return { label: getLabel(`方案 ${index + 1}`, branch), schema: branch };
        }),
        kind: 'branch',
      } satisfies JsonSchemaFormBranchNode;
    }

    return toField(key, schema, required.has(key), path, level);
  });
}

export function buildJsonSchemaFormNodes(schema?: Record<string, any>) {
  const normalizedSchema = normalizeJsonSchemaObject(schema);
  if (!normalizedSchema || !isRecord(normalizedSchema.properties)) return [];

  return buildNodes(
    normalizedSchema.properties,
    new Set<string>(
      Array.isArray(normalizedSchema.required) ? normalizedSchema.required : [],
    ),
    [],
    0,
  );
}

export function planJsonSchemaColumns(nodes: JsonSchemaFormNode[]) {
  const simpleCount = nodes.filter((node) => 'kind' in node && node.kind !== 'group' && node.kind !== 'collection' && node.kind !== 'branch').length;
  return simpleCount < 3 ? 1 : 2;
}
