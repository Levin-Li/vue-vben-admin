<script lang="ts" setup>
import type { TenantSettingItem } from './setting-for-tenant';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  message,
  Modal,
  Spin,
  Tabs,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { settingService } from '../../api/setting-service';

import SettingValueContentField from '../setting-value-content-field.vue';
import {
  buildTenantSettingCategories,
  buildTenantSettingUpdatePayload,
  getSettingDisplayName,
  getSettingKey,
  isSettingEditable,
  isSettingValueChanged,
  parseSettingValueForEditor,
  serializeSettingValueFromEditor,
} from './setting-for-tenant';

interface SettingPageService {
  list(params?: any, options?: any): Promise<any>;
  update(data?: any, options?: any): Promise<any>;
}

const props = withDefaults(
  defineProps<{
    emptyDescription?: string;
    loadErrorMessage?: string;
    service?: SettingPageService;
    title?: string;
  }>(),
  {
    emptyDescription: '暂无系统配置',
    loadErrorMessage: '系统配置加载失败',
    title: '系统配置',
  },
);

const loading = ref(false);
const errorMessage = ref('');
const settings = ref<TenantSettingItem[]>([]);
const activeCategoryKey = ref('');
const activeGroupKeys = reactive<Record<string, string>>({});
const draftValues = reactive<Record<string, any>>({});
const originalValues = reactive<Record<string, string>>({});
const savingKeys = reactive<Record<string, boolean>>({});
const editValueModalOpen = ref(false);
const editValueItem = ref<TenantSettingItem>();
const editValueFormState = ref<Record<string, any>>({});
const editValueSubmitting = ref(false);

const categories = computed(() => buildTenantSettingCategories(settings.value));

const changedSettings = computed(() =>
  settings.value.filter((item) => {
    const key = getSettingKey(item);
    if (!key || !item.id || !isSettingEditable(item)) {
      return false;
    }

    return isSettingValueChanged(
      item,
      draftValues[key],
      originalValues[key] ?? '',
    );
  }),
);

const hasSettings = computed(() => settings.value.length > 0);

const editValueTitle = computed(() => {
  const item = editValueItem.value;
  return item ? `编辑值 - ${getSettingDisplayName(item)}` : '编辑配置值';
});

const editValueModalBodyStyle = {
  maxHeight: 'calc(100vh - 180px)',
  overflowY: 'auto',
};

function normalizeSettingList(data: any): TenantSettingItem[] {
  const list: TenantSettingItem[] = Array.isArray(data)
    ? data
    : data?.items || data?.records || data?.list || [];

  return list.filter((item) => item?.enable !== false);
}

function resetDraftState(nextSettings: TenantSettingItem[]) {
  Object.keys(draftValues).forEach((key) => delete draftValues[key]);
  Object.keys(originalValues).forEach((key) => delete originalValues[key]);

  nextSettings.forEach((item) => {
    const key = getSettingKey(item);
    if (!key) {
      return;
    }

    const editorValue = parseSettingValueForEditor(item);
    draftValues[key] = editorValue;
    originalValues[key] = serializeSettingValueFromEditor(item, editorValue);
  });
}

function ensureActiveTabs() {
  const firstCategory = categories.value[0];
  if (
    firstCategory &&
    !categories.value.some((item) => item.key === activeCategoryKey.value)
  ) {
    activeCategoryKey.value = firstCategory.key;
  }

  categories.value.forEach((category) => {
    const activeGroupKey = activeGroupKeys[category.key];
    if (!category.groups.some((item) => item.key === activeGroupKey)) {
      activeGroupKeys[category.key] = category.groups[0]?.key || '';
    }
  });
}

async function loadSettings() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const result = await (props.service || settingService).list({
      enable: true,
      isContainsPublicData: true,
      orderBy: 'orderCode',
      orderDir: 'Asc',
      pageIndex: 1,
      pageSize: 2000,
    });

    settings.value = normalizeSettingList(result);
    resetDraftState(settings.value);
    ensureActiveTabs();
  } catch (error) {
    console.error(error);
    errorMessage.value = props.loadErrorMessage;
  } finally {
    loading.value = false;
  }
}

function getItemKey(item: TenantSettingItem) {
  return getSettingKey(item);
}

function getValue(item: TenantSettingItem) {
  return draftValues[getItemKey(item)];
}

