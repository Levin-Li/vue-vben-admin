<script setup lang="ts">
import type { ErrorInfo, FlowNode, NodeExecutionStatus } from './nodes/type';

import { computed, ref } from 'vue';

import TreeNode from './nodes/TreeNode.vue';

// 画布只消费宿主授权后的定义树；执行状态只能由调用方提供。
const props = withDefaults(
  defineProps<{
    bgColor?: string;
    defaultZoom?: number;
    nodeStatuses?: Readonly<Record<string, NodeExecutionStatus>>;
    process: FlowNode;
    readOnly?: boolean;
    selectedEdgeId?: string;
    selectedNodeId?: string;
  }>(),
  {
    bgColor: undefined,
    defaultZoom: 100,
    nodeStatuses: undefined,
    readOnly: false,
    selectedEdgeId: undefined,
    selectedNodeId: undefined,
  },
);

const emit = defineEmits<{
  edgeClick: [id: string];
  nodeClick: [id: string];
}>();

const zoom = ref(Math.min(170, Math.max(50, props.defaultZoom)));
const canvasStyle = computed(() => ({
  '--flow-canvas-background': props.bgColor || 'hsl(var(--background))',
  '--flow-canvas-scale': String(zoom.value / 100),
}));

// 沿用上游公开的校验入口，检查画布身份和分支结构；发布仍由服务端校验。
function validate(): Promise<true> {
  const errors: ErrorInfo[] = [];
  const visited = new Set<FlowNode>();
  const ids = new Set<string>();

  function visit(node: FlowNode): void {
    if (visited.has(node)) {
      errors.push({
        id: node.id,
        name: node.name,
        message: '流程树存在循环或重复引用',
      });
      return;
    }
    visited.add(node);
    if (!node.id || ids.has(node.id)) {
      errors.push({
        id: node.id,
        name: node.name,
        message: '节点标识为空或重复',
      });
    }
    ids.add(node.id);

    if (node.branches) {
      if (
        !['exclusiveGateway', 'parallelGateway'].includes(node.type) ||
        node.branches.length < 2
      ) {
        errors.push({
          id: node.id,
          name: node.name,
          message: '网关分支结构无效',
        });
      }
      node.branches.forEach((branch) => visit(branch));
    }
    if (node.next) visit(node.next);
  }

  visit(props.process);
  return errors.length > 0 ? Promise.reject(errors) : Promise.resolve(true);
}

defineExpose({ validate });
</script>

<template>
  <div class="flow-design-host">
    <div
      class="designer-container"
      :class="{ 'with-properties': !!$slots.properties }"
      :style="canvasStyle"
      data-flow-design
    >
      <div class="designer-main">
        <!-- 工具槽和缩放按钮使用当前主题，不加载 Element Plus。 -->
        <div class="tool"><slot></slot></div>
        <div class="zoom" role="group" aria-label="流程图缩放">
          <button
            type="button"
            aria-label="缩小流程图"
            :disabled="zoom <= 50"
            @click="zoom -= 10"
          >
            −
          </button>
          <span>{{ zoom }}%</span>
          <button
            type="button"
            aria-label="放大流程图"
            :disabled="zoom >= 170"
            @click="zoom += 10"
          >
            +
          </button>
        </div>

        <!-- 设计和运行共用同一组件；只读模式关闭选择事件。 -->
        <div class="canvas-content">
          <div class="node-container">
            <TreeNode
              :node="process"
              :read-only="readOnly"
              :selected-edge-id="selectedEdgeId"
              :selected-node-id="selectedNodeId"
              :node-statuses="nodeStatuses || {}"
              @node-click="(id) => emit('nodeClick', id)"
              @edge-click="(id) => emit('edgeClick', id)"
            />
          </div>
        </div>
      </div>

      <!-- 属性内容由宿主按授权目录提供，画布负责固定的双栏布局。 -->
      <div v-if="$slots.properties" class="designer-properties">
        <slot name="properties"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.flow-design-host {
  width: 100%;
  height: 100%;
  container-type: inline-size;
}

.designer-container {
  position: relative;
  width: 100%;
  min-height: 320px;
  height: 100%;
  overflow: auto;
  color: hsl(var(--foreground));
  background: var(--flow-canvas-background);
}

.designer-container.with-properties {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  align-items: start;
}

.designer-main {
  min-width: 0;
}

.designer-properties {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  padding: 12px;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.designer-container.with-properties .canvas-content {
  min-width: 0;
  overflow: auto;
}

@container (max-width: 800px) {
  .designer-container.with-properties {
    grid-template-columns: minmax(0, 1fr);
  }

  .designer-properties {
    grid-column: 1;
    grid-row: auto;
    border-top: 1px solid hsl(var(--border));
    border-left: 0;
  }
}

.tool {
  position: sticky;
  top: 12px;
  left: 12px;
  z-index: 5;
  width: fit-content;
}

.zoom {
  position: sticky;
  top: 12px;
  float: right;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.zoom button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: inherit;
  cursor: pointer;
}

.zoom button:hover:not(:disabled) {
  background: hsl(var(--accent));
}
.zoom button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.canvas-content {
  min-width: max-content;
  padding: 32px 48px 80px;
  clear: both;
}

.node-container {
  width: max-content;
  margin: 0 auto;
  transform: scale(var(--flow-canvas-scale));
  transform-origin: top center;
}
</style>
