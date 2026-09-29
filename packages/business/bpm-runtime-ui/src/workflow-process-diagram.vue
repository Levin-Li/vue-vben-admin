<script lang="ts" setup>
import type { WorkflowNodeStatus, WorkflowTaskView } from './types';

import { computed, useId } from 'vue';

import { Alert as AAlert, Empty as AEmpty } from 'ant-design-vue';

import {
  layoutWorkflowDiagram,
  workflowNodeNameLines,
  workflowNodeStatusLabels,
} from './workflow-diagram-layout';

// 只使用服务端已授权的固定版本节点和真实连线，不推断业务路由与执行结果。
const props = defineProps<{ task: WorkflowTaskView }>();
const markerId = `workflow-arrow-${useId()}`;
const layout = computed(() =>
  layoutWorkflowDiagram(
    props.task.processDiagramNodes ?? [],
    props.task.processDiagramEdges ?? [],
  ),
);
const statusKeys: WorkflowNodeStatus[] = [
  'active',
  'completed',
  'pending',
  'cancelled',
  'skipped',
];
const nodeTypeLabels: Record<string, string> = {
  start: '开始',
  userTask: '审批',
  exclusiveGateway: '条件网关',
  parallelGateway: '并行网关',
  end: '结束',
};
</script>

<template>
  <section
    class="levin-workflow-process-diagram"
    :aria-label="`${task.taskName || '流程'}流程图`"
  >
    <!-- 状态使用文字加主题语义色，取消/跳过不能伪装成已完成。 -->
    <template v-if="layout.nodes.length > 0">
      <div class="workflow-legend" aria-label="节点状态图例">
        <span
          v-for="status in statusKeys"
          :key="status"
          :class="`workflow-status-${status}`"
        >
          {{ workflowNodeStatusLabels[status] }}
        </span>
      </div>
      <AAlert
        v-if="!task.processDiagramEdges?.length"
        class="mb-3"
        type="info"
        message="服务端未提供连线，仅展示节点状态，不表示执行顺序。"
      />
      <AAlert
        v-if="layout.invalidEdgeCount"
        class="mb-3"
        type="warning"
        message="部分连线缺少对应节点，图示不完整。"
      />
      <div
        class="workflow-diagram-scroll"
        tabindex="0"
        aria-label="流程图，可横向滚动查看所有分支"
      >
        <svg
          :width="layout.width"
          :height="layout.height"
          :viewBox="`0 0 ${layout.width} ${layout.height}`"
          role="img"
          :aria-label="`${task.taskName || '流程'}的真实节点与连线`"
        >
          <defs>
            <marker
              :id="markerId"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path class="workflow-arrow" d="M 0 0 L 8 4 L 0 8 Z" />
            </marker>
          </defs>
          <!-- 先画边后画节点；折线路由保持在节点文本区域之外。 -->
          <g class="workflow-edges" fill="none">
            <path
              v-for="edge in layout.edges"
              :key="edge.id"
              :data-edge-id="edge.id"
              :data-source="edge.source"
              :data-target="edge.target"
              :d="edge.path"
              :marker-end="`url(#${markerId})`"
            />
          </g>
          <g
            v-for="node in layout.nodes"
            :key="node.id"
            :data-node-id="node.id"
            :data-status="node.status"
            :transform="`translate(${node.x},${node.y})`"
            class="workflow-node"
            :class="[`workflow-status-${node.status || 'unknown'}`]"
          >
            <title>
              {{ node.name }}：{{
                node.status ? workflowNodeStatusLabels[node.status] : '未标记'
              }}
            </title>
            <rect :width="node.width" :height="node.height" rx="8" />
            <text
              v-if="node.type"
              class="workflow-node-type"
              :x="node.width / 2"
              y="17"
              text-anchor="middle"
            >
              {{ nodeTypeLabels[node.type] || node.type }}
            </text>
            <text
              class="workflow-node-name"
              :x="node.width / 2"
              y="37"
              text-anchor="middle"
            >
              <tspan
                v-for="(line, index) in workflowNodeNameLines(node.name)"
                :key="index"
                :x="node.width / 2"
                :dy="index === 0 ? 0 : 17"
              >
                {{ line }}
              </tspan>
            </text>
            <text
              class="workflow-node-state"
              :x="node.width / 2"
              y="77"
              text-anchor="middle"
            >
              {{
                node.status ? workflowNodeStatusLabels[node.status] : '未标记'
              }}
            </text>
          </g>
        </svg>
      </div>
    </template>
    <AEmpty
      v-else
      description="服务端尚未提供可展示的流程图节点"
      :image-style="{ height: '48px' }"
    />
  </section>
</template>

<style scoped>
/* 使用框架语义变量，跟随明暗主题；图形保留真实宽度避免多分支文字被缩小。 */
.workflow-diagram-scroll {
  max-width: 100%;
  overflow: auto;
}

.workflow-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
}

.workflow-edges path {
  stroke: hsl(var(--muted-foreground));
  stroke-width: 1.5;
}

.workflow-arrow {
  fill: hsl(var(--muted-foreground));
}

.workflow-node rect {
  fill: hsl(var(--card));
  stroke: currentcolor;
  stroke-width: 1.5;
}

.workflow-node-name {
  font-size: 13px;
  fill: hsl(var(--foreground));
}

.workflow-node-type {
  font-size: 11px;
  fill: hsl(var(--muted-foreground));
}

.workflow-node-state {
  font-size: 12px;
  fill: currentcolor;
}

.workflow-status-active {
  color: hsl(var(--primary));
}

.workflow-status-completed {
  color: hsl(var(--success));
}

.workflow-status-pending,
.workflow-status-unknown {
  color: hsl(var(--muted-foreground));
}

.workflow-status-cancelled {
  color: hsl(var(--destructive));
}

.workflow-status-skipped {
  color: hsl(var(--warning));
}

.workflow-status-active rect {
  fill: hsl(var(--primary) / 8%);
  stroke-width: 2;
}

.workflow-status-cancelled rect,
.workflow-status-skipped rect {
  stroke-dasharray: 5 3;
}
</style>
