import { describe, expect, it } from 'vitest';

import {
  defineAdminPageOverrides,
  normalizeAdminGlobPageMap,
  type AdminPageMap,
} from '../page-registry';

const loginLoader = async () => ({ default: 'login' });
const roleLoader = async () => ({ default: 'role' });

describe('admin page registry helpers', () => {
  it('defines page overrides from the default pages directory', () => {
    const overrides = defineAdminPageOverrides({
      './pages/_core/authentication/login.vue': loginLoader,
      './pages/system/com_levin_oak_base/role/index.vue': roleLoader,
    });

    expect(overrides).toEqual({
      '/_core/authentication/login.vue': loginLoader,
      '/system/com_levin_oak_base/role/index.vue': roleLoader,
    });
  });

  it('defines page overrides from a custom local directory', () => {
    const overrides = defineAdminPageOverrides(
      {
        './features/rbac/pages/role/index.vue': roleLoader,
      } satisfies AdminPageMap,
      './features/rbac/pages',
    );

    expect(overrides).toEqual({
      '/role/index.vue': roleLoader,
    });
  });

  it('keeps the lower-level normalizer available for module page maps', () => {
    expect(
      normalizeAdminGlobPageMap(
        {
          './views/user/index.vue': loginLoader,
        },
        './views',
      ),
    ).toEqual({
      '/user/index.vue': loginLoader,
    });
  });
});
