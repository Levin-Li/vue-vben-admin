<script lang="ts" setup>
import type { WorkflowTaskView } from './types';

defineProps<{ task: WorkflowTaskView }>();
</script>

<template>
  <div class="levin-workflow-process-diagram" role="img" :aria-label="`${task.taskName || '流程'}流程图`">
    <template v-if="task.processDiagramNodes?.length">
      <template v-for="(node, index) in task.processDiagramNodes" :key="node.id"><a-tag :color="node.status === 'active' ? 'processing' : node.status === 'completed' ? 'success' : 'default'">{{ node.name }}</a-tag><span v-if="index < task.processDiagramNodes.length - 1" class="mx-2">→</span></template>
    </template>
    <a-empty v-else description="服务端尚未提供可展示的流程图节点" :image-style="{ height: '48px' }" />
  </div>
</template>
