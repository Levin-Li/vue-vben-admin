import type { CrudFieldConfig } from './types';

type RecordData = Record<string, any>;

const reservedKeys = new Set([
  '__proto__',
  'autoForceUpdateField',
  'constructor',
  'forceUpdateFields',
  'id',
  'optimisticLock',
  'orgId',
  'prototype',
  'tenantId',
]);

/** 专用入口是原更新操作的字段视图，不能扩大页面或字段权限。 */
export function getCrudJsonSchemaEditFields(
  fields: CrudFieldConfig[],
  record: RecordData,
  options: {
    canEditField: (field: CrudFieldConfig, record: RecordData) => boolean;
    canEditRecord: boolean;
    recordKey: string;
    userInfo: unknown;
  },
) {
  if (!options.canEditRecord) return [];
  return fields.filter((field) => {
    const disabled =
      typeof field.disabledOnEdit === 'function'
        ? field.disabledOnEdit({ userInfo: options.userInfo })
        : field.disabledOnEdit === true;
    return (
      field.jsonSchemaEditor === true &&
      field.type === 'json' &&
      field.form !== false &&
      field.formEdit !== false &&
      field.omitOnEdit !== true &&
      !field.complexGroupKey &&
      !disabled &&
      !reservedKeys.has(field.key) &&
      field.key !== options.recordKey &&
      options.canEditField(field, record)
    );
  });
}

/** 转换器之后再次收窄字段，保留读取到的主键、版本和适用范围。 */
export function buildCrudJsonFieldUpdatePayload(
  fieldKey: string,
  transformed: RecordData,
  record: RecordData,
  recordKey: string,
  isPlatformUser: boolean,
) {
  if (
    reservedKeys.has(fieldKey) ||
    fieldKey === recordKey ||
    !Object.hasOwn(transformed, fieldKey) ||
    transformed[fieldKey] === undefined ||
    record[recordKey] === undefined ||
    record[recordKey] === null
  ) {
    throw new Error('缺少目标字段或记录标识，无法单独保存');
  }
  const payload: RecordData = {
    [recordKey]: record[recordKey],
    [fieldKey]: transformed[fieldKey],
    forceUpdateFields: [fieldKey],
  };
  for (const key of [
    'optimisticLock',
    'orgId',
    // 不从原记录补回已被表单“不提”状态排除的租户。
    ...(isPlatformUser && Object.hasOwn(transformed, 'tenantId')
      ? ['tenantId']
      : []),
  ]) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '')
      payload[key] = record[key];
  }
  return payload;
}
