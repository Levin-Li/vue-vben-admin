import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      hideInMenu: true,
      title: '数据权限分配预览',
    },
    name: 'DataPermissionPreview',
    path: '/system/com_levin_oak_base/data-permission-preview',
    component: () => import('#/views/system/com_levin_oak_base/data-permission-preview/index.vue'),
  },
];

export default routes;
