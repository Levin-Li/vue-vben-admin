import type { RouteRecordRaw } from 'vue-router';

import { traverseTreeValues } from '@vben/utils';

function buildCoreRouteNames(routes: RouteRecordRaw[]) {
  return traverseTreeValues(routes, (route) =>
    route.meta?.requiresAccess ? undefined : route.name,
  );
}

export { buildCoreRouteNames };
