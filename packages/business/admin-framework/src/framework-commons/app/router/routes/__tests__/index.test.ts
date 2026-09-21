import { describe, expect, it, vi } from 'vitest';

vi.mock('@levin/admin-framework/framework-commons/app/options', () => ({
  getEnabledFrontendModules: () => [],
}));

vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  resolveAdminPage: (pagePath: string) => async () => pagePath,
}));

vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: { defaultHomePath: '/index' } },
}));

import { accessRoutes } from '../index';

describe('access routes', () => {
  it('does not supplement backend menus with Vben project or about routes', () => {
    const routeNames = accessRoutes.map((route) => route.name);

    expect(routeNames).not.toContain('VbenProject');
    expect(routeNames).not.toContain('VbenAbout');
  });
});
