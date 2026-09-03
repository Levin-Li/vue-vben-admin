<script lang="ts" setup>
import { computed, ref } from 'vue';

import {
  Button,
  Input,
  Modal,
  Switch,
  Table,
  Tooltip,
  message,
} from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { servicePluginService } from '../../api/service-plugin-service';
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
  enable?: boolean;
  id?: string;
  name?: string;
  optimisticLock?: number;
  baseConfig?: Record<string, any>;
  configEditor?: string;
  pluginImplType?: string;
  pluginType?: string;
  providerList?: ServicePluginProvider[];
}

const providerListOpen = ref(false);
const selectedPlugin = ref<ServicePluginRecord>();
const editingProviders = ref<ServicePluginProvider[]>([]);
const providerListSaving = ref(false);
const baseConfigOpen = ref(false);
const baseConfigSaving = ref(false);
const baseConfigPlugin = ref<ServicePluginRecord>();
const baseConfigFormState = ref<Record<string, any>>({
  editor: 'json',
  valueContent: {},
  valueType: 'Json',
});

const providerListTitle = computed(() => {
  const pluginName = selectedPlugin.value?.name;
  return pluginName ? `供应商列表 - ${pluginName}` : '供应商列表';
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
  return JSON.parse(JSON.stringify(value));
}

function openBaseConfig(record: ServicePluginRecord) {
  baseConfigPlugin.value = record;
  baseConfigFormState.value = {
    editor: record.configEditor?.trim() || 'json',
    id: record.id,
    name: `${record.name || record.id || '服务插件'} - 基本配置`,
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
      forceUpdateFields: ['baseConfig'],
      baseConfig,
      id: plugin.id,
      optimisticLock: plugin.optimisticLock,
    });
    plugin.baseConfig = baseConfig;
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
  if (!plugin?.id || providerListSaving.value) {
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
      <Button size="small" type="link" @click="openProviderList(record)">
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
          <Input v-model:value="record.name" placeholder="请输入供应商名称" />
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
    <SettingValueContentField
      :key="baseConfigFormState.id"
      inline
      :form-state="baseConfigFormState"
    />
  </Modal>
</template>
