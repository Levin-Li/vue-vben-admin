<script setup lang="ts" name="TreeNode">
import type { FlowNode, NodeExecutionStatus } from './type';

import { computed } from 'vue';

const props = defineProps<{
  node: FlowNode;
  nodeStatuses: Readonly<Record<string, NodeExecutionStatus>>;
  readOnly?: boolean;
  selectedEdgeId?: string;
  selectedNodeId?: string;
}>();

const emit = defineEmits<{
  edgeClick: [id: string];
  nodeClick: [id: string];
}>();

const typeNames: Record<FlowNode['type'], string> = {
  start: '开始',
  userTask: '用户任务',
  exclusiveGateway: '排他网关',
  parallelGateway: '并行网关',
  condition: '条件分支',
  end: '结束',
  approval: '审批',
  cc: '抄送',
  exclusive: '排他网关',
  timer: '等待',
  notify: '通知',
  service: '服务任务',
};

// 合成连线卡片沿用上游 condition 类型，但按其真实网关区分排他与并行语义。
const typeName = computed(() =>
  props.node.type === 'condition' && props.node.branchKind === 'parallel'
    ? '并行支路'
    : typeNames[props.node.type],
);

const statusNames: Record<NodeExecutionStatus, string> = {
  active: '进行中',
  completed: '已完成',
  pending: '待执行',
  cancelled: '已取消',
  skipped: '已跳过',
};

// 条件内容只提示是否配置；运行图不暴露可能含业务数据的条件正文。
const description = computed(() => {
  if (props.node.type === 'condition') {
    if (props.node.branchKind === 'parallel') return '并行执行';
    if (props.node.default) return '默认分支';
    return props.node.condition ? '已设置条件' : '分支';
  }
  return '';
});

const status = computed(() => props.nodeStatuses[props.node.id]);
const edgeId = computed(() => props.node.nextEdgeId);
const hasOutgoing = computed(() =>
  Boolean(props.node.next || props.node.nextTargetId),
);

function selectNode(): void {
  if (props.readOnly) return;
  if (props.node.type === 'condition') selectEdge(props.node.edgeId);
  else emit('nodeClick', props.node.id);
}

function selectEdge(id: string | undefined): void {
  if (!props.readOnly && id) emit('edgeClick', id);
}
</script>

<template>
  <div class="flow-segment">
    <!-- 节点 ID 原样保留；合成条件分支使用 branch:edgeId 身份。 -->
    <article
      class="flow-node"
      :class="[
        `type-${node.type}`,
        status && `status-${status}`,
        {
          selectable: !readOnly && (node.type !== 'condition' || !!node.edgeId),
          selected:
            !readOnly &&
            (node.type === 'condition'
              ? selectedEdgeId === node.edgeId
              : selectedNodeId === node.id),
        },
      ]"
      :data-node-id="node.id"
      :data-status="status"
      :aria-label="
        readOnly
          ? undefined
          : node.type === 'condition'
            ? `配置连线 ${node.edgeId}`
            : `配置节点 ${node.name}`
      "
      :role="
        readOnly || (node.type === 'condition' && !node.edgeId)
          ? undefined
          : 'button'
      "
      :tabindex="
        readOnly || (node.type === 'condition' && !node.edgeId) ? undefined : 0
      "
      :aria-pressed="
        readOnly
          ? undefined
          : node.type === 'condition'
            ? selectedEdgeId === node.edgeId
            : selectedNodeId === node.id
      "
      @click="selectNode"
      @keydown.enter="selectNode"
      @keydown.space.prevent="selectNode"
    >
      <div class="node-topline">
        <span>{{ typeName }}</span>
        <span v-if="status" class="execution-status">{{
          statusNames[status]
        }}</span>
      </div>
      <strong class="node-name">{{ node.name || typeName }}</strong>
      <small v-if="description" class="node-description">{{
        description
      }}</small>
    </article>

    <!-- 分支和汇聚仅展示输入的树形拓扑，不推导执行路径。 -->
    <div
      v-if="node.branches?.length"
      class="branch-layout"
      :data-join-id="node.joinId"
    >
      <div class="fork-stem" aria-hidden="true"></div>
      <div class="branch-grid">
        <div
          v-for="branch in node.branches"
          :key="branch.id"
          class="branch-column"
        >
          <button
            v-if="branch.edgeId"
            class="branch-edge"
            type="button"
            :data-edge-id="branch.edgeId"
            :disabled="readOnly"
            :aria-pressed="
              readOnly ? undefined : selectedEdgeId === branch.edgeId
            "
            :aria-label="`选择连线 ${branch.edgeId}`"
            @click="selectEdge(branch.edgeId)"
          >
            <span aria-hidden="true">↓</span>
          </button>
          <TreeNode
            :node="branch"
            :read-only="readOnly"
            :selected-edge-id="selectedEdgeId"
            :selected-node-id="selectedNodeId"
            :node-statuses="nodeStatuses"
            @node-click="(id) => emit('nodeClick', id)"
            @edge-click="(id) => emit('edgeClick', id)"
          />
        </div>
      </div>
      <div class="join-stem" aria-hidden="true"></div>
    </div>

    <!-- 分支末端到汇聚点只有连线，真实汇聚节点在网关 next 中渲染一次。 -->
    <button
      v-if="hasOutgoing && edgeId"
      class="flow-connector"
      type="button"
      :data-edge-id="edgeId"
      :disabled="readOnly"
      :aria-pressed="readOnly ? undefined : selectedEdgeId === edgeId"
      :aria-label="`选择连线 ${edgeId}`"
      @click="selectEdge(edgeId)"
    >
      <span aria-hidden="true">↓</span>
    </button>
    <div v-else-if="node.next" class="flow-connector plain" aria-hidden="true">
      ↓
    </div>

    <TreeNode
      v-if="node.next"
      :node="node.next"
      :read-only="readOnly"
      :selected-edge-id="selectedEdgeId"
      :selected-node-id="selectedNodeId"
      :node-statuses="nodeStatuses"
      @node-click="(id) => emit('nodeClick', id)"
      @edge-click="(id) => emit('edgeClick', id)"
    />
  </div>
