import { beforeEach, describe, expect, it } from 'vitest';

import { buildCoreRouteNames } from '../access-route-names';
import {
  rememberLastVisitedPath,
  ROOT_HOME_PATH,
  resolveRootRedirectPath,
} from '../root-redirect';

describe('resolveRootRedirectPath', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('uses configured non-root home paths', () => {
    expect(resolveRootRedirectPath('/clob/V1/Role')).toBe('/clob/V1/Role');
  });

  it('uses the default home route when preferences point root to itself', () => {
    expect(ROOT_HOME_PATH).toBe('/index');
    expect(resolveRootRedirectPath('/')).toBe(ROOT_HOME_PATH);
    expect(resolveRootRedirectPath('  ')).toBe(ROOT_HOME_PATH);
  });

  it('uses the last visited path before the default home route', () => {
    rememberLastVisitedPath('/clob/V1/Role');
    rememberLastVisitedPath('/clob/V1/User');

    expect(resolveRootRedirectPath('/')).toBe('/clob/V1/User');
  });

  it('ignores unsafe or authentication paths when restoring the root route', () => {
    rememberLastVisitedPath('/clob/V1/Menu');
    rememberLastVisitedPath('https://example.com/admin');
    rememberLastVisitedPath('/auth/login');
    rememberLastVisitedPath('/');

    expect(resolveRootRedirectPath('/')).toBe('/clob/V1/Menu');
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
