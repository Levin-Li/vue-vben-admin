<script setup lang="ts">
import type { DetailDisplayEntry } from './detail-display';
import type { CrudFieldConfig } from './types';

import { computed, reactive, ref } from 'vue';

import { JsonViewer } from '@vben/common-ui';

import { Button, Modal, QRCode, Tooltip } from 'ant-design-vue';

import { DEFAULT_CONTENT_MODAL_BODY_STYLE } from './config-helpers';

import {
  formatDetailDisplayValue,
  formatDetailJsonText,
  isDetailJsonValue,
} from './detail-display';
import { CRUD_TOOLTIP_MOUSE_ENTER_DELAY } from './crud-tooltip-preview';

const props = defineProps<{
  entries: DetailDisplayEntry[];
}>();

const jsonViewerOpen = ref(false);
const jsonViewerTitle = ref('');
const jsonViewerValue = ref<any>(null);
const collapsedGroups = reactive<Record<string, boolean>>({});

const sections = computed(() => {
  const values: Array<{ entries: DetailDisplayEntry[]; key: string; title?: string }> = [];
  const byKey = new Map<string, (typeof values)[number]>();
  for (const entry of props.entries) {
    const group = entry.field?.displayGroup;
    const key = group?.key || '__ungrouped';
    let section = byKey.get(key);
    if (!section) {
      section = { entries: [], key, title: group?.title };
      byKey.set(key, section);
      values.push(section);
      if (group) collapsedGroups[key] = group.defaultExpanded === false;
    }
    section.entries.push(entry);
  }
  return values;
});

function toggleGroup(key: string) {
  collapsedGroups[key] = !collapsedGroups[key];
}

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
    field.type === 'json' ||
    field.type === 'qrcode'
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

function getDisplayText(entry: DetailDisplayEntry) {
  return formatDetailDisplayValue(entry);
}
</script>

<template>
  <div class="max-h-[72vh] space-y-5 overflow-auto pr-1">
    <section v-for="section in sections" :key="section.key">
      <div v-if="section.title" class="bg-muted/45 mb-3 flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold">
        <span>{{ section.title }}</span>
        <Button type="link" size="small" @click="toggleGroup(section.key)">
          {{ collapsedGroups[section.key] ? '展开' : '收起' }}
        </Button>
      </div>
      <div v-show="!collapsedGroups[section.key]" class="grid gap-4 md:grid-cols-2">
        <div
          v-for="entry in section.entries"
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
        <Tooltip
          :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
          :overlay-class-name="'crud-detail-display-tooltip'"
          :title="getDisplayText(entry)"
        >
          <pre
            class="bg-background line-clamp-2 flex-1 whitespace-pre-wrap break-all rounded p-3 text-sm leading-6"
            data-test="detail-display-value"
            >{{ formatDetailJsonText(entry.value) }}</pre
          >
        </Tooltip>
        <Button @click="openJsonViewer(entry)">查看 JSON</Button>
          </div>
          <div v-else-if="entry.kind === 'qrcode'" class="flex justify-center py-2">
        <QRCode
          :size="168"
          :value="String(entry.value)"
          data-test="detail-display-qrcode"
        />
          </div>
          <Tooltip
            v-else
        :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
        :overlay-class-name="'crud-detail-display-tooltip'"
        :title="getDisplayText(entry)"
          >
        <pre
          class="line-clamp-2 whitespace-pre-wrap break-all text-sm leading-6"
          :class="{
            'bg-background rounded p-3': shouldSpanFullRow(entry),
          }"
          data-test="detail-display-value"
          >{{ getDisplayText(entry) }}</pre
        >
          </Tooltip>
        </div>
      </div>
    </section>
  </div>

  <Modal
    v-model:open="jsonViewerOpen"
    :body-style="DEFAULT_CONTENT_MODAL_BODY_STYLE"
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

<style scoped>
:global(.crud-detail-display-tooltip) {
  max-width: min(80vw, 960px);
}

:global(.crud-detail-display-tooltip .ant-tooltip-inner) {
  max-height: 60vh;
  min-width: 500px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
