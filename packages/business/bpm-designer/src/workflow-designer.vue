<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import type { WorkflowDesignerDefinition, WorkflowDesignerOptions, WorkflowNode } from './types';

const props = withDefaults(defineProps<{ modelValue: WorkflowDesignerDefinition; options?: WorkflowDesignerOptions; readonly?: boolean }>(), { options: () => ({}) });
const emit = defineEmits<{ 'update:modelValue': [value: WorkflowDesignerDefinition]; validate: [valid: boolean, messages: string[]] }>();
const selectedNodeId = ref<string>();
const actionOptions = ['approve', 'reject', 'return', 'transfer', 'delegate', 'add-sign'];
const verifyOptions = ['Captcha', 'Hmi', 'Sms', 'Email', 'Mfa'];
const nodes = computed(() => props.modelValue.nodes);
const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value));
const validationMessages = computed(() => validateDefinition(props.modelValue));
const userOptions = computed(() => props.options.users?.map((candidate) => ({ label: candidate.label, value: candidate.value ?? candidate.id })));
const groupOptions = computed(() => props.options.groups?.map((candidate) => ({ label: candidate.label, value: candidate.value ?? candidate.id })));
watch(validationMessages, (messages) => emit('validate', messages.length === 0, messages), { immediate: true });

function updateDefinition(mutator: (draft: WorkflowDesignerDefinition) => void) {
  const draft = structuredClone(props.modelValue); mutator(draft); emit('update:modelValue', draft);
}
function addApprovalNode() {
  updateDefinition((draft) => {
    const next = draft.nodes.filter((node) => node.type === 'userTask').length + 1;
    const node: WorkflowNode = { actions: ['approve', 'reject'], candidateGroups: [], candidateUsers: [], id: `approve_${next}`, name: `审批节点 ${next}`, requiredFields: [], stepUpVerifyTypes: [], type: 'userTask' };
    const endIndex = draft.nodes.findIndex((item) => item.type === 'end'); draft.nodes.splice(endIndex < 0 ? draft.nodes.length : endIndex, 0, node); selectedNodeId.value = node.id;
  });
}
function removeNode(nodeId: string) { updateDefinition((draft) => { if (draft.nodes.find((item) => item.id === nodeId)?.type !== 'userTask') return; draft.nodes = draft.nodes.filter((item) => item.id !== nodeId); selectedNodeId.value = undefined; }); }
function updateSelected(patch: Partial<WorkflowNode>) { if (!selectedNode.value) return; updateDefinition((draft) => { const index = draft.nodes.findIndex((item) => item.id === selectedNode.value?.id); draft.nodes[index] = { ...draft.nodes[index], ...patch }; }); }
function updateName(name: string) { updateDefinition((draft) => { draft.name = name; }); }
function validateDefinition(definition: WorkflowDesignerDefinition) {
  const messages: string[] = [];
  if (definition.nodes.filter((node) => node.type === 'start').length !== 1 || definition.nodes.filter((node) => node.type === 'end').length !== 1) messages.push('流程必须且只能包含一个开始节点和一个结束节点。');
  definition.nodes.filter((node) => node.type === 'userTask').forEach((node) => { if (!(node.candidateUsers?.length || node.candidateGroups?.length)) messages.push(`节点「${node.name}」缺少候选用户或候选组。`); if (!node.actions?.length) messages.push(`节点「${node.name}」至少要配置一个动作。`); });
  return messages;
}
</script>

<template>
  <section class="levin-workflow-designer">
    <a-alert v-if="validationMessages.length" class="mb-4" message="发布前需要处理以下问题" show-icon type="warning"><template #description><div v-for="message in validationMessages" :key="message">{{ message }}</div></template></a-alert>
    <a-card size="small"><a-form layout="vertical"><a-row :gutter="16"><a-col :md="12" :span="24"><a-form-item label="流程名称"><a-input :disabled="readonly" :value="modelValue.name" @update:value="updateName" /></a-form-item></a-col><a-col :md="12" :span="24"><a-form-item label="流程标识"><a-input disabled :value="modelValue.processKey" /></a-form-item></a-col></a-row></a-form></a-card>
    <a-row class="mt-4" :gutter="16"><a-col :lg="15" :span="24"><a-card title="审批流画布" size="small"><template #extra><a-button :disabled="readonly" type="dashed" @click="addApprovalNode">新增审批节点</a-button></template><div class="workflow-canvas"><template v-for="(node, index) in nodes" :key="node.id"><button class="workflow-node" :class="[`workflow-node--${node.type}`, { 'workflow-node--selected': selectedNodeId === node.id }]" type="button" @click="selectedNodeId = node.id"><span>{{ node.type === 'start' ? '开始' : node.type === 'end' ? '结束' : '审批' }}</span><strong>{{ node.name }}</strong></button><span v-if="index < nodes.length - 1" class="workflow-arrow">↓</span></template></div></a-card></a-col>
      <a-col :lg="9" :span="24"><a-card title="节点属性" size="small"><template v-if="selectedNode?.type === 'userTask'"><a-form layout="vertical"><a-form-item label="节点名称"><a-input :disabled="readonly" :value="selectedNode.name" @update:value="updateSelected({ name: $event })" /></a-form-item><a-form-item label="候选用户"><a-select :disabled="readonly" mode="multiple" :options="userOptions" :value="selectedNode.candidateUsers" @update:value="updateSelected({ candidateUsers: $event })" /></a-form-item><a-form-item label="候选角色 / 组织"><a-select :disabled="readonly" mode="multiple" :options="groupOptions" :value="selectedNode.candidateGroups" @update:value="updateSelected({ candidateGroups: $event })" /></a-form-item><a-form-item label="允许动作"><a-select :disabled="readonly" mode="multiple" :options="actionOptions" :value="selectedNode.actions" @update:value="updateSelected({ actions: $event })" /></a-form-item><a-form-item label="必填表单字段"><a-select :disabled="readonly" mode="multiple" :options="options.fields?.map((field) => ({ label: field.label, value: field.key }))" :value="selectedNode.requiredFields" @update:value="updateSelected({ requiredFields: $event })" /></a-form-item><a-form-item label="二次验证"><a-select :disabled="readonly" mode="multiple" :options="verifyOptions" :value="selectedNode.stepUpVerifyTypes" @update:value="updateSelected({ stepUpVerifyTypes: $event })" /></a-form-item><a-popconfirm title="确定删除此审批节点吗？" @confirm="removeNode(selectedNode.id)"><a-button danger :disabled="readonly">删除节点</a-button></a-popconfirm></a-form></template><a-empty v-else description="选择一个审批节点配置审批人、表单与动作" :image-style="{ height: '72px' }" /></a-card></a-col></a-row>
  </section>
</template>

<style scoped>
.workflow-canvas { align-items: center; display: flex; flex-direction: column; min-height: 24rem; padding: 2rem 1rem; }
.workflow-node { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: .5rem; color: hsl(var(--foreground)); cursor: pointer; display: flex; flex-direction: column; gap: .25rem; min-width: 12rem; padding: .75rem 1rem; text-align: left; }
.workflow-node--start { border-color: hsl(var(--success)); }.workflow-node--end { border-color: hsl(var(--destructive)); }.workflow-node--selected { box-shadow: 0 0 0 2px hsl(var(--ring)); }.workflow-arrow { color: hsl(var(--muted-foreground)); font-size: 1.5rem; line-height: 2rem; }
</style>
