import type { WorkflowDiagramEdge, WorkflowDiagramNode } from './types';

import { describe, expect, it } from 'vitest';

import {
  layoutWorkflowDiagram,
  workflowNodeNameLines,
} from './workflow-diagram-layout';

// 非拓扑顺序用于防止实现误把节点数组当成串行流程。
const nodes: WorkflowDiagramNode[] = [
  { id: 'end', name: '结束' },
  { id: 'b', name: '财务审批' },
  { id: 'start', name: '开始' },
  { id: 'join', name: '并行汇聚' },
  { id: 'a', name: '部门审批' },
  { id: 'fork', name: '并行分叉' },
];
const edges: WorkflowDiagramEdge[] = [
  { id: 'e1', source: 'start', target: 'fork' },
  { id: 'e2', source: 'fork', target: 'a' },
  { id: 'e3', source: 'fork', target: 'b' },
  { id: 'e4', source: 'a', target: 'join' },
  { id: 'e5', source: 'b', target: 'join' },
  { id: 'e6', source: 'join', target: 'end' },
];

describe('真实拓扑分层布局', () => {
  it('分支同层、汇聚在分支之后，保留真实边且不制造串行边', () => {
    const graph = layoutWorkflowDiagram(nodes, edges);
    const find = (id: string) => graph.nodes.find((node) => node.id === id);
    expect(find('a')?.y).toBe(find('b')?.y);
    expect(find('a')?.x).not.toBe(find('b')?.x);
    expect(find('join')?.y).toBeGreaterThan(find('a')?.y ?? 0);
    expect(find('end')?.y).toBeGreaterThan(find('join')?.y ?? 0);
    expect(
      graph.edges.map(({ id, source, target }) => ({ id, source, target })),
    ).toEqual(edges);
    expect(
      graph.edges.some((edge) => edge.source === 'a' && edge.target === 'b'),
    ).toBe(false);
  });

  it('相邻层、跨层和回跳连线不穿过节点内部', () => {
    const graph = layoutWorkflowDiagram(nodes, [
      ...edges,
      { id: 'skip', source: 'start', target: 'end' },
      { id: 'back', source: 'end', target: 'a' },
    ]);
    for (const edge of graph.edges) {
      for (let index = 1; index < edge.points.length; index++) {
        const a = edge.points[index - 1];
        const b = edge.points[index];
        if (!a || !b) continue;
        for (const node of graph.nodes) {
          // 边连接矩形边界，但不能进入标题/状态所在的矩形内部。
          const crosses =
            a[0] === b[0]
              ? a[0] > node.x &&
                a[0] < node.x + node.width &&
                Math.max(a[1], b[1]) > node.y &&
                Math.min(a[1], b[1]) < node.y + node.height
              : a[1] > node.y &&
                a[1] < node.y + node.height &&
                Math.max(a[0], b[0]) > node.x &&
                Math.min(a[0], b[0]) < node.x + node.width;
          expect(crosses, `${edge.id}不应穿过${node.id}`).toBe(false);
        }
      }
    }
  });

  it('无边不伪造顺序，缺失端点明确统计，长标题最多两行', () => {
    expect(layoutWorkflowDiagram(nodes, []).edges).toEqual([]);
    const graph = layoutWorkflowDiagram(nodes, [
      { id: 'invalid', source: 'start', target: 'missing' },
    ]);
    expect(graph.invalidEdgeCount).toBe(1);
    expect(graph.edges).toEqual([]);
    const lines = workflowNodeNameLines(
      '这是一个超过节点展示宽度需要换行和省略的非常长的审批节点名称',
    );
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => [...line].length <= 12)).toBe(true);
    expect(lines[1]).toContain('…');
  });
});
