import { describe, expect, it, vi } from 'vitest';

import { keepSessionWithoutMenus } from './menu-load-failure';

describe('keepSessionWithoutMenus', () => {
  it('keeps the session while clearing every menu result after a failed load', () => {
    const accessStore = {
      setAccessMenus: vi.fn(),
      setAccessRoutes: vi.fn(),
      setIsAccessChecked: vi.fn(),
    };

    keepSessionWithoutMenus(accessStore);

    expect(accessStore.setAccessMenus).toHaveBeenCalledWith([]);
    expect(accessStore.setAccessRoutes).toHaveBeenCalledWith([]);
    expect(accessStore.setIsAccessChecked).toHaveBeenCalledWith(true);
  });
});
