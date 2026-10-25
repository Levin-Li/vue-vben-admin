import type { AdminPageMap } from '@levin/admin-framework';

const viewModules = import.meta.glob('./views/**/*.vue') as AdminPageMap;

const discoveredPageMap: AdminPageMap = Object.fromEntries(
  Object.entries(viewModules).map(([path, loader]) => [
    path.replace(/^\.\/views/, '/system/com_levin_oak_base'),
    loader,
  ]),
);

// 新增业务页面显式注册真实lazy loader，避免开发服务器旧glob缓存漏掉组件。
export const oakBaseAdminPageMap: AdminPageMap = {
  ...discoveredPageMap,
  '/system/com_levin_oak_base/domain-data-dynamic-model/index.vue': () =>
    import('./views/domain-data-dynamic-model/index.vue'),
  '/system/com_levin_oak_base/data-model-record-page/index.vue': () =>
    import('./views/data-model-record-page/index.vue'),
  '/system/com_levin_oak_base/daily-access-stat/index.vue': () =>
    import('./views/daily-access-stat/index.vue'),
  '/system/com_levin_oak_base/robot-notify-group/index.vue': () =>
    import('./views/robot-notify-group/index.vue'),
  '/system/com_levin_oak_base/notification-audit/index.vue': () =>
    import('./views/notification-audit/index.vue'),
  '/system/com_levin_oak_base/support-mailbox-rule/index.vue': () =>
    import('./views/support-mailbox-rule/index.vue'),
  '/system/com_levin_oak_base/ticket-queue/index.vue': () =>
    import('./views/ticket-queue/index.vue'),
  '/system/com_levin_oak_base/ticket/index.vue': () =>
    import('./views/ticket/index.vue'),
  '/system/com_levin_oak_base/workflow-notification-route/index.vue': () =>
    import('./views/workflow-notification-route/index.vue'),
};
