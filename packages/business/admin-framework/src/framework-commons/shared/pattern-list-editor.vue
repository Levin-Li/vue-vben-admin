<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  AutoComplete,
  Button,
  Empty,
  Input,
  Modal,
  Tooltip,
  message,
} from 'ant-design-vue';

import {
  evaluatePatternList,
  filterPatternOptions,
  normalizePatternList,
  stringifyPatternList,
  type PatternListOption,
  type PatternMatchMode,
} from './pattern-list-utils';

defineOptions({
  name: 'PatternListEditor',
});

const props = withDefaults(
  defineProps<{
    customTest?: boolean;
    disabled?: boolean;
    loading?: boolean;
    matchMode?: PatternMatchMode;
    modelValue?: null | string | string[];
    hint?: string;
    options?: PatternListOption[];
    placeholder?: string;
    showEmptyImage?: boolean;
    testable?: boolean;
    testPlaceholder?: string;
    testValue?: string;
    validateItem?: (value: string) => boolean | string | undefined;
  }>(),
  {
    customTest: false,
    disabled: false,
    hint: '支持*和?匹配。',
    loading: false,
    matchMode: 'any',
    modelValue: () => [],
    options: () => [],
    placeholder: '输入或选择匹配规则',
    showEmptyImage: false,
    testable: true,
    testPlaceholder: '输入待匹配文本',
    testValue: '',
  },
);

const emit = defineEmits<{
  change: [value: string[], matchMode: PatternMatchMode];
  dropdownVisibleChange: [open: boolean];
  search: [keyword: string];
  test: [];
  'update:matchMode': [value: PatternMatchMode];
  'update:modelValue': [value: string[]];
  'update:testValue': [value: string];
}>();

const draftValue = ref('');
const editingIndex = ref(-1);
const editingValue = ref('');
const innerTestValue = ref(props.testValue);
const optionSearch = ref('');
const testOpen = ref(false);
const testSubmitted = ref(false);

watch(
  () => props.testValue,
  (value) => {
    innerTestValue.value = value || '';
  },
);

const patterns = computed(() => normalizePatternList(props.modelValue));
const currentMatchMode = computed<PatternMatchMode>(
  () => props.matchMode || 'any',
);
const selectOptions = computed<SelectProps['options']>(() =>
  filterPatternOptions(props.options, optionSearch.value).map((option) => ({
    disabled: option.disabled,
    label: option.label || option.value,
    title: option.description || option.value,
    value: option.value,
  })),
);
const jsonOutput = computed(() => stringifyPatternList(patterns.value));
const testResult = computed(() =>
  evaluatePatternList(
    patterns.value,
    innerTestValue.value,
    currentMatchMode.value,
  ),
);
const testStatusText = computed(() => {
  if (!patterns.value.length) {
    return '当前还没有匹配规则。';
  }

  if (!innerTestValue.value.trim()) {
    return '请输入测试值。';
  }

  return testResult.value.matched ? '匹配成功' : '匹配失败';
});
const testStatusClass = computed(() =>
  testResult.value.matched
    ? 'text-success'
    : 'text-destructive dark:text-red-400',
);
const matchModeLabel = computed(() =>
  currentMatchMode.value === 'all' ? '全部命中' : '任一命中',
);

function updatePatterns(value: unknown) {
  const next = normalizePatternList(value);
  emit('update:modelValue', next);
  emit('change', next, currentMatchMode.value);
}

function handleSearch(value: string) {
  optionSearch.value = value;
  emit('search', value);
}

function handleDropdownVisibleChange(open: boolean) {
  emit('dropdownVisibleChange', open);
}

function appendDraftPattern() {
  const values = normalizePatternList(draftValue.value);
  if (!values.length) {
    return;
  }

  if (!validatePatterns(values)) {
    return;
  }

  updatePatterns([...patterns.value, ...values]);
  draftValue.value = '';
}

function removePattern(index: number) {
  updatePatterns(patterns.value.filter((_, itemIndex) => itemIndex !== index));
}

