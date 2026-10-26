import type { DataModelQueryInput } from '../../api/data-model-service';

// 展示列名只供管理员核对；保存请求始终仅提交字段属性名。
export function derivedQueryColumn(field: string): string {
  return field
    .replaceAll(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

// 切换候选字段或比较符时保持已暴露的请求参数身份。
export function withQueryMappingCandidate(
  selected: DataModelQueryInput,
  candidate: DataModelQueryInput,
): DataModelQueryInput {
  return {
    ...candidate,
    key: selected.key,
    title: selected.title,
    defaultVisible: selected.defaultVisible,
  };
}

export function validateQueryInputMapping(
  inputs: DataModelQueryInput[],
): string | undefined {
  const keys = new Set<string>();
  for (const input of inputs) {
    const customKey = /^[a-z]\w{0,63}$/.test(input.key);
    const generatedKey = /^__query_[sf]_\w{1,100}$/.test(input.key);
    if (
      (!customKey && !generatedKey) ||
      ['constructor', 'prototype', 'toString', 'valueOf'].includes(input.key)
    )
      return '查询参数键须为受限字母数字下划线标识，不能使用保留字';
    if (!input.field || !input.operator)
      return `查询参数 ${input.key} 缺少目标字段或操作符`;
    if (keys.has(input.key)) return '查询参数不能重复';
    keys.add(input.key);
  }
  return undefined;
}
