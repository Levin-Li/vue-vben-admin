<script lang="ts" setup>
import { computed } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  isSuperAdminUser,
  isTopSuperAdminUser,
} from '@levin/admin-framework/framework-commons/shared/user-identity';

import CrudPage from '../crud-page.vue';
import { scheduledTaskPageCrudConfig } from './config';
import ScheduledTaskExecutionContentField from './execution-content-field.vue';

const userStore = useUserStore();
const canUseGroovyScript = computed(
  () =>
    isSuperAdminUser(userStore.userInfo) ||
    isTopSuperAdminUser(userStore.userInfo),
);
</script>

<template>
  <CrudPage :config="scheduledTaskPageCrudConfig">
    <template #form-field-executionContent="{ editingRecord, formState }">
      <ScheduledTaskExecutionContentField
        v-model="formState.executionContent"
        :editing-record="editingRecord"
        :execution-content-type="formState.executionContentType"
        :groovy-allowed="canUseGroovyScript"
        :task="formState"
      />
    </template>
  </CrudPage>
</template>
