<script setup lang="ts">
import type {
  WorkflowDefinitionVersion,
  WorkflowDesignerOptions,
} from './types';
import type { WorkflowDesignerService } from './workflow-designer-service';
import type { WorkflowStateGraph } from './workflow-state-graph';
import type { WorkflowTaskGraph } from './workflow-task-graph';
import type { WorkflowTreeVersion } from './workflow-tree-version';

import WorkflowGraphWorkbench from './workflow-graph-workbench.vue';
import WorkflowTreeWorkbench from './workflow-tree-workbench.vue';

// 版本入口显式分派，两种协议各自保存，不在读取时转换历史事实。
const props = withDefaults(
  defineProps<{
    definition: WorkflowStateGraph | WorkflowTaskGraph | WorkflowTreeVersion;
    options?: WorkflowDesignerOptions;
    permissions?: {
      deleteSimulation?: boolean;
      publish?: boolean;
      save?: boolean;
      simulate?: boolean;
      viewSimulation?: boolean;
    };
    service?: WorkflowDesignerService;
    version: WorkflowDefinitionVersion;
  }>(),
  { options: () => ({}), permissions: () => ({}), service: undefined },
);
const emit = defineEmits<{
  refreshed: [value: WorkflowDefinitionVersion];
  'update:definition': [
    value: WorkflowStateGraph | WorkflowTaskGraph | WorkflowTreeVersion,
  ];
}>();
</script>

<template>
  <WorkflowGraphWorkbench
    v-if="definition.schemaVersion === 4 || definition.schemaVersion === 5"
    v-bind="props"
    :definition="definition"
    @refreshed="emit('refreshed', $event)"
    @update:definition="emit('update:definition', $event)"
  />
  <WorkflowTreeWorkbench
    v-else
    v-bind="props"
    :definition="definition"
    :version="
      version as Omit<WorkflowDefinitionVersion, 'lowflowDefinition'> & {
        lowflowDefinition?: WorkflowTreeVersion;
      }
    "
    @refreshed="emit('refreshed', $event)"
    @update:definition="emit('update:definition', $event)"
  >
    <template
      v-if="$slots['notification-preview']"
      #notification-preview="preview"
    >
      <slot name="notification-preview" v-bind="preview"></slot>
    </template>
  </WorkflowTreeWorkbench>
</template>
