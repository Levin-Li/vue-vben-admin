<script lang="ts" setup>
import type { WorkflowNodeStatus, WorkflowTaskView } from './types';

import { computed } from 'vue';

import {
  layoutTaskGraph,
  LowflowFlowDesign,
  toLowflowRuntimeTree,
  WorkflowGraphCanvas,
} from '@levin/bpm-designer';
import { Alert as AAlert, Empty as AEmpty } from 'ant-design-vue';

import { workflowNodeStatusLabels } from './workflow-diagram-layout';

// 只从服务端已授权的固定版本投影构建只读图，不加载设计权限或条件正文。
const props = defineProps<{
  task: Partial<
    Pick<
      WorkflowTaskView,
      | 'processDiagramEdges'
      | 'processDiagramNodes'
      | 'processSchemaVersion'
      | 'taskId'
      | 'taskName'
    >
  >;
}>();
const statusKeys: WorkflowNodeStatus[] = [
  'active',
  'completed',
  'pending',
  'cancelled',
  'skipped',
];
const nodes = computed(() => props.task.processDiagramNodes ?? []);
const edges = computed(() => props.task.processDiagramEdges ?? []);
const nodeStatuses = computed(() =>
  Object.fromEntries(
    nodes.value.flatMap((node) =>
      node.status ? [[node.id, node.status] as const] : [],
    ),
  ),
);

// 状态节点由服务端固定图标识，不按连线形状猜测协议，也不索取完整设计配置。
const isStateGraph = computed(
  () =>
    nodes.value.length > 0 &&
    nodes.value.every((node) => node.type === 'state'),
);

// 服务端可序列化null；只展示有限非负整数，不将空投影当作进度。
function isProgressCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

// 第五版直接保留任务拓扑，仅适配画布事件图形，不隐式改写固定版本。
const isTaskGraph = computed(() => props.task.processSchemaVersion === 5);
// 无坐标的运行投影复用设计期拓扑布局；仅改展示克隆，已有位置保持原值。
const displayNodes = computed(() => {
  const copies = nodes.value.map((node) => ({ ...node }));
  if (!isTaskGraph.value) return copies;
  const layout = layoutTaskGraph({
    nodes: copies,
    edges: edges.value.map((edge) => ({ ...edge })),
  });
  return layout.nodes.map((node, index) => ({
    ...node,
    x: Number.isFinite(nodes.value[index]?.x) ? nodes.value[index]?.x : node.x,
    y: Number.isFinite(nodes.value[index]?.y) ? nodes.value[index]?.y : node.y,
  }));
});
const canvasNodes = computed(() =>
  displayNodes.value.map((node) => {
    let type = node.type;
    if (type === 'start') type = 'startEvent';
    if (type === 'end') type = 'endEvent';
    const canvasType = [
      'endEvent',
      'exclusiveGateway',
      'parallelGateway',
      'serviceTask',
      'startEvent',
      'userTask',
    ].includes(type ?? '')
      ? (type as
          | 'endEvent'
          | 'exclusiveGateway'
          | 'parallelGateway'
          | 'serviceTask'
          | 'startEvent'
          | 'userTask')
      : undefined;
    const progress =
      isProgressCount(node.completedCount) && isProgressCount(node.totalCount)
        ? `已完成 ${node.completedCount}／${node.totalCount}`
        : '';
    const waiting =
      isProgressCount(node.waitingCount) && node.waitingCount > 0
        ? `等待 ${node.waitingCount} ${node.type === 'parallelGateway' ? '条分支' : '人办理'}`
        : '';
    return {
      ...node,
      type: canvasType,
      stateLabel: [progress, waiting].filter(Boolean).join(' · '),
    };
  }),
);

// 缺少连线或图结构异常时只展示事实列表，不能推断一条不存在的执行路径。
const diagram = computed(() => {
  if (
    isTaskGraph.value ||
    isStateGraph.value ||
    nodes.value.length === 0 ||
    edges.value.length === 0
  )
    return { tree: null, error: '' };
  try {
    return {
      tree: toLowflowRuntimeTree(nodes.value, edges.value),
      error: '',
    };
  } catch (error) {
    return {
      tree: null,
      error: error instanceof Error ? error.message : '流程图结构不可展示',
    };
  }
});
</script>

<template>
  <section
    class="levin-workflow-process-diagram"
    :aria-label="`${task.taskName || '流程'}流程图`"
  >
    <template v-if="nodes.length > 0">
      <!-- 图例和状态文字保持一致；颜色不是唯一的状态传达方式。 -->
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
        v-if="edges.length === 0"
        class="mb-3"
        type="info"
        message="服务端未提供连线，仅展示节点状态，不表示执行顺序。"
      />
      <AAlert
        v-else-if="diagram.error"
        class="mb-3"
        type="warning"
        :message="`服务端流程图结构不完整：${diagram.error}`"
      />

      <!-- 第四版直接展示服务端授权图，多入边和回环保留原节点身份。 -->
      <WorkflowGraphCanvas
        v-if="isStateGraph || isTaskGraph"
        :nodes="canvasNodes"
        :edges="edges"
        :node-statuses="nodeStatuses"
        :read-only="true"
      />

      <!-- 第三版继续按其固定树协议展示，不进行隐式格式转换。 -->
      <div
        v-else-if="diagram.tree"
        class="workflow-diagram-scroll"
        tabindex="0"
        aria-label="流程图，可横向滚动查看所有分支"
      >
        <p class="workflow-diagram-hint">
          流程图较宽时，可横向滚动查看全部分支。
        </p>
        <LowflowFlowDesign
          :process="diagram.tree"
          :node-statuses="nodeStatuses"
          :read-only="true"
        />
      </div>

      <!-- 不完整投影的兜底只列事实，不显示推断的箭头或节点顺序。 -->
      <ul v-else class="workflow-node-list" aria-label="流程节点状态">
        <li
          v-for="node in nodes"
          :key="node.id"
          :data-node-id="node.id"
          :data-status="node.status"
        >
          {{ node.name }}：{{
            node.status ? workflowNodeStatusLabels[node.status] : '未标记'
          }}
        </li>
      </ul>
    </template>
    <AEmpty
      v-else
      description="服务端尚未提供可展示的流程图节点"
      :image-style="{ height: '48px' }"
    />
  </section>
</template>

<style scoped>
.workflow-diagram-scroll {
  max-width: 100%;
  overflow: auto;
}

.workflow-diagram-hint {
  margin-bottom: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.workflow-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
}

.workflow-node-list {
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  color: hsl(var(--foreground));
}

.workflow-status-active {
  color: hsl(var(--primary));
}
.workflow-status-completed {
  color: hsl(var(--success));
}
.workflow-status-pending {
  color: hsl(var(--muted-foreground));
}
.workflow-status-cancelled {
  color: hsl(var(--destructive));
}
.workflow-status-skipped {
  color: hsl(var(--warning));
}
</style>
