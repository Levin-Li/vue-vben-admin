<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed } from 'vue';

import DynamicCrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { Button } from 'ant-design-vue';

import { moduleExportTemplateService, OAK_BASE_API_MODULE } from './api-module';
import WorkflowCrudEntry from './workflow-crud-entry.vue';

const props = defineProps<{
  config: CrudPageConfig;
}>();

defineSlots<Record<string, (slotProps: Record<string, any>) => any>>();

const mergedConfig = computed<CrudPageConfig>(() => ({
  ...props.config,
  apiModuleBase: props.config.apiModuleBase || OAK_BASE_API_MODULE,
  exportTemplateService:
    props.config.exportTemplateService || moduleExportTemplateService,
}));
</script>

<template>
  <WorkflowCrudEntry :config="mergedConfig" v-slot="workflow">
    <DynamicCrudPage :config="mergedConfig">
      <template
        v-for="slotName in Object.keys($slots).filter(
          (name) => name !== 'row-actions',
        )"
        :key="slotName"
        #[slotName]="slotProps"
      >
        <slot :name="slotName" v-bind="slotProps || {}"></slot>
      </template>
      <template
        v-if="workflow.supported || $slots['row-actions']"
        #row-actions="{ record, reload }"
      >
        <slot name="row-actions" :record="record" :reload="reload"></slot>
        <Button
          v-if="workflow.canOpen(record)"
          type="link"
          size="small"
          @click="workflow.open(record, reload)"
        >
          业务流程
        </Button>
      </template>
    </DynamicCrudPage>
  </WorkflowCrudEntry>
</template>
