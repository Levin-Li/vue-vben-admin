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
];
