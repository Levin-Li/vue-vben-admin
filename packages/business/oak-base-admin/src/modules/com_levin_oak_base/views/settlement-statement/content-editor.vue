<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { Alert, Input } from 'ant-design-vue';

import { settlementStatementService } from '../../api/settlement-statement-service';
import { settlementFinancialPermission } from './config';

const props = defineProps<{
  disabled?: boolean;
  id?: string;
  modelValue?: unknown;
  orgId?: string;
  tenantId?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>();
const { hasPermission } = useRbacAccess();
const text = ref('');
const loading = ref(false);
const error = ref('');
let version = 0;
watch(
  () => props.modelValue,
  (value) => {
    if (typeof value === 'string') text.value = value;
    else text.value = value ? JSON.stringify(value, null, 2) : '';
  },
  { immediate: true },
);
// 普通详情不含结算内容，编辑按独立财务权限加载，缺少字段组时不补造空对象。
watch(
  () => [props.id, props.tenantId, props.orgId],
  async () => {
    const current = ++version;
    error.value = '';
    if (!props.id) return;
    if (!hasPermission(settlementFinancialPermission)) {
      error.value = '修改结算内容需要结算资料读取权限及结算业务内容字段组授权';
      return;
    }
    loading.value = true;
    try {
      const data = await settlementStatementService.readFinancialDetails({
        id: props.id,
      });
      if (current !== version) return;
      if (
        data.settlementContent === null ||
        data.settlementContent === undefined
      ) {
        error.value = '当前账号未获结算业务内容字段组授权，无法加载原内容';
        return;
      }
      emit('update:modelValue', data.settlementContent);
    } catch {
      if (current === version) error.value = '结算内容加载失败，请重新打开表单';
    } finally {
      if (current === version) loading.value = false;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  version++;
});
</script>

<template>
  <Alert v-if="error" :message="error" type="warning" class="mb-2" />
  <Input.TextArea
    :value="text"
    :disabled="disabled || loading || Boolean(error)"
    :rows="8"
    placeholder="输入非空 JSON 对象，例如订单清单、对账说明"
    @update:value="
      (value) => {
        if (!disabled && !loading && !error) emit('update:modelValue', value);
      }
    "
  />
</template>
