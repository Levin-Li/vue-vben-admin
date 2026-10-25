import type {
  DataModelField,
  DataModelQueryOperator,
} from '../../api/data-model-service';

const equalityOnly = new Set(['BOOLEAN', 'UUID']);
const comparable = new Set([
  'BIG_INTEGER',
  'DATE',
  'DATETIME',
  'DECIMAL',
  'INTEGER',
  'MONEY',
  'TIME',
]);
export const reservedModelFieldNames = new Set([
  'createTime',
  'creator',
  'definitionVersion',
  'domainId',
  'editable',
  'enable',
  'id',
  'lastUpdateTime',
  'modelKey',
  'optimisticLock',
  'orderCode',
  'orgId',
  'orgShared',
  'ownerId',
  'platformPublic',
  'remark',
  'scopeKind',
  'syncedVersion',
  'tenantId',
  'tenantPublic',
  'tenantShared',
]);

export const queryOperatorLabels: Record<DataModelQueryOperator, string> = {
  CONTAINS: '包含',
  EQ: '等于',
  GT: '大于',
  GTE: '大于等于',
  LT: '小于',
  LTE: '小于等于',
};

export function allowedQueryOperators(
  type: DataModelField['type'],
): DataModelQueryOperator[] {
  if (type === 'JSON') return [];
  if (equalityOnly.has(type)) return ['EQ'];
  if (type === 'STRING' || type === 'TEXT') return ['EQ', 'CONTAINS'];
  if (comparable.has(type)) return ['EQ', 'GT', 'GTE', 'LT', 'LTE'];
  return ['EQ'];
}

export function withFieldUsageDefaults(field: DataModelField): DataModelField {
  const allowed = allowedQueryOperators(field.type);
  return {
    ...field,
    queryEnabled: field.type !== 'JSON' && field.queryEnabled === true,
    listEnabled: field.listEnabled !== false,
    createEnabled: field.createEnabled ?? field.formEnabled !== false,
    editEnabled: field.editEnabled ?? field.formEnabled !== false,
    detailEnabled: field.detailEnabled !== false,
    queryOperators: (field.queryOperators || []).filter((operator) =>
      allowed.includes(operator),
    ),
  };
}

export function queryFieldOptions(field: DataModelField) {
  const allowed = allowedQueryOperators(field.type);
  return (
    field.queryOperators?.length
      ? field.queryOperators
      : (['EQ'] as DataModelQueryOperator[])
  ).filter((operator) => allowed.includes(operator));
}
