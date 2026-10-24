<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Alert, Input } from 'ant-design-vue';

import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';

type Field = { key: string; required?: boolean; title: string };

const props = defineProps<{
  disabled?: boolean;
  modelValue?: Record<string, string>;
  templateId?: string;
  tenantId?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
}>();
const fields = ref<Field[]>([]);
const error = ref('');
const loading = ref(false);
let loadVersion = 0;

// 每次选择模板都重新读取变量定义，旧模板的变量不能带入新合同。
watch(
  () => [props.templateId, props.tenantId],
  async ([templateId, tenantId]) => {
    const version = ++loadVersion;
    fields.value = [];
    error.value = '';
    emit('update:modelValue', {});
    if (!templateId) return;

    loading.value = true;
    try {
      const response = await electronicContractTemplateService.retrieve({
        id: templateId,
        tenantId: tenantId || undefined,
      });
      if (version !== loadVersion) return;
      const payload =
        response && typeof response === 'object' && 'data' in response
          ? response.data
          : response;
      const schema = (payload as { templateFieldSchema?: unknown })
        ?.templateFieldSchema;
      const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
      fields.value = Array.isArray(parsed)
        ? parsed.filter(
            (field) =>
              field &&
              typeof field.key === 'string' &&
              typeof field.title === 'string',
          )
        : [];
    } catch (error_) {
      if (version !== loadVersion) return;
      error.value =
        error_ instanceof Error ? error_.message : '加载模板变量失败';
    } finally {
      if (version === loadVersion) loading.value = false;
    }
  },
  { immediate: true },
);

function updateValue(key: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="contract-template-values">
    <span v-if="loading">正在加载模板变量…</span>
    <span v-else-if="!templateId">请先选择合同模板</span>
    <span v-else-if="fields.length === 0 && !error">此模板没有填写变量</span>
    <label
      v-for="field in fields"
      :key="field.key"
      class="contract-template-values__field"
    >
      <span>{{ field.title }}{{ field.required ? ' *' : '' }}</span>
      <Input
        :disabled="disabled"
        :value="modelValue?.[field.key]"
        :placeholder="`填写${field.title}`"
        @update:value="(value) => updateValue(field.key, String(value || ''))"
      />
    </label>
    <Alert v-if="error" :message="error" show-icon type="error" />
  </div>
</template>

<style scoped>
.contract-template-values {
  display: grid;
  gap: 8px;
}

.contract-template-values__field {
  display: grid;
  gap: 4px;
}
</style>
