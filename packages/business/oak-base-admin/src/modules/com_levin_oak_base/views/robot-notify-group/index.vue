<script setup lang="ts">
import { computed } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import CrudPage from '../crud-page.vue';
import {
  canManageRobotWebhook,
  robotNotifyGroupPageCrudConfig,
} from './config';

const userStore = useUserStore();
const canManageCredential = computed(() =>
  canManageRobotWebhook(userStore.userInfo),
);

// 组织共享只扩大配置的可见范围，不把其它组织的 Webhook 凭据交给组织管理员。
const pageConfig = computed(() => ({
  ...robotNotifyGroupPageCrudConfig,
  allowCreate: canManageCredential.value,
  allowDelete: canManageCredential.value,
  allowEdit: canManageCredential.value,
  fields: robotNotifyGroupPageCrudConfig.fields.filter(
    (field) => field.key !== 'webhookUrl' || canManageCredential.value,
  ),
}));
</script>

<template>
  <CrudPage :config="pageConfig" />
</template>
