import { describe, expect, it, vi } from 'vitest';

import {
  rememberLastVisitedPath,
  resolveRootRedirectPath,
} from '../../router/routes/root-redirect';
import { clearPreviousUserAccessState } from '../user-access-session';

describe('clearPreviousUserAccessState', () => {
  it('clears every account access and navigation cache', () => {
    const calls: string[] = [];
    rememberLastVisitedPath('/previous-account-page');
    expect(resolveRootRedirectPath('')).toBe('/previous-account-page');
    const accessStore = {
      setAccessToken: vi.fn((value: null) => {
        calls.push(`access-token:${value}`);
      }),
      setAccessCodes: vi.fn((value: string[]) => {
        calls.push(`codes:${value.length}`);
      }),
      setAccessMenus: vi.fn((value: unknown[]) => {
        calls.push(`menus:${value.length}`);
      }),
      setAccessRoutes: vi.fn((value: unknown[]) => {
        calls.push(`routes:${value.length}`);
      }),
      setIsAccessChecked: vi.fn((value: boolean) => {
        calls.push(`checked:${value}`);
      }),
      setLoginExpired: vi.fn((value: boolean) => {
        calls.push(`login-expired:${value}`);
      }),
      setRefreshToken: vi.fn((value: null) => {
        calls.push(`refresh-token:${value}`);
      }),
    };
    const resetRoutes = vi.fn(() => {
      calls.push('reset-routes');
    });
    const resetNavigationState = vi.fn(() => {
      calls.push('reset-navigation');
    });

    clearPreviousUserAccessState(
      accessStore,
      resetRoutes,
      resetNavigationState,
    );

    expect(calls).toEqual([
      'access-token:null',
      'refresh-token:null',
      'login-expired:false',
      'codes:0',
      'menus:0',
      'routes:0',
      'checked:false',
      'reset-routes',
      'reset-navigation',
    ]);
    expect(resolveRootRedirectPath('')).toBe('/index');
  });

  it('keeps valid credentials when only entering the login page', () => {
    const accessStore = {
      setAccessToken: vi.fn(),
      setAccessCodes: vi.fn(),
      setAccessMenus: vi.fn(),
      setAccessRoutes: vi.fn(),
      setIsAccessChecked: vi.fn(),
      setLoginExpired: vi.fn(),
      setRefreshToken: vi.fn(),
    };

    clearPreviousUserAccessState(
      accessStore,
      vi.fn(),
      vi.fn(),
      { clearCredentials: false },
    );

    expect(accessStore.setAccessToken).not.toHaveBeenCalled();
    expect(accessStore.setRefreshToken).not.toHaveBeenCalled();
    expect(accessStore.setLoginExpired).not.toHaveBeenCalled();
    expect(accessStore.setAccessCodes).toHaveBeenCalledWith([]);
    expect(accessStore.setAccessMenus).toHaveBeenCalledWith([]);
    expect(accessStore.setAccessRoutes).toHaveBeenCalledWith([]);
    expect(accessStore.setIsAccessChecked).toHaveBeenCalledWith(false);
  });
});
