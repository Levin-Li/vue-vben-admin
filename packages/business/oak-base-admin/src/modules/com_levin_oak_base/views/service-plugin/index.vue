<script lang="ts" setup>
import type {
  ProviderSelectionMode,
  ProviderSelectionModes,
} from '../provider-selection-mode';

import { computed, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Table,
  Tooltip,
} from 'ant-design-vue';

import { servicePluginService } from '../../api/service-plugin-service';
import CrudPage from '../crud-page.vue';
import {
  getProviderSelectionMode,
  parseProviderSelectionModesResponse,
} from '../provider-selection-mode';
import { resolveServiceProviderName } from '../service-provider-display-name';
import SettingValueContentField from '../setting-value-content-field.vue';
import { servicePluginPageCrudConfig } from './config';

interface ServicePluginProvider {
  code?: string;
  configEditor?: string;
  disabled?: boolean;
  name?: string;
  remark?: string;
}

interface ServicePluginRecord {
  baseConfig?: Record<string, any>;
  configEditor?: string;
  enable?: boolean;
  id?: string;
  name?: string;
  optimisticLock?: number;
  pluginImplType?: string;
  pluginType?: string;
  providerList?: ServicePluginProvider[];
  providerSelectionMode?:
    | 'MULTI_ACTIVE_BALANCED'
    | 'MULTI_CHOICE'
    | 'SINGLE_ACTIVE';
}

const providerListOpen = ref(false);
const selectedPlugin = ref<ServicePluginRecord>();
const editingProviders = ref<ServicePluginProvider[]>([]);
const providerListSaving = ref(false);
const providerSelectionModes = ref<ProviderSelectionModes>({});
const providerSelectionModeOptions = ref<Record<string, string[]>>({});
const modesReady = ref(false);
const baseConfigOpen = ref(false);
const baseConfigSaving = ref(false);
const baseConfigPlugin = ref<ServicePluginRecord>();
// 打开基本配置时统一设置模式；表单保留同一单选默认值和明确类型。
const baseConfigFormState = ref<
  Record<string, any> & { providerSelectionMode: ProviderSelectionMode }
>({
  providerSelectionMode: 'SINGLE_ACTIVE',
  editor: 'json',
  valueContent: {},
  valueType: 'Json',
});

const providerListTitle = computed(() => {
  const pluginName = selectedPlugin.value?.name;
  return pluginName ? `供应商列表 - ${pluginName}` : '供应商列表';
});
const baseConfigModeOptions = computed(() => {
  const pluginId = baseConfigPlugin.value?.id;
  return pluginId ? providerSelectionModeOptions.value[pluginId] || [] : [];
});
const selectedModeLabel = computed(() => {
  const mode = getProviderSelectionMode(
    providerSelectionModes.value,
    selectedPlugin.value?.id,
  );
  if (mode === 'MULTI_CHOICE') return '多供应商可同时启用，由每次操作选择';
  if (mode === 'MULTI_ACTIVE_BALANCED')
    return '多供应商及多配置实例可同时启用，按权重自动均衡使用';
  if (mode === 'SINGLE_ACTIVE') return '同一作用域只使用一个当前供应商';
  return '模式目录未加载';
});

onMounted(async () => {
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
    message.error('供应商选择模式加载失败，目录编辑已禁用');
  }
});

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
  { dataIndex: 'remark', key: 'remark', title: '备注' },
];

function openProviderList(record: ServicePluginRecord) {
  selectedPlugin.value = record;
  editingProviders.value = (record.providerList || []).map((provider) => ({
    ...provider,
  }));
  providerListOpen.value = true;
}

function cloneJsonValue(value: any): Record<string, any> {
  if (value === undefined || value === null || value === '') {
    return {};
  }
  // 配置表单可持有 Vue reactive proxy，按 JSON 请求语义克隆。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value));
}

function openBaseConfig(record: ServicePluginRecord) {
  baseConfigPlugin.value = record;
  baseConfigFormState.value = {
    editor: record.configEditor?.trim() || 'json',
    id: record.id,
    name: `${record.name || record.id || '服务插件'} - 基本配置`,
    providerSelectionMode:
      record.providerSelectionMode ||
      getProviderSelectionMode(providerSelectionModes.value, record.id) ||
      'SINGLE_ACTIVE',
    valueContent: cloneJsonValue(record.baseConfig),
    valueType: 'Json',
  };
  baseConfigOpen.value = true;
}

async function saveBaseConfig() {
  const plugin = baseConfigPlugin.value;
  if (!plugin?.id || baseConfigSaving.value) {
    return;
  }

  baseConfigSaving.value = true;
  try {
    const baseConfig = cloneJsonValue(baseConfigFormState.value.valueContent);
    await servicePluginService.update({
      autoForceUpdateField: false,
      forceUpdateFields: ['baseConfig', 'providerSelectionMode'],
      baseConfig,
      id: plugin.id,
      optimisticLock: plugin.optimisticLock,
      providerSelectionMode: baseConfigFormState.value.providerSelectionMode,
    });
    plugin.baseConfig = baseConfig;
    plugin.providerSelectionMode =
      baseConfigFormState.value.providerSelectionMode;
    providerSelectionModes.value[plugin.id] = plugin.providerSelectionMode;
    plugin.optimisticLock = Number(plugin.optimisticLock || 0) + 1;
    message.success('基本配置已保存');
    baseConfigOpen.value = false;
  } catch (error) {
    console.error(error);
    message.error('基本配置保存失败，请刷新后重试');
  } finally {
    baseConfigSaving.value = false;
  }
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
    message.error('供应商信息保存失败，请刷新后重试');
  } finally {
    providerListSaving.value = false;
  }
}
</script>

<template>
  <CrudPage :config="servicePluginPageCrudConfig">
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
      <Button size="small" type="link" @click="openBaseConfig(record)">
        基本配置
      </Button>
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
      </template>
    </Table>
  </Modal>

  <Modal
    v-model:open="baseConfigOpen"
    :confirm-loading="baseConfigSaving"
    :mask-closable="false"
    destroy-on-close
    ok-text="保存"
    title="基本配置"
    width="min(80vw, 1120px)"
    @ok="saveBaseConfig"
  >
    <div class="mb-3 flex items-center gap-3">
      <span class="shrink-0">供应商选择模式</span>
      <Select
        v-model:value="baseConfigFormState.providerSelectionMode"
        class="flex-1"
      >
        <Select.Option
          v-for="mode in baseConfigModeOptions"
          :key="mode"
          :value="mode"
        >
          {{
            mode === 'SINGLE_ACTIVE'
              ? '单活'
              : mode === 'MULTI_CHOICE'
                ? '多供应商手动选择'
                : '多供应商加权均衡'
          }}
        </Select.Option>
      </Select>
    </div>
    <SettingValueContentField
      :key="baseConfigFormState.id"
      inline
      :form-state="baseConfigFormState"
    />
  </Modal>
</template>
