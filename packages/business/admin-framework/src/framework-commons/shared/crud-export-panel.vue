<script lang="ts" setup>
import type { CrudExportTemplateRecord, CrudFieldConfig } from './types';
import type { CrudExportConverter } from './crud-value-converter';

import { ArrowDown, ArrowUp, IconifyIcon } from '@vben/icons';

import {
  Button,
  Checkbox,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
} from 'ant-design-vue';

import { CRUD_EXPORT_CONVERTER_OPTIONS } from './crud-value-converter';

defineProps<{
  allFieldsSelected: boolean;
  confirmLoading: boolean;
  fieldAliases: Record<string, string>;
  fieldConverters: Record<string, CrudExportConverter>;
  fieldsIndeterminate: boolean;
  open: boolean;
  orderedFields: CrudFieldConfig[];
  selectedFieldKeys: string[];
  selectedTemplate?: CrudExportTemplateRecord;
  selectedTemplateCanDelete: boolean;
  selectedTemplateId?: string;
  templateLoading: boolean;
  templateOptions: Array<{ label: string; value?: string }>;
  templateSaving: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  deleteTemplate: [];
  moveField: [field: CrudFieldConfig, offset: -1 | 1];
  saveTemplate: [];
  setAllFieldsSelected: [selected: boolean];
  setFieldSelected: [key: string, selected: boolean];
  templateChange: [value?: number | string];
  'update:open': [value: boolean];
  updateFieldAlias: [key: string, value: string];
  updateFieldConverter: [key: string, value: CrudExportConverter];
}>();
</script>

<template>
  <Modal
    :confirm-loading="confirmLoading"
    :mask-closable="false"
    :open="open"
    title="导出 Excel"
    width="720px"
    destroy-on-close
    @cancel="emit('update:open', false)"
    @ok="emit('confirm')"
  >
    <div class="vben-crud-export-modal">
      <div class="vben-crud-export-template-bar">
        <Select
          :value="selectedTemplateId"
          allow-clear
          class="vben-crud-export-template-select"
          :disabled="templateSaving"
          :loading="templateLoading"
          :options="templateOptions"
          placeholder="选择导出模板"
          size="small"
          @change="(value) => emit('templateChange', value)"
        />
        <Button
          size="small"
          :disabled="templateLoading"
          :loading="templateSaving"
          @click="emit('saveTemplate')"
        >
          <template #icon>
            <IconifyIcon class="size-3.5" icon="lucide:save" />
          </template>
          另存为模板
        </Button>
        <Popconfirm
          v-if="selectedTemplate && selectedTemplateCanDelete"
          title="确认删除当前导出模板？"
          @confirm="emit('deleteTemplate')"
        >
          <Button size="small" danger :disabled="templateLoading">
            <template #icon>
              <IconifyIcon class="size-3.5" icon="lucide:trash-2" />
            </template>
            删除模板
          </Button>
        </Popconfirm>
      </div>
      <div class="border-border mb-2 border-b pb-2">
        <Checkbox
          :checked="allFieldsSelected"
          :indeterminate="fieldsIndeterminate"
          @change="
            (event) => emit('setAllFieldsSelected', event.target.checked)
          "
        >
          全部字段
        </Checkbox>
        <div class="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
          <IconifyIcon class="size-3.5" icon="lucide:arrow-up-down" />
          默认按当前表格列顺序导出，可调整列映射、转换、顺序和导出表头
        </div>
      </div>
      <div class="flex max-h-[420px] flex-col overflow-auto">
        <div class="vben-crud-export-field-header">
          <span>字段</span>
          <span>导出列别名</span>
          <span>转换</span>
          <span>排序</span>
        </div>
        <div
          v-for="(field, index) in orderedFields"
          :key="field.key"
          class="vben-crud-export-field-row"
        >
          <Checkbox
            :checked="selectedFieldKeys.includes(String(field.key))"
            @change="
              (event) =>
                emit(
                  'setFieldSelected',
                  String(field.key),
                  event.target.checked,
                )
            "
          >
            {{ field.label }}
          </Checkbox>
          <Input
            :value="fieldAliases[String(field.key)]"
            allow-clear
            class="vben-crud-export-alias-input"
            :placeholder="field.label"
            size="small"
            @update:value="
              (value) => emit('updateFieldAlias', String(field.key), value)
            "
          />
          <Select
            :options="CRUD_EXPORT_CONVERTER_OPTIONS"
            :value="fieldConverters[String(field.key)] || 'display'"
            size="small"
            @change="
              (value) =>
                emit(
                  'updateFieldConverter',
                  String(field.key),
                  value as CrudExportConverter,
                )
            "
          />
          <Space :size="2">
            <button
              type="button"
              class="vben-crud-column-pin"
              :disabled="index <= 0"
              title="上移"
              @click="emit('moveField', field, -1)"
            >
              <ArrowUp class="size-4" />
            </button>
            <button
              type="button"
              class="vben-crud-column-pin"
              :disabled="index >= orderedFields.length - 1"
              title="下移"
              @click="emit('moveField', field, 1)"
            >
              <ArrowDown class="size-4" />
            </button>
          </Space>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.vben-crud-export-template-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.vben-crud-export-template-select {
  min-width: 0;
  flex: 1;
}

.vben-crud-export-field-header {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(150px, 210px) minmax(
      120px,
      150px
    ) 56px;
  gap: 8px;
  align-items: center;
  padding: 4px 0 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.vben-crud-export-field-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(150px, 210px) minmax(
      120px,
      150px
    ) 56px;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 6px 0;
  border-radius: var(--radius);
}

.vben-crud-export-field-row:hover {
  background: hsl(var(--muted) / 60%);
}

.vben-crud-export-field-row :deep(.ant-checkbox-wrapper) {
  min-width: 0;
  flex: 1;
}

.vben-crud-export-field-row :deep(.ant-checkbox + span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vben-crud-export-alias-input {
  min-width: 0;
}
</style>
