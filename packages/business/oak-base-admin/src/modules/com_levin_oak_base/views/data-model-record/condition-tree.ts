import type {
  DataModelConditionDefinition,
  DataModelQueryInput,
} from '../../api/data-model-service';

export type EditableConditionNode = DataModelConditionDefinition;

export function newCondition(
  type: EditableConditionNode['type'],
): EditableConditionNode {
  if (type === 'PARAM') return { type, key: '' };
  if (type === 'NOT') return { type, child: newCondition('PARAM') };
  return { type, children: [newCondition('PARAM')] };
}

// 条件结构属于接口定义：叶子只保存参数键，值由使用者查询时提供。
export function buildConditionDefinition(
  node: EditableConditionNode,
  inputs: DataModelQueryInput[],
): DataModelConditionDefinition {
  const known = new Set(inputs.map((input) => input.key));
  const referenced = new Set<string>();
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
    if (current.type !== 'PARAM') throw new Error('查询条件类型无效');
    if (++leaves > 20 || !known.has(current.key))
      throw new Error('请选择已定义的查询参数，最多20项');
    referenced.add(current.key);
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
