import type { CrudComplexGroupConfig, CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import { omitExcludedCrudFields } from '../crud-submit-fields';

const fields: [CrudFieldConfig, CrudFieldConfig, CrudFieldConfig] = [
  { key: 'hidden', label: '排除字段' },
  { key: 'secret', label: '私密信息', complexGroupKey: 'profile' },
  { key: 'name', label: '名称', complexGroupKey: 'profile' },
];
const groups: CrudComplexGroupConfig[] = [
  {
    key: 'profile',
    title: '个人信息',
    submitKey: 'profile',
    fieldMappings: { secret: 'secret', name: 'name' },
  },
];

describe('最终提交范围复核', () => {
  it('页面转换不能补回排除字段，保留允许值和技术标识', () => {
    const payload = {
      id: '1',
      optimisticLock: 2,
      hidden: '补回',
      priority: 7,
      forceUpdateFields: ['hidden', 'priority'],
    };
    expect(
      omitExcludedCrudFields(
        payload,
        [fields[0], { key: 'id', label: 'ID' }],
        [],
        ['id'],
      ),
    ).toEqual({
      id: '1',
      optimisticLock: 2,
      priority: 7,
      forceUpdateFields: ['priority'],
    });
    expect(payload.hidden).toBe('补回');
  });
  it('复杂映射只移除被排除子属性，不修改原值', () => {
    const payload = {
      secret: '扁平补回',
      profile: { name: '张三', secret: '嵌套补回' },
      forceUpdateFields: ['profile.secret', 'profile.name'],
    };
    expect(omitExcludedCrudFields(payload, [fields[1]], groups)).toEqual({
      profile: { name: '张三' },
      forceUpdateFields: ['profile.name'],
    });
    expect(payload.profile.secret).toBe('嵌套补回');
  });
  it('整个组取消时移除完整对象以及转换器附加内容', () => {
    expect(
      omitExcludedCrudFields(
        {
          profile: { name: '张三', injected: true },
          forceUpdateFields: ['profile', 'profile.name'],
        },
        fields.slice(1),
        groups,
      ),
    ).toEqual({ forceUpdateFields: [] });
  });
  it('点路径和地址映射不会因转换再次回到请求', () => {
    expect(
      omitExcludedCrudFields(
        {
          profile: { secret: '值', name: '名称' },
          'profile.secret': '值',
          cityName: '城市',
          cityCode: '1101',
          forceUpdateFields: ['profile.secret', 'cityCode', 'profile.name'],
        },
        [
          { key: 'profile.secret', label: '私密' },
          { key: 'area', label: '地区', type: 'area-cascader' },
        ],
      ),
    ).toEqual({
      profile: { name: '名称' },
      forceUpdateFields: ['profile.name'],
    });
  });
});
