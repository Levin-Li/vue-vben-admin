import { describe, expect, it, vi } from 'vitest';

import { getStaticRouteNames, resetStaticRoutes } from './reset-routes';

describe('resetStaticRoutes', () => {
  it('removes routes that were added after static route names were captured', () => {
    const staticRouteNames = getStaticRouteNames([
      { name: 'Root', path: '/' },
      { name: 'Login', path: '/auth/login' },
    ]);
    const router = {
      getRoutes: vi.fn(() => [
        { name: 'Root' },
        { name: 'Login' },
        { name: 'PreviousAccountMenu' },
      ]),
      hasRoute: vi.fn(() => true),
      removeRoute: vi.fn(),
    };

    resetStaticRoutes(router as any, staticRouteNames);

    expect(router.removeRoute).toHaveBeenCalledWith('PreviousAccountMenu');
    expect(router.removeRoute).not.toHaveBeenCalledWith('Root');
    expect(router.removeRoute).not.toHaveBeenCalledWith('Login');
  });
});
