<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Alert, Select } from 'ant-design-vue';

import { servicePluginService } from '../../api/service-plugin-service';
import JsonSchemaEditorField from '@levin/admin-framework/framework-commons/shared/json-schema-editor-field.vue';

import {
  createPayChannelDetailInfo,
  getPayChannelPluginImplType,
  getPayChannelProviders,
  type PayChannelPluginProvider,
  type PayChannelServicePlugin,
} from './pay-channel-provider';

const props = defineProps<{
  formState: Record<string, any>;
}>();

const loading = ref(false);
const loadError = ref('');
const plugins = ref<PayChannelServicePlugin[]>([]);

const providers = computed(() =>
  getPayChannelProviders(props.formState.currencyType, plugins.value),
);
const detailInfo = computed<Record<string, any>>(() => {
  const value = props.formState.detailInfo;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
});
const selectedProvider = computed(() =>
  providers.value.find(
    (item) => item.code === detailInfo.value.providerCode,
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

function selectProvider(code?: string) {
  const provider = providers.value.find((item) => item.code === code);
  if (!provider) {
    props.formState.detailInfo = {};
    return;
  }

  if (
    detailInfo.value.providerCode === provider.code &&
    detailInfo.value['@JsonSchema'] === provider.configEditor
  ) {
    return;
  }

  props.formState.detailInfo = createPayChannelDetailInfo(provider);
}

function reconcileDetailInfo() {
  if (!pluginConfigured.value) {
    return;
  }

  const providerCode = detailInfo.value.providerCode;
  const currentProvider = providers.value.find(
    (item) => item.code === providerCode,
  );
  if (currentProvider) {
    if (detailInfo.value['@JsonSchema'] !== currentProvider.configEditor) {
      props.formState.detailInfo = {
        ...detailInfo.value,
        '@JsonSchema': currentProvider.configEditor,
      };
    }
    return;
  }

  const legacyProvider = providers.value.find(
    (item) => item.configEditor === detailInfo.value['@JsonSchema'],
  );
  if (legacyProvider) {
    props.formState.detailInfo = {
      ...detailInfo.value,
      providerCode: legacyProvider.code,
    };
    return;
  }

  if (providerCode || detailInfo.value['@JsonSchema']) {
    props.formState.detailInfo = {};
  }
}

async function loadPlugins() {
  loading.value = true;
  loadError.value = '';
  try {
    const result = await servicePluginService.list({
      pageIndex: 1,
      pageSize: 500,
    });
    plugins.value = getListItems<PayChannelServicePlugin>(result);
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

onMounted(() => {
  void loadPlugins();
});
</script>

<template>
  <div class="space-y-3">
    <Select
      :disabled="!pluginConfigured || loading"
      :loading="loading"
      :options="providerOptions"
      :placeholder="pluginConfigured ? '请选择支付提供商' : '请先选择货币类型'"
      :value="detailInfo.providerCode"
      class="w-full"
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
      v-else-if="!selectedProvider"
      message="选择支付提供商后显示对应的配置参数"
      show-icon
      type="info"
    />
    <JsonSchemaEditorField
      v-else
      :model-value="detailInfo"
      :schema-source="selectedProvider.configEditor"
      title="通道详情"
      @update:model-value="updateDetailInfo"
    />
  </div>
</template>
