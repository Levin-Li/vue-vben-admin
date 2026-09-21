import type { Router, RouteRecordName, RouteRecordRaw } from 'vue-router';

import { traverseTreeValues } from '@vben-core/foundation/shared/utils';

/**
 * @zh_CN 在动态路由装配前固定静态路由名称，防止后续路由记录被原地扩展。
 */
export function getStaticRouteNames(routes: RouteRecordRaw[]) {
  return traverseTreeValues<RouteRecordRaw, RouteRecordName | undefined>(
    routes,
    (route) => {
      // 这些路由需要指定 name，防止在路由重置时，不能删除没有指定 name 的路由。
      if (!route.name) {
        console.warn(
          `The route with the path ${route.path} needs to have the field name specified.`,
        );
      }
      return route.name;
    },
  );
}

/**
 * @zh_CN 重置所有路由，如有指定白名单除外
 */
export function resetStaticRoutes(
  router: Router,
  routes: RouteRecordName[] | RouteRecordRaw[],
) {
  // 支持调用方在应用初始化时传入已固定的静态名称，兼容旧的路由定义数组调用方式。
  const staticRouteNames = routes.every(
    (route) => typeof route === 'string' || typeof route === 'symbol',
  )
    ? (routes as RouteRecordName[])
    : getStaticRouteNames(routes as RouteRecordRaw[]);

  const { getRoutes, hasRoute, removeRoute } = router;
  const allRoutes = getRoutes();
  allRoutes.forEach(({ name }) => {
    // 存在于路由表且非白名单才需要删除
    if (name && !staticRouteNames.includes(name) && hasRoute(name)) {
      removeRoute(name);
    }
  });
}
