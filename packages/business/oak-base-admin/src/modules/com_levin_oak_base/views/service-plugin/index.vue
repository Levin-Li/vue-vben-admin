<script lang="ts" setup>
import type { ProviderSelectionModes } from '../provider-selection-mode';

import { computed, onMounted, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { isSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Switch,
  Table,
  Tooltip,
} from 'ant-design-vue';

import { servicePluginService } from '../../api/service-plugin-service';
import CrudPage from '../crud-page.vue';
import {
  getProviderSelectionMode,
  getProviderSelectionModeLabel,
  parseProviderSelectionModesResponse,
} from '../provider-selection-mode';
import { resolveServiceProviderName } from '../service-provider-display-name';
import {
  preserveUnsetPluginConfigurationRule,
  servicePluginPageCrudConfig,
} from './config';

interface ServicePluginProvider {
  allowMultipleConfigurations?: boolean | null;
  code?: string;
  configEditor?: string;
  disabled?: boolean;
  name?: string;
  remark?: string;
}

interface ServicePluginRecord {
  id?: string;
  name?: string;
  optimisticLock?: number;
  providerList?: ServicePluginProvider[];
}

const providerListOpen = ref(false);
const userStore = useUserStore();
const canManageConfigurationRules = computed(() =>
  isSuperAdminUser(userStore.userInfo),
);
const selectedPlugin = ref<ServicePluginRecord>();
const editingProviders = ref<ServicePluginProvider[]>([]);
const providerListSaving = ref(false);
const providerSelectionModes = ref<ProviderSelectionModes>({});
const providerSelectionModeOptions = ref<Record<string, string[]>>({});
const modesReady = ref(false);
const editingPluginId = ref('');

const providerListTitle = computed(() => {
  const pluginName = selectedPlugin.value?.name;
  return pluginName ? `供应商列表 - ${pluginName}` : '供应商列表';
});
const selectedModeLabel = computed(() => {
  const mode = getProviderSelectionMode(
    providerSelectionModes.value,
    selectedPlugin.value?.id,
  );
  if (mode === 'MULTI_CHOICE') return '多供应商可同时启用，由每次操作选择';
  if (mode === 'MULTI_ACTIVE_BALANCED')
    return '多供应商及多配置实例可同时启用，按权重自动均衡使用';
  if (mode === 'SINGLE_ACTIVE')
    return '这里仅列出可选供应商。到“服务插件设置”或“租户插件设置”中启用要使用的那家；同一租户和域名下只能启用一家。';
  return '模式目录未加载';
});

async function loadModeCatalog() {
  try {
    const [modes, options] = await Promise.all([
      servicePluginService.providerSelectionModes(),
      servicePluginService.providerSelectionModeOptions(),
    ]);
    providerSelectionModes.value = parseProviderSelectionModesResponse(modes);
    providerSelectionModeOptions.value =
      (options as { data?: Record<string, string[]> }).data ||
      (options as Record<string, string[]>);
    modesReady.value = true;
  } catch (error) {
    console.error(error);
    notifyApiErrorOnce(error);
  }
}

onMounted(() => {
  void loadModeCatalog();
});

// 普通编辑读取完整记录；模式候选只使用该插件声明支持的值。
const editPageConfig = computed(() => ({
  ...servicePluginPageCrudConfig,
  loadEditRecord: async (record: Record<string, any>) => {
    const detail = (await servicePluginService.retrieve({
      id: record.id,
    })) as Record<string, any>;
    editingPluginId.value = String(detail.id || record.id);
    return {
      ...detail,
      __originalAllowMultipleConfigurations: detail.allowMultipleConfigurations,
      allowMultipleConfigurations: detail.allowMultipleConfigurations !== false,
      providerSelectionMode:
        detail.providerSelectionMode ||
        getProviderSelectionMode(
          providerSelectionModes.value,
          editingPluginId.value,
        ) ||
        'SINGLE_ACTIVE',
    };
  },
  transformSubmit: preserveUnsetPluginConfigurationRule,
  fields: servicePluginPageCrudConfig.fields.map((field) =>
    field.key === 'providerSelectionMode'
      ? {
          ...field,
          loadOptions: async () => {
            if (!modesReady.value) await loadModeCatalog();
            return (
              providerSelectionModeOptions.value[editingPluginId.value] || []
            ).map((mode) => ({
              label: getProviderSelectionModeLabel(mode),
              value: mode,
            }));
          },
        }
      : field,
  ),
}));

const providerColumns = [
  { dataIndex: 'name', key: 'name', title: '供应商名称', width: 180 },
  { dataIndex: 'code', key: 'code', title: '供应商编码' },
  {
    dataIndex: 'configEditor',
    key: 'configEditor',
    title: '配置编辑器',
    width: 180,
  },
  { key: 'disabled', title: '是否禁用' },
  {
    key: 'allowMultipleConfigurations',
    title: '允许多套配置并存',
    width: 190,
  },
  { dataIndex: 'remark', key: 'remark', title: '备注' },
];

function openProviderList(record: ServicePluginRecord) {
  selectedPlugin.value = record;
  editingProviders.value = (record.providerList || []).map((provider) => ({
    ...provider,
  }));
  providerListOpen.value = true;
}

async function saveProviders() {
  const plugin = selectedPlugin.value;
  if (
    !plugin?.id ||
    !modesReady.value ||
    !getProviderSelectionMode(providerSelectionModes.value, plugin.id) ||
    providerListSaving.value
  ) {
    return;
  }

  const providerList = editingProviders.value.map((provider) => ({
    ...provider,
    name: provider.name?.trim(),
  }));
  if (providerList.some((provider) => !provider.name)) {
    message.warning('供应商名称不能为空');
    return;
  }

  providerListSaving.value = true;
  try {
    await servicePluginService.update({
      autoForceUpdateField: false,
      forceUpdateFields: ['providerList'],
      id: plugin.id,
      optimisticLock: plugin.optimisticLock,
      providerList,
    });
    plugin.providerList = providerList;
    plugin.optimisticLock = Number(plugin.optimisticLock || 0) + 1;
    message.success('供应商信息已保存');
    providerListOpen.value = false;
  } catch (error) {
    console.error(error);
    notifyApiErrorOnce(error);
  } finally {
    providerListSaving.value = false;
  }
}
</script>

<template>
  <CrudPage :config="editPageConfig">
    <!-- 列表展示中文名称，底层数据仍保留原有模式编码。 -->
    <template #table-cell-providerSelectionMode="{ value }">
      {{ getProviderSelectionModeLabel(value) }}
    </template>
    <template #table-cell-pluginTypeName="{ record, value }">
      <Tooltip :mouse-enter-delay="1">
        <template #title>
          <div>插件接口类型：{{ record.pluginType || '-' }}</div>
          <div>插件实现类型：{{ record.pluginImplType || '-' }}</div>
        </template>
        <span>{{ value || '-' }}</span>
      </Tooltip>
    </template>
    <template #row-actions="{ record }">
      <Button
        :disabled="
          !modesReady ||
          !getProviderSelectionMode(providerSelectionModes, record.id)
        "
        size="small"
        type="link"
        @click="openProviderList(record)"
      >
        供应商
      </Button>
    </template>
  </CrudPage>

  <Modal
    v-model:open="providerListOpen"
    :confirm-loading="providerListSaving"
    :mask-closable="false"
    ok-text="保存"
    :title="providerListTitle"
    width="min(80vw, 1120px)"
    @ok="saveProviders"
  >
    <Alert :message="selectedModeLabel" show-icon type="info" class="mb-3" />
    <Table
      :columns="providerColumns"
      :data-source="editingProviders"
      :pagination="false"
      :scroll="{ y: 'min(560px, calc(100vh - 360px))' }"
      row-key="code"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <Input
            :value="resolveServiceProviderName(record)"
            placeholder="请输入供应商名称"
            @update:value="record.name = $event"
          />
        </template>
        <template v-else-if="column.key === 'remark'">
          <Input v-model:value="record.remark" placeholder="请输入备注" />
        </template>
        <template v-else-if="column.key === 'disabled'">
          <Switch
            v-model:checked="record.disabled"
            checked-children="禁用"
            un-checked-children="启用"
          />
        </template>
        <template v-else-if="column.key === 'allowMultipleConfigurations'">
          <Switch
            v-model:checked="record.allowMultipleConfigurations"
            :disabled="!canManageConfigurationRules"
            checked-children="允许"
            un-checked-children="仅一套"
          />
        </template>
      </template>
    </Table>
  </Modal>
</template>
