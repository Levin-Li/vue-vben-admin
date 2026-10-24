<script setup lang="ts">
import type { UserOrgSelectorModelValue } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  DataModelOperationParameter,
  DataModelRecordScope,
  DataModelScopeOption,
} from '../../api/data-model-service';

import { computed } from 'vue';

import { UserOrgSelector } from '@levin/admin-framework';
import { Form, Select } from 'ant-design-vue';

import { scopeFieldDescription } from './scope-field-description';

const props = defineProps<{
  compact?: boolean;
  controlOnly?: boolean;
  disabled?: boolean;
  field: DataModelOperationParameter;
  modelValue?: null | string;
  optionKey?: keyof DataModelRecordScope;
  options: Partial<Record<keyof DataModelRecordScope, DataModelScopeOption[]>>;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
}>();
const candidates = computed(
  () =>
    props.options[
      props.optionKey || (props.field.name as keyof DataModelRecordScope)
    ] || [],
);
const orgs = computed(() => props.options.orgId || []);
// 默认系统说明只描述服务端实现边界；模型维护者自定义的中文说明仍原样显示。
const scopeHelp = computed(() => scopeFieldDescription(props.field));
const selection = computed(() => {
  const found = candidates.value.find((item) => item.id === props.modelValue);
  return found
    ? [
        {
          ...found,
          kind:
            props.field.referenceType === 'USER'
              ? ('user' as const)
              : ('org' as const),
        },
      ]
    : [];
});
function update(value: UserOrgSelectorModelValue) {
  emit('update:modelValue', typeof value === 'string' ? value : undefined);
}
// 组织与拥有者候选均来自本模型的受控接口，不回退到通用用户管理接口。
async function loadOrgs() {
  const result = orgs.value.map((item) => ({ ...item }));
  if (
    props.field.referenceType === 'USER' &&
    candidates.value.some((item) => !item.orgId)
  )
    result.push({ id: '__ungrouped_owners__', name: '其他可选用户' });
  return result;
}
async function loadUsers(context: { orgId: string }) {
  return candidates.value
    .filter((item) =>
      context.orgId === '__ungrouped_owners__'
        ? !item.orgId
        : item.orgId === context.orgId,
    )
    .map((item) => ({ ...item }));
}
</script>

<template>
  <component
    :is="controlOnly ? 'div' : Form.Item"
    :label="controlOnly || compact ? undefined : field.title"
    :required="controlOnly ? undefined : !field.nullable"
    :extra="controlOnly || compact ? undefined : scopeHelp"
  >
    <UserOrgSelector
      v-if="field.referenceType === 'ORG' || field.referenceType === 'USER'"
      :key="JSON.stringify(options)"
      :model-value="modelValue || undefined"
      :selected-records="selection"
      :selectable-types="field.referenceType === 'ORG' ? ['org'] : ['user']"
      :load-org-tree="loadOrgs"
      :load-users="loadUsers"
      value-mode="id"
      :allow-clear="field.nullable"
      :disabled="disabled || field.readOnly || field.serverManaged"
      :placeholder="`请选择${field.title}`"
      @update:model-value="update"
    />
    <Select
      v-else
      :value="modelValue || undefined"
      :options="
        candidates.map((item) => ({ value: item.id, label: item.name }))
      "
      :allow-clear="field.nullable"
      :disabled="disabled || field.readOnly || field.serverManaged"
      show-search
      option-filter-prop="label"
      :placeholder="`请选择${field.title}`"
      @update:value="
        (value) => emit('update:modelValue', value as string | undefined)
      "
    />
  </component>
</template>
