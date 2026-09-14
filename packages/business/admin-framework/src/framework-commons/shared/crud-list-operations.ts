import { evaluateJavaScriptExpression } from './javascript-expression';

// 列表操作以稳定标识关联配置，名称与位置仅用于编辑器展示。
export interface CrudListOperationCandidate {
  key: string;
  label: string;
  placement: 'left' | 'right';
}

export type CrudListOperationConfig = Record<string, { expression?: string }>;

// 框架入口固定登记；自定义扩展不能覆盖这些标识及其展示含义。
export const DEFAULT_LIST_OPERATIONS: CrudListOperationCandidate[] = [
  { key: 'builtin:create', label: '新增', placement: 'left' },
  { key: 'tool:export', label: '导出', placement: 'right' },
  { key: 'tool:import', label: '导入', placement: 'right' },
  { key: 'tool:refresh', label: '刷新', placement: 'right' },
  { key: 'tool:fullscreen', label: '全屏', placement: 'right' },
  { key: 'tool:columns', label: '列设置', placement: 'right' },
  { key: 'settings:display', label: '页面展示设置', placement: 'right' },
  { key: 'settings:display-v2', label: '展示设置2', placement: 'right' },
];

// 只有显式标识可持久化，不使用按钮文案或数组位置推导身份。
export function getListOperationKey(
  action: { displayKey?: string },
  kind: 'batch' | 'toolbar',
): string | undefined {
  const displayKey = action.displayKey?.trim();
  return displayKey ? `${kind}:${displayKey}` : undefined;
}

// 内置候选优先，自定义与扩展按登记顺序合并，同一个键只保留第一项。
export function buildListOperationCandidates(
  toolbar: Array<{ displayKey?: string; label: string }>,
  batch: Array<{ displayKey?: string; label: string }>,
  extra: CrudListOperationCandidate[] = [],
): CrudListOperationCandidate[] {
  const candidates = DEFAULT_LIST_OPERATIONS.map((item) => ({ ...item }));
  for (const [kind, actions] of [
    ['toolbar', toolbar],
    ['batch', batch],
  ] as const) {
    for (const action of actions) {
      const key = getListOperationKey(action, kind);
      if (key) candidates.push({ key, label: action.label, placement: 'left' });
    }
  }
  candidates.push(...extra.map((item) => ({ ...item })));

  // 不修改调用方的数组或候选对象，避免编辑器草稿反向污染登记来源。
  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

// 附加条件只能收紧原有可见性，不能授予权限或恢复不可用的入口。
export function isListOperationVisible({
  key,
  baseVisible,
  config,
  isSuperAdmin,
  context,
}: {
  baseVisible: boolean;
  config?: CrudListOperationConfig;
  context: Record<string, unknown>;
  isSuperAdmin?: boolean;
  key: string;
}): boolean {
  if (!baseVisible) return false;

  // 超管保留两个设置入口以便恢复配置，此例外不扩展到普通按钮。
  if (
    isSuperAdmin &&
    (key === 'settings:display' || key === 'settings:display-v2')
  ) {
    return true;
  }

  // 沿用受限表达式引擎，空配置默认展示，求值失败则隐藏当前按钮。
  try {
    const expression = config?.[key]?.expression?.trim() || 'true';
    return Boolean(evaluateJavaScriptExpression(expression, context));
  } catch {
    return false;
  }
}
