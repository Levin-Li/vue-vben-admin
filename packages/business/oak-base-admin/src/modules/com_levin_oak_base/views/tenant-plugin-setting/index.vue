<script lang="ts" setup>
import type { TenantSettingItem } from '../setting-for-tenant/setting-for-tenant';
import type { CSSProperties } from 'vue';

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

import { servicePluginSettingService } from '../../api/service-plugin-setting-service';
import SettingValueContentField from '../setting-value-content-field.vue';
import {
  buildTenantSettingCategories,
  formatSettingValueInlinePreview,
  formatSettingValuePreview,
  getSettingKey,
  resolveSettingEditorKind,
} from '../setting-for-tenant/setting-for-tenant';

interface ServicePluginProvider {
  code?: string;
  configEditor?: string;
  disabled?: boolean;
  name?: string;
}

interface ServicePluginRecord {
  categoryName?: string;
  enable?: boolean;
  groupName?: string;
  id?: string;
  name?: string;
  pluginTypeName?: string;
  providerList?: ServicePluginProvider[];
}

interface ServicePluginSettingRecord {
  domain?: string;
  editable?: boolean;
  enable?: boolean;
  id?: string;
  optimisticLock?: number;
  orderCode?: number;
  servicePlugin?: ServicePluginRecord;
  servicePluginId?: string;
  servicePluginProviderCode?: string;
  value?: Record<string, any>;
}

interface TenantPluginSettingItem extends TenantSettingItem {
  domain?: string;
  record: ServicePluginSettingRecord;
  servicePluginName: string;
  providerName: string;
}

const loading = ref(false);
const errorMessage = ref('');
const settings = ref<TenantPluginSettingItem[]>([]);
const activeCategoryKey = ref('');
const activeGroupKeys = reactive<Record<string, string>>({});
const editValueModalOpen = ref(false);
const editValueItem = ref<TenantPluginSettingItem>();
const editValueFormState = reactive<Record<string, any>>({});
const editValueMode = ref<'edit' | 'view'>('edit');
const editValueSubmitting = ref(false);

const categories = computed(() => buildTenantSettingCategories(settings.value));
const hasSettings = computed(() => settings.value.length > 0);
const editValueReadonly = computed(() => editValueMode.value === 'view');
const currentProviderCode = computed(
  () => editValueItem.value?.record.servicePluginProviderCode,
);
const editValueTitle = computed(() => {
  const item = editValueItem.value;
  const actionName = editValueReadonly.value ? '查看配置' : '编辑配置';
  return item
    ? `${actionName} - ${item.servicePluginName} / ${item.providerName}`
    : actionName;
});
const editValueModalBodyStyle: CSSProperties = {
  maxHeight: 'calc(100vh - 160px)',
  overflowY: 'auto',
};
const editValueModalWidth = computed(() => {
  const item = editValueItem.value;
  const editorKind = item ? resolveSettingEditorKind(item) : 'json';
  if (editorKind === 'json' || editorKind === 'code') {
    return 'min(82vw, 1480px)';
  }
  if (editorKind === 'json-schema') {
    return 'min(80vw, 960px)';
  }
  return 'min(64vw, 880px)';
});

function getListItems<T>(result: any): T[] {
  if (Array.isArray(result)) {
    return result;
  }
  return result?.items || result?.records || result?.list || result?.data || [];
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function cloneJsonValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return {};
  }
  return JSON.parse(JSON.stringify(value));
}

function getProvider(record: ServicePluginSettingRecord) {
  return record.servicePlugin?.providerList?.find(
    (item) => item.code === record.servicePluginProviderCode,
  );
}

function getMatchingDomain(item: TenantPluginSettingItem) {
  return normalizeText(item.domain) || '所有域名';
}

