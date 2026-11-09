import { describe, expect, it } from 'vitest';

import { oakBaseAdminCrudResources } from '../../../admin-crud';
import { dataMaskingSettingPageCrudConfig } from '../config';

describe('数据脱敏设置页面', () => {
  it('归入既有设置业务分组并使用独立配置资源', () => {
    expect(
      oakBaseAdminCrudResources.find(
        (item) => item.resource === 'DataMaskingSetting',
      ),
    ).toMatchObject({ title: '数据脱敏设置' });
    expect(dataMaskingSettingPageCrudConfig.apiBase).toBe(
      '/DataMaskingSetting',
    );
  });

  it('保留匹配条件和直接数组形式的 JSON 规则', async () => {
    for (const key of [
      'tenantId',
      'domain',
      'orgCategory',
      'orgType',
      'userCategory',
      'userType',
    ]) {
      expect(
        dataMaskingSettingPageCrudConfig.fields.find(
          (field) => field.key === key,
        ),
      ).toBeDefined();
    }
    const rule = {
      outputOperation: 'Order.list',
      outputFieldPath: 'data.items[*].id',
      treatment: 'HIDE',
    };
    const payload = { valueContent: [rule] };
    expect(
      await dataMaskingSettingPageCrudConfig.transformSubmit?.(payload, null),
    ).toBe(payload);
  });
});
