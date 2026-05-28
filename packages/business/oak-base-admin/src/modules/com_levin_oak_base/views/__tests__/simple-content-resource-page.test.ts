import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/simple-content-resource-page.vue',
  'utf8',
);

describe('simple content resource page', () => {
  it('shows the script test panel only for API code editors used by top super admins', () => {
    expect(source).toContain("props.resourceKind === 'api'");
    expect(source).toContain("contentEditorMeta.value.kind === 'code'");
    expect(source).toContain('isTopSuperAdminUser(userStore.userInfo)');
  });

  it('keeps the script test panel fields for method path timeout and json payloads', () => {
    expect(source).toContain("const scriptTestMethodOptions = [");
    expect(source).toContain("placeholder=\"测试路径\"");
    expect(source).toContain('v-model:value="scriptTestTimeoutMs"');
    expect(source).toContain('Headers JSON');
    expect(source).toContain('Query JSON');
    expect(source).toContain('Body JSON');
    expect(source).toContain("message.success('脚本测试执行完成')");
  });
});
