<script setup lang="ts">
import type { DetailDisplayEntry } from './detail-display';
import type { CrudFieldConfig, CrudPageDisplayGroupConfig } from './types';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { JsonViewer } from '@vben/common-ui';
import { ChevronDown } from '@vben/icons';

import { Button, Modal, QRCode, Space, Tag, Tooltip } from 'ant-design-vue';

import { DEFAULT_CONTENT_MODAL_BODY_STYLE } from './config-helpers';
import { getCrudGroupTitleClass } from './crud-group-display';
import { CRUD_TOOLTIP_MOUSE_ENTER_DELAY } from './crud-tooltip-preview';
import {
  formatDetailDisplayValue,
  formatDetailJsonText,
  isDetailJsonValue,
  isEmptyDetailValue,
} from './detail-display';
import DetailMediaField from './detail-media-field.vue';

import './crud-group-display.css';

const props = defineProps<{
  entries: DetailDisplayEntry[];
}>();

const panel = ref<HTMLElement>();
const jsonViewerOpen = ref(false);
const jsonViewerTitle = ref('');
const jsonViewerValue = ref<any>(null);
const collapsedGroups = reactive<Record<string, boolean>>({});
const expandedEntries = reactive<Record<string, boolean>>({});
const overflowingEntries = reactive<Record<string, boolean>>({});
let resizeObserver: ResizeObserver | undefined;

const sections = computed(() => {
  const values: Array<{
    displayStyle?: CrudPageDisplayGroupConfig['displayStyle'];
    entries: DetailDisplayEntry[];
    key: string;
    title?: string;
  }> = [];
  const byKey = new Map<string, (typeof values)[number]>();
  for (const entry of props.entries) {
    const group = entry.field?.displayGroup;
    const key = group?.key || '__ungrouped';
    let section = byKey.get(key);
    if (!section) {
      section = {
        entries: [],
        key,
        title: group?.title,
        displayStyle: group?.displayStyle,
      };
      byKey.set(key, section);
      values.push(section);
    }
    section.entries.push(entry);
  }
  return values;
});

function measureOverflow() {
  panel.value
    ?.querySelectorAll<HTMLElement>('[data-detail-key]')
    .forEach((element) => {
      const key = element.dataset.detailKey!;
      if (!expandedEntries[key] && element.clientHeight > 0) {
        overflowingEntries[key] =
          element.scrollHeight > element.clientHeight + 1;
      }
    });
}

watch(
  () => props.entries,
  async () => {
    for (const state of [
      collapsedGroups,
      expandedEntries,
      overflowingEntries,
    ]) {
      for (const key of Object.keys(state)) delete state[key];
    }
    for (const section of sections.value) {
      collapsedGroups[section.key] =
        section.entries[0]?.field?.displayGroup?.defaultExpanded === false;
    }
    jsonViewerOpen.value = false;
    await nextTick();
    measureOverflow();
  },
  { immediate: true },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(measureOverflow);
  if (panel.value) resizeObserver.observe(panel.value);
  measureOverflow();
});
onBeforeUnmount(() => resizeObserver?.disconnect());

async function toggleGroup(key: string) {
  collapsedGroups[key] = !collapsedGroups[key];
  await nextTick();
  measureOverflow();
}

async function toggleEntry(key: string) {
  expandedEntries[key] = !expandedEntries[key];
  await nextTick();
  measureOverflow();
}

