<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed, ref } from 'vue';

import { Button, message, Modal } from 'ant-design-vue';

import CrudPage from './crud-page.vue';
import { moduleUpdateCrudRecord } from './api-module';
import {
  getSettingDisplayName,
  isSettingEditable,
  serializeSettingValueFromEditor,
} from './setting-for-tenant/setting-for-tenant';
import SettingValueContentField from './setting-value-content-field.vue';

const props = defineProps<{
  config: CrudPageConfig;
}>();

const editValueModalOpen = ref(false);
const editValueRecord = ref<Record<string, any> | null>(null);
const editValueFormState = ref<Record<string, any>>({});
const savingValue = ref(false);
const reloadList = ref<(() => Promise<void> | void) | null>(null);

const editValueTitle = computed(() => {
  const name = editValueRecord.value
    ? getSettingDisplayName(editValueRecord.value)
    : '';

  return name ? `编辑值 - ${name}` : '编辑值';
});

const editValueModalBodyStyle = {
  maxHeight: 'calc(100vh - 180px)',
  overflowY: 'auto',
};

function openEditValue(
  record: Record<string, any>,
  reload?: () => Promise<void> | void,
) {
  editValueRecord.value = record;
  editValueFormState.value = { ...record };
  reloadList.value = reload || null;
  editValueModalOpen.value = true;
}

async function updateSettingValue(payload: Record<string, any>) {
  if (props.config.apiService?.update && !props.config.updatePath) {
    return props.config.apiService.update(payload);
  }

  return moduleUpdateCrudRecord(
    props.config.updatePath || `${props.config.apiBase}/update`,
    payload,
  );
}

async function saveEditValue() {
  const record = editValueRecord.value;

  if (!record) {
    return;
  }

  savingValue.value = true;

  try {
    const payload: Record<string, any> = {
      id: record.id,
      forceUpdateFields: ['valueContent'],
      valueContent: serializeSettingValueFromEditor(
        editValueFormState.value,
        editValueFormState.value.valueContent,
      ),
    };

    if (record.optimisticLock !== undefined && record.optimisticLock !== null) {
      payload.optimisticLock = record.optimisticLock;
    }

    await updateSettingValue(payload);
    message.success('值更新成功');
    editValueModalOpen.value = false;
    await reloadList.value?.();
  } catch (error) {
    console.error(error);
    message.error('值更新失败');
  } finally {
    savingValue.value = false;
  }
}
</script>

<template>
  <CrudPage :config="config">
    <template #form-field-valueContent="{ formState }">
      <SettingValueContentField :form-state="formState" />
    </template>

    <template #row-actions="{ record, reload }">
      <Button
        v-if="isSettingEditable(record)"
        size="small"
        type="link"
        @click="openEditValue(record, reload)"
      >
        编辑值
      </Button>
    </template>
  </CrudPage>

  <Modal
    v-model:open="editValueModalOpen"
    :body-style="editValueModalBodyStyle"
    :confirm-loading="savingValue"
    :title="editValueTitle"
    :width="config.modalWidth || 'min(70vw, 1280px)'"
    @ok="saveEditValue"
  >
    <div class="setting-edit-value-form">
      <div class="text-sm font-medium">值</div>
      <SettingValueContentField :form-state="editValueFormState" inline />
    </div>
  </Modal>
</template>

<style scoped>
.setting-edit-value-form {
  display: grid;
  width: 100%;
  gap: 8px;
}
</style>