function startEdit(index: number, value: string) {
  editingIndex.value = index;
  editingValue.value = value;
}

function cancelEdit() {
  editingIndex.value = -1;
  editingValue.value = '';
}

function commitEdit() {
  if (editingIndex.value < 0) {
    return;
  }

  const values = normalizePatternList(editingValue.value);
  if (!validatePatterns(values)) {
    return;
  }

  const next = [...patterns.value];
  next.splice(editingIndex.value, 1, ...values);
  updatePatterns(next);
  cancelEdit();
}

function handleEditKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitEdit();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
  }
}

async function copyText(value: string, successText: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(value);
  message.success(successText);
}

function openTestModal() {
  if (props.customTest) {
    emit('test');
    return;
  }

  testOpen.value = true;
  testSubmitted.value = false;
}

function validatePatterns(values: string[]) {
  if (!props.validateItem) {
    return true;
  }

  for (const value of values) {
    const result = props.validateItem(value);
    if (result === true || result === undefined) {
      continue;
    }

    message.warning(
      typeof result === 'string' && result.trim()
        ? result
        : `匹配项格式不正确：${value}`,
    );
    return false;
  }

  return true;
}

function submitTest() {
  testSubmitted.value = true;
}

function updateTestValue(value: string) {
  innerTestValue.value = value;
  emit('update:testValue', value);
  testSubmitted.value = false;
}
</script>

