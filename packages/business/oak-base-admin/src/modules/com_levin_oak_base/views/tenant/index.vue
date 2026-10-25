<script lang="ts" setup>
import { computed } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { isSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import CrudPage from '../crud-page.vue';
import { tenantPageCrudConfig } from './config';

const userStore = useUserStore();
const pageConfig = computed(() => ({
  ...tenantPageCrudConfig,
  allowEdit: isSuperAdminUser(userStore.userInfo),
}));
</script>

<template>
  <CrudPage :config="pageConfig" />
</template>
