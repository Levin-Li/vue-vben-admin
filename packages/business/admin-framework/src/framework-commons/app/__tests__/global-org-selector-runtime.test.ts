import { describe, expect, it, vi } from 'vitest';

const { addLayoutHeaderExtensionAreaItem } = vi.hoisted(() => ({
  addLayoutHeaderExtensionAreaItem: vi.fn(() => vi.fn()),
}));

vi.mock('@vben/layouts/basic/header-extension-area', () => ({
  addLayoutHeaderExtensionAreaItem,
}));

vi.mock('@vben/stores', () => ({
  useTabbarStore: () => ({ invalidateCachedRouteViews: vi.fn() }),
  useUserStore: () => ({ userInfo: {} }),
}));

vi.mock('../api/ui-setting-runtime', () => ({
  resolveUiSettingRuntime: vi.fn(),
}));

vi.mock('../global-org-context-state', () => ({
  onGlobalUserOrgContextChange: vi.fn(() => vi.fn()),
  setCurrentGlobalOrgId: vi.fn(),
}));

vi.mock('../global-org-selector.vue', () => ({ default: {} }));
vi.mock('../router', () => ({ router: {} }));

describe('global org selector runtime', () => {
  it('uses 220px as the default width while retaining the 360px maximum', async () => {
    const { registerGlobalOrgSelectorRuntime } =
      await import('../global-org-selector-runtime');

    registerGlobalOrgSelectorRuntime();

    expect(addLayoutHeaderExtensionAreaItem).toHaveBeenCalledWith(
      'center',
      expect.objectContaining({
        class: 'w-[220px] min-w-[220px] max-w-[360px] shrink-0',
      }),
    );
  });
});
