import { describe, expect, it } from 'vitest';

import {
  buildProviderConfigurationUpdate,
  prepareProviderSettingSubmit,
} from '../../provider-configuration-update';
import {
  allowsMultipleActiveProviders,
  allowsMultipleProviderInstances,
  describeProviderConfiguration,
  getProviderSelectionMode,
  getProviderSelectionModeLabel,
  parseProviderSelectionModes,
} from '../../provider-selection-mode';
import { servicePluginSettingPageCrudConfig } from '../config';

describe('插件供应商选择模式', () => {
  it('列表与配置选项使用一致的中文名称，未知值不显示内部编码', () => {
    expect(getProviderSelectionModeLabel('SINGLE_ACTIVE')).toBe(
      '单一启用供应商',
    );
    expect(getProviderSelectionModeLabel('MULTI_CHOICE')).toBe(
      '使用时选择供应商',
    );
    expect(getProviderSelectionModeLabel('MULTI_ACTIVE_BALANCED')).toBe(
      '多家供应商自动分配',
    );
    expect(getProviderSelectionModeLabel('OTHER')).toBe('未知模式');
  });

  it('新建记录默认停用且只初始化本行供应商；编辑不更换供应商', () => {
    expect(servicePluginSettingPageCrudConfig.defaultFormValues?.enable).toBe(
      false,
    );
    expect(
      prepareProviderSettingSubmit(
        {
          enable: false,
          servicePluginProviderCode: 'FEISHU',
          servicePluginProviderInstanceCode: 'account-a',
          usageWeight: 3,
          value: { DINGTALK_V2: { enable: true } },
        },
        false,
      ),
    ).toEqual({
      enable: false,
      servicePluginProviderCode: 'FEISHU',
      servicePluginProviderInstanceCode: 'account-a',
      usageCount: 0,
      usageWeight: 3,
      value: { FEISHU: {} },
    });
    expect(
      prepareProviderSettingSubmit(
        { enable: true, usageCount: 4, usageWeight: 2 },
        true,
      ),
    ).toEqual({ enable: true, usageWeight: 2 });
  });

  it('只接受后端声明的模式，不从名称或供应商数量推断', () => {
    const modes = parseProviderSelectionModes({
      oauth: 'MULTI_CHOICE',
      sms: 'SINGLE_ACTIVE',
      smsBalanced: 'MULTI_ACTIVE_BALANCED',
    });
    expect(getProviderSelectionMode(modes, 'oauth')).toBe('MULTI_CHOICE');
    expect(getProviderSelectionMode(modes, 'sms')).toBe('SINGLE_ACTIVE');
    expect(getProviderSelectionMode(modes, 'smsBalanced')).toBe(
      'MULTI_ACTIVE_BALANCED',
    );
    expect(allowsMultipleActiveProviders('MULTI_ACTIVE_BALANCED')).toBe(true);
    expect(
      allowsMultipleProviderInstances(
        {
          providerList: [{ allowMultipleConfigurations: true, code: 'sms' }],
        },
        'sms',
      ),
    ).toBe(true);
    expect(getProviderSelectionMode(modes, 'unknown')).toBeUndefined();
    expect(() => parseProviderSelectionModes({ oauth: 'OTHER' })).toThrow();
  });

  it('插件与供应商独立限制配置实例数量，不由选择模式推断', () => {
    const plugin = {
      providerList: [
        { allowMultipleConfigurations: true, code: 'alpha' },
        { code: 'beta' },
      ],
    };
    expect(allowsMultipleProviderInstances(plugin, 'alpha')).toBe(true);
    expect(allowsMultipleProviderInstances(plugin, 'beta')).toBe(false);
    expect(allowsMultipleProviderInstances(plugin, 'unknown')).toBe(false);
    expect(
      allowsMultipleProviderInstances(
        { ...plugin, allowMultipleConfigurations: false },
        'alpha',
      ),
    ).toBe(false);
  });

  it('目录禁用和配置停用分别显示；更新只包含当前记录供应商与乐观锁', () => {
    expect(describeProviderConfiguration(true, { enable: true })).toBe(
      '目录禁用',
    );
    expect(describeProviderConfiguration(false, { enable: false })).toBe(
      '配置停用',
    );
    expect(describeProviderConfiguration(false, undefined)).toBe('未配置');
    const record = {
      id: 'setting',
      optimisticLock: 6,
      servicePluginProviderCode: 'DINGTALK_V2',
      value: { DINGTALK_V2: { enable: false } },
    };
    const update = buildProviderConfigurationUpdate(
      record,
      'DINGTALK_V2',
      { enable: false },
      false,
    );
    expect(update.value).toEqual({
      DINGTALK_V2: { enable: false },
    });
    expect(update.optimisticLock).toBe(6);
    expect(record.value).toEqual({ DINGTALK_V2: { enable: false } });
  });

  it('拒绝使用其它供应商编码更新当前行', () => {
    const record = {
      id: 'setting',
      optimisticLock: 8,
      servicePluginProviderCode: 'FEISHU',
      value: { FEISHU: { enable: false } },
    };
    expect(() =>
      buildProviderConfigurationUpdate(
        record,
        'DINGTALK_V2',
        { enable: true },
        false,
      ),
    ).toThrow('供应商编码与当前设置记录不一致');
  });
});
