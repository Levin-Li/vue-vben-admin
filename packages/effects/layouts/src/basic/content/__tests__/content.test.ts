import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRouteContentKey } from '../route-content-key';

vi.mock('@vben/stores', () => ({
  getTabKey(route: RouteLocationNormalizedLoadedGeneric) {
    return route.fullPath;
  },
}));

describe('layoutContent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to a safe key when route key fields throw', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const route = {
      meta: {},
      query: {},
    } as unknown as RouteLocationNormalizedLoadedGeneric;

    Object.defineProperties(route, {
      fullPath: {
        get() {
          throw new Error('broken route fullPath');
        },
      },
      name: {
        get() {
          throw new Error('broken route name');
        },
      },
      path: {
        get() {
          throw new Error('broken route path');
        },
      },
    });

    expect(getRouteContentKey(route)).toBe('unknown-route');
  });
});
