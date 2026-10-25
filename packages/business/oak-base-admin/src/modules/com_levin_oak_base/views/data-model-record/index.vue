<script setup lang="ts">
import type {
  DataModelDefinition,
  DataModelOperationParameter,
  DataModelRecordScope,
} from '../../api/data-model-service';

import { computed, onMounted, ref } from 'vue';

import DynamicCrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { Alert, Button, message } from 'ant-design-vue';

import { useModelMetadataContext } from '../domain-data-dynamic-model/model-metadata';
import ScopeFields from './scope-fields.vue';
import { createDynamicCrudAdapter } from './standard-crud-adapter';

const props = defineProps<{ model: DataModelDefinition }>();
const metadataContext = useModelMetadataContext();
const adapter = createDynamicCrudAdapter(
  props.model,
  () => metadataContext.value,
);
const page = ref<{
  openCreate: () => Promise<void>;
  reload: () => Promise<void>;
}>();
const formReferences = computed(() => {
  const candidates = [
    ...(props.model.operations || []).flatMap(
      (operation) => operation.requestParams,
    ),
    ...(adapter.form.context?.fields || []),
  ];
  return [
    ...new Map(
      candidates
        .filter((field) => field.source === 'SCOPE' && field.referenceType)
        .map((field) => [field.name, field]),
    ).values(),
  ];
});
const queryReferences = computed(() =>
  (props.model.queryInputs || []).filter((field) => field.referenceType),
);
function formReference(name: string): DataModelOperationParameter {
  return (
    adapter.form.context?.fields.find((field) => field.name === name) ||
    formReferences.value.find((field) => field.name === name)!
  );
}
function queryValue(slot: unknown, key: string): string | undefined {
  const value = queryState(slot)[key];
  return typeof value === 'string' ? value : undefined;
}
function queryState(slot: unknown): Record<string, unknown> {
  return (slot as { searchState: Record<string, unknown> }).searchState;
}
function queryReference(key: string): DataModelOperationParameter {
  const field = queryReferences.value.find((input) => input.key === key)!;
  return {
    ...field,
    name: key,
    source: 'SCOPE',
    nullable: true,
    referenceType:
      field.referenceType as DataModelOperationParameter['referenceType'],
  };
}
onMounted(() => {
  void adapter
    .loadQueryContext()
    .catch(() => message.error('查询候选加载失败，请刷新页面重试'));
});
async function changeScope(
  name: string,
  value: string | undefined,
  state: Record<string, unknown>,
) {
  try {
    await adapter.changeScope(name, value, state);
  } catch {
    message.error('归属候选加载失败，请重试');
  }
}
async function openCreate(code: 'CREATE' | `CUSTOM_${string}`) {
  adapter.chooseCreate(code);
  await page.value?.openCreate();
}
</script>

<template>
  <DynamicCrudPage
    v-if="
      model.operations?.some((operation) => adapter.allowed(operation.code))
    "
    ref="page"
    :config="adapter.config"
    embedded
  >
    <template #toolbar-extra>
      <Button
        v-if="adapter.allowed('CREATE')"
        type="primary"
        @click="openCreate('CREATE')"
      >
        新增
      </Button>
      <Button
        v-for="operation in adapter.customCreates"
        :key="operation.code"
        @click="openCreate(operation.code as `CUSTOM_${string}`)"
      >
        {{ operation.title }}
      </Button>
    </template>
    <template
      v-for="parameter in formReferences"
      :key="parameter.name"
      #[`form-field-${parameter.name}`]="{ formState, disabled }"
    >
      <ScopeFields
        control-only
        :field="formReference(parameter.name)"
        :model-value="formState[parameter.name]"
        :options="adapter.form.context?.options || {}"
        :disabled="disabled"
        @update:model-value="changeScope(parameter.name, $event, formState)"
      />
    </template>
    <template
      v-for="input in queryReferences"
      :key="input.key"
      #[`search-field-${input.key}`]="slot"
    >
      <ScopeFields
        control-only
        :field="queryReference(input.key)"
        :option-key="input.field as keyof DataModelRecordScope"
        :model-value="queryValue(slot, input.key)"
        :options="adapter.queryContext.value?.options || {}"
        :disabled="slot.disabled"
        @update:model-value="queryState(slot)[input.key] = $event"
      />
    </template>
  </DynamicCrudPage>
  <Alert v-else type="info" message="当前模型未开放操作或当前用户未获授权" />
</template>
