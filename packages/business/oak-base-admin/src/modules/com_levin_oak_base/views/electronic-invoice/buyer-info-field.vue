<script lang="ts" setup>
import { Input } from 'ant-design-vue';

type BuyerInfo = {
  bankAccount?: string;
  bankName?: string;
  name?: string;
  taxNo?: string;
  taxRegisteredAddress?: string;
  taxRegisteredPhone?: string;
};

const props = defineProps<{ modelValue?: BuyerInfo }>();
const emit = defineEmits<{ 'update:modelValue': [value: BuyerInfo] }>();

function update(key: keyof BuyerInfo, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <label class="flex flex-col gap-1">
      <span>购买方开票抬头 *</span>
      <Input
        :value="modelValue?.name"
        placeholder="企业全称或个人姓名"
        @update:value="update('name', $event)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span>纳税人识别号 *</span>
      <Input
        :value="modelValue?.taxNo"
        placeholder="税号或统一社会信用代码"
        @update:value="update('taxNo', $event)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span>注册地址</span>
      <Input
        :value="modelValue?.taxRegisteredAddress"
        placeholder="专票按需填写"
        @update:value="update('taxRegisteredAddress', $event)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span>联系电话</span>
      <Input
        :value="modelValue?.taxRegisteredPhone"
        placeholder="专票按需填写"
        @update:value="update('taxRegisteredPhone', $event)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span>开户行</span>
      <Input
        :value="modelValue?.bankName"
        placeholder="专票按需填写"
        @update:value="update('bankName', $event)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span>银行账号</span>
      <Input
        :value="modelValue?.bankAccount"
        placeholder="专票按需填写"
        @update:value="update('bankAccount', $event)"
      />
    </label>
  </div>
</template>
