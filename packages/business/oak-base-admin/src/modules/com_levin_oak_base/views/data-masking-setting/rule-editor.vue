<script lang="ts" setup>
import type { MaskingOperationCatalogItem } from '../../api/data-masking-setting-service';
import type { MaskingFieldRule } from './rules';

import { computed, onMounted, ref, watch } from 'vue';

import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { Checkbox, Empty, InputNumber, Select, Spin } from 'ant-design-vue';

import { dataMaskingSettingService } from '../../api/data-masking-setting-service';

const props = defineProps<{
  disabled?: boolean;
  formState: Record<string, any>;
}>();

const catalog = ref<MaskingOperationCatalogItem[]>([]);
const loading = ref(false);
const outputOperation = ref('');

const rules = computed<MaskingFieldRule[]>(() => {
  const content = props.formState.valueContent;
  return Array.isArray(content) ? content : [];
});
const selectedOutput = computed(() =>
  catalog.value.find((item) => item.operation === outputOperation.value),
);
const operationOptions = computed(() =>
  catalog.value.map((item) => ({
    label: `${item.methods.join(',') || 'ANY'} ${item.paths[0] || item.operation}`,
    value: item.operation,
  })),
);

// 切换新增或编辑记录时，重新定位到该记录已有规则的输出接口。
watch(
  () => props.formState.valueContent,
  () => {
    outputOperation.value =
      rules.value[0]?.outputOperation || catalog.value[0]?.operation || '';
  },
);

function writableRules(): MaskingFieldRule[] {
  // CrudPage 将可编辑表单状态传入插槽；在本地引用中更新该状态。
  const formState = props.formState;
  if (!Array.isArray(formState.valueContent)) {
    formState.valueContent = [];
  }
  return formState.valueContent;
}

function ruleFor(path: string): MaskingFieldRule | undefined {
  return rules.value.find(
    (rule) =>
      rule.outputOperation === outputOperation.value &&
      rule.outputFieldPath === path,
  );
}

function toggleField(path: string, checked: boolean) {
  const items = writableRules();
  const index = items.findIndex(
    (rule) =>
      rule.outputOperation === outputOperation.value &&
      rule.outputFieldPath === path,
  );
  if (checked && index === -1) {
    items.push({
      outputOperation: outputOperation.value,
      outputFieldPath: path,
      treatment: 'HIDE',
    });
  } else if (!checked && index !== -1) {
    items.splice(index, 1);
  }
}

function inputFieldOptions(rule: MaskingFieldRule) {
  return (
    catalog.value.find((item) => item.operation === rule.inputOperation)
      ?.requestFields || []
  ).map((path) => ({ label: path, value: path }));
}

function setInputOperation(rule: MaskingFieldRule, operation: string) {
  rule.inputOperation = operation;
  rule.inputFieldPath = undefined;
}

onMounted(async () => {
  loading.value = true;
  try {
    catalog.value = await dataMaskingSettingService.catalog();
    outputOperation.value =
      rules.value[0]?.outputOperation || catalog.value[0]?.operation || '';
  } catch (error) {
    notifyApiErrorOnce(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Spin :spinning="loading">
    <div class="rule-editor">
      <!-- 先从服务端注册目录选择输出接口，再勾选本接口的响应字段。 -->
      <label class="rule-label">输出接口</label>
      <Select
        v-model:value="outputOperation"
        :disabled="disabled"
        :options="operationOptions"
        class="rule-full"
        show-search
        option-filter-prop="label"
      />

      <Empty v-if="!selectedOutput" description="没有可选接口" />
      <div v-else class="rule-field-list">
        <Checkbox
          v-for="path in selectedOutput.responseFields"
          :key="path"
          :checked="!!ruleFor(path)"
          :disabled="disabled"
          @change="toggleField(path, $event.target.checked)"
        >
          {{ path }}
        </Checkbox>
        <Empty
          v-if="selectedOutput.responseFields.length === 0"
          description="此接口没有可配置的响应字段"
        />
      </div>

      <!-- 每个勾选字段各自配置处理方式；可还原 ID 才要求输入接口和有效期。 -->
      <div
        v-for="rule in rules.filter(
          (item) => item.outputOperation === outputOperation,
        )"
        :key="rule.outputFieldPath"
        class="rule-card"
      >
        <strong>{{ rule.outputFieldPath }}</strong>
        <Select
          v-model:value="rule.treatment"
          :disabled="disabled"
          :options="[
            { label: '隐藏', value: 'HIDE' },
            { label: '普通遮盖', value: 'MASK' },
            { label: '可还原 ID', value: 'REVERSIBLE_ID' },
          ]"
        />

        <template v-if="rule.treatment === 'REVERSIBLE_ID'">
          <Select
            :value="rule.inputOperation"
            :disabled="disabled"
            :options="operationOptions"
            placeholder="接收 ID 的接口"
            show-search
            option-filter-prop="label"
            @change="setInputOperation(rule, String($event))"
          />
          <Select
            v-model:value="rule.inputFieldPath"
            :disabled="disabled || !rule.inputOperation"
            :options="inputFieldOptions(rule)"
            placeholder="接收 ID 的请求字段"
            show-search
            option-filter-prop="label"
          />
          <Select
            v-model:value="rule.binding"
            :disabled="disabled"
            :options="[
              { label: '当前用户', value: 'USER' },
              { label: '当前登录会话', value: 'SESSION' },
            ]"
            placeholder="绑定范围"
          />
          <InputNumber
            v-model:value="rule.validSeconds"
            addon-after="秒"
            :disabled="disabled"
            :min="1"
            :max="86400"
            class="rule-full"
            placeholder="有效秒数"
          />
        </template>
      </div>
    </div>
  </Spin>
</template>

<style scoped>
.rule-editor {
  display: grid;
  gap: 12px;
  width: 100%;
}
.rule-label {
  font-weight: 600;
}
.rule-full {
  width: 100%;
}
.rule-field-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  max-height: 180px;
  overflow: auto;
}
.rule-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 8px;
}
</style>
