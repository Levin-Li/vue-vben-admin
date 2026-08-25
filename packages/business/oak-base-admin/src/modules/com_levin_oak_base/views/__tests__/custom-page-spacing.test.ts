import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const viewsRoot =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views';

function readPage(path: string) {
  return readFileSync(`${viewsRoot}/${path}`, 'utf8');
}

describe('定制页面内容留白', () => {
  it('为设置和消息页面保留与路由内容区分离的卡片留白', () => {
    const cardContentClass =
      'content-class="!bg-card !m-4 !p-4 min-w-0 !overflow-hidden rounded-lg"';

    expect(readPage('setting-for-tenant/index.vue')).toContain(
      cardContentClass,
    );
    expect(readPage('my-setting/index.vue')).toContain(
      'SettingForTenantPage',
    );
    expect(readPage('tenant-plugin-setting/index.vue')).toContain(
      cardContentClass,
    );
    expect(readPage('my-messages/index.vue')).toContain(
      'content-class="!bg-card !m-4 min-w-0 !overflow-hidden rounded-lg"',
    );
  });
});
