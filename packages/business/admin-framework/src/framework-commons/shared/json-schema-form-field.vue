<script lang="ts" setup>
import type { CrudFieldConfig } from './types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

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
  DEFAULT_CONTENT_MODAL_BODY_STYLE,
  DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
} from './config-helpers';
import {
  getFormGridContentMaxWidth,
  resolveFormColumnCount,
} from './crud-form-layout';
import { getJsonSchemaFieldError } from './json-schema-field-validation';
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
    inline?: boolean;
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
    inline: false,
    modalStyle: undefined,
    modelValue: undefined,
    loading: false,
    modalWidth: 'min(80vw, 1120px)',
    schema: () => ({}),
    title: 'JSON',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
  validity: [valid: boolean];
}>();

const open = ref(false);
const draftValue = ref<Record<string, any>>({});
const complexTextValues = reactive<Record<string, string>>({});
const complexErrors = reactive<Record<string, string>>({});
const viewportWidth = ref(0);
const viewportHeight = ref(0);

function syncViewportSize() {
  if (typeof window === 'undefined') {
    viewportWidth.value = 0;
    viewportHeight.value = 0;
    return;
  }

  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
}

function getConfiguredModalMaxWidthPx(configuredWidth?: number | string) {
  if (typeof configuredWidth === 'number' && Number.isFinite(configuredWidth)) {
    return configuredWidth;
  }

  if (typeof configuredWidth !== 'string') {
    return undefined;
  }

  const widthText = configuredWidth.trim();
  const pixelMatches = [...widthText.matchAll(/(\d+(?:\.\d+)?)px/g)];
  const lastPixelMatch = pixelMatches.at(-1);

  if (!lastPixelMatch) {
    return undefined;
  }

  const width = Number(lastPixelMatch[1]);
  return Number.isFinite(width) ? width : undefined;
}

function getLayoutFieldType(field: { kind: string }) {
  if (field.kind === 'boolean') {
    return 'switch';
  }

  if (field.kind === 'number') {
    return 'number';
  }

  if (field.kind === 'textarea') {
    return 'textarea';
  }

  if (field.kind === 'json') {
    return 'json';
  }

  return 'text';
}

function shouldUseFullRowLayout(field: (typeof fields.value)[number]) {
  if (['json', 'section', 'textarea'].includes(field.kind)) return true;
  const name = `${field.path.at(-1) || ''} ${field.label}`.toLowerCase();
  return /content|template|message|remark|description|模板|内容|说明|备注|消息/.test(
    name,
  );
}

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
    // Vue响应式代理不能直接structuredClone；这里按JSON值语义复制。
    // eslint-disable-next-line unicorn/prefer-structured-clone
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { ...value };
  }
}

