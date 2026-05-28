<script lang="ts" setup>
import type { JsonSchemaSourceInput } from './json-schema-source';

import { computed, ref, watch } from 'vue';

import { Spin } from 'ant-design-vue';

import { jsonSchemaService } from '../app/api/json-schema-service';
import { requestClient } from '../runtime';
import JsonSchemaFormField from './json-schema-form-field.vue';
import { normalizeJsonSchemaObject } from './json-schema-form';
import {
  getJsonValueJsonSchemaInput,
  resolveJsonSchemaSource,
} from './json-schema-source';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    inline?: boolean;
    modalStyle?: Record<string, any>;
    modalWidth?: number | string;
    modelValue?: any;
    schemaSource?: JsonSchemaSourceInput;
    title?: string;
  }>(),
  {
    disabled: false,
    inline: false,
    modalWidth: 'min(70vw, 1120px)',
    schemaSource: undefined,
    title: 'JSON',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
}>();

const schema = ref<Record<string, any>>();
const schemaErrorMessage = ref('');
const schemaLoading = ref(false);

const resolvedSource = computed(() =>
  resolveJsonSchemaSource(
    props.schemaSource ?? getJsonValueJsonSchemaInput(props.modelValue),
  ),
);
const sourceSignature = computed(() => JSON.stringify(resolvedSource.value));

function normalizeJsonSchemaResponse(data: any) {
  return normalizeJsonSchemaObject(
    data?.jsonSchema ??
      data?.data?.jsonSchema ??
      data?.schema ??
      data?.data?.schema ??
      data,
  );
}

async function fetchJsonSchema() {
  const source = resolvedSource.value;

  if (!source) {
    return undefined;
  }

  if (source.kind === 'inline') {
    return source.schema;
  }

  if (source.kind === 'java-type') {
    const result = await jsonSchemaService.genJsonSchema({
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
  schema.value = undefined;
  schemaErrorMessage.value = '';

  if (!resolvedSource.value) {
    return;
  }

  schemaLoading.value = true;

  try {
    const nextSchema = await fetchJsonSchema();

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
  sourceSignature,
  () => {
    void loadJsonSchema();
  },
  { immediate: true },
);
</script>

<template>
  <Spin :spinning="schemaLoading">
    <JsonSchemaFormField
      :disabled="disabled"
      :error-message="schemaErrorMessage"
      :inline="inline"
      :modal-style="modalStyle"
      :modal-width="modalWidth"
      :model-value="modelValue"
      :schema="schema"
      :title="title"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </Spin>
</template>
