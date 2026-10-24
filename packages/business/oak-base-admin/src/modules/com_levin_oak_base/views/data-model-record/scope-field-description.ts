import type { DataModelOperationParameter } from '../../api/data-model-service';

export function scopeFieldDescription(
  field: Pick<
    DataModelOperationParameter,
    'description' | 'referenceType' | 'source'
  >,
): string | undefined {
  const defaults = {
    DOMAIN: '服务端验证领域范围，空领域沿用标准语义',
    ORG: '服务端可信组织范围',
    TENANT: '服务端可信租户范围',
    USER: '服务端可信操作者',
  };
  if (
    field.source === 'SCOPE' &&
    field.referenceType &&
    field.description === defaults[field.referenceType]
  )
    return undefined;
  return field.description;
}
