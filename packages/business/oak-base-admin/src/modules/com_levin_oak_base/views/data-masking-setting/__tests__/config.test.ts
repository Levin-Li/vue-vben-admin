import { resolveCrudQuickFill } from '@levin/admin-framework/framework-commons/shared/crud-quick-fill';
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
      entityClass: 'example.Order',
      fieldName: 'id',
      schemaVersion: 2,
      treatment: 'HIDE',
    };
    const payload = { valueContent: [rule] };
    expect(
      await dataMaskingSettingPageCrudConfig.transformSubmit?.(payload, null),
    ).toBe(payload);
  });

  it('新增快捷填写包含必需的字段规则并拒绝空规则和旧规则', () => {
    const fields = dataMaskingSettingPageCrudConfig.fields;
    const field = fields.find((item) => item.key === 'valueContent');
    expect(field?.required).toBe(true);
    const plan = resolveCrudQuickFill(
      fields,
      new Set(fields.map((item) => item.key)),
    );
    expect(plan.requiredKeys.has('valueContent')).toBe(true);
    expect(() =>
      dataMaskingSettingPageCrudConfig.transformSubmit?.(
        { valueContent: [] },
        null,
      ),
    ).toThrow('至少选择');
    expect(() =>
      dataMaskingSettingPageCrudConfig.transformSubmit?.(
        {
          valueContent: [
            {
              entityClass: 'example.Order',
              fieldName: 'id',
              treatment: 'HIDE',
            },
          ],
        },
        null,
      ),
    ).toThrow('重新配置');
  });

  it('租户归属覆盖平台查询、列表和新增，组织匹配条件不伪装为组织归属', () => {
    const fields = dataMaskingSettingPageCrudConfig.fields;
    expect(fields.find((field) => field.key === 'tenantId')).toMatchObject({
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    });
    expect(fields.find((field) => field.key === '__tenant')).toMatchObject({
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
    });
    expect(fields.find((field) => field.key === 'orgId')).toBeUndefined();
    expect(fields.find((field) => field.key === 'orgCategory')?.search).toBe(
      true,
    );
    expect(fields.find((field) => field.key === 'orgType')?.search).toBe(true);
  });
});
