<script lang="ts" setup>
import { Button, Input, InputNumber } from 'ant-design-vue';

type InvoiceItem = {
  amountWithoutTax?: number;
  itemName?: string;
  quantity?: number;
  specification?: string;
  taxAmount?: number;
  taxRate?: number;
  unit?: string;
  unitPrice?: number;
};
const props = defineProps<{ modelValue?: InvoiceItem[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: InvoiceItem[]] }>();

function update(
  index: number,
  key: keyof InvoiceItem,
  value: null | number | string,
) {
  const items = [...(props.modelValue ?? [])];
  const item = { ...items[index], [key]: value ?? undefined };
  if (key === 'quantity' || key === 'unitPrice' || key === 'taxRate') {
    const amount = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
    item.amountWithoutTax = Number(amount.toFixed(4));
    item.taxAmount = Number((amount * Number(item.taxRate ?? 0)).toFixed(4));
  }
  items[index] = item;
  emit('update:modelValue', items);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="(item, index) in modelValue ?? []"
      :key="index"
      class="grid grid-cols-2 gap-2 rounded border p-3 md:grid-cols-4"
    >
      <Input
        :value="item.itemName"
        placeholder="项目名称 *"
        @update:value="update(index, 'itemName', $event)"
      />
      <Input
        :value="item.specification"
        placeholder="规格型号"
        @update:value="update(index, 'specification', $event)"
      />
      <Input
        :value="item.unit"
        placeholder="单位"
        @update:value="update(index, 'unit', $event)"
      />
      <InputNumber
        :value="item.quantity"
        :min="0"
        class="w-full"
        placeholder="数量 *"
        @update:value="update(index, 'quantity', $event)"
      />
      <InputNumber
        :value="item.unitPrice"
        :min="0"
        class="w-full"
        placeholder="不含税单价 *"
        @update:value="update(index, 'unitPrice', $event)"
      />
      <InputNumber
        :value="item.taxRate"
        :min="0"
        :max="1"
        :step="0.01"
        class="w-full"
        placeholder="税率，如 0.13"
        @update:value="update(index, 'taxRate', $event)"
      />
      <span>金额：{{ item.amountWithoutTax ?? 0 }}</span>
      <span>税额：{{ item.taxAmount ?? 0 }}</span>
      <Button
        danger
        size="small"
        @click="
          emit(
            'update:modelValue',
            (modelValue ?? []).filter((_, i) => i !== index),
          )
        "
      >
        删除此项
      </Button>
    </div>
    <Button @click="emit('update:modelValue', [...(modelValue ?? []), {}])">
      添加票面明细
    </Button>
  </div>
</template>
