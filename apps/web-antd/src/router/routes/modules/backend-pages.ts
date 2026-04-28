import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'BackendCrudAlias',
    path: '/clob/V1/:resource',
    component: () => import('#/views/system/shared/controller-crud-page.vue'),
    meta: {
      hideInMenu: true,
      title: '后台页面',
    },
  },
];

export default routes;
