import type { RouteRecordRaw } from 'vue-router';

export const oakBaseAdminRoutes: RouteRecordRaw[] = [
  {
    component: () => import('./views/setting-for-tenant/index.vue'),
    meta: {
      crudResource: 'SettingForTenant',
      icon: 'lucide:building',
      title: '租户系统设置',
    },
    name: 'AdminCrudSettingForTenant',
    path: '/clob/V1/SettingForTenant',
  },
  {
    component: () => import('./views/tenant-plugin-setting/index.vue'),
    meta: {
      crudResource: 'TenantPluginSetting',
      icon: 'lucide:plug-zap',
      title: '租户插件设置',
    },
    name: 'AdminCrudTenantPluginSetting',
    path: '/clob/V1/TenantPluginSetting',
  },
];
