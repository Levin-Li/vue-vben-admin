import { describe, expect, it, vi } from 'vitest';

import { clearPreviousUserAccessState } from '../user-access-session';

describe('clearPreviousUserAccessState', () => {
  it('clears every account access and navigation cache', () => {
    const calls: string[] = [];
    const accessStore = {
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
      'codes:0',
      'menus:0',
      'routes:0',
      'checked:false',
      'reset-routes',
      'reset-navigation',
    ]);
  });
});
