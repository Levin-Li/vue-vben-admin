<script lang="ts" setup>
import { computed } from 'vue';

import type { CrudPageConfig } from '../shared/types';

import SharedCrudPage from '../shared/crud-page.vue';

import { OAK_BASE_API_MODULE } from './api-module';

const props = defineProps<{
  config: CrudPageConfig;
}>();

const mergedConfig = computed<CrudPageConfig>(() => ({
  ...props.config,
  apiModuleBase: props.config.apiModuleBase || OAK_BASE_API_MODULE,
}));
</script>

<template>
  <SharedCrudPage :config="mergedConfig">
    <template v-for="(_, slotName) in $slots" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps || {}" />
    </template>
  </SharedCrudPage>
</template>
