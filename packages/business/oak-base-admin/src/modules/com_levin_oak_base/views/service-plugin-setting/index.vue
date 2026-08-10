<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Button, message, Modal, Select } from 'ant-design-vue';

import { servicePluginService } from '../../api/service-plugin-service';
import { servicePluginSettingService } from '../../api/service-plugin-setting-service';
import CrudPage from '../crud-page.vue';
import SettingValueContentField from '../setting-value-content-field.vue';
import { servicePluginSettingPageCrudConfig } from './config';

interface ServicePluginProvider {
  code?: string;
  configEditor?: string;
  disabled?: boolean;
  name?: string;
}

interface ServicePluginRecord {
  id: string;
  name?: string;
  providerList?: ServicePluginProvider[];
}

interface ServicePluginSettingRecord {
  id?: string;
  optimisticLock?: number;
  servicePlugin?: ServicePluginRecord;
  servicePluginId?: string;
  servicePluginProviderCode?: string;
  value?: Record<string, any>;
}

const plugins = ref<ServicePluginRecord[]>([]);
const pluginsLoading = ref(false);
const providerConfigOpen = ref(false);
const providerConfigSaving = ref(false);
const editingSetting = ref<ServicePluginSettingRecord>();
const providerConfigFormState = reactive<Record<string, any>>({
  editor: 'json',
  valueContent: {},
  valueType: 'Json',
});
const reloadSettings = ref<undefined | (() => Promise<void> | void)>();

const pluginOptions = computed(() =>
  plugins.value.map((plugin) => ({
    label: plugin.name || plugin.id,
    value: plugin.id,
  })),
);

function getListItems<T>(result: any): T[] {
  if (Array.isArray(result)) {
    return result;
  }

  return result?.items || result?.records || result?.list || result?.data || [];
}

function getProviders(formState: Record<string, any>) {
  return (
    plugins.value.find((plugin) => plugin.id === formState.servicePluginId)
      ?.providerList || []
  ).filter((provider) => provider.code && !provider.disabled);
}

function getProviderOptions(formState: Record<string, any>) {
  return getProviders(formState).map((provider) => ({
    label: provider.name || provider.code,
    value: provider.code!,
  }));
}

function getPlugin(record: ServicePluginSettingRecord) {
  return (
    record.servicePlugin ||
    plugins.value.find((plugin) => plugin.id === record.servicePluginId)
  );
}

function getPluginName(record: ServicePluginSettingRecord) {
  const plugin = getPlugin(record);
  return plugin?.name || record.servicePluginId || '-';
}

function getProviderName(record: ServicePluginSettingRecord) {
  const plugin = getPlugin(record);
  const provider = plugin?.providerList?.find(
    (item) => item.code === record.servicePluginProviderCode,
  );
  return provider?.name || record.servicePluginProviderCode || '-';
}

function isSelectedProviderEnabled(record: ServicePluginSettingRecord) {
  const plugin = getPlugin(record);
  return Boolean(
    plugin?.providerList?.some(
      (provider) =>
        provider.code === record.servicePluginProviderCode &&
        !provider.disabled,
    ),
  );
}

const editingProvider = computed(() => {
  const record = editingSetting.value;
  if (!record) {
    return undefined;
  }

  return getPlugin(record)?.providerList?.find(
    (provider) => provider.code === record.servicePluginProviderCode,
  );
});

const providerConfigTitle = computed(() => {
  const record = editingSetting.value;
  return record
    ? `配置编辑 - ${getPluginName(record)} / ${getProviderName(record)}`
    : '配置编辑';
});

function cloneJsonValue(value: any): Record<string, any> {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  return JSON.parse(JSON.stringify(value));
}

function openProviderConfig(
  record: ServicePluginSettingRecord,
  reload?: () => Promise<void> | void,
) {
  const providerCode = record.servicePluginProviderCode;
  if (!providerCode) {
    message.warning('请先在设置中选择供应商');
    return;
  }
  if (!isSelectedProviderEnabled(record)) {
    message.warning('当前供应商已禁用，不能编辑配置');
    return;
  }

  editingSetting.value = record;
  providerConfigFormState.editor =
    editingProvider.value?.configEditor?.trim() || 'json';
  providerConfigFormState.id = `${record.id}:${providerCode}`;
  providerConfigFormState.name = providerConfigTitle.value;
  providerConfigFormState.valueContent = cloneJsonValue(
    record.value?.[providerCode],
  );
  reloadSettings.value = reload;
  providerConfigOpen.value = true;
}

