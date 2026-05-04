<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
} from 'ant-design-vue';

import {
  applyJsonSchemaDefaults,
  buildJsonSchemaFormFields,
  getJsonSchemaPathValue,
  setJsonSchemaPathValue,
} from './json-schema-form';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    errorMessage?: string;
    loading?: boolean;
    modalStyle?: Record<string, any>;
    modalWidth?: number | string;
    modelValue?: any;
    schema?: Record<string, any>;
    title?: string;
  }>(),
  {
    disabled: false,
    errorMessage: '',
    loading: false,
    modalWidth: 'min(70vw, 1120px)',
    schema: () => ({}),
    title: 'JSON',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
}>();

const open = ref(false);
const draftValue = ref<Record<string, any>>({});
const complexTextValues = reactive<Record<string, string>>({});

function cloneObjectValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { ...value };
  }
}

const fields = computed(() => buildJsonSchemaFormFields(props.schema));

const previewText = computed(() => {
  if (
    props.modelValue === undefined ||
    props.modelValue === null ||
    props.modelValue === ''
  ) {
    return '';
  }

  if (typeof props.modelValue === 'string') {
    return props.modelValue;
  }

  try {
    return JSON.stringify(props.modelValue);
  } catch {
    return String(props.modelValue);
  }
});

const modalTitle = computed(() => `编辑${props.schema?.title || props.title}`);

function stringifyComplexValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resetComplexTextValues() {
  Object.keys(complexTextValues).forEach(
    (key) => delete complexTextValues[key],
  );
  fields.value
    .filter((field) => field.kind === 'json')
    .forEach((field) => {
      complexTextValues[field.pathKey] = stringifyComplexValue(
        getJsonSchemaPathValue(draftValue.value, field.path),
      );
    });
}

function openEditor() {
  if (props.disabled) {
    return;
  }

  draftValue.value = applyJsonSchemaDefaults(
    cloneObjectValue(props.modelValue),
    props.schema,
  );
  resetComplexTextValues();
  open.value = true;
}

function getFieldValue(path: string[]) {
  return getJsonSchemaPathValue(draftValue.value, path);
}

function setFieldValue(path: string[], value: any) {
  draftValue.value = setJsonSchemaPathValue(draftValue.value, path, value);
}

function setComplexFieldValue(path: string[], pathKey: string, value: string) {
  complexTextValues[pathKey] = value;

  if (!value.trim()) {
    setFieldValue(path, undefined);
    return;
  }

  try {
    setFieldValue(path, JSON.parse(value));
  } catch {
    // Keep the user's text in the textarea while they finish editing invalid JSON.
  }
}

function isWideField(field: { kind: string; schema?: Record<string, any> }) {
  return (
    field.kind === 'json' ||
    field.kind === 'textarea' ||
    field.schema?.['ui:span'] === 2 ||
    field.schema?.['x-span'] === 2
  );
}

function getFieldItemStyle(field: {
  kind: string;
  level: number;
  schema?: Record<string, any>;
}) {
  return {
    gridColumn: isWideField(field) ? '1 / -1' : undefined,
    paddingLeft: `${field.level * 16}px`,
  };
}

function handleOk() {
  emit('update:modelValue', cloneObjectValue(draftValue.value));
  open.value = false;
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!open.value) {
      draftValue.value = applyJsonSchemaDefaults(
        cloneObjectValue(nextValue),
        props.schema,
      );
      resetComplexTextValues();
    }
  },
  { immediate: true },
);

watch(fields, () => {
  if (open.value) {
    resetComplexTextValues();
  }
});
</script>

