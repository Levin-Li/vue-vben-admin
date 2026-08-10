<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { CrudImportMapping } from './crud-import';
import type { CrudExportTemplateRecord, CrudFieldConfig } from './types';

import { ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { CRUD_IMPORT_CONVERTER_OPTIONS } from './crud-import';

defineProps<{
  canStart: boolean;
  consoleLines: string[];
  consoleOpen: boolean;
  fileName: string;
  headerOptions: Array<{ label: string; value: string }>;
  importableFields: CrudFieldConfig[];
  importing: boolean;
  mappings: CrudImportMapping[];
  open: boolean;
  previewColumns: TableColumnsType;
  previewRows: Record<string, any>[];
  rowCount: number;
  rowErrors: Array<{ message: string; rowIndex: number }>;
  selectedTemplate?: CrudExportTemplateRecord;
  selectedTemplateCanDelete: boolean;
  selectedTemplateId?: string;
  stopRequested: boolean;
  templateLoading: boolean;
  templateOptions: Array<{ label: string; value?: string }>;
  templateSaving: boolean;
}>();

const emit = defineEmits<{
  clearConsole: [];
  confirm: [];
  copyConsole: [];
  deleteTemplate: [];
  fileChange: [file: File];
  saveTemplate: [];
  stop: [];
  templateChange: [value?: number | string];
  'update:consoleOpen': [value: boolean];
  'update:open': [value: boolean];
  updateMapping: [fieldKey: string, patch: Partial<CrudImportMapping>];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileSelect() {
  fileInputRef.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const [file] = [...(input.files || [])];

  input.value = '';

  if (file) {
    emit('fileChange', file);
  }
}

function getMappingFieldLabel(
  fields: CrudFieldConfig[],
  mapping: CrudImportMapping,
) {
  return (
    fields.find((field) => String(field.key) === mapping.fieldKey)?.label ||
    mapping.fieldKey
  );
}
</script>

<template>
  <Modal
    :keyboard="!importing"
    :mask-closable="false"
    :open="open"
    title="导入数据"
    width="980px"
    destroy-on-close
    @cancel="!importing && emit('update:open', false)"
  >
    <template #footer>
      <Button :disabled="importing" @click="emit('update:open', false)">
        取消
      </Button>
      <Button
        v-if="importing"
        danger
        :disabled="stopRequested"
        @click="emit('stop')"
      >
        {{ stopRequested ? '正在停止...' : '停止导入' }}
      </Button>
      <Button
        v-else
        type="primary"
        :disabled="!canStart"
        @click="emit('confirm')"
      >
        开始导入
      </Button>
    </template>

    <div class="vben-crud-import-modal">
      <div class="vben-crud-export-template-bar">
        <Select
          :value="selectedTemplateId"
          allow-clear
          class="vben-crud-export-template-select"
          :disabled="templateSaving || importing"
          :loading="templateLoading"
          :options="templateOptions"
          placeholder="选择导入模板"
          size="small"
          @change="(value) => emit('templateChange', value)"
        />
        <Button
          size="small"
          :disabled="templateLoading || importing"
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
          title="确认删除当前导入模板？"
          @confirm="emit('deleteTemplate')"
        >
          <Button size="small" danger :disabled="templateLoading || importing">
            <template #icon>
              <IconifyIcon class="size-3.5" icon="lucide:trash-2" />
            </template>
            删除模板
          </Button>
        </Popconfirm>
        <Button size="small" :disabled="importing" @click="triggerFileSelect">
          <template #icon>
            <IconifyIcon class="size-3.5" icon="lucide:file-up" />
          </template>
          选择文件
        </Button>
        <input
          ref="fileInputRef"
          accept=".csv,.xls,.xlsx,.xml,.html"
          class="hidden"
          type="file"
          @change="handleFileChange"
        />
      </div>

      <div v-if="fileName" class="vben-crud-import-summary">
        <span>{{ fileName }}</span>
        <Tag color="blue">{{ rowCount }} 行</Tag>
        <Tag v-if="rowErrors.length > 0" color="red">
          {{ rowErrors.length }} 个错误
        </Tag>
      </div>

      <Tabs>
        <Tabs.TabPane key="mapping" tab="字段映射">
          <div class="vben-crud-import-mapping">
            <div class="vben-crud-import-mapping-header">
              <span>目标字段</span>
              <span>来源列</span>
              <span>转换</span>
              <span>默认值</span>
            </div>
            <div
              v-for="mapping in mappings"
              :key="mapping.fieldKey"
              class="vben-crud-import-mapping-row"
            >
              <span class="truncate">
                {{ getMappingFieldLabel(importableFields, mapping) }}
              </span>
              <Select
                allow-clear
                :disabled="importing"
                :options="headerOptions"
                :value="mapping.header"
                size="small"
                @change="
                  (value) =>
                    emit('updateMapping', mapping.fieldKey, {
                      header: value ? String(value) : undefined,
                    })
                "
              />
              <Select
                :disabled="importing"
                :options="CRUD_IMPORT_CONVERTER_OPTIONS"
                :value="mapping.converter || 'trim'"
                size="small"
                @change="
                  (value) =>
                    emit('updateMapping', mapping.fieldKey, {
                      converter: value as any,
                    })
                "
              />
              <Input
                :value="mapping.defaultValue"
                allow-clear
                :disabled="importing"
                size="small"
                @change="
                  (event) =>
                    emit('updateMapping', mapping.fieldKey, {
                      defaultValue: event.target.value,
                    })
                "
              />
            </div>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane key="preview" tab="导入预览">
          <Table
            size="small"
            :columns="previewColumns"
            :data-source="previewRows"
            :pagination="false"
            :scroll="{ x: 'max-content', y: 260 }"
            row-key="__index"
          />
          <div v-if="rowErrors.length > 0" class="vben-crud-import-errors">
            <div
              v-for="error in rowErrors.slice(0, 20)"
              :key="`${error.rowIndex}-${error.message}`"
            >
              第 {{ error.rowIndex }} 行：{{ error.message }}
            </div>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  </Modal>

  <Modal
    :open="consoleOpen"
    title="导入控制台"
    width="860px"
    :footer="null"
    @cancel="emit('update:consoleOpen', false)"
  >
    <div class="vben-crud-import-console-actions">
      <Button
        v-if="importing"
        size="small"
        danger
        :disabled="stopRequested"
        @click="emit('stop')"
      >
        {{ stopRequested ? '正在停止...' : '停止导入' }}
      </Button>
      <Button size="small" @click="emit('clearConsole')">清空</Button>
      <Button size="small" @click="emit('copyConsole')">复制</Button>
    </div>
    <pre class="vben-crud-import-console">{{ consoleLines.join('\n') }}</pre>
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

.vben-crud-import-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vben-crud-import-summary {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 8px 10px;
  font-size: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.vben-crud-import-summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vben-crud-import-mapping {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow: auto;
}

.vben-crud-import-mapping-header,
.vben-crud-import-mapping-row {
  display: grid;
  grid-template-columns:
    minmax(120px, 1fr) minmax(180px, 1.2fr)
    minmax(120px, 0.8fr) minmax(140px, 1fr);
  gap: 8px;
  align-items: center;
}

.vben-crud-import-mapping-header {
  padding: 4px 0 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.vben-crud-import-mapping-row {
  padding: 6px 0;
}

.vben-crud-import-errors {
  max-height: 140px;
  padding: 8px 10px;
  margin-top: 10px;
  overflow: auto;
  font-size: 12px;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
  border-radius: var(--radius);
}

.vben-crud-import-console-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.vben-crud-import-console {
  min-height: 280px;
  max-height: 520px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  color: hsl(var(--foreground));
  white-space: pre-wrap;
  word-break: break-word;
  background: hsl(var(--muted) / 65%);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}
</style>
