import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { getTabKey } from '@vben/stores';

function getRouteValue(
  route: RouteLocationNormalizedLoadedGeneric,
  key: 'fullPath' | 'name' | 'path',
) {
  try {
    return route[key];
  } catch (error) {
    console.error(error);
  }
}

export function getRouteContentKey(
  route: RouteLocationNormalizedLoadedGeneric,
) {
  try {
    return getTabKey(route);
  } catch (error) {
    console.error(error);
    return String(
      getRouteValue(route, 'name') ||
        getRouteValue(route, 'fullPath') ||
        getRouteValue(route, 'path') ||
        'unknown-route',
    );
  }
}
