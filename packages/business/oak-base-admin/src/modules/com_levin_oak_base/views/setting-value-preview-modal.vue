<script lang="ts" setup>
import { computed } from 'vue';

import { Empty, Modal } from 'ant-design-vue';

import { formatSettingValuePreview } from './setting-for-tenant/setting-for-tenant';

const props = defineProps<{
  open: boolean;
  title: string;
  value: unknown;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
}>();

const modalBodyStyle = {
  maxHeight: 'calc(100vh - 160px)',
  overflowY: 'auto',
};

const displayValue = computed(() => formatSettingValuePreview(props.value));
const hasValue = computed(() => displayValue.value !== '-');
</script>

<template>
  <Modal
    destroy-on-close
    :footer="null"
    :open="open"
    :body-style="modalBodyStyle"
    :title="title"
    :width="'min(82vw, 1480px)'"
    @update:open="emit('update:open', $event)"
  >
    <div class="setting-value-preview-modal">
      <div class="text-foreground text-sm font-medium">值</div>
      <pre v-if="hasValue" class="setting-value-preview-modal__content">{{
        displayValue
      }}</pre>
      <Empty v-else description="暂无值" />
    </div>
  </Modal>
</template>

<style scoped>
.setting-value-preview-modal {
  display: grid;
  width: 100%;
  gap: 8px;
}

.setting-value-preview-modal__content {
  min-height: 360px;
  max-height: calc(100vh - 260px);
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
