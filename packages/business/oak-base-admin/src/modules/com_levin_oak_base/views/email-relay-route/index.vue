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
        const result = await emailRelayRouteService.testConfiguration({ id: record.id });
        await Modal.info({
          title: result?.ready ? '配置测试通过' : '配置测试未通过',
          content: result?.message || '未返回测试结果。',
        });
        return record;
      },
      label: '测试配置',
      reloadAfterAction: false as const,
      successMessage: false as const,
    },
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
      confirmText: '确认同步中转路由并自动配置或补回可管理的 DNS 记录吗？系统不会删除 DNS 记录。',
      handler: async (record: Recordable) => {
        const result = await emailRelayRouteService.autoConfigure({ id: record.id });
        await Modal.info({ title: result?.success ? '自动配置完成' : '自动配置未完全完成', content: result?.message || '未返回自动配置结果。' });
        return record;
      },
      label: '自动配置',
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
    {
      confirmText: '确认同步或补回 Forward Email 验证记录吗？系统只会新增或更新，不会删除 DNS 记录。',
      handler: async (record: Recordable) => {
        const result = await emailRelayRouteService.syncDns({ id: record.id });
        await Modal.info({ title: result?.ready ? 'DNS 同步完成' : 'DNS 未自动同步', content: result?.message || '未返回 DNS 同步信息。' });
        return record;
      },
      label: '同步/修复DNS',
      reloadAfterAction: false as const,
      successMessage: false as const,
    },
    {
      confirmText: '确认删除当前路由在邮件提供商中的资源吗？本地路由记录会保留。',
      handler: async (record: Recordable) => {
        await emailRelayRouteService.removeProviderResource({ id: record.id });
        message.success('邮件提供商资源已删除');
        return record;
      },
      label: '删除提供商资源',
    },
  ],
}));
</script>

<template>
  <CrudPage :config="pageConfig" />
</template>
