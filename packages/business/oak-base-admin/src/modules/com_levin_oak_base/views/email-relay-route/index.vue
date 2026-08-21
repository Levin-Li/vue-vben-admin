<script lang="ts" setup>
import type { Recordable } from '@levin/types';

import { Modal, message } from 'ant-design-vue';
import { computed } from 'vue';

import { emailRelayRouteService } from '../../api/email-relay-route-service';
import CrudPage from '../crud-page.vue';
import { emailRelayRoutePageCrudConfig } from './config';

const pageConfig = computed(() => ({
  ...emailRelayRoutePageCrudConfig,
  rowActions: [
    {
      handler: async (record: Recordable) => {
        const result = await emailRelayRouteService.preview({ id: record.id });
        await Modal.info({
          title: result?.ready ? '预检通过' : '预检未通过',
          content: [...(result?.errors || []), ...(result?.warnings || [])].join('\n') || '提供商配置和路由目标可以同步。',
        });
        return record;
      },
      label: '预检',
      reloadAfterAction: false as const,
      successMessage: false as const,
    },
    {
      handler: async (record: Recordable) => {
        const result = await emailRelayRouteService.previewDns({ id: record.id });
        await Modal.info({
          title: result?.ready ? 'DNS 已就绪' : 'DNS 需要处理',
          content: result?.message || '未返回 DNS 预检信息。',
        });
        return record;
      },
      label: '预检DNS',
      reloadAfterAction: false as const,
      successMessage: false as const,
    },
    {
      confirmText: '确认将当前路由同步到邮件提供商吗？',
      handler: async (record: Recordable) => {
        await emailRelayRouteService.sync({ id: record.id });
        message.success('邮件路由已同步');
        return record;
      },
      label: '同步',
    },
  ],
}));
</script>

<template>
  <CrudPage :config="pageConfig" />
</template>
