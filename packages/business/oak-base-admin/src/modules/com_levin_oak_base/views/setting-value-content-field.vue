<script lang="ts" setup>
import type {
  SettingJsonSchemaSource,
  TenantSettingItem,
} from './setting-for-tenant/setting-for-tenant';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { requestClient } from '@levin/admin-framework';
import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import { normalizeJsonSchemaObject } from '@levin/admin-framework/framework-commons/shared/json-schema-form';
import JsonSchemaFormField from '@levin/admin-framework/framework-commons/shared/json-schema-form-field.vue';
import { Input, InputNumber, Select, Spin, Switch } from 'ant-design-vue';

import { modulePost } from './api-module';
import {
  getCodeEditorLanguage,
  getEditorOptions,
  getSettingDisplayName,
  getSettingJsonSchema,
  getSettingJsonSchemaSource,
  parseSettingValueForEditor,
  resolveSettingEditorKind,
} from './setting-for-tenant/setting-for-tenant';

const props = defineProps<{
  disabled?: boolean;
  formState: Record<string, any>;
  inline?: boolean;
}>();

const schema = ref<Record<string, any>>();
const schemaErrorMessage = ref('');
const schemaLoading = ref(false);

const setting = computed(() => props.formState as TenantSettingItem);
const editorKind = computed(() => resolveSettingEditorKind(setting.value));
const settingTitle = computed(() => getSettingDisplayName(setting.value));
const placeholder = computed(
  () => setting.value.inputPlaceholder || `请输入${settingTitle.value}`,
);
const editorOptions = computed(() => getEditorOptions(setting.value.editor));
const inlineJsonSchema = computed(() => getSettingJsonSchema(setting.value));
const jsonSchemaSource = computed(() =>
  getSettingJsonSchemaSource(setting.value),
);
const jsonSchemaSourceSignature = computed(() => {
  const source = jsonSchemaSource.value;
  return source ? JSON.stringify(source) : '';
});
const jsonSchema = computed(() => schema.value || inlineJsonSchema.value);
const textAreaAutoSize = computed(() =>
  props.inline ? { maxRows: 18, minRows: 8 } : { maxRows: 8, minRows: 3 },
);

function setValue(value: any) {
  props.formState.valueContent = value;
}

function normalizeJsonSchemaResponse(data: any) {
  return normalizeJsonSchemaObject(
    data?.jsonSchema ??
      data?.data?.jsonSchema ??
      data?.schema ??
      data?.data?.schema ??
      data,
  );
}

async function fetchJsonSchemaBySource(source: SettingJsonSchemaSource) {
  if (source.kind === 'inline') {
    return source.schema;
  }

  if (source.kind === 'java-type') {
    const result = await modulePost<{
      jsonSchema?: string;
      schema?: Record<string, any> | string;
    }>('/jsonSchema/genJsonSchema', {
      typeGenericStr: source.typeGenericStr,
    });
    return normalizeJsonSchemaResponse(result);
  }

  const result = await requestClient.get(source.url, {
    baseURL: /^https?:\/\//i.test(source.url) ? undefined : '',
  });
  return normalizeJsonSchemaResponse(result);
}

async function loadJsonSchema() {
  const source = jsonSchemaSource.value;
  schema.value = undefined;
  schemaErrorMessage.value = '';

  if (!source) {
    return;
  }

  schemaLoading.value = true;

  try {
    const nextSchema = await fetchJsonSchemaBySource(source);
    if (nextSchema) {
      schema.value = nextSchema;
    } else {
      schemaErrorMessage.value = 'JSON Schema 解析失败';
    }
  } catch (error) {
    console.error(error);
    schemaErrorMessage.value = 'JSON Schema 加载失败';
  } finally {
    schemaLoading.value = false;
  }
}

watch(
  () => [props.formState.id, props.formState.valueType, props.formState.editor],
  () => {
    setValue(parseSettingValueForEditor(setting.value));
  },
  { immediate: true },
);

watch(
  jsonSchemaSourceSignature,
  () => {
    void loadJsonSchema();
  },
  { immediate: true },
);
</script>

<template>
  <Switch
    v-if="editorKind === 'switch'"
    :checked="formState.valueContent"
    :disabled="disabled"
    @update:checked="setValue"
  />

  <InputNumber
    v-else-if="editorKind === 'number'"
    :disabled="disabled"
    :placeholder="placeholder"
    :value="formState.valueContent"
    class="w-full"
    @update:value="setValue"
  />

  <Select
    v-else-if="editorKind === 'select'"
    :disabled="disabled"
    :options="editorOptions"
    :placeholder="placeholder"
    :value="formState.valueContent"
    allow-clear
    class="w-full"
    show-search
    @update:value="setValue"
  />

  <Spin v-else-if="editorKind === 'json-schema'" :spinning="schemaLoading">
    <JsonSchemaFormField
      :disabled="disabled"
      :error-message="schemaErrorMessage"
      :inline="inline"
      :model-value="formState.valueContent"
      :schema="jsonSchema"
      :title="settingTitle"
      @update:model-value="setValue"
    />
  </Spin>

  <JsonEditorField
    v-else-if="editorKind === 'json'"
    :disabled="disabled"
    :inline="inline"
    :model-value="formState.valueContent"
    :title="settingTitle"
    @update:model-value="setValue"
  />

  <CodeEditorField
    v-else-if="editorKind === 'code'"
    :disabled="disabled"
    :inline="inline"
    :language="getCodeEditorLanguage(setting)"
    :model-value="formState.valueContent"
    :title="settingTitle"
    @update:model-value="setValue"
  />

  <div v-else-if="editorKind === 'image-url'" class="space-y-2">
    <Input
      :disabled="disabled"
      :placeholder="placeholder"
      :value="formState.valueContent"
      @update:value="setValue"
    >
      <template #prefix>
        <IconifyIcon icon="lucide:image" />
      </template>
    </Input>
    <img
      v-if="formState.valueContent"
      :alt="settingTitle"
      class="max-h-32 rounded object-contain"
      :src="formState.valueContent"
    />
  </div>

  <div v-else-if="editorKind === 'video-url'" class="space-y-2">
    <Input
      :disabled="disabled"
      :placeholder="placeholder"
      :value="formState.valueContent"
      @update:value="setValue"
    >
      <template #prefix>
        <IconifyIcon icon="lucide:video" />
      </template>
    </Input>
    <video
      v-if="formState.valueContent"
      class="max-h-40 w-full rounded bg-black"
      controls
      :src="formState.valueContent"
    ></video>
  </div>

  <Input
    v-else-if="editorKind === 'file-url'"
    :disabled="disabled"
    :placeholder="placeholder"
    :value="formState.valueContent"
    @update:value="setValue"
  >
    <template #prefix>
      <IconifyIcon icon="lucide:file" />
    </template>
  </Input>

  <Input.TextArea
    v-else-if="editorKind === 'textarea'"
    :auto-size="textAreaAutoSize"
    :disabled="disabled"
    :placeholder="placeholder"
    :value="formState.valueContent"
    @update:value="setValue"
  />

  <Input.TextArea
    v-else
    :auto-size="textAreaAutoSize"
    :disabled="disabled"
    :placeholder="placeholder"
    :value="formState.valueContent"
    @update:value="setValue"
  />
</template>
