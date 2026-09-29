import { describe, expect, it } from 'vitest';

import { addNode, createDefinition } from './definition-model';
import {
  applyGraphLayout,
  graphPosition,
  routeGraphEdge,
} from './workflow-graph-layout';

describe('画布执行语义', () => {
  it('默认新增审批后按开始、审批、结束的执行顺序排布', () => {
    const definition = createDefinition('review', '审核');
    const approval = addNode(definition, 'userTask');
    const start = definition.nodes.find((node) => node.type === 'start');
    const end = definition.nodes.find((node) => node.type === 'end');
    expect(start?.x).toBeLessThan(approval.x ?? 0);
    expect(approval.x).toBeLessThan(end?.x ?? 0);
    expect(start?.y).toBe(approval.y);
    expect(approval.y).toBe(end?.y);
  });

  it('自动排布读取连线而非节点数组，保留所有业务连线', () => {
    const definition = createDefinition('review', '审核');
    addNode(definition, 'userTask');
    const edges = structuredClone(definition.edges);
    applyGraphLayout(definition);
    expect(definition.nodes.map((node) => node.id)).toEqual([
      'start',
      'end',
      'userTask_1',
    ]);
    expect(
      definition.nodes.find((node) => node.id === 'userTask_1')?.x,
    ).toBeLessThan(definition.nodes.find((node) => node.id === 'end')?.x ?? 0);
    expect(definition.edges).toEqual(edges);
  });

  it('新增节点不会覆盖既有手动坐标', () => {
    const definition = createDefinition('review', '审核');
    const start = definition.nodes[0];
    if (start) {
      start.x = 130;
      start.y = 210;
    }
    const stored = definition.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    }));
    addNode(definition, 'userTask');
    expect(
      definition.nodes
        .slice(0, 2)
        .map((node) => ({ id: node.id, x: node.x, y: node.y })),
    ).toEqual(stored);
  });

  it('已发布的旧坐标仍将真实箭头绕过中间结束节点', () => {
    const definition = createDefinition('review', '审核');
    const approval = addNode(definition, 'userTask');
    // 复现浏览器截图中数据库已经保存的坐标，不修改存量定义。
    Object.assign(
      definition.nodes.find((node) => node.type === 'start') ?? {},
      { x: 60, y: 100 },
    );
    Object.assign(definition.nodes.find((node) => node.type === 'end') ?? {}, {
      x: 380,
      y: 100,
    });
    Object.assign(approval, { x: 580, y: 100 });
    const snapshot = structuredClone(definition);
    for (const [index, edge] of (definition.edges ?? []).entries()) {
      const points = routeGraphEdge(definition.nodes, edge, index);
      expect(points.length).toBeGreaterThan(1);
      const targetIndex = definition.nodes.findIndex(
        (node) => node.id === edge.target,
      );
      const target = definition.nodes[targetIndex];
      expect(target).toBeDefined();
      if (target) {
        const targetPosition = graphPosition(target, targetIndex);
        const arrow = points.at(-1);
        expect(arrow).toBeDefined();
        expect(arrow?.x).toBeGreaterThanOrEqual(targetPosition.x);
        expect(arrow?.x).toBeLessThanOrEqual(targetPosition.x + 180);
        expect(arrow?.y).toBeGreaterThanOrEqual(targetPosition.y);
        expect(arrow?.y).toBeLessThanOrEqual(targetPosition.y + 64);
        expect(
          arrow?.x === targetPosition.x ||
            arrow?.x === targetPosition.x + 180 ||
            arrow?.y === targetPosition.y ||
            arrow?.y === targetPosition.y + 64,
        ).toBe(true);
      }
      for (let cursor = 1; cursor < points.length; cursor++) {
        const first = points[cursor - 1];
        const second = points[cursor];
        if (!first || !second) continue;
        for (const [nodeIndex, node] of definition.nodes.entries()) {
          if (node.id === edge.source || node.id === edge.target) continue;
          const position = graphPosition(node, nodeIndex);
          const crosses =
            first.y === second.y
              ? first.y > position.y &&
                first.y < position.y + 64 &&
                Math.max(first.x, second.x) > position.x &&
                Math.min(first.x, second.x) < position.x + 180
              : first.x > position.x &&
                first.x < position.x + 180 &&
                Math.max(first.y, second.y) > position.y &&
                Math.min(first.y, second.y) < position.y + 64;
          expect(crosses).toBe(false);
        }
      }
    }
    expect(definition).toEqual(snapshot);
  });
});
