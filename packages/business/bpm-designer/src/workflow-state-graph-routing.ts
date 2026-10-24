import type { GraphPoint } from './workflow-graph-layout';

import { graphPosition, routeGraphEdge } from './workflow-graph-layout';

interface StateRenderNode {
  id: string;
  name: string;
  x?: number;
  y?: number;
}
interface StateRenderEdge {
  id: string;
  label?: string;
  source: string;
  target: string;
}
export interface StateGraphLabelRect {
  height: number;
  width: number;
  x: number;
  y: number;
}
export interface StateGraphRoute extends StateRenderEdge {
  labelPoint?: GraphPoint;
  labelRect?: StateGraphLabelRect;
  path: string;
  points: GraphPoint[];
}
export function graphRectsOverlap(
  a: StateGraphLabelRect,
  b: StateGraphLabelRect,
  gap = 4,
) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}
function segmentHitsRect(
  a: GraphPoint,
  b: GraphPoint,
  rect: StateGraphLabelRect,
) {
  if (a.x === b.x)
    return (
      a.x > rect.x &&
      a.x < rect.x + rect.width &&
      Math.max(a.y, b.y) > rect.y &&
      Math.min(a.y, b.y) < rect.y + rect.height
    );
  return (
    a.y > rect.y &&
    a.y < rect.y + rect.height &&
    Math.max(a.x, b.x) > rect.x &&
    Math.min(a.x, b.x) < rect.x + rect.width
  );
}

/** v4 独立排线：每条边保留其身份，错开端口，并避让已使用的正交线段。 */
export function layoutStateGraphRoutes(
  nodes: StateRenderNode[],
  edges: StateRenderEdge[],
): StateGraphRoute[] {
  const graphNodes = nodes.map((node) => ({
    ...node,
    type: 'userTask' as const,
  }));
  const rectangles = nodes.map((node, index) => ({
    ...graphPosition({ ...node, type: 'userTask' }, index),
    width: 180,
    height: 64,
  }));
  const occupied: GraphPoint[][] = [];
  const routes = edges.map((edge, index): StateGraphRoute => {
    const offset =
      edges.length > 1 ? -22 + (44 * index) / (edges.length - 1) : 0;
    let points = routeGraphEdge(graphNodes, edge, index, {
      occupiedPaths: occupied,
      portOffset: { x: offset * 2.5, y: offset },
    });
    if (edge.source === edge.target) {
      const sourceIndex = nodes.findIndex((node) => node.id === edge.source);
      const node = nodes[sourceIndex];
      if (node) {
        const source = graphPosition(
          { ...node, type: 'userTask' },
          sourceIndex,
        );
        const right = source.x + 212 + index * 3;
        const top = Math.max(20, source.y - 24 - (index % 3) * 20);
        points = [
          { x: source.x + 180, y: source.y + 32 + offset },
          { x: right, y: source.y + 32 + offset },
          { x: right, y: top },
          { x: source.x + 90 + offset * 2.5, y: top },
          { x: source.x + 90 + offset * 2.5, y: source.y },
        ];
      }
    }
    occupied.push(points);
    return {
      ...edge,
      points,
      path: points
        .map(
          (point, pointIndex) =>
            `${pointIndex ? 'L' : 'M'}${point.x},${point.y}`,
        )
        .join(' '),
    };
  });
  const labels: StateGraphLabelRect[] = [];
  for (const route of routes) {
    if (!route.label) continue;
    const width = Math.max(
      24,
      [...route.label].reduce(
        (size, char) => size + ((char.codePointAt(0) ?? 0) > 255 ? 12 : 7),
        0,
      ) + 10,
    );
    const segments = route.points
      .flatMap((point, index) => {
        const previous = route.points[index - 1];
        return previous
          ? [
              {
                a: previous,
                b: point,
                length:
                  Math.abs(point.x - previous.x) +
                  Math.abs(point.y - previous.y),
              },
            ]
          : [];
      })
      .toSorted((a, b) => b.length - a.length);
    let choice: undefined | { point: GraphPoint; rect: StateGraphLabelRect };
    const candidates: {
      penalty: number;
      point: GraphPoint;
      rect: StateGraphLabelRect;
    }[] = [];
    for (const segment of segments)
      for (const fraction of [0.5, 0.3, 0.7]) {
        const x = segment.a.x + (segment.b.x - segment.a.x) * fraction;
        const y = segment.a.y + (segment.b.y - segment.a.y) * fraction;
        const horizontal = segment.a.y === segment.b.y;
        if (horizontal && segment.length < width + 12) continue;
        const points = horizontal
          ? [
              { x, y: y - 8 },
              { x, y: y + 20 },
            ]
          : [
              { x: x + width / 2 + 10, y: y + 4 },
              { x: x - width / 2 - 10, y: y + 4 },
            ];
        for (const point of points) {
          const rect = {
            x: point.x - width / 2,
            y: point.y - 13,
            width,
            height: 18,
          };
          if (
            rect.x < 8 ||
            rect.y < 8 ||
            rectangles.some((node) => graphRectsOverlap(rect, node, 6)) ||
            labels.some((label) => graphRectsOverlap(rect, label, 6))
          )
            continue;
          const crossings = routes.reduce(
            (count, other) =>
              count +
              other.points.filter((end, index) => {
                const start = other.points[index - 1];
                return start && segmentHitsRect(start, end, rect);
              }).length,
            0,
          );
          candidates.push({
            point,
            rect,
            penalty: crossings * 100_000 - segment.length,
          });
          if (crossings === 0 && !choice) choice = { point, rect };
        }
      }
    const selected =
      choice ?? candidates.toSorted((a, b) => a.penalty - b.penalty)[0];
    if (selected) {
      route.labelPoint = selected.point;
      route.labelRect = selected.rect;
      labels.push(selected.rect);
    }
  }
  return routes;
}
