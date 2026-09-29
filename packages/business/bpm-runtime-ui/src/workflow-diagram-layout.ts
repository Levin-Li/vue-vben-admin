import type {
  WorkflowDiagramEdge,
  WorkflowDiagramNode,
  WorkflowNodeStatus,
} from './types';

export const workflowNodeStatusLabels: Record<WorkflowNodeStatus, string> = {
  active: '进行中',
  completed: '已完成',
  pending: '待执行',
  cancelled: '已取消',
  skipped: '已跳过',
};

/** 固定版本的真实拓扑按层排布，不用节点数组顺序推断执行连线。 */
export function layoutWorkflowDiagram(
  sourceNodes: WorkflowDiagramNode[],
  sourceEdges: WorkflowDiagramEdge[],
) {
  const width = 176;
  const height = 92;
  const gapX = 48;
  const gapY = 72;
  const padding = 24;
  const nodesById = new Map(sourceNodes.map((node) => [node.id, node]));
  const edges = sourceEdges.filter(
    (edge) => nodesById.has(edge.source) && nodesById.has(edge.target),
  );
  const levels = new Map<string, number>();
  const incomingCount = new Map([...nodesById.keys()].map((id) => [id, 0]));
  for (const edge of edges)
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  const queue = [...nodesById.keys()].filter(
    (id) => incomingCount.get(id) === 0,
  );
  for (const id of queue) levels.set(id, 0);

  // 使用入度和最长前置层级确定分叉、汇聚位置，处理顺序与原数组无关。
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    for (const edge of edges.filter((item) => item.source === id)) {
      levels.set(
        edge.target,
        Math.max(
          levels.get(edge.target) ?? 0,
          (levels.get(edge.source) ?? 0) + 1,
        ),
      );
      const remaining = (incomingCount.get(edge.target) ?? 0) - 1;
      incomingCount.set(edge.target, remaining);
      if (remaining === 0) queue.push(edge.target);
    }
  }

  // 非DAG历史图仍展示原连线，未排定节点放到独立层并通过侧边走线避免覆盖文本。
  const placed = new Set(queue);
  let remainingLevel = Math.max(0, ...levels.values());
  for (const id of nodesById.keys())
    if (!placed.has(id)) levels.set(id, ++remainingLevel);
  const layerCount = Math.max(0, ...levels.values()) + 1;
  const layers = Array.from({ length: layerCount }, (_, level) =>
    [...nodesById.values()].filter((node) => levels.get(node.id) === level),
  );
  const columns = Math.max(1, ...layers.map((layer) => layer.length));
  const contentWidth = columns * width + (columns - 1) * gapX;
  const nodes = layers.flatMap((layer, level) =>
    layer.map((node, index) => ({
      ...node,
      width,
      height,
      x:
        padding +
        (contentWidth - (layer.length * width + (layer.length - 1) * gapX)) /
          2 +
        index * (width + gapX),
      y: padding + level * (height + gapY),
    })),
  );
  const positions = new Map(nodes.map((node) => [node.id, node]));
  let sideLanes = 0;

  // 相邻层只在层间空白区折线；跨层/回跳连线走节点区外侧，任何边都不穿过节点文字。
  const paths = edges.flatMap((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return [];
    const sx = source.x + width / 2;
    const sy = source.y + height;
    const tx = target.x + width / 2;
    const ty = target.y;
    let points: Array<[number, number]>;
    if ((levels.get(edge.target) ?? 0) === (levels.get(edge.source) ?? 0) + 1) {
      const midY = sy + gapY / 2;
      points = [
        [sx, sy],
        [sx, midY],
        [tx, midY],
        [tx, ty],
      ];
    } else {
      const laneX = padding + contentWidth + 24 + sideLanes++ * 16;
      points = [
        [sx, sy],
        [sx, sy + 20],
        [laneX, sy + 20],
        [laneX, ty - 20],
        [tx, ty - 20],
        [tx, ty],
      ];
    }
    return [
      {
        ...edge,
        points,
        path: points
          .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
          .join(' '),
      },
    ];
  });
  return {
    nodes,
    edges: paths,
    width: padding * 2 + contentWidth + (sideLanes ? 24 + sideLanes * 16 : 0),
    height: padding * 2 + layerCount * height + (layerCount - 1) * gapY,
    invalidEdgeCount: sourceEdges.length - edges.length,
  };
}

/** SVG标签限制为两行，并用title保留完整业务节点名称。 */
export function workflowNodeNameLines(name: string) {
  const characters = [...name];
  return characters.length > 12
    ? [
        characters.slice(0, 12).join(''),
        `${characters.slice(12, 23).join('')}${characters.length > 23 ? '…' : ''}`,
      ]
    : [name];
}
