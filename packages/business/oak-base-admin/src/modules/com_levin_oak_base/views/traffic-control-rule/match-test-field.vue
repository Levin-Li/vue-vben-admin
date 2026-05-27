<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { PatternListEditor } from '@levin/admin-framework';
import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';
import type { SelectOption } from '@levin/admin-framework';

import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import { Alert, Button, Form, Input, Modal, Space, Tag } from 'ant-design-vue';

import {
  matchRuleList,
  normalizePatternList,
  normalizeRuleList,
} from './traffic-control-match';

const props = defineProps<{
  field: CrudFieldConfig;
  modelValue: unknown;
  ruleKind?: 'list' | 'nameValue';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const localOptions = ref<SelectOption[]>([]);
const loading = ref(false);
const testerOpen = ref(false);
const nameInputValue = ref('');
const valueInputValue = ref('');
const tested = ref(false);
let loadSeq = 0;

const isNameValueRule = computed(() => props.ruleKind === 'nameValue');
const modelProxy = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
const fieldOptions = computed(() => [
  ...(props.field.options || []),
  ...localOptions.value,
]);
const patternOptions = computed(() =>
  fieldOptions.value.map((option) => ({
    description: String((option as Record<string, unknown>).description || ''),
    disabled: !!(option as Record<string, unknown>).disabled,
    label: String(option.label ?? option.value ?? ''),
    value: String(option.value ?? ''),
  })),
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

async function loadOptions(keyword = '') {
  if (!props.field.loadOptions) {
    return;
  }

  const currentSeq = ++loadSeq;
  loading.value = true;

  try {
    const options = await props.field.loadOptions(keyword);

    if (currentSeq === loadSeq) {
      localOptions.value = options;
    }
  } finally {
    if (currentSeq === loadSeq) {
      loading.value = false;
    }
  }
}

function handleSearch(keyword: string) {
  void loadOptions(keyword);
}

function handleDropdownVisibleChange(open: boolean) {
  if (open) {
    void loadOptions();
  }
}

function openTester() {
  testerOpen.value = true;
}

function testMatch() {
  tested.value = true;
}

onMounted(() => {
  void loadOptions();
});
</script>

<template>
  <div class="flex w-full items-start gap-2">
    <JsonEditorField
      v-if="isNameValueRule"
      v-model="modelProxy"
      class="min-w-0 flex-1"
      :modal-width="'min(70vw, 1280px)'"
      :title="field.label"
    />
    <PatternListEditor
      v-else
      v-model="modelProxy"
      class="min-w-0 flex-1"
      :loading="loading"
      :options="patternOptions"
      :placeholder="field.placeholder || `请输入${field.label}`"
      :test-placeholder="`测试${field.label}`"
      @dropdown-visible-change="handleDropdownVisibleChange"
      @search="handleSearch"
    />
    <Button v-if="isNameValueRule" @click="openTester">测试匹配</Button>
  </div>

  <Modal v-model:open="testerOpen" :footer="null" :title="modalTitle">
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