function isLargeDisplayField(field: CrudFieldConfig | undefined, value: any) {
  if (!field) return value && typeof value === 'object';
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

function openJsonViewer(entry: DetailDisplayEntry) {
  jsonViewerTitle.value = entry.label;
  jsonViewerValue.value = entry.value;
  jsonViewerOpen.value = true;
}

function formatArrayItem(entry: DetailDisplayEntry, value: unknown) {
  return formatDetailDisplayValue({ ...entry, kind: 'scalar', value });
}
</script>

<template>
  <div ref="panel" class="detail-display-panel">
    <div
      v-if="entries.length === 0"
      class="text-muted-foreground py-8 text-center"
      role="status"
    >
      暂无可展示内容
    </div>
    <section
      v-for="section in sections"
      :key="section.key"
      class="detail-section"
    >
      <div
        v-if="section.title"
        class="detail-section-heading"
        :class="getCrudGroupTitleClass(section.displayStyle)"
      >
        <h3 class="vben-crud-group-title">{{ section.title }}</h3>
        <Button
          type="text"
          size="small"
          :aria-label="`${collapsedGroups[section.key] ? '展开' : '收起'}${section.title}`"
          :aria-expanded="!collapsedGroups[section.key]"
          data-test="detail-group-toggle"
          @click="toggleGroup(section.key)"
        >
          <template #icon>
            <ChevronDown
              class="detail-toggle-icon"
              :class="{ 'is-expanded': !collapsedGroups[section.key] }"
              aria-hidden="true"
            />
          </template>
          {{ collapsedGroups[section.key] ? '展开' : '收起' }}
        </Button>
      </div>
      <dl v-show="!collapsedGroups[section.key]" class="detail-grid">
        <div
          v-for="entry in section.entries"
          :key="entry.key"
          class="detail-entry"
          :class="{
            'detail-entry-full': isLargeDisplayField(entry.field, entry.value),
          }"
          data-test="detail-display-entry"
        >
          <dt class="detail-label">{{ entry.label }}</dt>
          <dd class="detail-value">
            <div
              v-if="isEmptyDetailValue(entry.value, entry.field)"
              class="text-muted-foreground"
              data-test="detail-display-value"
            >
              {{
                entry.kind === 'json'
                  ? formatDetailJsonText(entry.value).trim() || '—'
                  : '—'
              }}
            </div>
            <DetailMediaField
              v-else-if="
                entry.field?.type === 'image' || entry.field?.type === 'file'
              "
              :label="entry.label"
              :type="entry.field.type"
              :value="entry.value"
            />
            <div v-else-if="isDetailJsonValue(entry)" class="detail-json">
              <div
                class="detail-json-preview line-clamp-2"
                data-test="detail-display-value"
              >
                {{ formatDetailJsonText(entry.value) }}
              </div>
              <Button size="small" @click="openJsonViewer(entry)">
                查看 JSON
              </Button>
            </div>
            <div v-else-if="entry.kind === 'qrcode'" class="detail-qrcode">
              <QRCode
                :size="168"
                :value="String(entry.value)"
                data-test="detail-display-qrcode"
              />
            </div>
            <Space
              v-else-if="
                entry.kind === 'array' &&
                (entry.field?.type === 'tags' || entry.field?.multiple)
              "
              class="detail-array-tags"
              data-test="detail-display-array"
              :size="[4, 4]"
              wrap
            >
              <Tag v-for="item in entry.value" :key="String(item)">
                {{ formatArrayItem(entry, item) }}
              </Tag>
            </Space>
            <template v-else>
              <Tooltip
                :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
                overlay-class-name="crud-detail-display-tooltip"
                :title="
                  overflowingEntries[entry.key]
                    ? '点击展开全文查看完整内容'
                    : undefined
                "
              >
                <div
                  class="detail-text"
                  :class="{ 'line-clamp-2': !expandedEntries[entry.key] }"
                  :data-detail-key="entry.key"
                  data-test="detail-display-value"
                >
                  {{ formatDetailDisplayValue(entry) }}
                </div>
              </Tooltip>
              <Button
                v-if="overflowingEntries[entry.key]"
                class="detail-expand"
                type="link"
                size="small"
                :aria-label="`${expandedEntries[entry.key] ? '收起' : '展开全文'}：${entry.label}`"
                :aria-expanded="!!expandedEntries[entry.key]"
                data-test="detail-display-toggle"
                @click="toggleEntry(entry.key)"
              >
                <template #icon>
                  <ChevronDown
                    class="detail-toggle-icon"
                    :class="{ 'is-expanded': expandedEntries[entry.key] }"
                    aria-hidden="true"
                  />
                </template>
                {{ expandedEntries[entry.key] ? '收起' : '展开全文' }}
              </Button>
            </template>
          </dd>
        </div>
      </dl>
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
.detail-display-panel {
  width: 100%;
  max-width: 1008px;
  margin-inline: auto;
  container-type: inline-size;
  color: hsl(var(--foreground));
}

.detail-section + .detail-section {
  margin-top: 24px;
}

.detail-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-section-heading h3 {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 48px;
  margin: 0;
}

.detail-entry {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 16px;
  align-content: start;
  padding-block: 16px;
  border-bottom: 1px solid hsl(var(--border) / 70%);
}

.detail-entry-full {
  grid-column: 1 / -1;
}

.detail-label,
.detail-value {
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.detail-label {
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.detail-text,
.detail-json-preview {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.detail-json {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.detail-json-preview {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: inherit;
  color: hsl(var(--muted-foreground));
}

.detail-json :deep(.ant-btn) {
  flex-shrink: 0;
}

.detail-toggle-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-inline-end: 4px;
  vertical-align: -3px;
  transition: transform 150ms ease;
}

.detail-toggle-icon.is-expanded {
  transform: rotate(180deg);
}

.detail-expand {
  height: auto;
  padding: 0;
  line-height: 24px;
}

.detail-qrcode {
  padding-block: 4px;
}

@container (max-width: 719px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container (max-width: 399px) {
  .detail-entry {
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 12px;
    padding-block: 12px;
  }

  .detail-json {
    flex-wrap: wrap;
  }

  .detail-json-preview {
    flex-basis: 100%;
  }
}

:global(.crud-detail-display-tooltip) {
  max-width: min(80vw, 320px);
}
</style>
