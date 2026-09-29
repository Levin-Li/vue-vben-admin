import type {
  WorkflowDesignerDefinition,
  WorkflowEdge,
  WorkflowNode,
} from './types';

export interface GraphPoint {
  x: number;
  y: number;
}
interface GraphRect extends GraphPoint {
  id: string;
}
const WIDTH = 180;
const HEIGHT = 64;

/** 根据真实连线分层，数组顺序只用于同层兄弟节点的稳定排列。 */
export function graphLayout(
  definition: WorkflowDesignerDefinition,
): Map<string, GraphPoint> {
  const ranks = new Map<string, number>();
  const incoming = new Map(definition.nodes.map((node) => [node.id, 0]));
  for (const edge of definition.edges ?? [])
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  const pending = definition.nodes
    .filter((node) => incoming.get(node.id) === 0)
    .map((node) => node.id);
  const processed = new Set<string>();
  while (pending.length > 0) {
    const id = pending.shift();
    if (!id || processed.has(id)) continue;
    processed.add(id);
    for (const edge of definition.edges ?? []) {
      if (edge.source !== id) continue;
      ranks.set(
        edge.target,
        Math.max(ranks.get(edge.target) ?? 0, (ranks.get(id) ?? 0) + 1),
      );
      incoming.set(edge.target, (incoming.get(edge.target) ?? 1) - 1);
      if (incoming.get(edge.target) === 0) pending.push(edge.target);
    }
  }

  // 尚未连接或含错误环的草稿仍可编辑，尾部安排不会改变任何业务线路。
  const rows = new Map<number, number>();
  const result = new Map<string, GraphPoint>();
  for (const node of definition.nodes) {
    const rank = ranks.get(node.id) ?? 0;
    const row = rows.get(rank) ?? 0;
    rows.set(rank, row + 1);
    result.set(node.id, { x: 60 + rank * 320, y: 100 + row * 140 });
  }
  return result;
}

/** 只有仍保持自动坐标的图才在新增时重排；用户手动设置的坐标始终保留。 */
export function hasAutomaticLayout(
  definition: WorkflowDesignerDefinition,
): boolean {
  const positions = graphLayout(definition);
  return definition.nodes.every((node) => {
    const point = positions.get(node.id);
    return (
      (node.x === undefined || node.x === point?.x) &&
      (node.y === undefined || node.y === point?.y)
    );
  });
}
export function applyGraphLayout(definition: WorkflowDesignerDefinition) {
  const positions = graphLayout(definition);
  definition.nodes.forEach((node) =>
    Object.assign(node, positions.get(node.id)),
  );
}
export function graphPosition(node: WorkflowNode, index: number): GraphPoint {
  return {
    x: node.x ?? 60 + (index % 3) * 320,
    y: node.y ?? 100 + Math.floor(index / 3) * 140,
  };
}

/** 检测轴对齐线段是否穿过节点内部，允许线路贴着预留通道行进。 */
function clearSegment(
  first: GraphPoint,
  second: GraphPoint,
  obstacles: GraphRect[],
  ignored?: string,
) {
  return obstacles.every((rect) => {
    if (rect.id === ignored) return true;
    const left = rect.x - 6;
    const right = rect.x + WIDTH + 6;
    const top = rect.y - 6;
    const bottom = rect.y + HEIGHT + 6;
    if (first.x === second.x)
      return (
        first.x <= left ||
        first.x >= right ||
        Math.max(first.y, second.y) <= top ||
        Math.min(first.y, second.y) >= bottom
      );
    return (
      first.y <= top ||
      first.y >= bottom ||
      Math.max(first.x, second.x) <= left ||
      Math.min(first.x, second.x) >= right
    );
  });
}
function distance(first: GraphPoint, second: GraphPoint) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}
function ports(rect: GraphRect, margin: number, obstacles: GraphRect[]) {
  return [
    [
      { x: rect.x + WIDTH, y: rect.y + HEIGHT / 2 },
      { x: rect.x + WIDTH + margin, y: rect.y + HEIGHT / 2 },
    ],
    [
      { x: rect.x, y: rect.y + HEIGHT / 2 },
      { x: rect.x - margin, y: rect.y + HEIGHT / 2 },
    ],
    [
      { x: rect.x + WIDTH / 2, y: rect.y },
      { x: rect.x + WIDTH / 2, y: rect.y - margin },
    ],
    [
      { x: rect.x + WIDTH / 2, y: rect.y + HEIGHT },
      { x: rect.x + WIDTH / 2, y: rect.y + HEIGHT + margin },
    ],
  ].filter(
    (pair): pair is [GraphPoint, GraphPoint] =>
      !!pair[0] &&
      !!pair[1] &&
      clearSegment(pair[0], pair[1], obstacles, rect.id),
  );
}

