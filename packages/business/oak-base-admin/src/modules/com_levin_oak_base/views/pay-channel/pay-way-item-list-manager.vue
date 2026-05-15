<script lang="ts" setup>
import type { SelectOption } from '@levin/admin-framework/framework-commons/app/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Plus } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
} from 'ant-design-vue';

import { buildDictOptionsLoader, buildEnumOptionsLoader } from '../api-module';

export interface PayWayItemValue {
  currencyCode?: string;
  desc?: string;
  disabled?: boolean;
  logo?: string;
  payAppName: string;
  payWay: string;
  rate?: number;
  title?: string;
}

const props = defineProps<{
  items?: PayWayItemValue[];
}>();

const emit = defineEmits<{
  'update:items': [PayWayItemValue[]];
}>();

const payWayOptions = ref<SelectOption[]>([]);
const currencyCodeOptions = ref<SelectOption[]>([]);
const editorOpen = ref(false);
const editingIndex = ref(-1);
const draft = reactive<PayWayItemValue>({
  currencyCode: '',
  desc: '',
  disabled: false,
  logo: '',
  payAppName: '',
  payWay: '',
  rate: undefined,
  title: '',
});
const editorModalStyle = { maxWidth: 'min(70vw, 720px)' };

const normalizedItems = computed(() =>
  Array.isArray(props.items)
    ? props.items
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          currencyCode: String(item.currencyCode || ''),
          desc: String(item.desc || ''),
          disabled: !!item.disabled,
          logo: String(item.logo || ''),
          payAppName: String(item.payAppName || ''),
          payWay: String(item.payWay || ''),
          rate:
            item.rate === null || item.rate === undefined
              ? undefined
              : Number(item.rate),
          title: String(item.title || ''),
        }))
    : [],
);

function resetDraft() {
  draft.currencyCode = '';
  draft.desc = '';
  draft.disabled = false;
  draft.logo = '';
  draft.payAppName = '';
  draft.payWay = '';
  draft.rate = undefined;
  draft.title = '';
}

function updateItems(items: PayWayItemValue[]) {
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
  draft.currencyCode = item?.currencyCode || '';
  draft.desc = item?.desc || '';
  draft.disabled = !!item?.disabled;
  draft.logo = item?.logo || '';
  draft.payAppName = item?.payAppName || '';
  draft.payWay = item?.payWay || '';
  draft.rate = item?.rate;
  draft.title = item?.title || '';
  editorOpen.value = true;
}

function handleDelete(index: number) {
  updateItems(
    normalizedItems.value.filter((_, itemIndex) => itemIndex !== index),
  );
}

function getPayWayLabel(value: string) {
  return (
    payWayOptions.value.find((item) => item.value === value)?.label || value
  );
}

function handleSave() {
  const payAppName = draft.payAppName.trim();
  const payWay = draft.payWay.trim();
  const currencyCode = draft.currencyCode?.trim() || '';

  if (!payAppName || !payWay) {
    message.warning('请填写支付应用名称和支付唤起方式');
    return;
  }

  const duplicateIndex = normalizedItems.value.findIndex(
    (item, index) =>
      item.payAppName === payAppName &&
      item.payWay === payWay &&
      (item.currencyCode || '') === currencyCode &&
      index !== editingIndex.value,
  );

  if (duplicateIndex !== -1) {
    message.warning('支付应用、支付唤起方式和货币编码组合重复');
    return;
  }

  const nextItem: PayWayItemValue = {
    currencyCode: currencyCode || undefined,
    desc: draft.desc?.trim() || undefined,
    disabled: !!draft.disabled,
    logo: draft.logo?.trim() || undefined,
    payAppName,
    payWay,
    rate: draft.rate,
    title: draft.title?.trim() || undefined,
  };

  const items = [...normalizedItems.value];

  if (editingIndex.value === -1) {
    items.push(nextItem);
  } else {
    items[editingIndex.value] = nextItem;
  }

  updateItems(items);
  editorOpen.value = false;
}