const fields = computed(() => buildJsonSchemaFormFields(props.schema));
const fieldErrors = computed(() =>
  Object.fromEntries(
    fields.value
      .map((field) => [
        field.pathKey,
        complexErrors[field.pathKey] ||
          getJsonSchemaFieldError(
            field,
            getJsonSchemaPathValue(draftValue.value, field.path),
          ),
      ])
      .filter(([, error]) => !!error),
  ),
);
const formValid = computed(() => Object.keys(fieldErrors.value).length === 0);
watch(formValid, (valid) => emit('validity', valid), { immediate: true });
const layoutFields = computed<CrudFieldConfig[]>(() =>
  fields.value.map((field) => ({
    key: field.pathKey,
    label: field.label,
    fullRow: shouldUseFullRowLayout(field),
    layoutNewRow: field.kind === 'section',
    span: shouldUseFullRowLayout(field) ? -1 : 1,
    type: getLayoutFieldType(field),
  })),
);
const modalAvailableWidth = computed(() => {
  const configuredWidth = getConfiguredModalMaxWidthPx(props.modalWidth);
  const viewportLimit = viewportWidth.value > 0 ? viewportWidth.value * 0.8 : 0;
  const configuredLimit = configuredWidth ?? (viewportLimit || 1120);

  if (viewportLimit > 0) {
    return Math.min(viewportLimit, configuredLimit);
  }

  return configuredLimit;
});
const popupColumnCount = computed(() =>
  resolveFormColumnCount({
    fields: layoutFields.value,
    configuredMaxColumns: 2,
    modalAvailableWidth: modalAvailableWidth.value,
    viewportHeight: viewportHeight.value || 900,
    viewportWidth: viewportWidth.value || 1440,
  }),
);
const popupGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${popupColumnCount.value}, minmax(0, 1fr))`,
  margin: '0 auto',
  maxWidth: `${getFormGridContentMaxWidth(popupColumnCount.value)}px`,
  width: '100%',
}));
const contentModalStyle = computed(() => ({
  maxHeight: DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
  ...props.modalStyle,
}));

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
  Object.keys(complexErrors).forEach((key) => delete complexErrors[key]);
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
  emitInlineValue();
}

function setComplexFieldValue(path: string[], pathKey: string, value: string) {
  complexTextValues[pathKey] = value;

  if (!value.trim()) {
    delete complexErrors[pathKey];
    setFieldValue(path, undefined);
    return;
  }

  try {
    const parsed = JSON.parse(value);
    delete complexErrors[pathKey];
    setFieldValue(path, parsed);
  } catch {
    complexErrors[pathKey] = 'JSON格式不正确，请完成输入后再保存';
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
  if (!formValid.value) return;
  emit('update:modelValue', cloneObjectValue(draftValue.value));
  open.value = false;
}

function emitInlineValue() {
  if (props.inline && formValid.value) {
    emit('update:modelValue', cloneObjectValue(draftValue.value));
  }
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (props.inline && Object.keys(complexErrors).length > 0) return;
    if (props.inline || !open.value) {
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
  if (props.inline || open.value) {
    resetComplexTextValues();
  }
});

onMounted(() => {
  syncViewportSize();
  window.addEventListener('resize', syncViewportSize);
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncViewportSize);
  }
});
</script>

<template>
  <div
    class="crud-json-schema-form-field"
    :class="{ 'crud-json-schema-form-field--inline': inline }"
  >
    <Input
      v-if="!inline"
      :disabled="disabled"
      :placeholder="
        loading ? 'JSON Schema 加载中' : '点击编辑 JSON Schema 表单'
      "
      readonly
      :value="previewText"
      @click="openEditor"
    />
    <Button
      v-if="!inline"
      :disabled="disabled || loading || !!errorMessage"
      @click="openEditor"
    >
      编辑
    </Button>

    <Form v-if="inline" layout="vertical">
      <div class="crud-json-schema-form-grid">
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
            <div v-if="field.description" class="text-muted-foreground text-xs">
              {{ field.description }}
            </div>
          </div>

          <Form.Item
            v-else
            :class="{
              'crud-json-schema-form-full': isWideField(field),
              'crud-json-schema-form-item': !isWideField(field),
            }"
            :help="fieldErrors[field.pathKey]"
            :validate-status="fieldErrors[field.pathKey] ? 'error' : undefined"
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
              class="w-full"
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
              class="w-full"
              @update:value="setFieldValue(field.path, $event)"
            />

            <Input
              v-else
              :disabled="disabled || field.readOnly"
              :placeholder="`请输入${field.label}`"
              :value="getFieldValue(field.path)"
              class="w-full"
              @update:value="setFieldValue(field.path, $event)"
            />
          </Form.Item>
        </template>

        <div
          v-if="loading"
          class="crud-json-schema-form-full text-muted-foreground text-sm"
          style="grid-column: 1 / -1"
        >
          正在加载 JSON Schema...
        </div>
        <div
          v-else-if="errorMessage"
          class="crud-json-schema-form-full text-destructive text-sm"
          style="grid-column: 1 / -1"
        >
          {{ errorMessage }}
        </div>
        <div
          v-else-if="fields.length === 0"
          class="crud-json-schema-form-full text-muted-foreground text-sm"
          style="grid-column: 1 / -1"
        >
          当前 JSON Schema 没有 properties，无法生成动态表单。
        </div>
      </div>
    </Form>

    <Modal
      v-if="!inline"
      v-model:open="open"
      :body-style="DEFAULT_CONTENT_MODAL_BODY_STYLE"
      destroy-on-close
      :mask-closable="false"
      ok-text="保存"
      :ok-button-props="{ disabled: !formValid }"
      :style="contentModalStyle"
      :title="modalTitle"
      :width="modalWidth"
      @ok="handleOk"
    >
      <Form layout="vertical">
        <div
          class="crud-json-schema-form-grid crud-json-schema-form-grid--popup"
          :style="popupGridStyle"
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
                class="text-muted-foreground text-xs"
              >
                {{ field.description }}
              </div>
            </div>

            <Form.Item
              v-else
              :class="{
                'crud-json-schema-form-full': isWideField(field),
                'crud-json-schema-form-item': !isWideField(field),
              }"
              :help="fieldErrors[field.pathKey]"
              :validate-status="
                fieldErrors[field.pathKey] ? 'error' : undefined
              "
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
                class="w-full"
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
                class="w-full"
                @update:value="setFieldValue(field.path, $event)"
              />

              <Input
                v-else
                :disabled="disabled || field.readOnly"
                :placeholder="`请输入${field.label}`"
                :value="getFieldValue(field.path)"
                class="w-full"
                @update:value="setFieldValue(field.path, $event)"
              />
            </Form.Item>
          </template>

          <div
            v-if="loading"
            class="crud-json-schema-form-full text-muted-foreground text-sm"
            style="grid-column: 1 / -1"
          >
            正在加载 JSON Schema...
          </div>
          <div
            v-else-if="errorMessage"
            class="crud-json-schema-form-full text-destructive text-sm"
            style="grid-column: 1 / -1"
          >
            {{ errorMessage }}
          </div>
          <div
            v-else-if="fields.length === 0"
            class="crud-json-schema-form-full text-muted-foreground text-sm"
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

.crud-json-schema-form-field--inline {
  display: block;
}

.crud-json-schema-form-field :deep(.ant-input) {
  cursor: pointer;
}

.crud-json-schema-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 4px;
  width: 100%;
}

.crud-json-schema-form-field--inline .crud-json-schema-form-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.crud-json-schema-form-item {
  width: 100%;
  min-width: 0;
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
