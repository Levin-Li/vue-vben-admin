<script lang="ts" setup>
import type { ProviderOnboardingGuidance } from '../provider-onboarding-guidance';
import type { ProviderSelectionModes } from '../provider-selection-mode';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
} from 'ant-design-vue';

import { servicePluginService } from '../../api/service-plugin-service';
import { servicePluginSettingService } from '../../api/service-plugin-setting-service';
import CrudPage from '../crud-page.vue';
import {
  buildProviderConfigurationUpdate,
  prepareProviderSettingSubmit,
} from '../provider-configuration-update';
import ProviderGuidance from '../provider-onboarding-guidance.vue';
import {
  allowsMultipleActiveProviders,
  allowsMultipleProviderInstances,
  describeProviderConfiguration,
  getProviderSelectionMode,
  parseProviderSelectionModesResponse,
} from '../provider-selection-mode';
import {
  filterServiceProviderOption,
  resolveServiceProviderName,
} from '../service-provider-display-name';
import SettingValueContentField from '../setting-value-content-field.vue';
import { servicePluginSettingPageCrudConfig } from './config';
import { filterServicePluginOption } from './plugin-option-search';

interface ServicePluginProvider {
  code?: string;
  configEditor?: string;
  disabled?: boolean;
  name?: string;
  onboardingGuidance?: ProviderOnboardingGuidance;
}

interface ServicePluginRecord {
  enable?: boolean;
  groupName?: string;
  id: string;
  name?: string;
  pluginTypeName?: string;
  providerList?: ServicePluginProvider[];
}

interface ServicePluginSettingRecord {
  id?: string;
  optimisticLock?: number;
  servicePlugin?: ServicePluginRecord;
  servicePluginId?: string;
  servicePluginProviderCode?: string;
  servicePluginProviderInstanceCode?: string;
  tenantId?: null | string;
  usageCount?: number;
  usageWeight?: number;
  value?: Record<string, any>;
}

const plugins = ref<ServicePluginRecord[]>([]);
const pluginsLoading = ref(false);
const providerSelectionModes = ref<ProviderSelectionModes>({});
const modesReady = ref(false);
const providerConfigOpen = ref(false);
const providerConfigSaving = ref(false);
const editingSetting = ref<ServicePluginSettingRecord>();
const editingProviderCode = ref<string>();
const providerConfigFormState = reactive<Record<string, any>>({
  editor: 'json',
  valueContent: {},
  valueType: 'Json',
});
const reloadSettings = ref<(() => Promise<void> | void) | undefined>();

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function getPluginOptionLabel(plugin: ServicePluginRecord) {
  const name = normalizeText(plugin.name) || plugin.id;
  const pluginTypeName = normalizeText(plugin.pluginTypeName);

  return pluginTypeName ? `${name}（${pluginTypeName}）` : name;
}

