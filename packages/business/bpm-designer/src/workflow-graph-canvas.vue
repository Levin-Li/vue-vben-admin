<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { graphPosition } from './workflow-graph-layout';
import { layoutStateGraphRoutes } from './workflow-state-graph-routing';

export interface GraphCanvasNode {
  id: string;
  name: string;
  stateLabel?: string;
  terminal?: boolean;
  type?:
    | 'endEvent'
    | 'exclusiveGateway'
    | 'parallelGateway'
    | 'serviceTask'
    | 'startEvent'
    | 'userTask';
  x?: number;
  y?: number;
}
export interface GraphCanvasEdge {
  id: string;
  label?: string;
  source: string;
  target: string;
}
const props = withDefaults(
  defineProps<{
    /** 只允许选择查看，不开放拖动或结构修改；运行图默认关闭。 */
    allowSelection?: boolean;
    edges: GraphCanvasEdge[];
    highlightNodeIds?: string[];
    nodes: GraphCanvasNode[];
    nodeStatuses?: Record<string, string>;
    readOnly?: boolean;
    selectedEdgeId?: string;
    selectedNodeId?: string;
  }>(),
  {
    allowSelection: false,
    readOnly: false,
    highlightNodeIds: () => [],
    nodeStatuses: () => ({}),
    selectedNodeId: undefined,
    selectedEdgeId: undefined,
  },
);
const emit = defineEmits<{
  addFrom: [id: string];
  connect: [source: string, target: string];
  edgeClick: [id: string];
  moveNode: [id: string, x: number, y: number];
  nodeClick: [id: string];
}>();
const canSelect = computed(() => !props.readOnly || props.allowSelection);
const zoom = ref(100);
const moving = ref<{
  clientX: number;
  clientY: number;
  id: string;
  pointerId: number;
  x: number;
  y: number;
}>();
// 连接手势使用画布坐标，独立于节点移动；指针捕获保证离开连接点仍可预览和取消。
const surface = ref<HTMLElement>();
const scrollViewport = ref<HTMLElement>();
const connecting = ref<{
  pointerId: number;
  source: string;
  x: number;
  y: number;
}>();
const typeLabels: Record<string, string> = {
  startEvent: '开始',
  endEvent: '结束',
  exclusiveGateway: '条件分路',
  parallelGateway: '并行分支／汇合',
  userTask: '人工办理',
  serviceTask: '自动处理',
};
function isEnd(node: GraphCanvasNode) {
  return node.terminal || node.type === 'endEvent';
}
function nodeKind(node: GraphCanvasNode) {
  if (node.type) return typeLabels[node.type];
  return node.terminal ? '结束状态' : '业务状态';
}
function pointerPoint(event: PointerEvent) {
  const rect = surface.value?.getBoundingClientRect();
  return {
    x: ((event.clientX - (rect?.left ?? 0)) * 100) / zoom.value,
    y: ((event.clientY - (rect?.top ?? 0)) * 100) / zoom.value,
  };
}
function targetAt(x: number, y: number) {
  return props.nodes.find((node) => {
    if (node.type === 'startEvent' || node.id === connecting.value?.source)
      return false;
    const point = positions.value.get(node.id);
    return (
      point &&
      x >= point.x &&
      x <= point.x + 180 &&
      y >= point.y &&
      y <= point.y + 64
    );
  });
}
const connectionTarget = computed(() =>
  connecting.value
    ? targetAt(connecting.value.x, connecting.value.y)?.id
    : undefined,
);
const previewPath = computed(() => {
  const connection = connecting.value;
  const source = connection && positions.value.get(connection.source);
  if (!connection || !source) return '';
  const x = source.x + 180;
  const y = source.y + 32;
  return `M${x},${y} L${(x + connection.x) / 2},${y} L${(x + connection.x) / 2},${connection.y} L${connection.x},${connection.y}`;
});
function beginConnect(event: PointerEvent, node: GraphCanvasNode) {
  if (props.readOnly || event.button !== 0 || isEnd(node)) return;
  moving.value = undefined;
  const point = positions.value.get(node.id)!;
  connecting.value = {
    source: node.id,
    pointerId: event.pointerId,
    x: point.x + 180,
    y: point.y + 32,
  };
  surface.value?.focus({ preventScroll: true });
  surface.value?.setPointerCapture?.(event.pointerId);
}
function updateConnection(event: PointerEvent) {
  if (!connecting.value || event.pointerId !== connecting.value.pointerId)
    return;
  if (props.readOnly || (event.buttons & 1) === 0) {
    cancelConnection();
    return;
  }
  Object.assign(connecting.value, pointerPoint(event));
}
function finishConnection(event: PointerEvent) {
  const connection = connecting.value;
  if (!connection || event.pointerId !== connection.pointerId) return;
  const point = pointerPoint(event);
  const target = targetAt(point.x, point.y);
  connecting.value = undefined;
  if (
    !props.readOnly &&
    target &&
    props.nodes.some((node) => node.id === connection.source)
  )
    emit('connect', connection.source, target.id);
}
function cancelConnection() {
  const connection = connecting.value;
  connecting.value = undefined;
  if (connection && surface.value?.hasPointerCapture?.(connection.pointerId))
    surface.value.releasePointerCapture(connection.pointerId);
}
const positions = computed(
  () =>
    new Map(
      props.nodes.map((node, index) => [
        node.id,
        graphPosition({ ...node, type: 'userTask' }, index),
      ]),
    ),
);
const routes = computed(() => layoutStateGraphRoutes(props.nodes, props.edges));
const canvasWidth = computed(() =>
  Math.max(
    700,
    ...[...positions.value.values()].map((point) => point.x + 260),
    ...routes.value.flatMap((route) =>
      route.points.map((point) => point.x + 60),
    ),
    ...routes.value.map(
      (route) => (route.labelRect?.x ?? 0) + (route.labelRect?.width ?? 0) + 30,
    ),
  ),
);
const canvasHeight = computed(() =>
  Math.max(
    420,
    ...[...positions.value.values()].map((point) => point.y + 160),
    ...routes.value.flatMap((route) =>
      route.points.map((point) => point.y + 70),
    ),
    ...routes.value.map(
      (route) =>
        (route.labelRect?.y ?? 0) + (route.labelRect?.height ?? 0) + 30,
    ),
  ),
);
// 显式适应只改变视图，保留用户存储的节点坐标；路线和标签也纳入边界。
async function fitCanvas() {
  const viewport = scrollViewport.value;
  if (
    !viewport ||
    !viewport.clientWidth ||
    !viewport.clientHeight ||
    props.nodes.length === 0
  )
    return;
  cancelConnection();
  moving.value = undefined;
  const rectangles = [...positions.value.values()].map((point) => ({
    ...point,
    width: 180,
    height: 94,
  }));
  for (const route of routes.value) {
    rectangles.push(
      ...route.points.map((point) => ({ ...point, width: 0, height: 0 })),
    );
    if (route.labelRect) rectangles.push(route.labelRect);
  }
  const left = Math.min(...rectangles.map((rect) => rect.x));
  const top = Math.min(...rectangles.map((rect) => rect.y));
  const width =
    Math.max(...rectangles.map((rect) => rect.x + rect.width)) - left + 48;
  const height =
    Math.max(...rectangles.map((rect) => rect.y + rect.height)) - top + 48;
  const visibleHeight = Math.min(
    viewport.clientHeight,
    Math.max(1, window.innerHeight - viewport.getBoundingClientRect().top - 24),
  );
  zoom.value = Math.max(
    10,
    Math.min(
      100,
      Math.floor(
        Math.min(viewport.clientWidth / width, visibleHeight / height) * 100,
      ),
    ),
  );
  await nextTick();
  viewport.scrollLeft = Math.max(0, ((left - 24) * zoom.value) / 100);
  viewport.scrollTop = Math.max(0, ((top - 24) * zoom.value) / 100);
}
function resetZoom() {
  cancelConnection();
  moving.value = undefined;
  zoom.value = 100;
  if (scrollViewport.value) {
    scrollViewport.value.scrollLeft = 0;
    scrollViewport.value.scrollTop = 0;
  }
}
const statusLabels: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  pending: '待执行',
  skipped: '已跳过',
  cancelled: '已取消',
};
function beginMove(event: PointerEvent, node: GraphCanvasNode) {
  if (props.readOnly || event.button !== 0) return;
  const point = positions.value.get(node.id)!;
  moving.value = {
    id: node.id,
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    ...point,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  const start = moving.value;
  if (!start || props.readOnly) return;
  if ((event.buttons & 1) === 0) {
    moving.value = undefined;
    return;
  }
  if (event.pointerId !== start.pointerId) return;
  const dx = event.clientX - start.clientX;
  const dy = event.clientY - start.clientY;
  // 点击、响应式布局和失去捕获后的悬停不是拖动，不将缺省坐标写入版本。
  if (Math.hypot(dx, dy) < 4) return;
  const x = Math.max(30, Math.round(start.x + (dx * 100) / zoom.value));
  const y = Math.max(40, Math.round(start.y + (dy * 100) / zoom.value));
  const current = positions.value.get(start.id);
  if (current?.x === x && current.y === y) return;
  emit('moveNode', start.id, x, y);
}
watch(
  () => props.readOnly,
  () => {
    moving.value = undefined;
    cancelConnection();
  },
);
</script>

<template>
  <!-- 一个节点只绘制一次，所有真实路线引用同一身份，允许共享目标及回环。 -->
  <section
    class="graph-host"
    :class="{ inspectable: readOnly && allowSelection, selectable: canSelect }"
    aria-label="工作流状态图"
  >
    <div class="graph-controls" aria-label="流程图缩放">
      <slot></slot>
      <button
        type="button"
        aria-label="缩小流程图"
        :disabled="zoom <= 10"
        @click="zoom = Math.max(10, zoom - 10)"
      >
        −
      </button>
      <span>{{ zoom }}%</span>
      <button
        type="button"
        aria-label="放大流程图"
        :disabled="zoom >= 170"
        @click="zoom = Math.min(170, zoom + 10)"
      >
        ＋
      </button>
      <button
        type="button"
        aria-label="适应画布"
        title="缩放以查看全部步骤和路线"
        @click="fitCanvas"
      >
        适应画布
      </button>
      <button
        type="button"
        aria-label="恢复100%比例"
        title="恢复原始比例，清晰编辑"
        @click="resetZoom"
      >
        恢复100%
      </button>
    </div>
    <div
      ref="scrollViewport"
      class="graph-scroll"
      tabindex="0"
      aria-label="状态图，可滚动查看所有状态和路线"
    >
      <div
        :style="{
          width: `${(canvasWidth * zoom) / 100}px`,
          height: `${(canvasHeight * zoom) / 100}px`,
        }"
      >
        <div
          ref="surface"
          class="graph-surface"
          tabindex="-1"
          @pointermove="updateConnection"
          @pointerup="finishConnection"
          @pointercancel="cancelConnection"
          @lostpointercapture="cancelConnection"
          @keydown.esc.prevent="cancelConnection"
          :style="{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${zoom / 100})`,
          }"
        >
          <svg
            class="graph-lines"
            :width="canvasWidth"
            :height="canvasHeight"
            role="group"
            aria-label="流转路线"
          >
            <defs>
              <marker
                id="workflow-state-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            <path
              v-if="connecting"
              class="connection-preview"
              :d="previewPath"
              marker-end="url(#workflow-state-arrow)"
            />
            <g
              v-for="edge in routes"
              :key="edge.id"
              :class="{ selected: selectedEdgeId === edge.id }"
              :data-edge-id="edge.id"
            >
              <path
                :d="edge.path"
                class="visible-edge"
                marker-end="url(#workflow-state-arrow)"
              />
              <path
                :d="edge.path"
                class="edge-hit"
                :tabindex="canSelect ? 0 : undefined"
                :role="canSelect ? 'button' : undefined"
                :aria-label="`${readOnly ? '查看路线' : '配置路线'} ${edge.label || edge.id}`"
                @click="canSelect && emit('edgeClick', edge.id)"
                @keydown.enter="canSelect && emit('edgeClick', edge.id)"
              />
              <text
                v-if="edge.labelPoint"
                :x="edge.labelPoint.x"
                :y="edge.labelPoint.y"
                text-anchor="middle"
                @click="canSelect && emit('edgeClick', edge.id)"
              >
                {{ edge.label }}
              </text>
            </g>
          </svg>
          <article
            v-for="node in nodes"
            :key="node.id"
            :data-node-id="node.id"
            class="graph-node"
            :class="[
              {
                selected: selectedNodeId === node.id,
                terminal: isEnd(node),
                highlighted: highlightNodeIds.includes(node.id),
                'connection-target': connectionTarget === node.id,
                gateway:
                  node.type === 'exclusiveGateway' ||
                  node.type === 'parallelGateway',
                event: node.type === 'startEvent' || node.type === 'endEvent',
              },
              node.type,
              nodeStatuses[node.id],
            ]"
            :style="{
              left: `${positions.get(node.id)?.x}px`,
              top: `${positions.get(node.id)?.y}px`,
            }"
          >
            <button
              class="node-select"
              type="button"
              :title="node.stateLabel || node.name"
              :aria-label="`${readOnly ? '查看' : '配置'}${node.type ? '节点' : '状态'} ${node.name}`"
              :disabled="!canSelect"
              @click="canSelect && emit('nodeClick', node.id)"
              @pointerdown="beginMove($event, node)"
              @pointermove="move"
              @pointerup="moving = undefined"
              @pointercancel="moving = undefined"
              @lostpointercapture="moving = undefined"
            >
              <span class="node-label">
                {{ nodeKind(node)
                }}{{
                  node.stateLabel && node.stateLabel !== node.name
                    ? ` · ${node.stateLabel}`
                    : ''
                }}
                <span v-if="nodeStatuses[node.id]">
                  ·
                  {{
                    statusLabels[nodeStatuses[node.id]!] ||
                    nodeStatuses[node.id]
                  }}
                </span>
              </span>
              <strong>{{ node.name }}</strong>
            </button>
            <button
              v-if="!readOnly && !isEnd(node)"
              class="connect-port"
              type="button"
              :aria-label="`从 ${node.name} 拖线连接节点`"
              title="拖到另一个节点，创建流转路线"
              @pointerdown.stop.prevent="beginConnect($event, node)"
            >
              ↗
            </button>
            <button
              v-if="!readOnly && !isEnd(node)"
              class="add-node"
              type="button"
              :aria-label="`从 ${node.name} 添加路线`"
              @click="emit('addFrom', node.id)"
            >
              ＋
            </button>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 状态画布采用宿主颜色，画布和属性栏分别滚动以保持主要操作可达。 */
