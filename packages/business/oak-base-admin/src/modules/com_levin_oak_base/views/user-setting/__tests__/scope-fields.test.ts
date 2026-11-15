import { describe, expect, it } from 'vitest';

import { userSettingPageCrudConfig } from '../config';

describe('用户个性化设置的本人归属', () => {
  it('允许平台身份在列表和详情识别本人设置的租户', () => {
    const tenant = userSettingPageCrudConfig.fields.find(
      ({ key }) => key === 'tenantId',
    );

    expect(tenant).toMatchObject({
      type: 'tenant',
      table: true,
      detail: true,
      visibleForPlatformUser: true,
    });
  });

  it('范围继续取自会话，查询和表单均不接受租户输入', () => {
    const tenant = userSettingPageCrudConfig.fields.find(
      ({ key }) => key === 'tenantId',
    );

    expect(tenant).toMatchObject({ search: false, form: false });
    expect(userSettingPageCrudConfig.defaultQuery).not.toHaveProperty(
      'tenantId',
    );
    expect(userSettingPageCrudConfig.defaultFormValues).not.toHaveProperty(
      'tenantId',
    );
    expect(userSettingPageCrudConfig.createSubmitKeys ?? []).not.toContain(
      'tenantId',
    );
  });
});
