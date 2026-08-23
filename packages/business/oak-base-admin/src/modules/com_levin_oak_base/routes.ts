import type { RouteRecordRaw } from 'vue-router';

import { toPathRouteName } from '@levin/admin-framework';

export const oakBaseAdminRoutes: RouteRecordRaw[] = [
  {
    component: () => import('./views/setting-for-tenant/index.vue'),
    meta: {
      crudResource: 'SettingForTenant',
      icon: 'lucide:building',
      title: '租户系统设置',
    },
    name: toPathRouteName('/clob/V1/SettingForTenant'),
    path: '/clob/V1/SettingForTenant',
  },
  {
    component: () => import('./views/tenant-plugin-setting/index.vue'),
    meta: {
      crudResource: 'TenantPluginSetting',
      icon: 'lucide:plug-zap',
      title: '租户插件设置',
    },
    name: toPathRouteName('/clob/V1/TenantPluginSetting'),
    path: '/clob/V1/TenantPluginSetting',
  },
];
