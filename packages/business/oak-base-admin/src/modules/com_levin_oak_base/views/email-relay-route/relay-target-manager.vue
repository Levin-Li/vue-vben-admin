<script lang="ts" setup>
import type { RelayTarget } from './config';

import { computed, reactive, ref } from 'vue';

import { Plus } from '@vben/runtime/icons';

import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Tag,
} from 'ant-design-vue';

import { normalizeTargets } from './config';

const props = defineProps<{
  disabled?: boolean;
  items?: Array<RelayTarget | string>;
}>();

const emit = defineEmits<{ 'update:items': [RelayTarget[]] }>();

const targetTypeOptions = [
  { label: '邮箱', value: 'email' },
  { label: '完整邮件 Webhook', value: 'mail-webhook' },
  { label: '通知 Webhook', value: 'notify-webhook' },
];

const editorOpen = ref(false);
const editingIndex = ref(-1);
const draft = reactive<RelayTarget>({ endpoint: '', type: '' });
const editorModalStyle = { maxWidth: 'min(80vw, 560px)' };

const normalizedItems = computed<RelayTarget[]>(() =>
  Array.isArray(props.items)
    ? props.items.map((item) => {
        if (typeof item === 'string') {
          const separator = item.indexOf(':');
          return separator === -1
            ? { endpoint: item, type: '' }
            : {
                endpoint: item.slice(separator + 1),
                type: item.slice(0, separator),
              };
        }
        return {
          endpoint: String(item?.endpoint || ''),
          type: String(item?.type || ''),
        };
      })
    : [],
);

function typeLabel(type?: string) {
  return (
    targetTypeOptions.find((option) => option.value === type)?.label ||
    type ||
    '-'
  );
}

function handleCreate() {
  if (props.disabled) return;
  editingIndex.value = -1;
  draft.endpoint = '';
  draft.type = '';
  editorOpen.value = true;
}

function handleEdit(index: number) {
  if (props.disabled) return;
  const item = normalizedItems.value[index];
  if (!item) return;
  editingIndex.value = index;
  draft.endpoint = item.endpoint;
  draft.type = item.type;
  editorOpen.value = true;
}

function handleDelete(index: number) {
  if (props.disabled) return;
  emit(
    'update:items',
    normalizedItems.value.filter((_, itemIndex) => itemIndex !== index),
  );
}

function handleSave() {
  const target: RelayTarget = {
    endpoint: String(draft.endpoint || '').trim(),
    type: String(draft.type || '').trim(),
  };
  try {
    normalizeTargets([target]);
  } catch (error) {
    message.warning(
      error instanceof Error ? error.message : '投递目标格式无效',
    );
    return;
  }

  const items = [...normalizedItems.value];
  if (editingIndex.value >= 0) {
    items[editingIndex.value] = target;
  } else {
    items.push(target);
  }
  emit('update:items', items);
  editorOpen.value = false;
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-muted-foreground text-xs">
        共 {{ normalizedItems.length }} 条
      </span>
      <Button :disabled="disabled" type="primary" @click="handleCreate">
        <Plus class="size-4" />
        新增目标
      </Button>
    </div>

    <div
      v-if="normalizedItems.length === 0"
      class="border-border text-muted-foreground rounded border border-dashed px-4 py-6 text-center text-sm"
    >
      暂无投递目标，请点击“新增目标”添加。
    </div>

    <div v-else class="border-border overflow-hidden rounded border text-sm">
      <div
        class="bg-muted grid grid-cols-[minmax(9rem,1fr)_minmax(0,3fr)_8rem] px-3 py-2 font-medium"
      >
        <span>投递类型</span>
        <span>地址</span>
        <span>操作</span>
      </div>
      <div class="max-h-[220px] overflow-y-auto" data-relay-target-rows>
        <div
          v-for="(item, index) in normalizedItems"
          :key="index"
          class="border-border grid min-h-11 grid-cols-[minmax(9rem,1fr)_minmax(0,3fr)_8rem] items-center border-t px-3"
          data-relay-target-row
        >
          <div class="min-w-0 truncate">
            <Tag>{{ typeLabel(item.type) }}</Tag>
          </div>
          <span class="min-w-0 truncate pr-3" :title="item.endpoint || '-'">
            {{ item.endpoint || '-' }}
          </span>
          <div class="whitespace-nowrap">
            <Button
              :disabled="disabled"
              size="small"
              type="link"
              @click="handleEdit(index)"
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除当前投递目标吗？"
              @confirm="handleDelete(index)"
            >
              <Button :disabled="disabled" danger size="small" type="link">
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal
    v-model:open="editorOpen"
    :mask-closable="false"
    :style="editorModalStyle"
    :title="editingIndex >= 0 ? '编辑投递目标' : '新增投递目标'"
    width="fit-content"
    @ok="handleSave"
  >
    <Form
      id="relay-target-edit"
      name="relayTargetEdit"
      data-form-id="relay-target-edit"
      data-form-name="新增或编辑投递目标"
      class="w-[480px] max-w-full"
      layout="vertical"
    >
      <Form.Item label="投递类型" required>
        <Select
          v-model:value="draft.type"
          :options="targetTypeOptions"
          placeholder="请选择投递类型"
        />
      </Form.Item>
      <Form.Item label="地址" required>
        <Input
          v-model:value="draft.endpoint"
          :placeholder="
            draft.type === 'email' ? '请输入接收邮箱' : '请输入 HTTPS 地址'
          "
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
