<script setup lang="ts">
import type { MenuFixedQuery } from '@levin/admin-framework/framework-commons/menu-fixed-query';
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { jsonSchemaService } from '@levin/admin-framework/framework-commons/app/api/json-schema-service';
import { parseMenuFixedQuery } from '@levin/admin-framework/framework-commons/menu-fixed-query';
import { requestClient } from '@levin/admin-framework/framework-commons/runtime';
import { getAdministrativeAreaCascaderOptions } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';
import { normalizeCrudChoiceOptions } from '@levin/admin-framework/framework-commons/shared/crud-choice-value';
import { buildCrudQueryItems } from '@levin/admin-framework/framework-commons/shared/crud-query-items';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import { normalizeJsonSchemaObject } from '@levin/admin-framework/framework-commons/shared/json-schema-form';
import JsonSchemaFormField from '@levin/admin-framework/framework-commons/shared/json-schema-form-field.vue';
import { resolveJsonSchemaSource } from '@levin/admin-framework/framework-commons/shared/json-schema-source';
import {
  Alert,
  AutoComplete,
  Badge,
  Button,
  Cascader,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  TimePicker,
  TreeSelect,
} from 'ant-design-vue';

import {
  getFixedQueryAreaControl,
  queryItemKeys,
  readFixedQueryValue,
  serializeFixedQueryItems,
} from './fixed-query-values';

const props = defineProps<{
  loadConfig?: () => Promise<CrudPageConfig>;
  modelValue?: MenuFixedQuery;
  paramsEditor?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: MenuFixedQuery] }>();
