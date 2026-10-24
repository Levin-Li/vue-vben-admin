<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import { Alert } from 'ant-design-vue';

import { settlementOrderService } from '../../api/settlement-order-service';
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
const loadedId = ref('');
const loadedContent = ref<unknown>();
const loading = ref(false);
const error = ref('');
let version = 0;
const editorDisabled = computed(
  () =>
    props.disabled ||
    loading.value ||
    Boolean(error.value) ||
    Boolean(props.id && loadedId.value !== props.id),
);
const editorValue = computed(() => {
  if (!props.id) return props.modelValue;
  return loadedId.value === props.id ? loadedContent.value : undefined;
});

function updateContent(value: unknown) {
  if (editorDisabled.value) return;
  if (props.id) loadedContent.value = value;
  emit('update:modelValue', value);
}

// 普通详情不含结算内容，编辑按独立财务权限加载，缺少字段组时不补造空对象。
watch(
  () => [props.id, props.tenantId, props.orgId],
  async () => {
    const current = ++version;
    loadedId.value = '';
    loadedContent.value = undefined;
    error.value = '';
    if (!props.id) return;
    if (!hasPermission(settlementFinancialPermission)) {
      error.value = '修改结算内容需要结算资料读取权限及结算业务内容字段组授权';
      return;
    }
    loading.value = true;
    try {
      const data = await settlementOrderService.readFinancialDetails({
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
      loadedContent.value = data.settlementContent;
      loadedId.value = props.id;
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
  <!-- 实体未指定固定 Schema，按完整 JSON 对象编辑；未授权时禁止覆盖。 -->
  <JsonEditorField
    :disabled="editorDisabled"
    :model-value="editorValue"
    title="结算内容"
    @update:model-value="updateContent"
  />
</template>
