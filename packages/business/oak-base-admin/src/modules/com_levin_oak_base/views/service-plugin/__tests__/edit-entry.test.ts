import { getCrudJsonSchemaEditFields } from '@levin/admin-framework/framework-commons/shared/crud-json-schema-actions';
import { describe, expect, it } from 'vitest';

import {
  preserveUnsetPluginConfigurationRule,
  servicePluginPageCrudConfig,
} from '../config';

describe('服务插件普通编辑入口', () => {
  it('基本配置保留在普通编辑中，不再生成单字段行操作', () => {
    const baseConfig = servicePluginPageCrudConfig.fields.find(
      (field) => field.key === 'baseConfig',
    );
    expect(baseConfig?.form).not.toBe(false);
    expect(
      getCrudJsonSchemaEditFields(
        baseConfig ? [baseConfig] : [],
        { id: 'plugin-1' },
        {
          canEditField: () => true,
          canEditRecord: true,
          recordKey: 'id',
          userInfo: { superAdmin: true },
        },
      ),
    ).toEqual([]);
    expect(
      servicePluginPageCrudConfig.fields.find(
        (field) => field.key === 'providerSelectionMode',
      )?.formEdit,
    ).toBe(true);
    expect(
      servicePluginPageCrudConfig.fields.find(
        (field) => field.key === 'allowMultipleConfigurations',
      )?.formVisibleForSuperAdmin,
    ).toBe(true);
  });

  it('编辑其它字段不回填历史空规则，明确关闭仍提交', () => {
    expect(
      preserveUnsetPluginConfigurationRule(
        { name: '插件', allowMultipleConfigurations: true },
        { __originalAllowMultipleConfigurations: null },
      ),
    ).toEqual({ name: '插件' });
    expect(
      preserveUnsetPluginConfigurationRule(
        { name: '插件', allowMultipleConfigurations: false },
        { __originalAllowMultipleConfigurations: null },
      ),
    ).toEqual({ name: '插件', allowMultipleConfigurations: false });
  });
});
