export interface MaskingFieldRule {
  binding?: 'SESSION' | 'USER';
  entityClass: string;
  fieldName: string;
  schemaVersion: 2;
  treatment: 'HIDE' | 'MASK' | 'REVERSIBLE_ID';
  validSeconds?: null | number;
}

export function isLegacyMaskingRule(rule: MaskingFieldRule) {
  if (!rule || typeof rule !== 'object') return true;
  const rawRule = rule as unknown as Record<string, unknown>;
  return (
    rule.schemaVersion !== 2 ||
    [
      'inputOperation',
      'inputFieldPath',
      'outputOperation',
      'outputFieldPath',
    ].some(
      (key) =>
        rawRule[key] !== null &&
        rawRule[key] !== undefined &&
        rawRule[key] !== '',
    )
  );
}

export function validateMaskingRuleContent(value: unknown) {
  const rules = value as MaskingFieldRule[] | null;
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('请至少选择一个实体字段');
  }

  // 旧规则不会被静默转换；管理员须明确重新选择实体字段。
  const selectedFields = new Set<string>();
  for (const rule of rules) {
    if (isLegacyMaskingRule(rule)) {
      throw new Error('检测到旧版脱敏规则，请移除旧字段后重新配置');
    }
    if (!rule.entityClass || !rule.fieldName || !rule.treatment) {
      throw new Error('实体字段规则缺少实体、字段或处理方式');
    }
    if (!['HIDE', 'MASK', 'REVERSIBLE_ID'].includes(rule.treatment)) {
      throw new Error('不支持的脱敏处理方式');
    }
    const key = `${rule.entityClass}\u0000${rule.fieldName}`;
    if (selectedFields.has(key)) {
      throw new Error('同一实体字段不能重复配置');
    }
    selectedFields.add(key);
    if (
      rule.treatment === 'REVERSIBLE_ID' &&
      (!['SESSION', 'USER'].includes(rule.binding ?? '') ||
        (rule.validSeconds !== null &&
          rule.validSeconds !== undefined &&
          (typeof rule.validSeconds !== 'number' ||
            !Number.isInteger(rule.validSeconds) ||
            rule.validSeconds <= 0 ||
            rule.validSeconds > 86_400)))
    ) {
      throw new Error(
        '可还原 ID 需要绑定范围；有效秒数留空表示不过期，或填写 1 至 86400',
      );
    }
  }
  return value;
}
