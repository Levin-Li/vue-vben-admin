import type { RouteRecordRaw } from 'vue-router';

import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

const routes: RouteRecordRaw[] = [
  {
    name: 'BackendCrudAlias',
    path: '/clob/V1/:resource',
    component: resolveAdminPage('/system/shared/controller-crud-page.vue'),
    meta: {
      hideInMenu: true,
      title: '后台页面',
    },
  },
];

export default routes;
