<script lang="ts" setup>
import type { TemplateVariable } from './template-variables';

import { computed, nextTick, ref } from 'vue';

import { Button, Checkbox, Input } from 'ant-design-vue';

const props = defineProps<{
  disabled?: boolean;
  formState: Record<string, any>;
}>();
const emit = defineEmits<{ update: [value: TemplateVariable[]] }>();
const editorRoot = ref<HTMLElement>();

// 旧记录可能回传 JSON 字符串；读取失败时明确提示，不静默覆盖原值。
const parseError = computed(() => {
  const value = props.formState.templateFieldSchema;
  if (typeof value !== 'string') return '';
  try {
    return Array.isArray(JSON.parse(value)) ? '' : '已有填写项格式不正确';
  } catch {
    return '已有填写项格式不正确';
  }
});
const rows = computed<TemplateVariable[]>(() => {
  const value = props.formState.templateFieldSchema;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && !parseError.value) {
    return JSON.parse(value) as TemplateVariable[];
  }
  return [];
});

function updateRow(index: number, values: Partial<TemplateVariable>) {
  emit(
    'update',
    rows.value.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...values } : row,
    ),
  );
}

async function addRow() {
  emit('update', [...rows.value, { key: '', title: '', required: false }]);
  await nextTick();

  // 新行可能落在弹窗滚动区下方，添加后直接带用户看到可填写的控件。
  const rowElements = editorRoot.value?.querySelectorAll<HTMLElement>(
    '[data-template-variable-row]',
  );
  rowElements?.[rowElements.length - 1]?.scrollIntoView?.({ block: 'nearest' });
}

function removeRow(index: number) {
  emit(
    'update',
    rows.value.filter((_, rowIndex) => rowIndex !== index),
  );
}
</script>

<template>
  <div ref="editorRoot" class="space-y-3">
    <!-- 固定正文不需要变量；需要填空时用一条可照做的 Word 示例解释占位符。 -->
    <div
      v-if="rows.length > 0"
      class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
    >
      在 Word 的填写位置写
      <code
        class="rounded bg-white px-1 py-0.5"
        v-text="'{{buyerName}}'"
      ></code>
      ；这里的变量名填
      <strong>buyerName</strong>，填写名称填“买方名称”。
    </div>

    <p v-if="parseError" class="text-red-600" role="alert">{{ parseError }}</p>
    <div
      v-else-if="rows.length === 0"
      class="flex flex-wrap items-center gap-2"
    >
      <Button :disabled="disabled" type="dashed" @click="addRow">
        添加要填写的内容
      </Button>
      <span class="text-sm text-slate-500">合同内容固定时可直接保存。</span>
    </div>

    <!-- 每个 Word 占位符对应一行，提交仍使用后端原有 key/title/required 数组。 -->
    <div
      v-for="(row, index) in rows"
      :key="index"
      data-template-variable-row
      class="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <label class="space-y-1 text-sm">
        <span>Word 中的变量名</span>
        <Input
          :aria-label="`第 ${index + 1} 项变量名`"
          :disabled="disabled"
          :maxlength="64"
          :value="row.key"
          placeholder="如 buyerName"
          @update:value="updateRow(index, { key: String($event) })"
        />
      </label>
      <label class="space-y-1 text-sm">
        <span>填写时显示的名称</span>
        <Input
          :aria-label="`第 ${index + 1} 项填写名称`"
          :disabled="disabled"
          :maxlength="128"
          :value="row.title"
          placeholder="如 买方名称"
          @update:value="updateRow(index, { title: String($event) })"
        />
      </label>
      <div class="flex items-end gap-2 pb-1">
        <Checkbox
          :checked="row.required === true"
          :disabled="disabled"
          @update:checked="updateRow(index, { required: $event === true })"
        >
          必填
        </Checkbox>
        <Button
          :disabled="disabled"
          size="small"
          type="link"
          @click="removeRow(index)"
        >
          删除
        </Button>
      </div>
    </div>

    <Button
      v-if="rows.length > 0"
      :disabled="disabled || !!parseError || rows.length >= 100"
      type="dashed"
      @click="addRow"
    >
      再添加一项
    </Button>
  </div>
</template>
