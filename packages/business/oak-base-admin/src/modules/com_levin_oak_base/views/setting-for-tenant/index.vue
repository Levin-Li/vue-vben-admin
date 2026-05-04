<script lang="ts" setup>
import type {
  SettingJsonSchemaSource,
  TenantSettingItem,
} from './setting-for-tenant';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { settingService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/setting';
import { requestClient } from '@levin/admin-framework';
import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import JsonSchemaFormField from '@levin/admin-framework/framework-commons/shared/json-schema-form-field.vue';
import { normalizeJsonSchemaObject } from '@levin/admin-framework/framework-commons/shared/json-schema-form';

import { modulePost } from '../api-module';
import {
  buildTenantSettingUpdatePayload,
  buildTenantSettingCategories,
  getCodeEditorLanguage,
  getEditorOptions,
  getSettingJsonSchema,
  getSettingJsonSchemaSource,
  getSettingDisplayName,
  getSettingKey,
  isSettingEditable,
  isSettingValueChanged,
  parseSettingValueForEditor,
  resolveSettingEditorKind,
  serializeSettingValueFromEditor,
} from './setting-for-tenant';

const loading = ref(false);
const errorMessage = ref('');
const settings = ref<TenantSettingItem[]>([]);
const activeCategoryKey = ref('');
const activeGroupKeys = reactive<Record<string, string>>({});
const draftValues = reactive<Record<string, any>>({});
const originalValues = reactive<Record<string, string>>({});
const savingKeys = reactive<Record<string, boolean>>({});
const schemaErrorMessages = reactive<Record<string, string>>({});
const schemaLoadingKeys = reactive<Record<string, boolean>>({});
const resolvedJsonSchemas = reactive<Record<string, Record<string, any>>>({});

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

function resetJsonSchemaState() {
  Object.keys(schemaErrorMessages).forEach(
    (key) => delete schemaErrorMessages[key],
  );
  Object.keys(schemaLoadingKeys).forEach(
    (key) => delete schemaLoadingKeys[key],
  );
  Object.keys(resolvedJsonSchemas).forEach(
    (key) => delete resolvedJsonSchemas[key],
  );
}

function normalizeJsonSchemaResponse(data: any) {
  return normalizeJsonSchemaObject(
    data?.jsonSchema ??
      data?.data?.jsonSchema ??
      data?.schema ??
      data?.data?.schema ??
      data,
  );
}

async function fetchJsonSchemaBySource(source: SettingJsonSchemaSource) {
  if (source.kind === 'inline') {
    return source.schema;
  }

  if (source.kind === 'java-type') {
    const result = await modulePost<{
      jsonSchema?: string;
      schema?: Record<string, any> | string;
    }>('/jsonSchema/genJsonSchema', {
      typeGenericStr: source.typeGenericStr,
    });
    return normalizeJsonSchemaResponse(result);
  }

  const result = await requestClient.get(source.url, {
    baseURL: /^https?:\/\//i.test(source.url) ? undefined : '',
  });
  return normalizeJsonSchemaResponse(result);
}

async function loadItemJsonSchema(item: TenantSettingItem) {
  const key = getSettingKey(item);
  const source = getSettingJsonSchemaSource(item);

  if (!key || !source) {
    return;
  }

  schemaLoadingKeys[key] = true;
  delete schemaErrorMessages[key];

  try {
    const schema = await fetchJsonSchemaBySource(source);
    if (schema) {
      resolvedJsonSchemas[key] = schema;
    } else {
      schemaErrorMessages[key] = 'JSON Schema 解析失败';
    }
  } catch (error) {
    console.error(error);
    schemaErrorMessages[key] = 'JSON Schema 加载失败';
  } finally {
    delete schemaLoadingKeys[key];
  }
}

async function loadJsonSchemas(nextSettings: TenantSettingItem[]) {
  resetJsonSchemaState();
  await Promise.all(nextSettings.map((item) => loadItemJsonSchema(item)));
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
    const result = await settingService.list({
      enable: true,
      isContainsPublicData: true,
      orderBy: 'orderCode',
      orderDir: 'Asc',
      pageIndex: 1,
      pageSize: 2000,
    });

    settings.value = normalizeSettingList(result);
    resetDraftState(settings.value);
    await loadJsonSchemas(settings.value);
    ensureActiveTabs();
  } catch (error) {
    console.error(error);
    errorMessage.value = '系统配置加载失败';
  } finally {
    loading.value = false;
  }
}

