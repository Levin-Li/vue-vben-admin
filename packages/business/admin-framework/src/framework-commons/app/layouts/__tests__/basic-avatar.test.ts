import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const layoutPath =
  'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue';

describe('basic layout avatar', () => {
  it('uses the configured colorful default avatar for an empty user avatar', () => {
    const source = readFileSync(layoutPath, 'utf8');

    expect(source).toContain(
      'return userStore.userInfo?.avatar || preferences.app.defaultAvatar;',
    );
  });
});