<template>
  <div
    class="pattern-list-editor border-border bg-card group grid min-h-[120px] grid-cols-[minmax(0,1fr)_36px] gap-2 rounded-md border p-2"
  >
    <div class="min-w-0 space-y-1">
      <div
        class="pattern-list-editor__list max-h-[184px] min-h-[92px] overflow-y-auto rounded-sm"
      >
        <div
          class="pattern-list-editor__row pattern-list-editor__draft-row border-border flex min-h-10 items-center gap-2 border-b py-1.5 pr-1"
        >
          <AutoComplete
            v-model:value="draftValue"
            :disabled="disabled"
            :filter-option="false"
            :loading="loading"
            :options="selectOptions"
            :placeholder="placeholder"
            class="min-w-0 flex-1"
            data-test="pattern-list-draft"
            @dropdown-visible-change="handleDropdownVisibleChange"
            @search="handleSearch"
            @select="(value) => (draftValue = String(value ?? ''))"
            @keydown.enter.prevent="appendDraftPattern"
          />
          <Tooltip title="加入">
            <Button
              :disabled="disabled || !draftValue.trim()"
              class="shrink-0"
              data-test="pattern-list-add"
              size="small"
              type="default"
              @click="appendDraftPattern"
            >
              <IconifyIcon class="size-4" icon="lucide:plus" />
            </Button>
          </Tooltip>
        </div>

        <div v-if="patterns.length" class="divide-border divide-y">
          <div
            v-for="(pattern, index) in patterns"
            :key="`${pattern}-${index}`"
            class="pattern-list-editor__row hover:bg-muted/50 flex min-h-10 items-center gap-2 py-1.5 pr-1"
            data-test="pattern-list-row"
          >
            <Input
              v-if="editingIndex === index"
              v-model:value="editingValue"
              :disabled="disabled"
              class="min-w-0 flex-1"
              data-test="pattern-list-edit-input"
              size="small"
              @keydown="handleEditKeydown"
            />
            <Tooltip v-else :mouse-enter-delay="0.8" :title="pattern">
              <div
                class="min-w-0 flex-1 truncate font-mono text-sm"
                data-test="pattern-list-row-value"
              >
                {{ pattern }}
              </div>
            </Tooltip>

            <div
              class="pattern-list-editor__row-actions flex shrink-0 items-center gap-1"
            >
              <template v-if="editingIndex === index">
                <Tooltip title="保存">
                  <Button
                    :disabled="disabled"
                    data-test="pattern-list-save"
                    size="small"
                    type="text"
                    @click="commitEdit"
                  >
                    <IconifyIcon class="size-3.5" icon="lucide:check" />
                  </Button>
                </Tooltip>
                <Tooltip title="取消">
                  <Button
                    :disabled="disabled"
                    data-test="pattern-list-cancel"
                    size="small"
                    type="text"
                    @click="cancelEdit"
                  >
                    <IconifyIcon class="size-3.5" icon="lucide:x" />
                  </Button>
                </Tooltip>
              </template>
              <template v-else>
                <Tooltip title="复制">
                  <Button
                    data-test="pattern-list-copy-item"
                    size="small"
                    type="text"
                    @click="copyText(pattern, '已复制')"
                  >
                    <IconifyIcon class="size-3.5" icon="lucide:copy" />
                  </Button>
                </Tooltip>
                <Tooltip title="编辑">
                  <Button
                    :disabled="disabled"
                    data-test="pattern-list-edit"
                    size="small"
                    type="text"
                    @click="startEdit(index, pattern)"
                  >
                    <IconifyIcon class="size-3.5" icon="lucide:pencil" />
                  </Button>
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    :disabled="disabled"
                    danger
                    data-test="pattern-list-delete"
                    size="small"
                    type="text"
                    @click="removePattern(index)"
                  >
                    <IconifyIcon class="size-3.5" icon="lucide:trash-2" />
                  </Button>
                </Tooltip>
              </template>
            </div>
          </div>
        </div>
        <template v-else>
          <Empty
            v-if="showEmptyImage"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            class="my-2"
            data-test="pattern-list-empty-image"
            description="暂无内容"
          />
          <div
            v-else
            class="text-muted-foreground flex min-h-[52px] items-center justify-center text-sm"
            data-test="pattern-list-empty-text"
          >
            暂无内容
          </div>
        </template>
      </div>
      <div
        v-if="hint"
        class="text-muted-foreground text-sm"
        data-test="pattern-list-hint"
      >
        {{ hint }}
      </div>
    </div>

    <div
      class="pattern-list-editor__actions flex flex-col items-center gap-2 pt-[44px]"
    >
      <Tooltip v-if="testable" :title="`测试匹配（${matchModeLabel}）`">
        <Button
          :disabled="disabled"
          data-test="pattern-list-test"
          shape="circle"
          size="small"
          type="text"
          @click="openTestModal"
        >
          <IconifyIcon class="size-4" icon="lucide:flask-conical" />
        </Button>
      </Tooltip>
      <Tooltip title="复制 JSON 数组">
        <Button
          :disabled="patterns.length === 0"
          data-test="pattern-list-copy-json"
          shape="circle"
          size="small"
          type="text"
          @click="copyText(jsonOutput, 'JSON数组已复制')"
        >
          <IconifyIcon class="size-4" icon="lucide:copy" />
        </Button>
      </Tooltip>
    </div>

    <Modal
      v-model:open="testOpen"
      :mask-closable="false"
      title="测试匹配"
      @ok="submitTest"
      @cancel="testSubmitted = false"
    >
      <div class="space-y-2">
        <Input
          :placeholder="testPlaceholder"
          :value="innerTestValue"
          allow-clear
          data-test="pattern-list-test-input"
          @update:value="updateTestValue"
          @keydown.enter.prevent="submitTest"
        >
          <template #prefix>
            <IconifyIcon
              class="text-muted-foreground size-4"
              icon="lucide:flask-conical"
            />
          </template>
        </Input>
        <div
          v-if="testSubmitted"
          class="text-sm font-medium"
          data-test="pattern-list-test-result"
          :class="testStatusClass"
        >
          {{ testStatusText }}
        </div>
        <div class="text-muted-foreground text-xs">
          当前测试模式：{{ matchModeLabel }}
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.pattern-list-editor__actions,
.pattern-list-editor__row-actions {
  opacity: 0.36;
  transition: opacity 0.16s ease;
}

.pattern-list-editor:hover .pattern-list-editor__actions,
.pattern-list-editor__row:hover .pattern-list-editor__row-actions,
.pattern-list-editor__row:focus-within .pattern-list-editor__row-actions {
  opacity: 1;
}

.pattern-list-editor__list {
  scrollbar-width: thin;
}
</style>