const open = ref(false);
const editingExtension = ref(false);
const loading = ref(false);
const error = ref('');
const editorMode = ref<'json' | 'query' | 'schema'>('query');
const rawDraft = ref<any>({});
const schema = ref<Record<string, any>>();
const config = ref<CrudPageConfig>();
const selected = ref<string[]>([]);
const extensionRows = ref<Array<{ key: string; type: string; value: string }>>([]);
const values = reactive<Record<string, any>>({});
const options = reactive<Record<string, any[]>>({});
const optionErrors = reactive<Record<string, string>>({});
const requests: Record<string, number> = {};
const pending = reactive<Record<string, boolean>>({});
const userStore = useUserStore();
const isPlatformUser = computed(() => {
  const user = userStore.userInfo as Record<string, any>;
  const roles = Array.isArray(user?.roles) ? user.roles : user?.roleList || [];
  return (
    user?.platformUser === true ||
    user?.isPlatformUser === true ||
    user?.saasAdmin === true ||
    user?.isSaasAdmin === true ||
    roles.some((role: unknown) => String(role || '').startsWith('R_SAAS'))
  );
});
const items = computed(() =>
  buildCrudQueryItems(
    (config.value?.fields || [])
      .filter(
        (field) =>
          field.search &&
          (!field.visibleForPlatformUser || isPlatformUser.value),
      )
      .toSorted((a, b) => (a.searchOrder ?? 0) - (b.searchOrder ?? 0)),
  ),
);
const extensionFieldOptions = computed(() =>
  [...new Map(
    (config.value?.fields || []).map((field) => [
      field.key,
      { label: `${field.label}（${field.key}）`, value: field.key },
    ]),
  ).values()],
);
const canEditFormQuery = computed(
  () => Boolean(props.paramsEditor?.trim()) || typeof props.loadConfig === 'function',
);
function getExtensionFieldType(key: string) {
  return String(
    config.value?.fields?.find((field) => field.key === key)?.type || '文本',
  );
}
function isKnownExtensionField(key: string) {
  return extensionFieldOptions.value.some((field) => field.value === key);
}
const count = computed(() => {
  try {
    return Object.keys(parseMenuFixedQuery(props.modelValue)).length;
  } catch {
    return '?';
  }
});
const formCount = computed(() => {
  const fixed = parseMenuFixedQuery(props.modelValue);
  const known = new Set(items.value.flatMap((item) => queryItemKeys(item)));
  return Object.keys(fixed).filter((key) => known.has(key)).length;
});
const extensionCount = computed(() => Math.max(count.value - formCount.value, 0));
let session = 0;
let baseline = '';
function snapshot() {
  if (editorMode.value !== 'query') return JSON.stringify(rawDraft.value);
  return JSON.stringify(
    editingExtension.value
      ? { extensionRows: extensionRows.value }
      : { selected: selected.value, values },
  );
}
async function loadOptions(
  field: NonNullable<CrudPageConfig['fields']>[number],
  keyword?: string,
) {
  if (!field.loadOptions) return;
  const id = (requests[field.key] || 0) + 1;
  requests[field.key] = id;
  pending[field.key] = true;
  const current = session;
  try {
    const result = await field.loadOptions(keyword);
    if (session === current && requests[field.key] === id) {
      options[field.key] = normalizeCrudChoiceOptions(field, result);
      delete optionErrors[field.key];
    }
  } catch {
    if (session === current && requests[field.key] === id)
      optionErrors[field.key] = `${field.label}选项加载失败，请重试`;
  } finally {
    if (session === current && requests[field.key] === id)
      pending[field.key] = false;
  }
}
async function edit(extension = false) {
  editingExtension.value = extension;
  open.value = true;
  loading.value = true;
  error.value = '';
  config.value = undefined;
  editorMode.value = 'query';
  schema.value = undefined;
  rawDraft.value = parseMenuFixedQuery(props.modelValue);
  const current = ++session;
  Object.keys(values).forEach((key) => delete values[key]);
  Object.keys(optionErrors).forEach((key) => delete optionErrors[key]);
  selected.value = [];
  extensionRows.value = [];
  Object.keys(pending).forEach((key) => delete pending[key]);
  try {
    if (extension) {
      extensionRows.value = Object.entries(rawDraft.value).map(([key, value]) => ({
        key,
        type: isKnownExtensionField(key)
          ? getExtensionFieldType(key)
          : typeof value === 'number'
            ? 'number'
            : 'text',
        value: typeof value === 'string' ? value : JSON.stringify(value),
      }));
      return;
    }
    if (!extension && props.paramsEditor?.trim()) {
      editorMode.value = 'schema';
      const source = resolveJsonSchemaSource(props.paramsEditor);
      if (!source) throw new Error('配置的 Schema 无法解析。');
      let data: any;
      if (source.kind === 'inline') data = source.schema;
      else if (source.kind === 'java-type')
        data = await jsonSchemaService.genJsonSchema({
          typeGenericStr: source.typeGenericStr,
        });
      else
        data = await requestClient.get(source.url, {
          baseURL: /^https?:\/\//i.test(source.url) ? undefined : '',
        });
      if (session !== current) return;
      schema.value = normalizeJsonSchemaObject(
        data?.jsonSchema ??
          data?.data?.jsonSchema ??
          data?.schema ??
          data?.data?.schema ??
          data,
      );
      if (!schema.value) throw new Error('Schema 返回内容无效。');
      return;
    }
    if (!props.loadConfig) {
      editorMode.value = 'json';
      return;
    }
    const loaded = await props.loadConfig();
    if (session !== current) return;
    config.value = loaded;
    const unsupported = items.value.filter(
      (item) =>
        item.kind === 'field' &&
        ![
          'area-cascader',
          'date',
          'datetime',
          'number',
          'org-tree-select',
          'role-select',
          'select',
          'string-array',
          'switch',
          'tags',
          'text',
          'textarea',
          'time',
          undefined,
        ].includes(item.field.type),
    );
    if (unsupported.length > 0)
      throw new Error(
        '该页面包含尚未接入的自定义查询控件，请先接入公共查询配置编辑器。',
      );
    const fixed = parseMenuFixedQuery(props.modelValue);
    for (const item of items.value) {
      values[item.key] = readFixedQueryValue(item, fixed);
      if (queryItemKeys(item).some((key) => Object.hasOwn(fixed, key)))
        selected.value.push(item.key);
      if (item.kind === 'field') {
        options[item.key] =
          item.field.type === 'area-cascader'
            ? getAdministrativeAreaCascaderOptions()
            : [];
        if (item.field.options)
          options[item.key] = normalizeCrudChoiceOptions(
            item.field,
            item.field.options,
          );
        void loadOptions(item.field);
      }
    }
    baseline = snapshot();
  } catch (error_) {
    if (session !== current) return;
    error.value = `${(error_ as Error).message} 已切换 JSON 编辑器，原条件保留。`;
    editorMode.value = 'json';
  } finally {
    if (session === current) {
      loading.value = false;
      baseline = snapshot();
    }
  }
}
function close() {
  const done = () => {
    open.value = false;
    session++;
  };
  if (snapshot() === baseline) {
    done();
  } else {
    Modal.confirm({ title: '放弃本次固定条件修改？', onOk: done });
  }
}
function clear() {
  Modal.confirm({
    title: '清除该菜单的全部固定查询条件？',
    onOk: () => emit('update:modelValue', {}),
  });
}
function save() {
  try {
    if (editorMode.value !== 'query') {
      // JSON文本编辑控件的临时文本在边界转换，持久化始终提交对象。
      const draft =
        typeof rawDraft.value === 'string'
          ? JSON.parse(rawDraft.value)
          : rawDraft.value;
      emit('update:modelValue', parseMenuFixedQuery(draft));
      open.value = false;
      session++;
      return;
    }
    if (selected.value.some((key) => pending[key]))
      throw new Error('查询选项正在加载，请稍后保存');
    const failed = selected.value
      .map((key) => optionErrors[key])
      .filter(Boolean);
    if (failed.length > 0) throw new Error(failed.join('；'));
    const merged = serializeFixedQueryItems(
      items.value,
      selected.value,
      values,
      options,
    );
    for (const row of extensionRows.value) {
      const key = row.key.trim();
      if (!key || Object.hasOwn(merged, key)) continue;
      try {
        merged[key] = parseMenuFixedQuery({ [key]: JSON.parse(row.value) })[key];
      } catch {
        merged[key] = row.type === 'number' ? Number(row.value) : row.value;
      }
    }
    emit('update:modelValue', parseMenuFixedQuery(merged));
    open.value = false;
    session++;
  } catch (error_) {
    message.error((error_ as Error).message);
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <Badge :count="formCount">
      <Button :disabled="!canEditFormQuery" @click="edit(false)">
        表单查询条件
      </Button>
    </Badge>
    <Badge :count="extensionCount">
      <Button @click="edit(true)">扩展查询条件</Button>
    </Badge>
    <Button v-if="count !== 0" type="link" danger @click="clear">
      清除条件
    </Button>
  </div>
  <Modal
    :open="open"
    :title="editingExtension ? '扩展查询条件' : '表单查询条件'"
    :width="editingExtension ? 'min(90vw, 860px)' : 'min(92vw, 960px)'"
    :mask-closable="false"
    :ok-button-props="{ disabled: loading }"
    @ok="save"
    @cancel="close"
  >
    <Spin :spinning="loading">
      <Alert
        v-if="error"
        :message="error"
        type="warning"
        show-icon
        class="mb-3"
      />
      <JsonSchemaFormField
        v-if="!loading && editorMode === 'schema'"
        v-model="rawDraft"
        :schema="schema"
        inline
        title="固定查询条件"
      />
      <JsonEditorField
        v-else-if="!loading && editorMode === 'json'"
        v-model="rawDraft"
        inline
        inline-min-height="min(48vh, 480px)"
        title="固定查询条件"
      />
      <template v-else-if="editorMode === 'query' && !editingExtension">
        <p class="text-muted-foreground mb-4">
          勾选需要固定的查询字段。固定后，页面隐藏对应查询项，查询和导出始终使用这些值。
        </p>
        <p v-if="items.length === 0 && !loading">
          该页面没有可配置的公共查询字段。
        </p>
        <Form class="grid grid-cols-1 gap-x-6 md:grid-cols-2" layout="vertical">
          <Form.Item v-for="item in items" :key="item.key">
            <template #label>
              <Checkbox
                :checked="selected.includes(item.key)"
                @update:checked="
                  (checked) =>
                    (selected = checked
                      ? [...selected, item.key]
                      : selected.filter((key) => key !== item.key))
                "
              >
                {{ item.kind === 'range' ? item.label : item.field.label }}
              </Checkbox>
            </template>
            <DatePicker.RangePicker
              v-if="item.kind === 'range' && item.format !== 'time'"
              v-model:value="values[item.key]"
              :disabled="!selected.includes(item.key)"
              :show-time="item.format === 'datetime'"
              :value-format="
                item.format === 'datetime'
                  ? 'YYYY-MM-DDTHH:mm:ss'
                  : 'YYYY-MM-DD'
              "
              class="w-full"
            />
            <TimePicker.RangePicker
              v-else-if="item.kind === 'range'"
              v-model:value="values[item.key]"
              :disabled="!selected.includes(item.key)"
              value-format="HH:mm:ss"
              class="w-full"
            />
            <template v-else>
              <Cascader
                v-if="item.field.type === 'area-cascader'"
                v-model:value="values[item.key]"
                :options="
                  getFixedQueryAreaControl(
                    item.field,
                    values[item.key],
                    options[item.key] || [],
                  ).options
                "
                :disabled="!selected.includes(item.key)"
                :change-on-select="
                  getFixedQueryAreaControl(
                    item.field,
                    values[item.key],
                    options[item.key] || [],
                  ).changeOnSelect
                "
                class="w-full"
              />
              <TreeSelect
                v-else-if="item.field.type === 'org-tree-select'"
                v-model:value="values[item.key]"
                :tree-data="options[item.key]"
                :multiple="!!item.field.multiple"
                :disabled="!selected.includes(item.key)"
                tree-default-expand-all
                show-search
                tree-node-filter-prop="label"
                class="w-full"
              />
              <Select
                v-else-if="item.field.type === 'switch'"
                v-model:value="values[item.key]"
                :options="[
                  { label: '是', value: 'true' },
                  { label: '否', value: 'false' },
                ]"
                :disabled="!selected.includes(item.key)"
                class="w-full"
              />
              <Select
                v-else-if="
                  ['select', 'role-select'].includes(item.field.type || '')
                "
                v-model:value="values[item.key]"
                :mode="item.field.multiple ? 'multiple' : undefined"
                :options="options[item.key]"
                :disabled="!selected.includes(item.key)"
                show-search
                :filter-option="item.field.remoteSearch ? false : undefined"
                option-filter-prop="label"
                class="w-full"
                @search="
                  (keyword) =>
                    item.field.remoteSearch && loadOptions(item.field, keyword)
                "
              />
              <DatePicker
                v-else-if="['date', 'datetime'].includes(item.field.type || '')"
                v-model:value="values[item.key]"
                :show-time="item.field.type === 'datetime'"
                :value-format="
                  item.field.type === 'datetime'
                    ? 'YYYY-MM-DDTHH:mm:ss'
                    : 'YYYY-MM-DD'
                "
                :disabled="!selected.includes(item.key)"
                class="w-full"
              />
              <TimePicker
                v-else-if="item.field.type === 'time'"
                v-model:value="values[item.key]"
                value-format="HH:mm:ss"
                :disabled="!selected.includes(item.key)"
                class="w-full"
              />
              <InputNumber
                v-else-if="item.field.type === 'number'"
                v-model:value="values[item.key]"
                :disabled="!selected.includes(item.key)"
                class="w-full"
              />
              <Input
                v-else
                v-model:value="values[item.key]"
                :disabled="!selected.includes(item.key)"
              />
              <Button
                v-if="optionErrors[item.key]"
                danger
                type="link"
                @click="loadOptions(item.field)"
              >
                {{ optionErrors[item.key] }}
              </Button>
            </template>
          </Form.Item>
        </Form>
      </template>
      <template v-else-if="editorMode === 'query' && editingExtension">
        <div>
          <div class="mb-2 flex justify-end">
            <Button size="small" @click="extensionRows.push({ key: '', type: 'text', value: '' })">
              新增条件
            </Button>
          </div>
          <div
            v-for="(row, index) in extensionRows"
            :key="index"
            class="mb-2 grid grid-cols-[3fr_2fr_5fr_auto] gap-2"
          >
            <AutoComplete
              v-model:value="row.key"
              show-search
              :options="extensionFieldOptions"
              placeholder="字段名"
            />
            <Input v-if="isKnownExtensionField(row.key)" :value="getExtensionFieldType(row.key)" disabled />
            <Select
              v-else
              v-model:value="row.type"
              :options="[{ label: '文本', value: 'text' }, { label: '数字', value: 'number' }]"
            />
            <Input v-model:value="row.value" placeholder="值" />
            <Button danger size="small" @click="extensionRows.splice(index, 1)">删除</Button>
          </div>
        </div>
      </template>
    </Spin>
  </Modal>
</template>