const pluginOptions = computed(() =>
  plugins.value.map((plugin) => ({
    label: getPluginOptionLabel(plugin),
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
    label: resolveServiceProviderName(provider),
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

function getMode(pluginId?: string) {
  return getProviderSelectionMode(providerSelectionModes.value, pluginId);
}

function allowsProviderInstances(pluginId?: string) {
  return allowsMultipleProviderInstances(getMode(pluginId));
}

function isMultiChoice(record?: ServicePluginSettingRecord) {
  return allowsMultipleActiveProviders(getMode(record?.servicePluginId));
}

const guardedCrudConfig = computed(() => ({
  ...servicePluginSettingPageCrudConfig,
  allowCreate: modesReady.value,
  allowEdit: modesReady.value,
  transformSubmit: (
    values: Record<string, any>,
    editingRecord: null | Record<string, any>,
  ) => {
    if (
      !modesReady.value ||
      !getMode(values.servicePluginId || editingRecord?.servicePluginId)
    ) {
      throw new Error('供应商选择模式未加载，无法保存插件设置');
    }
    return prepareProviderSettingSubmit(values, Boolean(editingRecord));
  },
}));

function getProviderName(record: ServicePluginSettingRecord) {
  const plugin = getPlugin(record);
  const provider = plugin?.providerList?.find(
    (item) => item.code === record.servicePluginProviderCode,
  );
  return provider
    ? resolveServiceProviderName(provider)
    : record.servicePluginProviderCode || '-';
}

function getProviderConfigurationStatus(record: ServicePluginSettingRecord) {
  const code = record.servicePluginProviderCode;
  const provider = getPlugin(record)?.providerList?.find(
    (item) => item.code === code,
  );
  return describeProviderConfiguration(
    Boolean(provider?.disabled),
    code ? record.value?.[code] : undefined,
  );
}

const editingProvider = computed(() => {
  const record = editingSetting.value;
  if (!record) {
    return undefined;
  }

  return getPlugin(record)?.providerList?.find(
    (provider) => provider.code === editingProviderCode.value,
  );
});
const providerConfigTitle = computed(() => {
  const record = editingSetting.value;
  return record
    ? `配置编辑 - ${getPluginName(record)} / ${editingProvider.value ? resolveServiceProviderName(editingProvider.value) : editingProviderCode.value || '-'}`
    : '配置编辑';
});
function cloneJsonValue(value: any): Record<string, any> {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  // 配置表单可持有 Vue reactive proxy，按 JSON 请求语义克隆。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value));
}

function openProviderConfig(
  record: ServicePluginSettingRecord,
  reload?: () => Promise<void> | void,
) {
  const mode = getMode(record.servicePluginId);
  if (!modesReady.value || !mode) {
    message.warning('供应商选择模式未加载，暂不能编辑配置');
    return;
  }
  const providerCode = record.servicePluginProviderCode;
  if (!providerCode) {
    message.warning('请先在设置中选择供应商');
    return;
  }
  editingSetting.value = record;
  editingProviderCode.value = providerCode;
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
  const providerCode = editingProviderCode.value;

  if (
    !record?.id ||
    !providerCode ||
    !modesReady.value ||
    !getMode(record.servicePluginId)
  ) {
    return;
  }

  providerConfigSaving.value = true;

  try {
    // 平台主体携带记录实际租户，租户主体由服务端注入范围。
    await servicePluginSettingService.update(
      buildProviderConfigurationUpdate(
        record,
        providerCode,
        cloneJsonValue(providerConfigFormState.valueContent),
        isPlatformUser(useUserStore().userInfo),
      ),
    );
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
  formState.servicePluginProviderInstanceCode = 'default';
  formState.usageWeight = 1;
}

async function loadPlugins() {
  pluginsLoading.value = true;
  modesReady.value = false;
  try {
    const [result, modesResult] = await Promise.all([
      servicePluginService.list({ enable: true, pageIndex: 1, pageSize: 500 }),
      servicePluginService.providerSelectionModes(),
    ]);
    plugins.value = getListItems<ServicePluginRecord>(result);
    providerSelectionModes.value =
      parseProviderSelectionModesResponse(modesResult);
    modesReady.value = true;
  } catch (error) {
    console.error(error);
    providerSelectionModes.value = {};
    message.error('加载服务插件或供应商选择模式失败，配置写入已禁用');
  } finally {
    pluginsLoading.value = false;
  }
}

onMounted(() => {
  void loadPlugins();
});
</script>

<template>
  <div class="service-plugin-setting-page">
    <CrudPage :config="guardedCrudConfig">
      <template #search-field-servicePluginId="{ searchState }">
        <Select
          :filter-option="filterServicePluginOption"
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
          :filter-option="filterServicePluginOption"
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
          :filter-option="filterServiceProviderOption"
          :options="getProviderOptions(searchState)"
          :value="searchState.servicePluginProviderCode"
          allow-clear
          class="w-full"
          placeholder="请先选择服务插件"
          show-search
          @update:value="searchState.servicePluginProviderCode = $event"
        />
      </template>

      <template
        #form-field-servicePluginProviderCode="{ editingRecord, formState }"
      >
        <div class="space-y-1">
          <Select
            :disabled="
              Boolean(editingRecord?.id) ||
              !modesReady ||
              !formState.servicePluginId
            "
            :filter-option="filterServiceProviderOption"
            :options="getProviderOptions(formState)"
            :value="formState.servicePluginProviderCode"
            allow-clear
            class="w-full"
            placeholder="请先选择服务插件"
            show-search
            @update:value="formState.servicePluginProviderCode = $event"
          />
          <p class="text-muted-foreground text-xs">
            每个供应商单独创建一条设置；新增默认停用，完成配置后再启用。
          </p>
        </div>
      </template>

      <template
        #form-field-servicePluginProviderInstanceCode="{
          editingRecord,
          formState,
        }"
      >
        <Input
          v-if="
            editingRecord?.id ||
            !allowsProviderInstances(formState.servicePluginId)
          "
          :value="formState.servicePluginProviderInstanceCode || 'default'"
          disabled
        />
        <Input
          v-else
          v-model:value="formState.servicePluginProviderInstanceCode"
          placeholder="例如 account-a"
        />
      </template>

      <template #form-field-usageWeight="{ formState }">
        <div class="space-y-1">
          <InputNumber
            v-model:value="formState.usageWeight"
            :disabled="!allowsProviderInstances(formState.servicePluginId)"
            :min="1"
            :precision="0"
            class="w-full"
          />
          <p class="text-muted-foreground text-xs">
            权重为相对值，默认 1；均衡模式按使用次数与权重自动分配。
          </p>
        </div>
      </template>

      <template #table-cell-servicePluginId="{ record }">
        {{ getPluginName(record) }}
      </template>

      <template #table-cell-servicePluginProviderCode="{ record }">
        <div>{{ getProviderName(record) }}</div>
        <div v-if="isMultiChoice(record)" class="text-muted-foreground text-xs">
          {{ getProviderConfigurationStatus(record) }}
        </div>
      </template>

      <template #row-actions="{ record, reload }">
        <Button
          :disabled="
            !modesReady ||
            !getMode(record.servicePluginId) ||
            !record.servicePluginProviderCode
          "
          size="small"
          type="link"
          @click="openProviderConfig(record, reload)"
        >
          编辑供应商配置
        </Button>
      </template>
    </CrudPage>
  </div>

  <Modal
    v-model:open="providerConfigOpen"
    :body-style="{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }"
    :confirm-loading="providerConfigSaving"
    :mask-closable="false"
    centered
    destroy-on-close
    ok-text="保存"
    width="min(80vw, 1120px)"
    @ok="saveProviderConfig"
  >
    <!-- 弹窗标题中的通用入口仅在供应商提供 Markdown 指南时显示。 -->
    <template #title>
      <div class="flex items-center justify-between gap-4 pr-8">
        <span>{{ providerConfigTitle }}</span>
        <ProviderGuidance
          :guidance="editingProvider?.onboardingGuidance"
          :provider-code="editingProviderCode"
        />
      </div>
    </template>
    <div v-if="isMultiChoice(editingSetting)" class="mb-4 space-y-3">
      <div class="flex items-center gap-2">
        <Switch
          v-model:checked="providerConfigFormState.valueContent.enable"
          :disabled="editingProvider?.disabled"
        />
        <span>{{
          editingProvider?.disabled
            ? '目录禁用：当前供应商不可运行'
            : '启用当前供应商的登录与绑定'
        }}</span>
      </div>
    </div>
    <p v-else-if="editingSetting" class="mb-4 text-sm">
      单选插件同一范围最多启用一个供应商设置。
    </p>
    <SettingValueContentField
      :key="`${editingSetting?.id}:${editingProviderCode}`"
      inline
      :form-state="providerConfigFormState"
    />
  </Modal>
</template>
