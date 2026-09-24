<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import WorkflowDesigner from './workflow-designer.vue';
import { WorkflowDesignerService } from './workflow-designer-service';
import type { WorkflowDesignerDefinition, WorkflowDesignerOptions, WorkflowDefinitionVersion } from './types';

const props = withDefaults(defineProps<{
  definition: WorkflowDesignerDefinition;
  options?: WorkflowDesignerOptions;
  service?: WorkflowDesignerService;
  version: WorkflowDefinitionVersion;
}>(), { options: () => ({}) });
const emit = defineEmits<{ 'update:definition': [value: WorkflowDesignerDefinition]; refreshed: [value: WorkflowDefinitionVersion] }>();
const service = computed(() => props.service ?? new WorkflowDesignerService());
const valid = ref(false);
const validationMessages = ref<string[]>([]);
const saving = ref(false);
const actionMessage = ref<string>();
const dirty = computed(() => {
  if (!props.version.lowflowJson) return true;
  try { return JSON.stringify(props.definition) !== JSON.stringify(JSON.parse(props.version.lowflowJson)); } catch { return true; }
});
const canEdit = computed(() => props.version.lifecycle === 'Draft');
const canSimulate = computed(() => canEdit.value && valid.value && dirty.value === false);
const canPublish = computed(() => props.version.lifecycle === 'Testing' && props.version.simulationReport?.successful);

watch(() => props.version.lowflowJson, (json) => {
  if (!json || dirty.value) return;
  try { emit('update:definition', JSON.parse(json) as WorkflowDesignerDefinition); } catch { /* 服务端会在发布时给出 JSON 校验错误 */ }
});

async function run(action: () => Promise<WorkflowDefinitionVersion>, message: string) {
  saving.value = true;
  actionMessage.value = undefined;
  try {
    const value = await action();
    emit('refreshed', value);
    actionMessage.value = message;
  } finally { saving.value = false; }
}
function save() { return run(() => service.value.saveDraft(props.version.id, JSON.stringify(props.definition)), '草稿已保存；任何修改都会使原模拟结果失效。'); }
function simulate() { return run(() => service.value.startSimulation(props.version.id), '已提交自动模拟测试，请以服务端覆盖报告为准。'); }
function publish() { return run(() => service.value.publishAfterSimulation(props.version.id), '版本已提交发布；服务端会再次核验模拟结果和唯一可发起版本约束。'); }
</script>

<template>
  <section class="levin-workflow-definition-workbench">
    <a-alert v-if="actionMessage" class="mb-4" :message="actionMessage" show-icon type="success" />
    <a-alert v-if="version.lifecycle !== 'Draft'" class="mb-4" :message="`当前版本：${version.lifecycle}`" show-icon type="info">
      <template #description>已发布、下线中、已下线和归档版本不可在设计器中编辑；状态迁移以服务端生命周期规则为准。</template>
    </a-alert>
    <WorkflowDesigner
      :model-value="definition"
      :options="options"
      :readonly="!canEdit"
      @update:model-value="emit('update:definition', $event)"
      @validate="(isValid, messages) => { valid = isValid; validationMessages = messages; }"
    />
    <a-card class="mt-4" size="small" title="验证、模拟与发布">
      <a-alert v-if="validationMessages.length" class="mb-3" :message="validationMessages.join('；')" type="warning" />
      <a-space wrap>
        <a-button :disabled="!canEdit || !dirty" :loading="saving" @click="save">保存草稿</a-button>
        <a-button :disabled="!canSimulate" :loading="saving" type="primary" @click="simulate">开始自动模拟</a-button>
        <a-popconfirm title="确认发布通过模拟测试的版本？" @confirm="publish"><a-button :disabled="!canPublish" :loading="saving" type="primary">发布</a-button></a-popconfirm>
      </a-space>
      <a-descriptions v-if="version.simulationReport" class="mt-4" :column="1" size="small">
        <a-descriptions-item label="模拟结果">{{ version.simulationReport.successful ? '通过' : '未通过' }}</a-descriptions-item>
        <a-descriptions-item label="覆盖分支">{{ version.simulationReport.coveredBranches?.join('、') || '无' }}</a-descriptions-item>
        <a-descriptions-item label="未覆盖分支">{{ version.simulationReport.uncoveredBranches?.join('、') || '无' }}</a-descriptions-item>
        <a-descriptions-item v-if="version.simulationReport.message" label="报告">{{ version.simulationReport.message }}</a-descriptions-item>
      </a-descriptions>
    </a-card>
  </section>
</template>
