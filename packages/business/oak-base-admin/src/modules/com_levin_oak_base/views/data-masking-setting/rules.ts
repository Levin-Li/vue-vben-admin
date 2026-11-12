export interface MaskingFieldRule {
  binding?: 'SESSION' | 'USER';
  entityClass: string;
  fieldName: string;
  inputFieldPath?: string;
  inputOperation?: string;
  treatment: 'HIDE' | 'MASK' | 'REVERSIBLE_ID';
  validSeconds?: number;
}

export function validateMaskingRuleContent(value: unknown) {
  const rules = value as MaskingFieldRule[] | null;
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('请至少选择一个实体字段');
  }

  // 可还原 ID 缺少输入位置或有效期时禁止保存不完整的安全规则。
  const selectedFields = new Set<string>();
  for (const rule of rules) {
    if (!rule.entityClass || !rule.fieldName || !rule.treatment) {
      throw new Error('实体字段规则缺少实体、字段或处理方式');
    }
    const key = `${rule.entityClass}\u0000${rule.fieldName}`;
    if (selectedFields.has(key)) {
      throw new Error('同一实体字段不能重复配置');
    }
    selectedFields.add(key);
    if (
      rule.treatment === 'REVERSIBLE_ID' &&
      (!rule.inputOperation ||
        !rule.inputFieldPath ||
        !rule.binding ||
        typeof rule.validSeconds !== 'number' ||
        !Number.isInteger(rule.validSeconds) ||
        rule.validSeconds <= 0 ||
        rule.validSeconds > 86_400)
    ) {
      throw new Error(
        '可还原 ID 需要输入接口、输入字段、绑定范围和有效秒数（1 至 86400）',
      );
    }
  }
  return value;
}
