import type { DataModelField } from '../../api/data-model-service';

// 固定选项在提交前按字段类型核对，避免输入 JSON 的值与实际列类型不一致。
export function validateFixedOptions(
  field: DataModelField,
): string | undefined {
  if (field.optionSource !== 'FIXED') return undefined;
  const options = field.options || [];
  if (options.length === 0 || options.length > 200)
    return '固定选项需要 1～200 个候选值';
  const seen = new Set<string>();
  for (const option of options) {
    if (!option || typeof option.label !== 'string' || !option.label.trim())
      return '固定选项的中文标签不能为空';
    const value = option.value;
    if (value === null || value === undefined || value === '')
      return '固定选项的值不能为空';
    if (field.type === 'BOOLEAN' && typeof value !== 'boolean')
      return '布尔字段的固定选项值必须是布尔值';
    if (
      field.type === 'INTEGER' &&
      (typeof value !== 'number' || !Number.isSafeInteger(value))
    )
      return '整数字段的固定选项值必须是安全整数';
    if (
      field.type !== 'BOOLEAN' &&
      field.type !== 'INTEGER' &&
      typeof value !== 'string'
    )
      return '该字段的固定选项值必须是字符串';
    const token = `${typeof value}:${String(value)}`;
    if (seen.has(token)) return '固定选项的值不能重复';
    seen.add(token);
  }
  return undefined;
}