async function saveProviderConfig() {
  const record = editingSetting.value;
  const providerCode = record?.servicePluginProviderCode;

  if (!record?.id || !providerCode) {
    return;
  }

  providerConfigSaving.value = true;

  try {
    await servicePluginSettingService.update({
      forceUpdateFields: ['value'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      value: {
        ...(record.value || {}),
        [providerCode]: cloneJsonValue(providerConfigFormState.valueContent),
      },
    });
    message.success('供应商配置已保存');
    providerConfigOpen.value = false;
    await reloadSettings.value?.();
  } catch (error) {
    console.error(error);
    message.error('供应商配置保存失败');
  } finally {
    providerConfigSaving.value = false;
  }
}

function handlePluginChange(formState: Record<string, any>, pluginId?: string) {
  formState.servicePluginId = pluginId;
  const providerCodes = new Set(
    getProviders(formState).map((item) => item.code),
  );
  if (!providerCodes.has(formState.servicePluginProviderCode)) {
    formState.servicePluginProviderCode = undefined;
  }
}

async function loadPlugins() {
  pluginsLoading.value = true;
  try {
    const result = await servicePluginService.list({
      enable: true,
      pageIndex: 1,
      pageSize: 500,
    });
    plugins.value = getListItems<ServicePluginRecord>(result);
  } catch (error) {
    console.error(error);
    message.error('加载服务插件失败');
  } finally {
    pluginsLoading.value = false;
  }
}

onMounted(() => {
  void loadPlugins();
});
</script>

<template>
  <CrudPage :config="servicePluginSettingPageCrudConfig">
    <template #search-field-servicePluginId="{ searchState }">
      <Select
        :loading="pluginsLoading"
        :options="pluginOptions"
        :value="searchState.servicePluginId"
        allow-clear
        class="w-full"
        placeholder="请选择服务插件"
        show-search
        @update:value="
          handlePluginChange(
            searchState,
            typeof $event === 'string' ? $event : undefined,
          )
        "
      />
    </template>

    <template #form-field-servicePluginId="{ editingRecord, formState }">
      <Select
        :disabled="Boolean(editingRecord?.id)"
        :loading="pluginsLoading"
        :options="pluginOptions"
        :value="formState.servicePluginId"
        allow-clear
        class="w-full"
        placeholder="请选择服务插件"
        show-search
        @update:value="
          handlePluginChange(
            formState,
            typeof $event === 'string' ? $event : undefined,
          )
        "
      />
    </template>

    <template #search-field-servicePluginProviderCode="{ searchState }">
      <Select
        :disabled="!searchState.servicePluginId"
        :options="getProviderOptions(searchState)"
        :value="searchState.servicePluginProviderCode"
        allow-clear
        class="w-full"
        placeholder="请先选择服务插件"
        show-search
        @update:value="searchState.servicePluginProviderCode = $event"
      />
    </template>

    <template #form-field-servicePluginProviderCode="{ formState }">
      <Select
        :disabled="!formState.servicePluginId"
        :options="getProviderOptions(formState)"
        :value="formState.servicePluginProviderCode"
        allow-clear
        class="w-full"
        placeholder="请先选择服务插件"
        show-search
        @update:value="formState.servicePluginProviderCode = $event"
      />
    </template>

    <template #table-cell-servicePluginId="{ record }">
      {{ getPluginName(record) }}
    </template>

    <template #table-cell-servicePluginProviderCode="{ record }">
      {{ getProviderName(record) }}
    </template>

    <template #row-actions="{ record, reload }">
      <Button
        :disabled="
          !record.servicePluginProviderCode ||
          !isSelectedProviderEnabled(record)
        "
        size="small"
        type="link"
        @click="openProviderConfig(record, reload)"
      >
        配置编辑
      </Button>
    </template>
  </CrudPage>

  <Modal
    v-model:open="providerConfigOpen"
    :confirm-loading="providerConfigSaving"
    :mask-closable="false"
    destroy-on-close
    ok-text="保存"
    :title="providerConfigTitle"
    width="min(80vw, 1120px)"
    @ok="saveProviderConfig"
  >
    <SettingValueContentField
      :key="`${editingSetting?.id}:${editingSetting?.servicePluginProviderCode}`"
      inline
      :form-state="providerConfigFormState"
    />
  </Modal>
</template>
