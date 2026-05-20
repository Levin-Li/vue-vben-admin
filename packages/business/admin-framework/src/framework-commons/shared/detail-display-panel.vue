<script setup lang="ts">
import type { DetailDisplayEntry } from './detail-display';
import type { CrudFieldConfig } from './types';

import { ref } from 'vue';

import { JsonViewer } from '@vben/common-ui';

import { Button, Input, Modal } from 'ant-design-vue';

import {
  formatDetailDisplayValue,
  formatDetailJsonText,
  isDetailJsonValue,
} from './detail-display';

const props = defineProps<{
  entries: DetailDisplayEntry[];
}>();

const jsonViewerOpen = ref(false);
const jsonViewerTitle = ref('');
const jsonViewerValue = ref<any>(null);

function isLargeDisplayField(field: CrudFieldConfig | undefined, value: any) {
  if (!field) {
    return value && typeof value === 'object';
  }

  return (
    field.fullRow ||
    field.span === -1 ||
    field.type === 'textarea' ||
    field.type === 'string-array' ||
    field.type === 'tags' ||
    field.type === 'code' ||
    field.type === 'css' ||
    field.type === 'html' ||
    field.type === 'json'
  );
}

function shouldSpanFullRow(entry: DetailDisplayEntry) {
  return isLargeDisplayField(entry.field, entry.value);
}

function openJsonViewer(entry: DetailDisplayEntry) {
  jsonViewerTitle.value = entry.label;
  jsonViewerValue.value = entry.value;
  jsonViewerOpen.value = true;
}
</script>

<template>
  <div class="grid max-h-[72vh] gap-4 overflow-auto pr-1 md:grid-cols-2">
    <div
      v-for="entry in props.entries"
      :key="entry.key"
      class="border-border bg-muted/30 rounded-lg border p-4"
      :class="{
        'md:col-span-2': shouldSpanFullRow(entry),
      }"
      data-test="detail-display-entry"
    >
      <div class="mb-2 text-sm font-medium">
        {{ entry.label }}
      </div>
      <div v-if="isDetailJsonValue(entry)" class="flex gap-2">
        <Input.TextArea
          :auto-size="{ minRows: 1 }"
          class="flex-1"
          readonly
          :value="formatDetailJsonText(entry.value)"
        />
        <Button @click="openJsonViewer(entry)">查看 JSON</Button>
      </div>
      <div
        v-else-if="shouldSpanFullRow(entry)"
        class="bg-background rounded p-3 text-sm leading-6"
      >
        <pre class="whitespace-pre-wrap break-words">{{
          formatDetailDisplayValue(entry)
        }}</pre>
      </div>
      <div v-else class="break-all text-sm">
        {{ formatDetailDisplayValue(entry) }}
      </div>
    </div>
  </div>

  <Modal
    v-model:open="jsonViewerOpen"
    :footer="null"
    :title="jsonViewerTitle"
    width="min(82vw, 1280px)"
  >
    <div class="max-h-[70vh] overflow-auto">
      <JsonViewer
        boxed
        copyable
        expanded
        :expand-depth="3"
        :value="jsonViewerValue"
      />
    </div>
  </Modal>
</template>