/** 先尝试简短正交线，再沿节点外侧通道搜索；箭头只落到真实目标节点边界。 */
export function routeGraphEdge(
  nodes: WorkflowNode[],
  edge: WorkflowEdge,
  edgeIndex = 0,
): GraphPoint[] {
  const rectangles = nodes.map((node, index) => ({
    id: node.id,
    ...graphPosition(node, index),
  }));
  const source = rectangles.find((rect) => rect.id === edge.source);
  const target = rectangles.find((rect) => rect.id === edge.target);
  if (!source || !target) return [];
  const margin = 24 + (edgeIndex % 4) * 10;
  const starts = ports(source, margin, rectangles);
  const ends = ports(target, margin, rectangles);
  const proposals: GraphPoint[][] = [];
  for (const [boundary, first] of starts) {
    for (const [lastBoundary, last] of ends) {
      for (const corner of [
        { x: first.x, y: last.y },
        { x: last.x, y: first.y },
      ]) {
        if (
          clearSegment(first, corner, rectangles) &&
          clearSegment(corner, last, rectangles)
        )
          proposals.push([boundary, first, corner, last, lastBoundary]);
      }
    }
  }
  const length = (points: GraphPoint[]) =>
    points.reduce(
      (sum, point, index) =>
        sum +
        (points[index - 1]
          ? distance(points[index - 1] as GraphPoint, point)
          : 0),
      0,
    );
  if (proposals.length > 0)
    return simplify(
      proposals.toSorted((left, right) => length(left) - length(right))[0] ??
        [],
    );

  // 网格只包含节点外侧与端口的坐标，不修改存储位置；搜索对存在重叠的无路图返回空线而不误导。
  const xs = [
    ...new Set([
      ...ends.flatMap((pair) => pair.map((point) => point.x)),
      ...rectangles.flatMap((rect) => [
        rect.x - margin,
        rect.x + WIDTH + margin,
      ]),
      ...starts.flatMap((pair) => pair.map((point) => point.x)),
    ]),
  ].toSorted((left, right) => left - right);
  const ys = [
    ...new Set([
      ...ends.flatMap((pair) => pair.map((point) => point.y)),
      ...rectangles.flatMap((rect) => [
        rect.y - margin,
        rect.y + HEIGHT + margin,
      ]),
      ...starts.flatMap((pair) => pair.map((point) => point.y)),
    ]),
  ].toSorted((left, right) => left - right);
  const points = ys.flatMap((y) => xs.map((x) => ({ x, y })));
  const key = (point: GraphPoint) =>
    ys.indexOf(point.y) * xs.length + xs.indexOf(point.x);
  const goals = new Map(
    ends.map(([boundary, point]) => [key(point), boundary]),
  );
  const costs = new Map<number, number>();
  const previous = new Map<number, number>();
  const roots = new Map<number, GraphPoint>();
  const queue: number[] = [];
  for (const [boundary, point] of starts) {
    const id = key(point);
    costs.set(id, margin);
    roots.set(id, boundary);
    queue.push(id);
  }
  const done = new Set<number>();
  while (queue.length > 0) {
    queue.sort(
      (left, right) =>
        (costs.get(left) ?? Infinity) - (costs.get(right) ?? Infinity),
    );
    const current = queue.shift();
    if (current === undefined || done.has(current)) continue;
    done.add(current);
    const point = points[current];
    if (!point) continue;
    const goal = goals.get(current);
    if (goal) {
      const result = [goal, point];
      let cursor = current;
      while (previous.has(cursor)) {
        cursor = previous.get(cursor) as number;
        const parent = points[cursor];
        if (parent) result.push(parent);
      }
      const root = roots.get(cursor);
      if (root) result.push(root);
      return simplify(result.toReversed());
    }
    const column = current % xs.length;
    const neighbors = [
      column > 0 ? current - 1 : -1,
      column < xs.length - 1 ? current + 1 : -1,
      current - xs.length,
      current + xs.length,
    ];
    for (const neighbor of neighbors) {
      const next = points[neighbor];
      if (!next || done.has(neighbor) || !clearSegment(point, next, rectangles))
        continue;
      const cost = (costs.get(current) ?? 0) + distance(point, next);
      if (cost >= (costs.get(neighbor) ?? Infinity)) continue;
      costs.set(neighbor, cost);
      previous.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return [];
}

/** 合并连续共线点，使SVG路径保持简洁，保留目标端最后一段的箭头方向。 */
function simplify(points: GraphPoint[]): GraphPoint[] {
  const result: GraphPoint[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last?.x === point.x && last.y === point.y) continue;
    const before = result.at(-2);
    if (
      last &&
      before &&
      ((before.x === last.x && last.x === point.x) ||
        (before.y === last.y && last.y === point.y))
    )
      result.pop();
    result.push(point);
  }
  return result;
}
