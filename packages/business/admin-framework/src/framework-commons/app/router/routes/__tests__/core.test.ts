import { describe, expect, it } from 'vitest';

import { buildCoreRouteNames } from '../access-route-names';
import { ROOT_HOME_PATH, resolveRootRedirectPath } from '../root-redirect';

describe('resolveRootRedirectPath', () => {
  it('uses configured non-root home paths', () => {
    expect(resolveRootRedirectPath('/clob/V1/Role')).toBe('/clob/V1/Role');
  });

  it('uses the framework home route when preferences point root to itself', () => {
    expect(resolveRootRedirectPath('/')).toBe(ROOT_HOME_PATH);
    expect(resolveRootRedirectPath('  ')).toBe(ROOT_HOME_PATH);
  });
});

describe('buildCoreRouteNames', () => {
  it('excludes static root children that still require access checks', () => {
    expect(
      buildCoreRouteNames([
        {
          name: 'Root',
          path: '/',
          children: [
            {
              name: 'Index',
              path: '/index',
              meta: {
                requiresAccess: true,
              },
            },
          ],
        },
        {
          name: 'Login',
          path: '/auth/login',
        },
      ]),
    ).toEqual(['Root', 'Login']);
  });
});
