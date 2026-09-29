<script lang="ts" setup>
import type {
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowDesignerDefinition,
  WorkflowDesignerOptions,
} from './types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Popconfirm as APopconfirm,
  Space as ASpace,
} from 'ant-design-vue';

import { definitionFingerprint } from './definition-model';
import { WorkflowDesignerService } from './workflow-designer-service';
import WorkflowDesigner from './workflow-designer.vue';
import { workflowLifecycleLabels } from './workflow-labels';

const props = withDefaults(
  defineProps<{
    definition: WorkflowDesignerDefinition;
    options?: WorkflowDesignerOptions;
    permissions?: { publish?: boolean; save?: boolean; simulate?: boolean };
    service?: WorkflowDesignerService;
    version: WorkflowDefinitionVersion;
  }>(),
  { options: () => ({}), permissions: () => ({}), service: undefined },
);
const emit = defineEmits<{
  refreshed: [value: WorkflowDefinitionVersion];
  'update:definition': [value: WorkflowDesignerDefinition];
}>();
const service = computed(() => props.service ?? new WorkflowDesignerService());
const valid = ref(false);
const validationMessages = ref<string[]>([]);
const saving = ref(false);
const actionMessage = ref<string>();
const actionError = ref<string>();
const businessTypes = ref<WorkflowBusinessType[]>([]);
const catalogLoading = ref(false);
const catalogError = ref<string>();
let catalogRequest = 0;
const resolvedOptions = computed(() => ({
  ...props.options,
  businessTypes: props.options.businessTypes ?? businessTypes.value,
}));
const dirty = computed(() => {
  return (
    definitionFingerprint(props.definition) !==
    definitionFingerprint(props.version.lowflowDefinition)
  );
});
const canEdit = computed(
  () =>
    ['Draft', 'Testing'].includes(props.version.lifecycle) &&
    props.permissions?.save !== false,
);
const canSimulate = computed(
  () =>
    ['Draft', 'Testing'].includes(props.version.lifecycle) &&
    props.permissions?.simulate !== false &&
    valid.value &&
    dirty.value === false,
);
const canPublish = computed(
  () =>
    props.version.lifecycle === 'Testing' &&
    props.permissions?.publish !== false &&
    props.version.simulationReport?.successful &&
    !dirty.value &&
    valid.value,
);

// 显式目录加载失败保留草稿，阻止未经目录验证的模拟和发布。
async function loadCatalog() {
  const request = ++catalogRequest;
  if (props.options.businessTypes) {
    catalogLoading.value = false;
    catalogError.value = undefined;
    return;
  }
  catalogLoading.value = true;
  catalogError.value = undefined;
  try {
    const values = await service.value.listBusinessTypes();
    if (request === catalogRequest) businessTypes.value = values;
  } catch (error) {
    if (request === catalogRequest)
      catalogError.value =
        error instanceof Error ? error.message : '业务能力目录加载失败';
  } finally {
    if (request === catalogRequest) catalogLoading.value = false;
  }
}
watch(
  () => [props.options.businessTypes, service.value],
  () => {
    void loadCatalog();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  catalogRequest++;
});

async function run(
  action: () => Promise<WorkflowDefinitionVersion>,
  message: string,
) {
  if (saving.value) return;
  saving.value = true;
  actionMessage.value = undefined;
  actionError.value = undefined;
  try {
    const value = await action();
    emit('refreshed', value);
    if (value.lowflowDefinition)
      emit('update:definition', value.lowflowDefinition);
    actionMessage.value = message;
  } catch (error) {
    // 失败只呈现错误，不关闭工作台、不清空用户正在编辑的配置。
    actionError.value =
      error instanceof Error ? error.message : '操作失败，请检查配置后重试。';
  } finally {
    saving.value = false;
  }
}
function save() {
  if (canEdit.value && dirty.value)
    return run(
      () =>
        service.value.saveDraft(
          props.version.id,
          props.definition,
          props.version.optimisticLock,
        ),
      '草稿已保存；任何修改都会使原模拟结果失效。',
    );
}
function simulate() {
  if (canSimulate.value)
    return run(
      () => service.value.startSimulation(props.version.id),
      '模拟已执行，请查看服务端覆盖报告。',
    );
}
function publish() {
  if (canPublish.value)
    return run(
      () => service.value.publishAfterSimulation(props.version.id),
      '版本已发布。',
    );
}
</script>

<template>
  <section class="levin-workflow-definition-workbench">
    <AAlert
      v-if="actionMessage"
      class="mb-4"
      :message="actionMessage"
      show-icon
      type="success"
    />
    <AAlert
      v-if="actionError"
      class="mb-4"
      :message="actionError"
      show-icon
      type="error"
    />
    <AAlert
      v-if="catalogError"
      class="mb-4"
      :message="catalogError"
      show-icon
      type="error"
    >
      <template #description>
        <AButton :loading="catalogLoading" @click="loadCatalog">
          重新加载业务能力目录
        </AButton>
      </template>
    </AAlert>
    <AAlert
      v-if="!canEdit"
      class="mb-4"
      :message="`当前版本：${workflowLifecycleLabels[version.lifecycle]}`"
      show-icon
      type="info"
    >
      <template #description>
        当前生命周期或操作权限不允许编辑；状态迁移以服务端生命周期规则为准。
      </template>
    </AAlert>
    <WorkflowDesigner
      :model-value="definition"
      :options="resolvedOptions"
      :readonly="!canEdit || saving"
      @update:model-value="emit('update:definition', $event)"
      @validate="
        (isValid, messages) => {
          valid = isValid;
          validationMessages = messages;
        }
      "
    />
    <ACard class="mt-4" size="small" title="验证、模拟与发布">
      <AAlert
        v-if="validationMessages.length > 0"
        class="mb-3"
        :message="validationMessages.join('；')"
        type="warning"
      />
      <ASpace wrap>
        <AButton
          v-if="permissions?.save !== false"
          :disabled="!canEdit || !dirty"
          :loading="saving"
          @click="save"
        >
          保存草稿
        </AButton>
        <AButton
          v-if="permissions?.simulate !== false"
          :disabled="!canSimulate || !!catalogError || catalogLoading"
          :loading="saving"
          type="primary"
          @click="simulate"
        >
          开始自动模拟
        </AButton>
        <APopconfirm
          v-if="permissions?.publish !== false"
          title="确认发布通过模拟测试的版本？"
          :disabled="!canPublish || saving"
          @confirm="publish"
        >
          <AButton
            :disabled="!canPublish || !!catalogError || catalogLoading"
            :loading="saving"
            type="primary"
          >
            发布
          </AButton>
        </APopconfirm>
      </ASpace>
      <ADescriptions
        v-if="version.simulationReport"
        class="mt-4"
        :column="1"
        size="small"
      >
        <ADescriptionsItem label="模拟结果">
          {{ version.simulationReport.successful ? '通过' : '未通过' }}
        </ADescriptionsItem>
        <ADescriptionsItem label="覆盖分支">
          {{ version.simulationReport.coveredBranches?.join('、') || '无' }}
        </ADescriptionsItem>
        <ADescriptionsItem label="未覆盖分支">
          {{ version.simulationReport.uncoveredBranches?.join('、') || '无' }}
        </ADescriptionsItem>
        <ADescriptionsItem v-if="version.simulationReport.message" label="报告">
          {{ version.simulationReport.message }}
        </ADescriptionsItem>
      </ADescriptions>
    </ACard>
  </section>
</template>
