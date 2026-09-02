<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Alert, Select } from 'ant-design-vue';

import { servicePluginService } from '../../api/service-plugin-service';
import JsonSchemaEditorField from '@levin/admin-framework/framework-commons/shared/json-schema-editor-field.vue';

import {
  createPayChannelDetailInfo,
  getPayChannelPluginImplType,
  getPayChannelProviders,
  normalizePayChannelDetailInfo,
  reconcilePayChannelProviderSelection,
  type PayChannelServicePlugin,
} from './pay-channel-provider';

const props = defineProps<{
  formState: Record<string, any>;
  mode?: 'detail' | 'provider';
}>();

const loading = ref(false);
const loadError = ref('');
const plugins = ref<PayChannelServicePlugin[]>([]);
let pluginListPromise: null | Promise<PayChannelServicePlugin[]> = null;
const fieldMode = computed(() => props.mode || 'detail');

const providers = computed(() =>
  getPayChannelProviders(props.formState.currencyType, plugins.value),
);
const detailInfo = computed<Record<string, any>>(() =>
  normalizePayChannelDetailInfo(props.formState.detailInfo),
);
const selectedProviderCode = computed(() =>
  String(props.formState.providerCode || detailInfo.value.providerCode || '').trim(),
);
const selectedProvider = computed(() =>
  providers.value.find(
    (item) => item.code === selectedProviderCode.value,
  ),
);
const providerOptions = computed(() =>
  providers.value.map((item) => ({
    label: item.name || item.code,
    value: item.code,
  })),
);
const pluginConfigured = computed(() =>
  Boolean(getPayChannelPluginImplType(props.formState.currencyType)),
);

function getListItems<T>(result: any): T[] {
  if (Array.isArray(result)) {
    return result;
  }
  return result?.items || result?.records || result?.list || result?.data || [];
}

function updateDetailInfo(value: Record<string, any>) {
  props.formState.detailInfo = value;
}

function selectProvider(value: unknown) {
  const code =
    typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : undefined;
  const provider = providers.value.find((item) => item.code === code);
  if (!provider) {
    props.formState.providerCode = undefined;
    props.formState.detailInfo = {};
    return;
  }

  if (
    selectedProviderCode.value === provider.code &&
    detailInfo.value['@JsonSchema'] === provider.configEditor
  ) {
    props.formState.providerCode = provider.code;
    return;
  }

  props.formState.providerCode = provider.code;
  props.formState.detailInfo = createPayChannelDetailInfo(provider);
}

function reconcileDetailInfo() {
  const nextState = reconcilePayChannelProviderSelection(
    {
      detailInfo: props.formState.detailInfo,
      providerCode: props.formState.providerCode,
    },
    providers.value,
    pluginConfigured.value,
  );
  const nextProviderCode = String(nextState.providerCode || '').trim();

  if (selectedProviderCode.value !== nextProviderCode) {
    props.formState.providerCode = nextState.providerCode;
  }
  if (props.formState.detailInfo !== nextState.detailInfo) {
    props.formState.detailInfo = nextState.detailInfo;
  }
}

async function fetchPlugins() {
  if (!pluginListPromise) {
    pluginListPromise = servicePluginService
      .list({
        pageIndex: 1,
        pageSize: 500,
      })
      .then((result) => getListItems<PayChannelServicePlugin>(result))
      .catch((error) => {
        pluginListPromise = null;
        throw error;
      });
  }

  return pluginListPromise;
}

async function loadPlugins() {
  loading.value = true;
  loadError.value = '';
  try {
    plugins.value = await fetchPlugins();
    reconcileDetailInfo();
  } catch (error) {
    console.error(error);
    loadError.value = '支付插件目录加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.formState.currencyType,
  () => reconcileDetailInfo(),
);
watch(
  () => props.formState.providerCode,
  () => reconcileDetailInfo(),
);

onMounted(() => {
  void loadPlugins();
});
</script>

<template>
  <div class="space-y-3">
    <Select
      v-if="fieldMode === 'provider'"
      :disabled="!pluginConfigured || loading"
      :loading="loading"
      :options="providerOptions"
      :placeholder="pluginConfigured ? '请选择支付提供商' : '请先选择货币类型'"
      :value="selectedProviderCode || undefined"
      allow-clear
      class="w-full"
      show-search
      @update:value="selectProvider"
    />
    <Alert v-if="loadError" :message="loadError" show-icon type="error" />
    <Alert
      v-else-if="pluginConfigured && !loading && !providers.length"
      message="当前货币类型没有可用的支付提供商"
      show-icon
      type="warning"
    />
    <Alert
      v-else-if="fieldMode !== 'provider' && !selectedProvider"
      message="选择支付提供商后显示对应的配置参数"
      show-icon
      type="info"
    />
    <JsonSchemaEditorField
      v-else-if="fieldMode !== 'provider' && selectedProvider"
      :model-value="detailInfo"
      :schema-source="selectedProvider.configEditor"
      title="通道详情"
      @update:model-value="updateDetailInfo"
    />
  </div>
</template>
