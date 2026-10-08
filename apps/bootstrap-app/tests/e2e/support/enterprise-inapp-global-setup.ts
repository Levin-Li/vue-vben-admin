import type { SafeSnapshot } from './enterprise-inapp-fixture';

import assert from 'node:assert/strict';

import { control, loadFixtureConfig } from './enterprise-inapp-fixture';

export default async function validateInitialFixture(): Promise<void> {
  // 整套只检查一次初始夹具；worker重启可继续使用本轮已合法创建的绑定。
  const fixture = await loadFixtureConfig();
  const initial = await control<SafeSnapshot>(
    fixture.vendorUrl,
    '/control/snapshot',
  );
  assert.equal(initial.db.userCount, 5);
  assert.deepEqual(
    initial.db.bindings.map((item) => item.id).toSorted(),
    Object.values(fixture.bindingIds).toSorted(),
  );
  for (const binding of initial.db.bindings) {
    assert.equal(binding.companyRootId, fixture.rootId);
    assert.equal(binding.innerUserId, fixture.accounts.primary.userId);
    assert.equal(binding.kind, 'login');
    assert.equal(binding.hasCredential, false);
  }
}