function getItemKey(item: TenantSettingItem) {
  return getSettingKey(item);
}

function getItemKind(item: TenantSettingItem) {
  return resolveSettingEditorKind(item);
}

function getItemJsonSchema(item: TenantSettingItem) {
  const key = getItemKey(item);
  return resolvedJsonSchemas[key] || getSettingJsonSchema(item);
}

function isItemSchemaLoading(item: TenantSettingItem) {
  return !!schemaLoadingKeys[getItemKey(item)];
}

function getItemSchemaErrorMessage(item: TenantSettingItem) {
  return schemaErrorMessages[getItemKey(item)] || '';
}

function getItemPlaceholder(item: TenantSettingItem) {
  return item.inputPlaceholder || `请输入${getSettingDisplayName(item)}`;
}

function getItemRemarkLabel(item: TenantSettingItem) {
  return item.remark || undefined;
}

function getValue(item: TenantSettingItem) {
  return draftValues[getItemKey(item)];
}

function setValue(item: TenantSettingItem, value: any) {
  draftValues[getItemKey(item)] = value;
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

async function saveItem(item: TenantSettingItem) {
  const key = getItemKey(item);
  if (!key || !item.id || !isSettingEditable(item) || !isItemChanged(item)) {
    return;
  }

  savingKeys[key] = true;

  try {
    await settingService.update(
      buildTenantSettingUpdatePayload(item, draftValues[key]),
    );
    message.success(`${getSettingDisplayName(item)}保存成功`);
    await loadSettings();
  } finally {
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
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-3"
      >
        <div class="flex items-center gap-2 text-sm">
          <span class="font-medium text-foreground">
            系统配置({{ settings.length }})
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
        <Empty v-if="!loading && !hasSettings" description="暂无系统配置" />

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
                <div class="grid gap-2">
                  <div
                    v-for="item in group.settings"
                    :key="getItemKey(item)"
                    class="rounded-lg bg-card px-4 py-3"
                  >
                    <div
                      class="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-3"
                    >
                      <div
                        class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
                      >
                        <div class="text-sm font-semibold">
                          {{ getSettingDisplayName(item) }}
                        </div>
                        <div
                          v-if="item.code"
                          class="text-xs leading-5 text-muted-foreground"
                        >
                          编码：{{ item.code }}
                        </div>
                      </div>
                      <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <Tag v-if="item.valueType">{{ item.valueType }}</Tag>
                        <Tag v-if="!isSettingEditable(item)" color="default">
                          只读
                        </Tag>
                      </div>
                    </div>

                    <Form layout="vertical">
                      <Form.Item class="mb-0">
                        <template v-if="getItemRemarkLabel(item)" #label>
                          <span class="text-xs leading-5 text-muted-foreground">
                            {{ getItemRemarkLabel(item) }}
                          </span>
                        </template>
                        <div class="flex min-w-0 items-start gap-3">
                          <div class="min-w-0 flex-1">
                            <Switch
                              v-if="getItemKind(item) === 'switch'"
                              :checked="getValue(item)"
                              :disabled="!isSettingEditable(item)"
                              @update:checked="setValue(item, $event)"
                            />

                            <InputNumber
                              v-else-if="getItemKind(item) === 'number'"
                              :disabled="!isSettingEditable(item)"
                              :placeholder="getItemPlaceholder(item)"
                              :value="getValue(item)"
                              class="w-full"
                              @update:value="setValue(item, $event)"
                            />

                            <Select
                              v-else-if="getItemKind(item) === 'select'"
                              :disabled="!isSettingEditable(item)"
                              :options="getEditorOptions(item.editor)"
                              :placeholder="getItemPlaceholder(item)"
                              :value="getValue(item)"
                              allow-clear
                              class="w-full"
                              show-search
                              @update:value="setValue(item, $event)"
                            />

                            <JsonSchemaFormField
                              v-else-if="getItemKind(item) === 'json-schema'"
                              :disabled="!isSettingEditable(item)"
                              :error-message="getItemSchemaErrorMessage(item)"
                              :loading="isItemSchemaLoading(item)"
                              :model-value="getValue(item)"
                              :schema="getItemJsonSchema(item)"
                              :title="getSettingDisplayName(item)"
                              @update:model-value="setValue(item, $event)"
                            />

                            <JsonEditorField
                              v-else-if="getItemKind(item) === 'json'"
                              :disabled="!isSettingEditable(item)"
                              :model-value="getValue(item)"
                              :title="getSettingDisplayName(item)"
                              @update:model-value="setValue(item, $event)"
                            />

                            <CodeEditorField
                              v-else-if="getItemKind(item) === 'code'"
                              :disabled="!isSettingEditable(item)"
                              :language="getCodeEditorLanguage(item)"
                              :model-value="getValue(item)"
                              :title="getSettingDisplayName(item)"
                              @update:model-value="setValue(item, $event)"
                            />

                            <div
                              v-else-if="getItemKind(item) === 'image-url'"
                              class="space-y-2"
                            >
                              <Input
                                :disabled="!isSettingEditable(item)"
                                :placeholder="getItemPlaceholder(item)"
                                :value="getValue(item)"
                                @update:value="setValue(item, $event)"
                              >
                                <template #prefix>
                                  <IconifyIcon icon="lucide:image" />
                                </template>
                              </Input>
                              <img
                                v-if="getValue(item)"
                                :alt="getSettingDisplayName(item)"
                                class="max-h-32 rounded object-contain"
                                :src="getValue(item)"
                              />
                            </div>

                            <div
                              v-else-if="getItemKind(item) === 'video-url'"
                              class="space-y-2"
                            >
                              <Input
                                :disabled="!isSettingEditable(item)"
                                :placeholder="getItemPlaceholder(item)"
                                :value="getValue(item)"
                                @update:value="setValue(item, $event)"
                              >
                                <template #prefix>
                                  <IconifyIcon icon="lucide:video" />
                                </template>
                              </Input>
                              <video
                                v-if="getValue(item)"
                                class="max-h-40 w-full rounded bg-black"
                                controls
                                :src="getValue(item)"
                              ></video>
                            </div>

                            <Input
                              v-else-if="getItemKind(item) === 'file-url'"
                              :disabled="!isSettingEditable(item)"
                              :placeholder="getItemPlaceholder(item)"
                              :value="getValue(item)"
                              @update:value="setValue(item, $event)"
                            >
                              <template #prefix>
                                <IconifyIcon icon="lucide:file" />
                              </template>
                            </Input>

                            <Input.TextArea
                              v-else-if="getItemKind(item) === 'textarea'"
                              :auto-size="{ minRows: 3, maxRows: 8 }"
                              :disabled="!isSettingEditable(item)"
                              :placeholder="getItemPlaceholder(item)"
                              :value="getValue(item)"
                              @update:value="setValue(item, $event)"
                            />

                            <Input
                              v-else
                              :disabled="!isSettingEditable(item)"
                              :placeholder="getItemPlaceholder(item)"
                              :value="getValue(item)"
                              @update:value="setValue(item, $event)"
                            />
                          </div>

                          <Button
                            :disabled="loading || !isItemChanged(item)"
                            :loading="isItemSaving(item)"
                            type="primary"
                            @click="saveItem(item)"
                          >
                            <IconifyIcon class="size-4" icon="lucide:save" />
                            保存
                          </Button>
                        </div>
                      </Form.Item>
                    </Form>
                  </div>
                </div>
              </Tabs.TabPane>
            </Tabs>
          </Tabs.TabPane>
        </Tabs>
      </Spin>
    </div>
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
</style>