<template>
  <div class="crud-json-schema-form-field">
    <Input
      :disabled="disabled"
      :placeholder="
        loading ? 'JSON Schema 加载中' : '点击编辑 JSON Schema 表单'
      "
      readonly
      :value="previewText"
      @click="openEditor"
    />
    <Button
      :disabled="disabled || loading || !!errorMessage"
      @click="openEditor"
    >
      编辑
    </Button>

    <Modal
      v-model:open="open"
      destroy-on-close
      :style="modalStyle"
      :title="modalTitle"
      :width="modalWidth"
      @ok="handleOk"
    >
      <Form layout="vertical">
        <div
          class="crud-json-schema-form-grid"
          style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            column-gap: 16px;
            row-gap: 4px;
          "
        >
          <template v-for="field in fields" :key="field.pathKey">
            <div
              v-if="field.kind === 'section'"
              class="crud-json-schema-form-section crud-json-schema-form-full"
              :style="{
                gridColumn: '1 / -1',
                paddingLeft: `${field.level * 16}px`,
              }"
            >
              <div class="text-sm font-medium">{{ field.label }}</div>
              <div
                v-if="field.description"
                class="text-xs text-muted-foreground"
              >
                {{ field.description }}
              </div>
            </div>

            <Form.Item
              v-else
              :class="{ 'crud-json-schema-form-full': isWideField(field) }"
              :extra="field.description"
              :label="field.label"
              :required="field.required"
              :style="getFieldItemStyle(field)"
            >
              <Select
                v-if="field.kind === 'select'"
                :disabled="disabled || field.readOnly"
                :options="field.options"
                :placeholder="`请选择${field.label}`"
                :value="getFieldValue(field.path)"
                allow-clear
                class="w-full"
                show-search
                @update:value="setFieldValue(field.path, $event)"
              />

              <Switch
                v-else-if="field.kind === 'boolean'"
                :checked="!!getFieldValue(field.path)"
                :disabled="disabled || field.readOnly"
                @update:checked="setFieldValue(field.path, $event)"
              />

              <InputNumber
                v-else-if="field.kind === 'number'"
                :disabled="disabled || field.readOnly"
                :placeholder="`请输入${field.label}`"
                :value="getFieldValue(field.path)"
                class="w-full"
                @update:value="setFieldValue(field.path, $event)"
              />

              <Input.TextArea
                v-else-if="field.kind === 'json'"
                :auto-size="{ minRows: 3, maxRows: 8 }"
                :disabled="disabled || field.readOnly"
                :placeholder="`请输入${field.label} JSON`"
                :value="complexTextValues[field.pathKey]"
                @update:value="
                  setComplexFieldValue(field.path, field.pathKey, $event)
                "
              />

              <Input.TextArea
                v-else-if="field.kind === 'textarea'"
                :auto-size="{ minRows: 3, maxRows: 8 }"
                :disabled="disabled || field.readOnly"
                :placeholder="`请输入${field.label}`"
                :value="getFieldValue(field.path)"
                @update:value="setFieldValue(field.path, $event)"
              />

              <Input
                v-else
                :disabled="disabled || field.readOnly"
                :placeholder="`请输入${field.label}`"
                :value="getFieldValue(field.path)"
                @update:value="setFieldValue(field.path, $event)"
              />
            </Form.Item>
          </template>

          <div
            v-if="loading"
            class="crud-json-schema-form-full text-sm text-muted-foreground"
            style="grid-column: 1 / -1"
          >
            正在加载 JSON Schema...
          </div>
          <div
            v-else-if="errorMessage"
            class="crud-json-schema-form-full text-sm text-destructive"
            style="grid-column: 1 / -1"
          >
            {{ errorMessage }}
          </div>
          <div
            v-else-if="fields.length === 0"
            class="crud-json-schema-form-full text-sm text-muted-foreground"
            style="grid-column: 1 / -1"
          >
            当前 JSON Schema 没有 properties，无法生成动态表单。
          </div>
        </div>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
.crud-json-schema-form-field {
  display: flex;
  width: 100%;
  gap: 8px;
}

.crud-json-schema-form-field :deep(.ant-input) {
  cursor: pointer;
}

.crud-json-schema-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 4px;
}

.crud-json-schema-form-grid :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.crud-json-schema-form-full {
  grid-column: 1 / -1;
}

.crud-json-schema-form-section {
  margin-bottom: 12px;
  border-left: 2px solid hsl(var(--border));
  padding-top: 2px;
  padding-bottom: 2px;
}

@media (max-width: 900px) {
  .crud-json-schema-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
