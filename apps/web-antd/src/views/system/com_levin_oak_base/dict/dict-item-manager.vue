<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import { Plus } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Tag,
} from 'ant-design-vue';

export interface DictItemValue {
  code: string;
  disabled: boolean;
  name: string;
  remark: string;
}

const props = defineProps<{
  items?: DictItemValue[];
}>();

const emit = defineEmits<{
  'update:items': [DictItemValue[]];
}>();

const editorOpen = ref(false);
const editingIndex = ref(-1);
const draft = reactive<DictItemValue>({
  code: '',
  disabled: false,
  name: '',
  remark: '',
});
const editorModalStyle = { maxWidth: 'min(70vw, 640px)' };

const normalizedItems = computed(() =>
  Array.isArray(props.items)
    ? props.items.map((item) => ({
        code: String(item?.code || ''),
        disabled: !!item?.disabled,
        name: String(item?.name || ''),
        remark: String(item?.remark || ''),
      }))
    : [],
);

function resetDraft() {
  draft.code = '';
  draft.disabled = false;
  draft.name = '';
  draft.remark = '';
}

function updateItems(items: DictItemValue[]) {
  emit('update:items', items);
}

function handleCreate() {
  editingIndex.value = -1;
  resetDraft();
  editorOpen.value = true;
}

function handleEdit(index: number) {
  const item = normalizedItems.value[index];
  editingIndex.value = index;
  draft.code = item?.code || '';
  draft.disabled = !!item?.disabled;
  draft.name = item?.name || '';
  draft.remark = item?.remark || '';
  editorOpen.value = true;
}

function handleDelete(index: number) {
  updateItems(
    normalizedItems.value.filter((_, itemIndex) => itemIndex !== index),
  );
}

function handleSave() {
  const code = draft.code.trim();
  const name = draft.name.trim();

  if (!code || !name) {
    message.warning('请填写完整的字典项名称和值');
    return;
  }

  const duplicateIndex = normalizedItems.value.findIndex(
    (item, index) => item.code === code && index !== editingIndex.value,
  );

  if (duplicateIndex >= 0) {
    message.warning(`字典项值[${code}]重复，请调整后再保存`);
    return;
  }

  const nextItem: DictItemValue = {
    code,
    disabled: draft.disabled,
    name,
    remark: draft.remark.trim(),
  };

  const items = [...normalizedItems.value];

  if (editingIndex.value >= 0) {
    items[editingIndex.value] = nextItem;
  } else {
    items.push(nextItem);
  }

  updateItems(items);
  editorOpen.value = false;
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button type="primary" @click="handleCreate">
        <Plus class="size-4" />
        新增字典项
      </Button>
    </div>

    <div
      v-if="normalizedItems.length === 0"
      class="rounded border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
    >
      暂无字典项，请点击“新增字典项”添加。
    </div>

    <div v-else class="overflow-hidden rounded border border-border">
      <table class="w-full table-fixed text-sm">
        <thead class="bg-muted text-left">
          <tr>
            <th class="px-3 py-2">标签</th>
            <th class="px-3 py-2">字典项值</th>
            <th class="w-24 px-3 py-2">是否禁用</th>
            <th class="px-3 py-2">备注</th>
            <th class="w-36 px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in normalizedItems"
            :key="`${item.code}-${index}`"
            class="border-t border-border"
          >
            <td class="px-3 py-2">{{ item.name || '-' }}</td>
            <td class="px-3 py-2">{{ item.code || '-' }}</td>
            <td class="px-3 py-2">
              <Tag :color="item.disabled ? 'default' : 'green'">
                {{ item.disabled ? '禁用' : '启用' }}
              </Tag>
            </td>
            <td class="px-3 py-2">{{ item.remark || '-' }}</td>
            <td class="px-3 py-2">
              <Space :size="4">
                <Button size="small" type="link" @click="handleEdit(index)">
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除当前字典项吗？"
                  @confirm="handleDelete(index)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
              </Space>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal
    v-model:open="editorOpen"
    :style="editorModalStyle"
    :title="editingIndex >= 0 ? '编辑字典项' : '新增字典项'"
    width="fit-content"
    @ok="handleSave"
  >
    <Form class="w-[480px] max-w-full" layout="vertical">
      <Form.Item label="标签" required>
        <Input v-model:value="draft.name" placeholder="请输入标签" />
      </Form.Item>
      <Form.Item label="字典项值" required>
        <Input v-model:value="draft.code" placeholder="请输入字典项值" />
      </Form.Item>
      <Form.Item label="是否禁用">
        <Switch v-model:checked="draft.disabled" />
      </Form.Item>
      <Form.Item label="备注">
        <Input.TextArea
          v-model:value="draft.remark"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="请输入备注"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
