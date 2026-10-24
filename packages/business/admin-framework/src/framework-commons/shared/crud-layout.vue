<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Form } from 'ant-design-vue';

import { getContainerColumnCount } from './crud-form-layout';

import './crud-layout.css';

// 专用业务列表只复用布局；字段、权限、查询与分页均由页面明确提供。
defineProps<{ formId: string; formName: string }>();
const queryPanel = ref<HTMLElement>();
const containerWidth = ref(0);
const columns = computed(() => getContainerColumnCount(containerWidth.value));
let observer: ResizeObserver | undefined;
onMounted(() => {
  const element = queryPanel.value;
  if (!element) return;
  containerWidth.value = element.clientWidth;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([entry]) => {
      if (entry) containerWidth.value = entry.contentRect.width;
    });
    observer.observe(element);
  }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="vben-crud-layout flex min-w-0 flex-col gap-2">
    <section v-if="$slots.query" class="vben-crud-section">
      <div ref="queryPanel">
        <Form
          :name="formId"
          :data-form-id="formId"
          :data-form-name="formName"
          :label-col="{ style: { width: '88px' } }"
          class="vben-crud-layout-query"
          layout="horizontal"
          @submit.prevent
        >
          <div
            class="grid gap-4"
            :style="{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }"
          >
            <slot name="query"></slot>
            <div
              v-if="$slots['query-actions']"
              class="vben-crud-layout-actions"
            >
              <slot name="query-actions"></slot>
            </div>
          </div>
        </Form>
      </div>
      <div v-if="$slots.notice" class="text-muted-foreground mt-3 text-sm">
        <slot name="notice"></slot>
      </div>
    </section>
    <section v-if="$slots.default || $slots.toolbar" class="vben-crud-section">
      <div v-if="$slots.toolbar" class="mb-3 flex flex-wrap items-center gap-2">
        <slot name="toolbar"></slot>
      </div>
      <div class="vben-crud-table min-w-0 overflow-x-auto">
        <slot></slot>
      </div>
      <div v-if="$slots.footer" class="my-3 flex flex-wrap justify-end gap-2">
        <slot name="footer"></slot>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 阻止表格最小宽度传给页面祖先；宽表只在列表内部滚动。 */
.vben-crud-layout {
  width: 100%;
  contain: inline-size;
}

/* 插槽字段遵守标准查询的横向标签、单元格宽度与16px间距。 */
.vben-crud-layout-query :deep(.ant-form-item) {
  min-width: 0;
  margin-bottom: 0;
}

.vben-crud-layout-query :deep(.ant-form-item-row) {
  flex-wrap: nowrap;
}

.vben-crud-layout-query :deep(.ant-form-item-control) {
  flex: 1;
  min-width: 0;
}

.vben-crud-layout-query :deep(.ant-form-item-label) {
  flex: 0 0 88px;
  padding: 0;
}

.vben-crud-layout-actions {
  display: flex;
  flex-wrap: wrap;
  grid-column: -2 / -1;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-height: 32px;
}
</style>