function toTenantPluginSettingItem(
  record: ServicePluginSettingRecord,
): TenantPluginSettingItem | undefined {
  const plugin = record.servicePlugin;
  const provider = getProvider(record);
  const providerCode = normalizeText(record.servicePluginProviderCode);

  if (
    !record.id ||
    !plugin ||
    plugin.enable === false ||
    !providerCode ||
    !provider ||
    provider.disabled
  ) {
    return undefined;
  }

  const servicePluginName =
    normalizeText(plugin.name) || record.servicePluginId || '未命名插件';
  const providerName = normalizeText(provider.name) || providerCode;
  return {
    categoryName:
      normalizeText(plugin.categoryName) ||
      normalizeText(plugin.pluginTypeName) ||
      '服务插件',
    code: providerCode,
    domain: record.domain,
    // ServicePluginSetting 的 editable 是基础实体字段，不是插件配置的编辑权限。
    // 实际可编辑性由插件、设置和供应商的可用状态在后端统一校验。
    editable: true,
    editor: normalizeText(provider.configEditor) || 'json',
    enable: record.enable !== false,
    groupName:
      normalizeText(plugin.groupName) ||
      normalizeText(plugin.pluginTypeName) ||
      '默认分组',
    id: record.id,
    name: `${servicePluginName} / ${providerName}`,
    optimisticLock: record.optimisticLock,
    orderCode: record.orderCode,
    providerName,
    record,
    servicePluginName,
    valueContent: cloneJsonValue(record.value?.[providerCode]),
    valueType: 'Json',
  };
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
    if (
      !category.groups.some(
        (item) => item.key === activeGroupKeys[category.key],
      )
    ) {
      activeGroupKeys[category.key] = category.groups[0]?.key || '';
    }
  });
}

async function loadSettings() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await servicePluginSettingService.list({
      enable: true,
      isContainsPublicData: true,
      loadServicePlugin: true,
      pageIndex: 1,
      pageSize: 2000,
    });
    settings.value = getListItems<ServicePluginSettingRecord>(result)
      .map(toTenantPluginSettingItem)
      .filter((item): item is TenantPluginSettingItem => Boolean(item));
    ensureActiveTabs();
  } catch (error) {
    console.error(error);
    errorMessage.value = '租户插件设置加载失败';
  } finally {
    loading.value = false;
  }
}

function openItemEditor(item: TenantPluginSettingItem) {
  if (item.editable === false || editValueSubmitting.value) {
    return;
  }
  editValueMode.value = 'edit';
  editValueItem.value = item;
  Object.assign(editValueFormState, {
    ...item,
    valueContent: cloneJsonValue(item.valueContent),
  });
  editValueModalOpen.value = true;
}

function openItemPreview(item: TenantPluginSettingItem) {
  editValueMode.value = 'view';
  editValueItem.value = item;
  Object.assign(editValueFormState, {
    ...item,
    valueContent: cloneJsonValue(item.valueContent),
  });
  editValueModalOpen.value = true;
}

async function saveEditValue() {
  const item = editValueItem.value;
  const providerCode = currentProviderCode.value;
  if (
    !item?.id ||
    !providerCode ||
    editValueReadonly.value ||
    item.editable === false
  ) {
    return;
  }
  editValueSubmitting.value = true;
  try {
    await servicePluginSettingService.update({
      forceUpdateFields: ['value'],
      id: item.id,
      optimisticLock: item.optimisticLock,
      value: {
        ...(item.record.value || {}),
        [providerCode]: cloneJsonValue(editValueFormState.valueContent),
      },
    });
    message.success(`${item.name}保存成功`);
    editValueModalOpen.value = false;
    await loadSettings();
  } catch (error) {
    console.error(error);
    message.error('配置保存失败');
  } finally {
    editValueSubmitting.value = false;
  }
}

watch(categories, ensureActiveTabs, { immediate: true });

