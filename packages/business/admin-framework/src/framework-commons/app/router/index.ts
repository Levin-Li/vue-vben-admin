import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import { getStaticRouteNames, resetStaticRoutes } from '@vben/utils';

import { createRouterGuard } from './guard';
import { routes } from './routes';

/**
 *  @zh_CN 创建vue-router实例
 */
const router = createRouter({
  history:
    import.meta.env.VITE_ROUTER_HISTORY === 'hash'
      ? createWebHashHistory(import.meta.env.VITE_BASE)
      : createWebHistory(import.meta.env.VITE_BASE),
  // 应该添加到路由的初始路由列表。
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }
    return to.hash ? { behavior: 'smooth', el: to.hash } : { left: 0, top: 0 };
  },
  // 是否应该禁止尾部斜杠。
  // strict: true,
});

// 动态菜单会更新路由记录，静态白名单必须在首次装配前固定。
const staticRouteNames = getStaticRouteNames(routes);
const resetRoutes = () => resetStaticRoutes(router, staticRouteNames);

// 创建路由守卫；登录页进入时通过同一重置函数清理前一账号的动态访问状态。
createRouterGuard(router, resetRoutes);

export { resetRoutes, router };