.graph-host {
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
  background: hsl(var(--background));
}
.graph-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}
.graph-controls button {
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
  padding: 3px 9px;
}
.graph-scroll {
  overflow: auto;
  max-height: 72vh;
  min-height: 420px;
  background-image: radial-gradient(hsl(var(--border)) 1px, transparent 1px);
  background-size: 18px 18px;
}
.graph-surface {
  position: relative;
  transform-origin: top left;
}
.graph-lines {
  position: absolute;
  inset: 0;
  overflow: visible;
}
.visible-edge {
  fill: none;
  stroke: hsl(var(--muted-foreground));
  stroke-width: 1.6;
}
.graph-lines marker path {
  fill: hsl(var(--muted-foreground));
}
.edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 18px;
  cursor: default;
}
.selectable .edge-hit {
  cursor: pointer;
}
.graph-lines text {
  font-size: 12px;
  fill: hsl(var(--foreground));
  paint-order: stroke;
  stroke: hsl(var(--background));
  stroke-width: 5px;
  cursor: pointer;
}
.graph-lines .selected .visible-edge {
  stroke: hsl(var(--primary));
  stroke-width: 3;
}
.graph-node {
  position: absolute;
  width: 180px;
  height: 64px;
  box-sizing: border-box;
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  background: hsl(var(--card));
  box-shadow: 0 2px 6px hsl(var(--foreground) / 0.06);
}
.graph-node.selected,
.graph-node.active {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
}
.graph-node.terminal {
  border-style: double;
  border-width: 3px;
}
.node-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 9px 12px;
  color: hsl(var(--foreground));
  text-align: left;
  background: transparent;
  touch-action: none;
  cursor: grab;
}
.inspectable .node-select {
  cursor: pointer;
  touch-action: auto;
}
.node-select:disabled {
  cursor: default;
  opacity: 1;
}
.node-label {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 14px;
}
strong {
  font-size: 14px;
  line-height: 20px;
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.add-node {
  position: absolute;
  right: -13px;
  top: 20px;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
/* 开始／结束使用圆角事件形状；菱形底板保留完整文字和稳定的线路边界。 */
.graph-node.event {
  border-radius: 32px;
}
.graph-node.gateway {
  background: transparent;
  border: 0;
  box-shadow: none;
}
.graph-node.gateway::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  background: hsl(var(--border));
}
.graph-node.gateway::after {
  content: '';
  position: absolute;
  inset: 1px;
  z-index: 0;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  background: hsl(var(--card));
  pointer-events: none;
}
.graph-node.gateway .node-select {
  position: relative;
  z-index: 1;
  padding-inline: 40px;
  text-align: center;
  align-items: center;
}
.graph-node.gateway.selected::before,
.graph-node.gateway.active::before {
  background: hsl(var(--primary));
}
.graph-node.highlighted,
.graph-node.connection-target {
  outline: 2px dashed hsl(var(--primary));
  outline-offset: 5px;
}
.connect-port {
  position: absolute;
  right: -9px;
  top: 23px;
  z-index: 2;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: hsl(var(--background));
  color: hsl(var(--primary));
  border: 2px solid hsl(var(--primary));
  cursor: crosshair;
  touch-action: none;
  font-size: 11px;
  line-height: 12px;
}
.add-node {
  top: 68px;
  right: 77px;
}
.connection-preview {
  fill: none;
  stroke: hsl(var(--primary));
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}
button:focus-visible,
.edge-hit:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>