function getValuePreview(item: TenantSettingItem) {
  const value = getValue(item);
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isItemChanged(item: TenantSettingItem) {
  const key = getItemKey(item);
  return (
    !!key &&
    !!item.id &&
    isSettingEditable(item) &&
    isSettingValueChanged(item, draftValues[key], originalValues[key] ?? '')
  );
}

function isItemSaving(item: TenantSettingItem) {
  return !!savingKeys[getItemKey(item)];
}

function openItemEditor(item: TenantSettingItem) {
  if (
    !isSettingEditable(item) ||
    isItemSaving(item) ||
    editValueSubmitting.value
  ) {
    return;
  }

  editValueItem.value = item;
  editValueFormState.value = {
    ...item,
    valueContent: getValue(item),
  };
  editValueModalOpen.value = true;
}

async function saveEditValue() {
  const item = editValueItem.value;
  if (!item) {
    return;
  }

  const key = getItemKey(item);
  if (!key || !item.id || !isSettingEditable(item)) {
    return;
  }

  const nextValue = editValueFormState.value.valueContent;
  draftValues[key] = nextValue;

  if (!isItemChanged(item)) {
    editValueModalOpen.value = false;
    return;
  }

  editValueSubmitting.value = true;
  savingKeys[key] = true;

  try {
    await (props.service || settingService).update(
      buildTenantSettingUpdatePayload(item, nextValue),
    );
    message.success(`${getSettingDisplayName(item)}保存成功`);
    editValueModalOpen.value = false;
    await loadSettings();
  } finally {
    editValueSubmitting.value = false;
    delete savingKeys[key];
  }
}

watch(categories, ensureActiveTabs, { immediate: true });

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <Page
    auto-content-height
    content-class="!bg-card !p-4 min-w-0 !overflow-hidden"
  >
    <div class="relative flex h-full min-h-0 flex-col gap-2">
      <div
        class="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
      >
        <div class="flex items-center gap-2 text-sm">
          <span class="text-foreground font-medium">
            {{ props.title }}({{ settings.length }})
          </span>
          <Tag v-if="changedSettings.length > 0" color="warning">
            待保存 {{ changedSettings.length }}
          </Tag>
        </div>
        <Tooltip title="刷新">
          <Button
            :loading="loading"
            aria-label="刷新"
            shape="circle"
            type="text"
            @click="loadSettings"
          >
            <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
          </Button>
        </Tooltip>
      </div>

      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        show-icon
        type="error"
      />

      <Spin :spinning="loading" class="min-h-0 flex-1">
        <Empty
          v-if="!loading && !hasSettings"
          :description="props.emptyDescription"
        />

        <Tabs
          v-else
          v-model:active-key="activeCategoryKey"
          class="tenant-setting-category-tabs"
        >
          <Tabs.TabPane
            v-for="category in categories"
            :key="category.key"
            :tab="category.name"
          >
            <Tabs
              v-model:active-key="activeGroupKeys[category.key]"
              class="tenant-setting-group-tabs"
              tab-position="left"
            >
              <Tabs.TabPane
                v-for="group in category.groups"
                :key="group.key"
                :tab="group.name"
              >
                <div class="tenant-setting-items-grid">
                  <div
                    v-for="item in group.settings"
                    :key="getItemKey(item)"
                    class="tenant-setting-item bg-card"
                  >
                    <div class="tenant-setting-item-header">
                      <div class="min-w-0">
                        <Tooltip :title="getSettingDisplayName(item)">
                          <div class="tenant-setting-item-title">
                            {{ getSettingDisplayName(item) }}
                          </div>
                        </Tooltip>
                        <Tooltip v-if="item.code" :title="item.code">
                          <div class="tenant-setting-item-code">
                            编码：{{ item.code }}
                          </div>
                        </Tooltip>
                      </div>
                      <div class="tenant-setting-item-tags">
                        <Tag v-if="item.valueType">{{ item.valueType }}</Tag>
                        <Tag v-if="!isSettingEditable(item)" color="default">
                          只读
                        </Tag>
                        <Tag v-if="isItemSaving(item)" color="processing">
                          保存中
                        </Tag>
                      </div>
                    </div>

                    <div class="tenant-setting-item-control">
                      <Tooltip :title="getValuePreview(item)">
                        <div class="tenant-setting-value-preview">
                          {{ getValuePreview(item) }}
                        </div>
                      </Tooltip>

                      <Button
                        block
                        :disabled="
                          !isSettingEditable(item) ||
                          isItemSaving(item) ||
                          editValueSubmitting
                        "
                        @click="openItemEditor(item)"
                      >
                        <IconifyIcon class="size-4" icon="lucide:pencil" />
                        编辑
                      </Button>
                    </div>
                  </div>
                </div>
              </Tabs.TabPane>
            </Tabs>
          </Tabs.TabPane>
        </Tabs>
      </Spin>
    </div>

    <Modal
      v-model:open="editValueModalOpen"
      :body-style="editValueModalBodyStyle"
      :confirm-loading="editValueSubmitting"
      destroy-on-close
      ok-text="保存"
      :title="editValueTitle"
      :width="'min(70vw, 1280px)'"
      @ok="saveEditValue"
    >
      <div class="tenant-setting-edit-form">
        <div class="text-foreground text-sm font-medium">值</div>
        <SettingValueContentField :form-state="editValueFormState" inline />
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.tenant-setting-category-tabs :deep(.ant-tabs-content-holder) {
  min-height: 0;
}

.tenant-setting-category-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}

.tenant-setting-group-tabs :deep(.ant-tabs-tabpane) {
  padding-left: 12px;
}

.tenant-setting-group-tabs :deep(.ant-tabs-nav) {
  min-width: 120px;
}

.tenant-setting-group-tabs :deep(.ant-tabs-tab) {
  margin-top: 0;
  padding: 8px 12px;
}

.tenant-setting-items-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(max(210px, calc((100% - 72px) / 7)), 1fr)
  );
  gap: 12px;
  align-items: start;
}

.tenant-setting-item {
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 12px;
}

.tenant-setting-item-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  min-height: 46px;
  margin-bottom: 8px;
}

.tenant-setting-item-title {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-setting-item-code {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-setting-item-tags {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.tenant-setting-item-tags :deep(.ant-tag) {
  margin-inline-end: 0;
}

.tenant-setting-item-remark {
  display: block;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-setting-item-control {
  display: grid;
  gap: 8px;
}

.tenant-setting-value-preview {
  min-width: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 20px;
  padding: 5px 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-setting-edit-form {
  display: grid;
  gap: 8px;
  width: 100%;
}

@media (max-width: 768px) {
  .tenant-setting-items-grid {
    grid-template-columns: 1fr;
  }
}
</style>