</template>

<style scoped lang="scss">
.flow-segment {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;
}

.flow-node {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 212px;
  min-height: 76px;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  box-shadow: 0 2px 8px hsl(var(--foreground) / 0.08);
  box-sizing: border-box;
}

.flow-node.selectable {
  cursor: pointer;
}
.flow-node.selectable:hover,
.flow-node.selectable:focus-visible {
  border-color: hsl(var(--primary));
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.flow-node.selected {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.22);
}

.flow-node.type-exclusiveGateway,
.flow-node.type-parallelGateway,
.flow-node.type-exclusive {
  border-style: dashed;
}
.flow-node.status-active {
  border-color: hsl(var(--primary));
}
.flow-node.status-completed {
  border-color: hsl(var(--success));
}
.flow-node.status-cancelled {
  border-color: hsl(var(--destructive));
}
.flow-node.status-skipped {
  border-color: hsl(var(--warning));
}

.node-topline {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}
.execution-status {
  color: hsl(var(--primary));
}
.node-name {
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
}
.node-description {
  color: hsl(var(--muted-foreground));
}

.branch-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fork-stem,
.join-stem {
  height: 22px;
  width: 1px;
  background: hsl(var(--border));
}
.branch-grid {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 32px;
  padding: 0 16px;
}
.branch-grid::before,
.branch-grid::after {
  content: '';
  position: absolute;
  left: calc(16px + 106px);
  right: calc(16px + 106px);
  height: 1px;
  background: hsl(var(--border));
}
.branch-grid::before {
  top: 0;
}
.branch-grid::after {
  bottom: 0;
}
.branch-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 212px;
}
.branch-column::after {
  content: '';
  flex: 1;
  min-height: 22px;
  width: 1px;
  background: hsl(var(--border));
}
.branch-edge,
.flow-connector {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-height: 36px;
  border: 0;
  padding: 0;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}
.branch-edge::before,
.flow-connector::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: hsl(var(--border));
}
.branch-edge:disabled,
.flow-connector:disabled {
  cursor: default;
}
.branch-edge span,
.flow-connector span {
  position: relative;
  margin-top: 28px;
  background: var(--flow-canvas-background);
}
.branch-edge:not(:disabled):hover,
.flow-connector:not(:disabled):hover {
  color: hsl(var(--primary));
}
.branch-edge:not(:disabled):hover::before,
.flow-connector:not(:disabled):hover::before {
  background: hsl(var(--primary));
}
.flow-connector.plain {
  color: hsl(var(--muted-foreground));
}
</style>