onMounted(async () => {
  const [nextPayWayOptions, nextCurrencyCodeOptions] = await Promise.all([
    buildEnumOptionsLoader('com.levin.oak.base.entities.enums.PayWay')(),
    buildDictOptionsLoader('CurrencyCode')(),
  ]);
  payWayOptions.value = nextPayWayOptions;
  currencyCodeOptions.value = nextCurrencyCodeOptions;
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button type="primary" @click="handleCreate">
        <Plus class="size-4" />
        新增支付方式
      </Button>
    </div>

    <div
      v-if="normalizedItems.length === 0"
      class="border-border text-muted-foreground rounded border border-dashed px-4 py-6 text-center text-sm"
    >
      暂无支付方式，请点击“新增支付方式”添加。
    </div>

    <div v-else class="border-border overflow-hidden rounded border">
      <table class="w-full table-fixed text-sm">
        <thead class="bg-muted text-left">
          <tr>
            <th class="px-3 py-2">标题</th>
            <th class="px-3 py-2">支付应用</th>
            <th class="px-3 py-2">支付唤起方式</th>
            <th class="w-28 px-3 py-2">货币编码</th>
            <th class="w-24 px-3 py-2">费率</th>
            <th class="w-24 px-3 py-2">状态</th>
            <th class="px-3 py-2">描述</th>
            <th class="w-36 px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in normalizedItems"
            :key="`${item.payAppName}-${item.payWay}-${item.currencyCode}-${index}`"
            class="border-border border-t"
          >
            <td class="px-3 py-2">{{ item.title || '-' }}</td>
            <td class="px-3 py-2">{{ item.payAppName || '-' }}</td>
            <td class="px-3 py-2">{{ getPayWayLabel(item.payWay) || '-' }}</td>
            <td class="px-3 py-2">{{ item.currencyCode || '-' }}</td>
            <td class="px-3 py-2">
              {{ item.rate === undefined ? '-' : item.rate }}
            </td>
            <td class="px-3 py-2">
              <Tag :color="item.disabled ? 'default' : 'green'">
                {{ item.disabled ? '禁用' : '启用' }}
              </Tag>
            </td>
            <td class="px-3 py-2">{{ item.desc || '-' }}</td>
            <td class="px-3 py-2">
              <Space :size="4">
                <Button size="small" type="link" @click="handleEdit(index)">
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除当前支付方式吗？"
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
    :title="editingIndex >= 0 ? '编辑支付方式' : '新增支付方式'"
    width="fit-content"
    @ok="handleSave"
  >
    <Form class="w-[560px] max-w-full" layout="vertical">
      <div class="grid grid-cols-2 gap-x-4">
        <Form.Item label="标题">
          <Input v-model:value="draft.title" placeholder="请输入标题" />
        </Form.Item>
        <Form.Item label="支付应用名称" required>
          <Input
            v-model:value="draft.payAppName"
            placeholder="请输入支付应用名称"
          />
        </Form.Item>
        <Form.Item label="支付唤起方式" required>
          <Select
            v-model:value="draft.payWay"
            :options="payWayOptions"
            placeholder="请选择支付唤起方式"
            show-search
          />
        </Form.Item>
        <Form.Item label="货币编码">
          <Select
            v-model:value="draft.currencyCode"
            allow-clear
            :options="currencyCodeOptions"
            placeholder="请选择货币编码"
            show-search
          />
        </Form.Item>
        <Form.Item label="通道费率">
          <InputNumber
            v-model:value="draft.rate"
            class="w-full"
            placeholder="请输入通道费率"
          />
        </Form.Item>
        <Form.Item label="是否禁用">
          <Switch v-model:checked="draft.disabled" />
        </Form.Item>
        <Form.Item class="col-span-full" label="logo">
          <Input v-model:value="draft.logo" placeholder="请输入logo" />
        </Form.Item>
        <Form.Item class="col-span-full" label="描述">
          <Input.TextArea
            v-model:value="draft.desc"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="请输入描述"
          />
        </Form.Item>
      </div>
    </Form>
  </Modal>
</template>
