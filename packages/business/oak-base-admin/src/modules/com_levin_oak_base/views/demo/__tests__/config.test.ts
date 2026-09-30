import { buildCrudComplexGroupPayload } from '@levin/admin-framework/framework-commons/shared/crud-complex-groups';
import { describe, expect, it, vi } from 'vitest';

import { demoPageCrudConfig } from '../config';

vi.mock('../../../api/demo-service', () => ({ demoService: {} }));
vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
}));

describe('demo 四层对象页面配置', () => {
  it('以完整提交路径声明四级对象和每层普通字段', () => {
    expect(
      demoPageCrudConfig.complexGroups?.map((group) => ({
        key: group.key,
        parentKey: group.parentKey,
        submitKey: group.submitKey,
      })),
    ).toEqual([
      { key: 'nestedOne', parentKey: undefined, submitKey: 'nestedObject' },
      {
        key: 'nestedTwo',
        parentKey: 'nestedOne',
        submitKey: 'nestedObject.levelTwo',
      },
      {
        key: 'nestedThree',
        parentKey: 'nestedTwo',
        submitKey: 'nestedObject.levelTwo.levelThree',
      },
      {
        key: 'nestedFour',
        parentKey: 'nestedThree',
        submitKey: 'nestedObject.levelTwo.levelThree.levelFour',
      },
    ]);
    expect(
      demoPageCrudConfig.complexGroups?.map(
        (group) => Object.keys(group.fieldMappings).length,
      ),
    ).toEqual([6, 5, 6, 6]);
    expect(
      demoPageCrudConfig.fields.some((field) => field.key === 'nestedObject'),
    ).toBe(false);
  });

  it('按后端注解配置必填、长度和混合类型，不改变普通示例字段', () => {
    const field = (key: string) =>
      demoPageCrudConfig.fields.find((item) => item.key === key);

    expect(field('nestedOneTitle')).toMatchObject({
      required: true,
      maxLength: 80,
    });
    expect(field('nestedTwoCategory')).toMatchObject({
      required: true,
      type: 'select',
      valueType: 'string',
    });
    expect(field('nestedThreePhase')).toMatchObject({
      required: true,
      type: 'select',
      valueType: 'string',
    });
    expect(field('nestedThreeEventTime')).toMatchObject({
      required: true,
      type: 'datetime',
    });
    expect(field('nestedOneSortOrder')).toMatchObject({
      type: 'number',
      valueType: 'number',
    });
    expect(field('nestedOneSortOrder')?.validator?.(-1, {})).toBe(
      '请输入非负整数',
    );
    expect(field('nestedFourEnabled')).toMatchObject({
      required: true,
      type: 'switch',
      valueType: 'boolean',
    });
    expect(field('jsonData')).toMatchObject({ type: 'json' });
    expect(field('imageUrl')).toMatchObject({ type: 'image' });
    expect(demoPageCrudConfig.defaultFormValues).toMatchObject({
      editable: false,
      enable: true,
      num: 99,
      orderCode: 1000,
      orgShared: false,
      tenantShared: false,
    });
  });

  it('普通业务字段以创建请求为基准，排除审计和请求技术字段', () => {
    const keys = new Set(demoPageCrudConfig.fields.map((field) => field.key));
    for (const key of [
      'qrCode',
      'mobile',
      'email',
      'location',
      'areaCode',
      'timeRange',
      'treeOrg',
      'url',
      'imageUrl',
      'imageUrls',
      'fileUrl',
      'pdfFileUrl',
      'num',
      'localDateTime',
      'localDate',
      'localTime',
      'htmlData',
      'jsonData',
      'jsCode',
      'cssCode',
      'slider',
      'transfer',
      'conditionData',
      'multiSelect',
      'singleSelect',
      'tenantShared',
      'orgShared',
      'orderCode',
      'enable',
      'editable',
      'remark',
    ]) {
      expect(keys.has(key), key).toBe(true);
    }
    for (const key of [
      'creator',
      'createTime',
      'lastUpdateTime',
      'optimisticLock',
    ]) {
      expect(keys.has(key), key).toBe(false);
    }
    for (const field of demoPageCrudConfig.fields.filter(
      (item) => item.complexGroupKey,
    )) {
      expect(field.search, field.key).toBeFalsy();
    }
  });

  it('四层样例序列化为一个真实请求对象', () => {
    const enabled = Object.fromEntries(
      (demoPageCrudConfig.complexGroups || []).map((group) => [
        group.key,
        true,
      ]),
    );
    const payload = buildCrudComplexGroupPayload(
      demoPageCrudConfig.complexGroups,
      enabled,
      {
        nestedOneTitle: '一级',
        nestedOneSortOrder: 12,
        nestedTwoName: '二级',
        nestedTwoCategory: 'Priority',
        nestedThreeLabel: '三级',
        nestedThreePhase: 'Processing',
        nestedThreeEventTime: '2026-09-30T08:00:00',
        nestedFourValue: '四级',
        nestedFourEnabled: false,
      },
    );

    expect(payload).toMatchObject({
      nestedObject: {
        title: '一级',
        sortOrder: 12,
        levelTwo: {
          name: '二级',
          category: 'Priority',
          levelThree: {
            label: '三级',
            phase: 'Processing',
            eventTime: '2026-09-30T08:00:00',
            levelFour: { value: '四级', enabled: false },
          },
        },
      },
    });
    expect(Object.hasOwn(payload, 'nestedObject.levelTwo')).toBe(false);
  });
});