onMounted(() => {
  void loadSettings();
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
        <span class="text-foreground text-sm font-medium"
          >租户插件设置({{ settings.length }})</span
        >
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
          description="暂无可用的租户插件设置"
        />
        <Tabs
          v-else
          v-model:active-key="activeCategoryKey"
          class="tenant-plugin-category-tabs"
        >
          <Tabs.TabPane
            v-for="category in categories"
            :key="category.key"
            :tab="category.name"
          >
            <Tabs
              v-model:active-key="activeGroupKeys[category.key]"
              class="tenant-plugin-group-tabs"
              tab-position="left"
            >
              <Tabs.TabPane
                v-for="group in category.groups"
                :key="group.key"
                :tab="group.name"
              >
                <div class="tenant-plugin-items-grid">
                  <div
                    v-for="item in group.settings"
                    :key="getSettingKey(item)"
                    class="tenant-plugin-item bg-card"
                  >
                    <div class="tenant-plugin-item-header">
                      <Tooltip :title="item.name"
                        ><div class="tenant-plugin-item-title">
                          {{ item.name }}
                        </div></Tooltip
                      >
                      <Tag>Json</Tag>
                    </div>
                    <div class="tenant-plugin-item-meta">
                      供应商编码：{{ item.code }}
                    </div>
                    <div class="tenant-plugin-item-domain">
                      匹配域名：{{
                        getMatchingDomain(item as TenantPluginSettingItem)
                      }}
                    </div>
                    <Tooltip
                      :mouse-enter-delay="1.5"
                      overlay-class-name="tenant-setting-value-tooltip"
                      :title="formatSettingValuePreview(item.valueContent)"
                    >
                      <div class="tenant-plugin-value-preview">
                        {{ formatSettingValueInlinePreview(item.valueContent) }}
                      </div>
                    </Tooltip>
                    <div class="tenant-plugin-item-actions">
                      <Button
                        block
                        @click="
                          openItemPreview(item as TenantPluginSettingItem)
                        "
                        ><IconifyIcon
                          class="size-4"
                          icon="lucide:eye"
                        />查看</Button
                      >
                      <Button
                        block
                        :disabled="
                          item.editable === false || editValueSubmitting
                        "
                        @click="openItemEditor(item as TenantPluginSettingItem)"
                        ><IconifyIcon
                          class="size-4"
                          icon="lucide:pencil"
                        />编辑</Button
                      >
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
      :footer="editValueReadonly ? null : undefined"
      :mask-closable="false"
      ok-text="保存"
      :title="editValueTitle"
      :width="editValueModalWidth"
      @ok="saveEditValue"
    >
      <div class="tenant-plugin-edit-form">
        <div class="text-foreground text-sm font-medium">
          匹配域名：{{ editValueItem ? getMatchingDomain(editValueItem) : '-' }}
        </div>
        <SettingValueContentField
          :disabled="editValueReadonly"
          :form-state="editValueFormState"
          inline
        />
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.tenant-plugin-category-tabs :deep(.ant-tabs-content-holder) {
  min-height: 0;
}
.tenant-plugin-category-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}
.tenant-plugin-group-tabs :deep(.ant-tabs-tabpane) {
  padding-left: 12px;
}
.tenant-plugin-group-tabs :deep(.ant-tabs-nav) {
  min-width: 120px;
}
.tenant-plugin-group-tabs :deep(.ant-tabs-tab) {
  margin-top: 0;
  padding: 8px 12px;
}
.tenant-plugin-items-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(max(250px, calc((100% - 72px) / 5)), 1fr)
  );
  gap: 12px;
  align-items: start;
}
.tenant-plugin-item {
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 12px;
}
.tenant-plugin-item-header {
  display: flex;
  min-height: 30px;
  align-items: start;
  justify-content: space-between;
  gap: 8px;
}
.tenant-plugin-item-title,
.tenant-plugin-item-meta,
.tenant-plugin-item-domain {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tenant-plugin-item-title {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.tenant-plugin-item-meta,
.tenant-plugin-item-domain {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
}
.tenant-plugin-value-preview {
  min-width: 0;
  overflow: hidden;
  margin-top: 8px;
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
.tenant-plugin-item-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.tenant-plugin-edit-form {
  display: grid;
  gap: 8px;
  width: 100%;
}
@media (max-width: 768px) {
  .tenant-plugin-items-grid {
    grid-template-columns: 1fr;
  }
}
</style>
