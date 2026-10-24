import type { DataModelQueryInput } from '../../api/data-model-service';

export type RuntimeQueryField = DataModelQueryInput;

// 参数名及语义来自已同步接口，使用者只提供值，不提交字段或操作符。
export function buildRecordQueryValues(
  fields: RuntimeQueryField[],
  values: Record<string, unknown>,
): Record<string, boolean | number | string> {
  const result: Record<string, boolean | number | string> = {};
  for (const field of fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === null || raw === '') continue;
    let value = raw;
    if (field.type === 'DATETIME') {
      const date = new Date(String(raw));
      if (Number.isNaN(date.getTime()))
        throw new Error(`${field.title}的日期时间无效`);
      value = date.toISOString();
    }
    if (!['boolean', 'number', 'string'].includes(typeof value))
      throw new Error(`${field.title}的查询值无效`);
    result[field.key] = value as boolean | number | string;
    if (Object.keys(result).length > 20) throw new Error('查询条件最多 20 项');
  }
  return result;
}
