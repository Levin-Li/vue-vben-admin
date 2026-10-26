import type {
  DataModelConditionNode,
  DataModelQueryInput,
} from '../../api/data-model-service';

export type EditableConditionNode =
  | { child: EditableConditionNode; type: 'NOT' }
  | { children: EditableConditionNode[]; type: 'AND' }
  | { children: EditableConditionNode[]; type: 'OR' }
  | { key: string; type: 'PARAM'; value: unknown };

type ConditionOption = { label: string; value: boolean | number | string };

// 空的元数据选项不遮挡归属候选或布尔值候选。
export function resolveConditionOptions(
  input: DataModelQueryInput | undefined,
  scopeOptions: Record<string, Array<{ label: string; value: string }>> = {},
): ConditionOption[] {
  if (!input) return [];
  if (input.options?.length) return input.options;
  const scope = scopeOptions[input.field];
  if (scope?.length) return scope;
  return input.type === 'BOOLEAN'
    ? [
        { label: '是', value: true },
        { label: '否', value: false },
      ]
    : [];
}

export function resolveConditionOptionValue(
  selected: unknown,
  options: ConditionOption[],
): ConditionOption['value'] | undefined {
  return options.find((option) => String(option.value) === String(selected))
    ?.value;
}

export function newCondition(
  type: EditableConditionNode['type'],
): EditableConditionNode {
  if (type === 'PARAM') return { type, key: '', value: undefined };
  if (type === 'NOT') return { type, child: newCondition('PARAM') };
  return { type, children: [newCondition('PARAM')] };
}

// 仅接受已发布的参数键；目标字段、操作符、物理列均由服务端定义解析。
export function buildConditionTree(
  node: EditableConditionNode,
  inputs: DataModelQueryInput[],
): DataModelConditionNode {
  const known = new Map(inputs.map((input) => [input.key, input]));
  let count = 0;
  let leaves = 0;
  function visit(
    current: EditableConditionNode,
    depth: number,
  ): DataModelConditionNode {
    count++;
    if (depth > 6 || count > 64) throw new Error('查询条件层级或数量超过限制');
    if (current.type === 'NOT')
      return { type: 'NOT', child: visit(current.child, depth + 1) };
    if (current.type === 'AND' || current.type === 'OR') {
      if (current.children.length === 0)
        throw new Error('条件分组至少包含一项');
      return {
        type: current.type,
        children: current.children.map((child) => visit(child, depth + 1)),
      };
    }
    leaves++;
    if (leaves > 20) throw new Error('查询参数最多 20 项');
    const input = known.get(current.key);
    if (!input) throw new Error('请选择已发布的查询参数');
    const raw = current.value;
    if (raw === undefined || raw === null || raw === '')
      throw new Error(`${input.title}不能为空`);
    if (
      input.options?.length &&
      !input.options.some((option) => option.value === raw)
    )
      throw new Error(`${input.title}不在可选值中`);
    if (input.type === 'BOOLEAN' && typeof raw !== 'boolean')
      throw new Error(`${input.title}需要选择是或否`);
    if (
      ['BIG_INTEGER', 'INTEGER'].includes(input.type) &&
      !/^-?\d+$/.test(String(raw))
    )
      throw new Error(`${input.title}需要输入整数`);
    if (
      ['DECIMAL', 'MONEY'].includes(input.type) &&
      !/^-?\d+(?:\.\d+)?$/.test(String(raw))
    )
      throw new Error(`${input.title}需要输入数值`);
    let value: unknown = raw;
    if (input.type === 'DATETIME') {
      const date = new Date(String(raw));
      if (Number.isNaN(date.getTime()))
        throw new Error(`${input.title}的日期时间无效`);
      value = date.toISOString();
    }
    if (!['boolean', 'number', 'string'].includes(typeof value))
      throw new Error(`${input.title}的查询值无效`);
    return {
      type: 'PARAM',
      key: input.key,
      value: value as boolean | number | string,
    };
  }
  return visit(node, 1);
}

export function canAddCondition(
  root: EditableConditionNode,
  parentDepth: number,
  type: EditableConditionNode['type'] = 'PARAM',
): boolean {
  let nodes = 0;
  let leaves = 0;
  function visit(current: EditableConditionNode) {
    nodes++;
    if (current.type === 'PARAM') leaves++;
    else if (current.type === 'NOT') visit(current.child);
    else current.children.forEach((child) => visit(child));
  }
  visit(root);
  const addsWrapper = type !== 'PARAM';
  return (
    parentDepth + (addsWrapper ? 2 : 1) <= 6 &&
    nodes + (addsWrapper ? 2 : 1) <= 64 &&
    leaves < 20
  );
}
