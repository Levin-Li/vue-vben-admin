<script lang="ts" setup>
import type { TenantSettingItem } from '../setting-for-tenant/setting-for-tenant';
import type { CSSProperties } from 'vue';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Switch,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

import { servicePluginSettingService } from '../../api/service-plugin-setting-service';
import { servicePluginService } from '../../api/service-plugin-service';
import SettingValueContentField from '../setting-value-content-field.vue';
import {
  buildTenantSettingCategories,
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
  remark?: string;
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
const editValueSubmitting = ref(false);
const editValueReadonly = ref(false);
const plugins = ref<ServicePluginRecord[]>([]);
const pluginsLoading = ref(false);
const basicModalOpen = ref(false);
const basicSubmitting = ref(false);
const editingBasicItem = ref<TenantPluginSettingItem>();
const basicFormState = reactive<Record<string, any>>({
  domain: '',
  enable: true,
  orderCode: 1000,
  remark: '',
  servicePluginId: undefined,
  servicePluginProviderCode: undefined,
});
const enableUpdatingIds = reactive<Record<string, boolean>>({});
const { hasPermission } = useRbacAccess();
const createPermission = buildApiMethodPermissions(
  servicePluginSettingService,
  'create',
);
const updatePermission = buildApiMethodPermissions(
  servicePluginSettingService,
  'update',
);
const deletePermission = buildApiMethodPermissions(
  servicePluginSettingService,
  'delete',
);

const categories = computed(() =>
  buildTenantSettingCategories(settings.value, { includeDisabled: true }),
);
const hasSettings = computed(() => settings.value.length > 0);
const canCreate = computed(() => hasPermission(createPermission));
const canUpdate = computed(() => hasPermission(updatePermission));
const canDelete = computed(() => hasPermission(deletePermission));
function getPluginOptionLabel(plugin: ServicePluginRecord) {
  const name = normalizeText(plugin.name) || normalizeText(plugin.id);
  const pluginTypeName = normalizeText(plugin.pluginTypeName);
  return pluginTypeName ? `${name}（${pluginTypeName}）` : name;
}

const pluginOptions = computed(() =>
  plugins.value
    .filter((plugin) => plugin.enable !== false)
    .map((plugin) => ({
      label: getPluginOptionLabel(plugin),
      value: plugin.id,
    })),
);
const basicProviderOptions = computed(
  () =>
    plugins.value
      .find((plugin) => plugin.id === basicFormState.servicePluginId)
      ?.providerList?.filter((provider) => provider.code && !provider.disabled)
      .map((provider) => ({
        label: provider.name || provider.code,
        value: provider.code,
      })) || [],
);
const basicProviderPlaceholder = computed(() => {
  if (!basicFormState.servicePluginId) {
    return '请先选择服务插件';
  }
  return basicProviderOptions.value.length
    ? '请选择供应商'
    : '暂无可选供应商，请先在服务插件管理中启用';
});
const currentProviderCode = computed(
  () => editValueItem.value?.record.servicePluginProviderCode,
);
const editValueTitle = computed(() => {
  const item = editValueItem.value;
  const action = editValueReadonly.value ? '查看配置' : '编辑配置';
  return item
    ? `${action} - ${item.servicePluginName} / ${item.providerName}`
    : action;
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

  if (!record.id || !plugin || !providerCode || !provider) {
    return undefined;
  }

  const servicePluginName =
    normalizeText(plugin.name) || record.servicePluginId || '未命名插件';
  const providerName = normalizeText(provider.name) || providerCode;
  return {
    categoryName:
      normalizeText(plugin.categoryName) ||
      '服务插件',
    code: providerCode,
    domain: record.domain,
    // 禁用供应商仍需允许先录入凭据；只有整个插件被禁用时才禁止编辑具体配置。
    editable: plugin.enable !== false,
    editor: normalizeText(provider.configEditor) || 'json',
    enable: record.enable !== false,
    groupName:
      normalizeText(plugin.groupName) ||
      normalizeText(plugin.pluginTypeName) ||
      normalizeText(plugin.categoryName) ||
      '服务插件',
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

async function loadPlugins() {
  pluginsLoading.value = true;
  try {
    const result = await servicePluginService.list({
      pageIndex: 1,
      pageSize: 500,
    });
    plugins.value = getListItems<ServicePluginRecord>(result);
  } catch (error) {
    console.error(error);
    message.error('服务插件列表加载失败');
  } finally {
    pluginsLoading.value = false;
  }
}

function getPluginDisplayName(item: TenantPluginSettingItem) {
  return item.servicePluginName || item.record.servicePluginId || '-';
}

function getProviderDisplayName(item: TenantPluginSettingItem) {
  return item.providerName || item.code || '-';
}

function resetBasicForm() {
  Object.assign(basicFormState, {
    domain: '',
    enable: true,
    orderCode: 1000,
    remark: '',
    servicePluginId: undefined,
    servicePluginProviderCode: undefined,
  });
}

function openCreate() {
  if (!canCreate.value || basicSubmitting.value) {
    return;
  }
  editingBasicItem.value = undefined;
  resetBasicForm();
  basicModalOpen.value = true;
}

function openBasicEditor(item: TenantPluginSettingItem) {
  if (!canUpdate.value || basicSubmitting.value) {
    return;
  }
  editingBasicItem.value = item;
  Object.assign(basicFormState, {
    domain: item.domain || '',
    enable: item.enable !== false,
    orderCode: item.orderCode ?? 1000,
    remark: item.record.remark || '',
    servicePluginId: item.record.servicePluginId,
    servicePluginProviderCode: item.record.servicePluginProviderCode,
  });
  basicModalOpen.value = true;
}

function handleBasicPluginChange(pluginId?: string) {
  basicFormState.servicePluginId = pluginId;
  if (
    !basicProviderOptions.value.some(
      (item) => item.value === basicFormState.servicePluginProviderCode,
    )
  ) {
    basicFormState.servicePluginProviderCode = undefined;
  }
}

async function saveBasicSetting() {
  const item = editingBasicItem.value;
  const servicePluginId = normalizeText(basicFormState.servicePluginId);
  const providerCode = normalizeText(basicFormState.servicePluginProviderCode);
  if (!item && (!servicePluginId || !providerCode)) {
    message.warning('请选择服务插件和供应商');
    return;
  }
  if (item && !canUpdate.value) {
    return;
  }
  if (!item && !canCreate.value) {
    return;
  }

  basicSubmitting.value = true;
  try {
    if (item?.id) {
      await servicePluginSettingService.update({
        domain: normalizeText(basicFormState.domain) || undefined,
        enable: basicFormState.enable !== false,
        forceUpdateFields: ['domain', 'enable', 'orderCode', 'remark'],
        id: item.id,
        optimisticLock: item.optimisticLock,
        orderCode: Number(basicFormState.orderCode || 0),
        remark: normalizeText(basicFormState.remark) || undefined,
      });
      message.success('基本信息已保存');
    } else {
      await servicePluginSettingService.create({
        domain: normalizeText(basicFormState.domain) || undefined,
        enable: basicFormState.enable !== false,
        orderCode: Number(basicFormState.orderCode || 0),
        remark: normalizeText(basicFormState.remark) || undefined,
        servicePluginId,
        servicePluginProviderCode: providerCode,
        value: { [providerCode]: {} },
      });
      message.success('插件配置已新增');
    }
    basicModalOpen.value = false;
    await loadSettings();
  } catch (error) {
    console.error(error);
    message.error(item ? '基本信息保存失败' : '插件配置新增失败');
  } finally {
    basicSubmitting.value = false;
  }
}

async function updateEnable(item: TenantPluginSettingItem, enable: boolean) {
  if (!item.id || !canUpdate.value || enableUpdatingIds[item.id]) {
    return;
  }
  enableUpdatingIds[item.id] = true;
  try {
    await servicePluginSettingService.update({
      enable,
      forceUpdateFields: ['enable'],
      id: item.id,
      optimisticLock: item.optimisticLock,
    });
    message.success(enable ? '配置已启用' : '配置已禁用');
    await loadSettings();
  } catch (error) {
    console.error(error);
    message.error('配置状态更新失败');
  } finally {
    delete enableUpdatingIds[item.id];
  }
}

function deleteSetting(item: TenantPluginSettingItem) {
  if (!item.id || !canDelete.value) {
    return;
  }
  Modal.confirm({
    autoFocusButton: 'cancel',
    cancelText: '取消',
    content: `删除后将无法恢复“${item.name}”配置，是否继续？`,
    okButtonProps: { danger: true },
    okText: '确认删除',
    onOk: async () => {
      await servicePluginSettingService.delete({
        id: item.id,
        optimisticLock: item.optimisticLock,
      });
      message.success('配置已删除');
      await loadSettings();
    },
    title: '确认删除配置？',
  });
}

function openItemEditor(item: TenantPluginSettingItem) {
  if (
    !canUpdate.value ||
    item.editable === false ||
    editValueSubmitting.value
  ) {
    return;
  }
  editValueReadonly.value = false;
  editValueItem.value = item;
  Object.assign(editValueFormState, {
    ...item,
    valueContent: cloneJsonValue(item.valueContent),
  });
  editValueModalOpen.value = true;
}

function openItemPreview(item: TenantPluginSettingItem) {
  editValueReadonly.value = true;
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
    !canUpdate.value ||
    item.editable === false ||
    editValueReadonly.value
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
  void loadPlugins();
});
</script>

<template>
  <Page
    auto-content-height
    content-class="!bg-card !p-4 min-w-0 !overflow-hidden"
  >
    <div class="relative flex h-full min-h-0 flex-col gap-2">
      <div
        class="bg-card flex flex-wrap items-center justify-start gap-3 rounded-lg px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <Button v-if="canCreate" type="primary" @click="openCreate">
            <IconifyIcon class="size-4" icon="lucide:plus" />
            新增配置
          </Button>
          <Tooltip title="刷新">
            <Button
              :loading="loading"
              aria-label="刷新"
              shape="circle"
              type="text"
              @click="loadSettings"
            >
              <template #icon>
                <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
              </template>
            </Button>
          </Tooltip>
          <span class="text-foreground text-sm font-medium">
            租户插件设置({{ settings.length }})
          </span>
        </div>
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
              <Tabs.TabPane v-for="group in category.groups" :key="group.key">
                <template #tab>
                  <span class="tenant-plugin-group-tab-label">{{
                    group.name
                  }}</span>
                </template>
                <div class="tenant-plugin-items-grid">
                  <div
                    v-for="item in group.settings"
                    :key="getSettingKey(item)"
                    :class="{
                      'tenant-plugin-item-disabled': item.enable === false,
                    }"
                    class="tenant-plugin-item bg-card"
                  >
                    <div class="tenant-plugin-item-header">
                      <div class="min-w-0">
                        <div class="tenant-plugin-item-title">
                          {{ item.name }}
                        </div>
                        <div class="tenant-plugin-item-meta">
                          供应商编码：{{ item.code }}
                        </div>
                      </div>
                      <div class="tenant-plugin-item-header-actions">
                        <Switch
                          :checked="item.enable !== false"
                          :disabled="
                            !canUpdate ||
                            Boolean(item.id && enableUpdatingIds[item.id])
                          "
                          :loading="
                            Boolean(item.id && enableUpdatingIds[item.id])
                          "
                          checked-children="启用"
                          un-checked-children="禁用"
                          @update:checked="
                            updateEnable(
                              item as TenantPluginSettingItem,
                              Boolean($event),
                            )
                          "
                        />
                        <Tooltip v-if="canDelete" title="删除配置">
                          <Button
                            danger
                            shape="circle"
                            size="small"
                            type="text"
                            @click="
                              deleteSetting(item as TenantPluginSettingItem)
                            "
                          >
                            <IconifyIcon class="size-4" icon="lucide:trash-2" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                    <div class="tenant-plugin-item-domain">
                      匹配域名：{{
                        getMatchingDomain(item as TenantPluginSettingItem)
                      }}
                    </div>
                    <div class="tenant-plugin-item-actions">
                      <Button
                        @click="
                          openItemPreview(item as TenantPluginSettingItem)
                        "
                      >
                        <IconifyIcon class="size-4" icon="lucide:eye" />
                        查看
                      </Button>
                      <Button
                        :disabled="!canUpdate || basicSubmitting"
                        @click="
                          openBasicEditor(item as TenantPluginSettingItem)
                        "
                      >
                        <IconifyIcon class="size-4" icon="lucide:pencil" />
                        编辑基本信息
                      </Button>
                      <Button
                        :disabled="
                          !canUpdate ||
                          item.editable === false ||
                          editValueSubmitting
                        "
                        type="primary"
                        @click="openItemEditor(item as TenantPluginSettingItem)"
                      >
                        <IconifyIcon class="size-4" icon="lucide:settings-2" />
                        编辑配置
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
      v-model:open="basicModalOpen"
      :confirm-loading="basicSubmitting"
      :title="editingBasicItem ? '编辑插件配置基本信息' : '新增插件配置'"
      @ok="saveBasicSetting"
    >
      <Form class="tenant-plugin-basic-form" layout="vertical">
        <Form.Item label="服务插件" required>
          <Select
            v-if="!editingBasicItem"
            :loading="pluginsLoading"
            :options="pluginOptions"
            :value="basicFormState.servicePluginId"
            placeholder="请选择服务插件"
            show-search
            @update:value="
              handleBasicPluginChange(
                typeof $event === 'string' ? $event : undefined,
              )
            "
          />
          <Input
            v-else
            :value="getPluginDisplayName(editingBasicItem)"
            disabled
          />
        </Form.Item>
        <Form.Item label="供应商" required>
          <Select
            v-if="!editingBasicItem"
            :disabled="!basicFormState.servicePluginId"
            :options="basicProviderOptions"
            :value="basicFormState.servicePluginProviderCode"
            :placeholder="basicProviderPlaceholder"
            show-search
            @update:value="basicFormState.servicePluginProviderCode = $event"
          />
          <Input
            v-else
            :value="getProviderDisplayName(editingBasicItem)"
            disabled
          />
        </Form.Item>
        <Form.Item label="匹配域名" extra="留空表示匹配所有域名">
          <Input
            v-model:value="basicFormState.domain"
            placeholder="请输入域名"
          />
        </Form.Item>
        <div class="tenant-plugin-basic-form-row">
          <Form.Item label="排序代码">
            <Input
              v-model:value="basicFormState.orderCode"
              inputmode="numeric"
              type="number"
            />
          </Form.Item>
          <Form.Item label="是否启用">
            <Switch v-model:checked="basicFormState.enable" />
          </Form.Item>
        </div>
        <Form.Item label="备注">
          <Input.TextArea
            v-model:value="basicFormState.remark"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            placeholder="请输入备注"
          />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="editValueModalOpen"
      :body-style="editValueModalBodyStyle"
      :confirm-loading="editValueSubmitting"
      :footer="editValueReadonly ? null : undefined"
      destroy-on-close
      :mask-closable="false"
      :ok-text="editValueReadonly ? undefined : '保存'"
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
.tenant-plugin-group-tab-label {
  display: inline-block;
}
.tenant-plugin-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 420px));
  gap: 12px;
  align-items: start;
}
.tenant-plugin-item {
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 12px;
}
.tenant-plugin-item-disabled {
  opacity: 0.65;
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
.tenant-plugin-item-header-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}
.tenant-plugin-item-meta,
.tenant-plugin-item-domain {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
}
.tenant-plugin-item-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.tenant-plugin-basic-form {
  display: grid;
  gap: 2px;
}
.tenant-plugin-basic-form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 16px;
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
  .tenant-plugin-basic-form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
