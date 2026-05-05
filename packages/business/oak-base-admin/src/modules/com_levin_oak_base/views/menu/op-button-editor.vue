<script lang="ts" setup>
import type { MenuOpButton } from './types';

import { computed } from 'vue';

import {
  Button,
  Checkbox,
  Empty,
  Input,
  Popconfirm,
  Table,
} from 'ant-design-vue';

const props = defineProps<{
  value?: MenuOpButton[];
}>();

const emit = defineEmits<{
  'update:value': [value: MenuOpButton[]];
}>();

const rows = computed({
  get: () => props.value || [],
  set: (value) => emit('update:value', value),
});

const columns = [
  { dataIndex: 'label', title: '标签', width: 180 },
  { dataIndex: 'apiUrl', title: 'API地址', width: 240 },
  { dataIndex: 'requireAuthorization', title: '需要权限', width: 260 },
  { dataIndex: 'disabled', title: '是否禁用', width: 110 },
  { dataIndex: 'remark', title: '备注', width: 220 },
  { dataIndex: 'operation', title: '操作', width: 90 },
];

function updateRow(index: number, patch: Partial<MenuOpButton>) {
  rows.value = rows.value.map((item, currentIndex) =>
    currentIndex === index ? { ...item, ...patch } : item,
  );
}

function addRow() {
  rows.value = [
    ...rows.value,
    {
      apiUrl: '',
      disabled: false,
      label: '',
      remark: '',
      requireAuthorization: '',
    },
  ];
}

function removeRow(index: number) {
  rows.value = rows.value.filter(
    (_item, currentIndex) => currentIndex !== index,
  );
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button type="primary" @click="addRow">新增操作按钮</Button>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :locale="{ emptyText: undefined }"
      :pagination="false"
      bordered
      row-key="label"
      size="small"
    >
      <template #emptyText>
        <Empty description="暂无操作按钮" />
      </template>
      <template #bodyCell="{ column, index, record }">
        <Input
          v-if="column.dataIndex === 'label'"
          :value="record.label"
          placeholder="请输入按钮标签"
          @update:value="(value) => updateRow(index, { label: value })"
        />
        <Input
          v-else-if="column.dataIndex === 'apiUrl'"
          :value="record.apiUrl"
          placeholder="请输入API地址"
          @update:value="(value) => updateRow(index, { apiUrl: value })"
        />
        <Input
          v-else-if="column.dataIndex === 'requireAuthorization'"
          :value="record.requireAuthorization"
          placeholder="请输入权限表达式"
          @update:value="
            (value) => updateRow(index, { requireAuthorization: value })
          "
        />
        <Checkbox
          v-else-if="column.dataIndex === 'disabled'"
          :checked="record.disabled"
          @update:checked="(value) => updateRow(index, { disabled: value })"
        >
          禁用
        </Checkbox>
        <Input
          v-else-if="column.dataIndex === 'remark'"
          :value="record.remark"
          placeholder="请输入备注"
          @update:value="(value) => updateRow(index, { remark: value })"
        />
        <Popconfirm
          v-else-if="column.dataIndex === 'operation'"
          title="确定删除这个操作按钮吗？"
          @confirm="removeRow(index)"
        >
          <Button danger type="link">删除</Button>
        </Popconfirm>
      </template>
    </Table>
  </div>
</template>
