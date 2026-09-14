import type { RouteRecordRaw } from 'vue-router';

import { toPathRouteName } from '@levin/admin-framework';

export const oakBaseAdminHomeRoute: RouteRecordRaw = {
  component: () => import('./views/home/index.vue'),
  meta: {
    hideInMenu: true,
    title: '后台管理',
  },
  path: '',
};

export const aclTestRoute: RouteRecordRaw = {
  component: () => import('./views/acl-test/index.vue'),
  meta: { title: '访问控制测试', icon: 'lucide:shield-check' },
  name: toPathRouteName('/clob/V1/aclTest'),
  path: '/clob/V1/aclTest',
};

export const namedScopeVariableAcceptanceRoute: RouteRecordRaw = {
  component: () => import('./views/named-scope-variable-acceptance/index.vue'),
  meta: { title: '具名数据范围变量验收', icon: 'lucide:scan-search' },
  name: toPathRouteName('/clob/V1/namedScopeVariableAcceptance'),
  path: '/clob/V1/namedScopeVariableAcceptance',
};

export const oakBaseAdminRoutes: RouteRecordRaw[] = [
  aclTestRoute,
  namedScopeVariableAcceptanceRoute,
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
