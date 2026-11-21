import type {
  DataModelConditionDefinition,
  DataModelQueryInput,
} from '../../api/data-model-service';

export type EditableConditionNode = DataModelConditionDefinition;

export function newCondition(
  type: EditableConditionNode['type'],
): EditableConditionNode {
  if (type === 'PARAM') return { type, key: '' };
  if (type === 'VARIABLE') return { type, key: '', variable: 'currentUserId' };
  if (type === 'NOT') return { type, child: newCondition('PARAM') };
  return { type, children: [newCondition('PARAM')] };
}

// 条件结构属于接口定义；上下文变量由服务端从当前身份解析。
export function buildConditionDefinition(
  node: EditableConditionNode,
  inputs: DataModelQueryInput[],
): DataModelConditionDefinition {
  const known = new Set(inputs.map((input) => input.key));
  const referenced = new Set<string>();
  const sources = new Map<string, 'PARAM' | 'VARIABLE'>();
  let nodes = 0;
  let leaves = 0;
  function visit(
    current: EditableConditionNode,
    depth: number,
  ): DataModelConditionDefinition {
    if (depth > 6 || ++nodes > 64)
      throw new Error('查询条件层级或数量超过限制');
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
    if (current.type !== 'PARAM' && current.type !== 'VARIABLE')
      throw new Error('查询条件类型无效');
    if (++leaves > 20 || !known.has(current.key))
      throw new Error('请选择已定义的查询参数，最多20项');
    referenced.add(current.key);
    const source = sources.get(current.key);
    if (source && source !== current.type)
      throw new Error('同一个查询参数不能同时由用户填写和使用当前用户变量');
    sources.set(current.key, current.type);
    if (current.type === 'VARIABLE') {
      const input = inputs.find((item) => item.key === current.key);
      if (input?.type !== 'STRING' || input.operator !== 'EQ')
        throw new Error('当前用户变量只支持字符串字段的等于条件');
      if (
        ![
          'authorizedOrgIds',
          'currentOrgId',
          'currentTenantId',
          'currentUserId',
        ].includes(current.variable)
      )
        throw new Error('请选择当前用户变量');
      return { type: 'VARIABLE', key: current.key, variable: current.variable };
    }
    return { type: 'PARAM', key: current.key };
  }
  const result = visit(node, 1);
  if (referenced.size !== known.size)
    throw new Error('请把全部查询参数加入条件组合');
  return result;
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
    if (current.type === 'PARAM' || current.type === 'VARIABLE') leaves++;
    else if (current.type === 'NOT') visit(current.child);
    else current.children.forEach((child) => visit(child));
  }
  visit(root);
  const addsWrapper = type !== 'PARAM' && type !== 'VARIABLE';
  return (
    parentDepth + (addsWrapper ? 2 : 1) <= 6 &&
    nodes + (addsWrapper ? 2 : 1) <= 64 &&
    leaves < 20
  );
}
