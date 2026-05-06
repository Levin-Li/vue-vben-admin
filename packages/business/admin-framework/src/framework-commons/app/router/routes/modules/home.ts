import type { RouteRecordRaw } from 'vue-router';

import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

const routes: RouteRecordRaw[] = [
  {
    name: 'Index',
    path: '/index',
    component: resolveAdminPage('/_core/home/index.vue'),
    meta: {
      icon: 'lucide:house',
      order: -1000,
      title: '首页',
    },
  },
];

export default routes;
