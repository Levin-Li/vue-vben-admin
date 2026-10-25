import type {
  DataModelField,
  DataModelSystemField,
  SaveDataModelFieldsInput,
} from '../../api/data-model-service';

/** 数据模型 DTO 只包含 JSON 值；序列化副本可展开 Vue 的嵌套 Proxy。 */
export function cloneDataModelDto<T>(value: T): T {
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
}

export type FieldSourceFilter =
  | 'ALL'
  | 'BUSINESS'
  | 'MODEL_ATTRIBUTE'
  | 'RECORD_SYSTEM';

export function buildFieldTableRows(
  fields: DataModelField[],
  systemFields: DataModelSystemField[],
  filter: FieldSourceFilter,
) {
  return [
    ...fields.map((field, businessIndex) => ({
      ...field,
      source: 'BUSINESS' as const,
      businessIndex,
    })),
    ...systemFields.map((field, systemIndex) => ({ ...field, systemIndex })),
  ].filter((field) => filter === 'ALL' || field.source === filter);
}

export function upsertBusinessField(
  fields: DataModelField[],
  index: number,
  draft: DataModelField,
): DataModelField[] {
  const next = fields.map((field) => cloneDataModelDto(field));
  if (index < 0) next.push(cloneDataModelDto(draft));
  else {
    if (index >= next.length) throw new RangeError('字段行不存在');
    next[index] = cloneDataModelDto(draft);
  }
  return next;
}

export function removeBusinessField(
  fields: DataModelField[],
  index: number,
): DataModelField[] {
  if (index < 0 || index >= fields.length) throw new RangeError('字段行不存在');
  return fields
    .filter((_, position) => position !== index)
    .map((field) => cloneDataModelDto(field));
}

export function fieldSaveRequest(
  current: SaveDataModelFieldsInput,
): SaveDataModelFieldsInput {
  return {
    key: current.key,
    expectedVersion: current.expectedVersion,
    fields: current.fields.map((field) => cloneDataModelDto(field)),
    ...(current.permissionGroups
      ? {
          permissionGroups: current.permissionGroups.map((group) =>
            cloneDataModelDto(group),
          ),
        }
      : {}),
  };
}
