import { describe, expect, it } from 'vitest';

import { graphSegmentOverlap } from './workflow-graph-layout';
import {
  graphRectsOverlap,
  layoutStateGraphRoutes,
} from './workflow-state-graph-routing';

const nodes = [
  { id: 'Draft', name: '草稿', x: 60, y: 100 },
  { id: 'Review', name: '审批', x: 380, y: 100 },
  { id: 'More', name: '补资料', x: 700, y: 100 },
  { id: 'Done', name: '完成', x: 60, y: 240 },
  { id: 'Cancel', name: '取消', x: 380, y: 240 },
];
const edges = [
  { id: 'submit', source: 'Draft', target: 'Review', label: '提交审批' },
  { id: 'more', source: 'Review', target: 'More', label: '需要补充' },
  { id: 'continue', source: 'More', target: 'Review', label: '继续审批' },
  { id: 'rewrite', source: 'Review', target: 'Draft', label: '重新填写' },
  { id: 'approve', source: 'Review', target: 'Done', label: '审批完成' },
  { id: 'cancelDraft', source: 'Draft', target: 'Cancel', label: '取消' },
  { id: 'cancelReview', source: 'Review', target: 'Cancel', label: '取消' },
  { id: 'cancelMore', source: 'More', target: 'Cancel', label: '取消' },
];

describe('状态图独立通道与事件标签', () => {
  it('双向和共享终态路线不复用共线段，保持每条真实目标', () => {
    const routes = layoutStateGraphRoutes(nodes, edges);
    expect(
      routes.map(({ id, source, target }) => ({ id, source, target })),
    ).toEqual(edges.map(({ id, source, target }) => ({ id, source, target })));
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index];
      if (!route) continue;
      expect(route.points.length).toBeGreaterThan(1);
      const target = nodes.find((node) => node.id === route.target);
      if (!target) throw new Error('测试目标不存在');
      const arrow = route.points.at(-1);
      if (!arrow) throw new Error('路线缺少箭头');
      expect(
        arrow.x >= target.x &&
          arrow.x <= target.x + 180 &&
          arrow.y >= target.y &&
          arrow.y <= target.y + 64,
      ).toBe(true);
      for (const previous of routes.slice(0, index))
        for (let a = 1; a < route.points.length; a++)
          for (let b = 1; b < previous.points.length; b++) {
            const first = route.points[a - 1];
            const second = route.points[a];
            const third = previous.points[b - 1];
            const fourth = previous.points[b];
            if (first && second && third && fourth)
              expect(
                graphSegmentOverlap(first, second, third, fourth),
                `${route.id}/${previous.id}不应共享可见线段`,
              ).toBe(0);
          }
    }
  });
  it('事件名称位于可用中段，不覆盖卡片和其它标题', () => {
    const routes = layoutStateGraphRoutes(nodes, edges);
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index];
      if (!route) continue;
      expect(route.labelRect, `${route.id}应有可见标题`).toBeDefined();
      if (!route.labelRect) continue;
      for (const node of nodes)
        expect(
          graphRectsOverlap(
            route.labelRect,
            { ...node, width: 180, height: 64 },
            0,
          ),
        ).toBe(false);
      for (const previous of routes.slice(0, index))
        if (previous.labelRect)
          expect(
            graphRectsOverlap(route.labelRect, previous.labelRect, 0),
          ).toBe(false);
    }
  });
  it('自回环绕到节点外侧，并保留真实的同状态目标', () => {
    const route = layoutStateGraphRoutes(nodes, [
      { id: 'again', source: 'Review', target: 'Review', label: '重新核验' },
    ])[0];
    expect(route?.target).toBe('Review');
    expect(route?.points.length).toBeGreaterThan(4);
    expect(route?.labelPoint).toBeDefined();
    expect(route?.points.some((point) => point.y < 100)).toBe(true);
  });
});
