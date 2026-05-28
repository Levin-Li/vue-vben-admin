<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import type { PatternMatchMode } from '@levin/admin-framework';
import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { Alert, Button, Form, Input, Modal, Space, Tag } from 'ant-design-vue';

import PatternListFormField from '../pattern-list-form-field.vue';
import {
  matchRuleList,
  normalizePatternList,
  normalizeRuleList,
  validateNameValueRuleItem,
} from './traffic-control-match';

const props = defineProps<{
  field: CrudFieldConfig;
  modelValue: unknown;
  ruleKind?: 'list' | 'nameValue';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const testerOpen = ref(false);
const nameInputValue = ref('');
const valueInputValue = ref('');
const tested = ref(false);

const isNameValueRule = computed(() => props.ruleKind === 'nameValue');
const modelProxy = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
const patternMatchMode = computed(
  () =>
    ((props.field as unknown as { matchMode?: PatternMatchMode }).matchMode ||
      'any') as PatternMatchMode,
);
const ruleMatchResult = computed(() =>
  matchRuleList(props.modelValue, nameInputValue.value, valueInputValue.value),
);
const hasConfig = computed(() =>
  isNameValueRule.value
    ? normalizeRuleList(props.modelValue).length > 0
    : normalizePatternList(props.modelValue).length > 0,
);
const matched = computed(() =>
  isNameValueRule.value ? ruleMatchResult.value.matched : false,
);
const modalTitle = computed(() => `${props.field.label} - 测试匹配`);
const matchSummary = computed(() => {
  if (!tested.value) {
    return '';
  }

  if (!hasConfig.value) {
    return '当前字段还没有配置匹配项。';
  }

  return matched.value ? '匹配' : '不匹配';
});

watch(testerOpen, (open) => {
  if (open) {
    tested.value = false;
  }
});

function openTester() {
  testerOpen.value = true;
}

function testMatch() {
  tested.value = true;
}
</script>

<template>
  <PatternListFormField
    v-model="modelProxy"
    class="min-w-0"
    :custom-test="isNameValueRule"
    :field="field"
    :match-mode="patternMatchMode"
    :testable="true"
    :validate-item="isNameValueRule ? validateNameValueRuleItem : undefined"
    @test="openTester"
  />

  <Modal
    v-model:open="testerOpen"
    :footer="null"
    :mask-closable="false"
    :title="modalTitle"
  >
    <Form layout="vertical">
      <template v-if="isNameValueRule">
        <Form.Item label="实际名称">
          <Input
            v-model:value="nameInputValue"
            placeholder="例如 tenant、status、X-Tenant-Id"
          />
        </Form.Item>
        <Form.Item label="实际值">
          <Input
            v-model:value="valueInputValue"
            placeholder="例如 market-cn、vip1"
          />
        </Form.Item>
      </template>
    </Form>

    <Alert
      v-if="tested"
      class="mb-3"
      :message="matchSummary"
      show-icon
      :type="matched ? 'success' : 'warning'"
    />

    <div class="space-y-2 text-sm">
      <div class="text-muted-foreground">当前匹配配置</div>
      <div
        v-for="(rule, index) in ruleMatchResult.rules"
        :key="index"
        class="border-border rounded border p-2"
      >
        <div>
          名称：
          <Space wrap>
            <Tag v-for="item in rule.namePatterns" :key="item">{{ item }}</Tag>
          </Space>
        </div>
        <div class="mt-1">
          值：
          <Space wrap>
            <Tag v-for="item in rule.valuePatterns" :key="item">{{ item }}</Tag>
          </Space>
        </div>
      </div>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <Button @click="testerOpen = false">关闭</Button>
      <Button type="primary" @click="testMatch">测试匹配</Button>
    </div>
  </Modal>
</template>
