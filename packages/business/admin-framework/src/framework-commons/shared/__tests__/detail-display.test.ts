import { describe, expect, it } from 'vitest';

import {
  buildDetailDisplayEntries,
  flattenCrudComplexDetailRecord,
  formatDetailDisplayValue,
  resolveDetailFields,
  isDetailJsonValue,
} from '../detail-display';

const fields = [
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '启用', value: 'enabled' },
      { label: '禁用', value: 'disabled' },
    ],
    type: 'select',
  },
  {
    key: 'levels',
    label: '级别',
    multiple: true,
    options: [
      { label: '一级', value: 1 },
      { label: '二级', value: 2 },
    ],
    type: 'select',
  },
  { key: 'tags', label: '标签', type: 'tags' },
  { key: 'setting', label: '设置', type: 'json' },
  { fullRow: true, key: 'mfaQrCode', label: 'MFA二维码', type: 'qrcode' },
  { key: 'plainList', label: '普通列表' },
  { key: 'complexList', label: '复杂列表' },
] as any[];

describe('detail display rules', () => {
  it('将已声明的嵌套对象展开为详情子字段，保留其它响应字段', () => {
    const result = flattenCrudComplexDetailRecord(
      {
        id: 'P-1',
        legalInfo: { name: '张三', mobilePhone: '13800000000' },
        shippingInfo: null,
      },
      [
        {
          key: 'legal',
          title: '法人信息',
          submitKey: 'legalInfo',
          fieldMappings: { legalName: 'name', legalPhone: 'mobilePhone' },
        },
        {
          key: 'shipping',
          title: '邮寄信息',
          submitKey: 'shippingInfo',
          fieldMappings: { shippingAddress: 'address' },
        },
      ],
    );
    expect(result).toEqual({
      id: 'P-1',
      legalName: '张三',
      legalPhone: '13800000000',
    });
  });

  it('按完整路径展开四层详情对象而不重复显示原始 JSON', () => {
    const result = flattenCrudComplexDetailRecord(
      {
        id: 'D-1',
        nestedObject: {
          title: '一级',
          levelTwo: {
            name: '二级',
            levelThree: { label: '三级', levelFour: { value: '四级' } },
          },
        },
      },
      [
        {
          key: 'one',
          title: '第一层',
          submitKey: 'nestedObject',
          fieldMappings: { oneTitle: 'title' },
        },
        {
          key: 'two',
          parentKey: 'one',
          title: '第二层',
          submitKey: 'nestedObject.levelTwo',
          fieldMappings: { twoName: 'name' },
        },
        {
          key: 'three',
          parentKey: 'two',
          title: '第三层',
          submitKey: 'nestedObject.levelTwo.levelThree',
          fieldMappings: { threeLabel: 'label' },
        },
        {
          key: 'four',
          parentKey: 'three',
          title: '第四层',
          submitKey: 'nestedObject.levelTwo.levelThree.levelFour',
          fieldMappings: { fourValue: 'value' },
        },
      ],
    );

    expect(result).toEqual({
      id: 'D-1',
      oneTitle: '一级',
      twoName: '二级',
      threeLabel: '三级',
      fourValue: '四级',
    });
  });

  it('keeps configured scalar fields and formats enum/dict/fixed option labels', () => {
    const entries = buildDetailDisplayEntries(
      {
        levels: [1, 2],
        profile: { name: 'Nested' },
        status: 'enabled',
      },
      fields,
    );

    const [statusEntry, levelsEntry] = entries;

    expect(entries.map((entry) => entry.key)).toEqual(['status', 'levels']);
    expect(levelsEntry).toBeDefined();
    expect(statusEntry).toBeDefined();
    if (!levelsEntry || !statusEntry) {
      throw new Error('Expected detail entries to be created');
    }
    expect(formatDetailDisplayValue(levelsEntry)).toBe('一级, 二级');
    expect(formatDetailDisplayValue(statusEntry)).toBe('启用');
  });

  it('orders detail entries by the same coordinated form layout rules', () => {
    const entries = buildDetailDisplayEntries(
      {
        allowedIpList: ['10.0.*'],
        allowedPathPatterns: ['/api/*'],
        editable: true,
        exInfo: { level: 1 },
        orderCode: 100,
      },
      [
        {
          key: 'exInfo',
          label: '扩展信息',
          layoutGroup: 'extension',
          layoutNewRow: true,
          type: 'json',
        },
        {
          key: 'orderCode',
          label: '排序代码',
          layoutGroup: 'business',
          layoutOrder: 30,
          type: 'number',
        },
        {
          key: 'editable',
          label: '是否可编辑',
          layoutGroup: 'business',
          layoutOrder: 40,
          type: 'switch',
        },
        {
          key: 'allowedPathPatterns',
          label: '允许访问路径',
          layoutGroup: 'business',
          layoutNewRow: true,
          layoutOrder: 10,
          type: 'tags',
        },
        {
          key: 'allowedIpList',
          label: '允许访问IP',
          layoutGroup: 'business',
          layoutOrder: 20,
          type: 'tags',
        },
      ] as any[],
    );

    expect(entries.map((entry) => entry.key)).toEqual([
      'exInfo',
      'allowedPathPatterns',
      'allowedIpList',
      'orderCode',
      'editable',
    ]);
  });

  it('keeps explicit JSON values and marks them for Json Viewer', () => {
    const entries = buildDetailDisplayEntries(
      {
        setting: { auth: { enabled: true } },
      },
      fields,
    );

    expect(entries).toHaveLength(1);
    const [entry] = entries;

    expect(entry).toBeDefined();
    expect(entry?.kind).toBe('json');
    expect(entry && isDetailJsonValue(entry)).toBe(true);
    expect(entry && formatDetailDisplayValue(entry)).toBe(
      '{"auth":{"enabled":true}}',
    );
  });

  it('marks explicitly configured QR fields without treating their URI as text', () => {
    const [entry] = buildDetailDisplayEntries(
      {
        mfaQrCode: 'otpauth://totp/example?secret=ABC',
      },
      fields,
    );

    expect(entry).toMatchObject({
      key: 'mfaQrCode',
      kind: 'qrcode',
      label: 'MFA二维码',
    });
  });

  it('keeps primitive arrays but filters complex object arrays by default', () => {
    const entries = buildDetailDisplayEntries(
      {
        complexList: [{ id: 1 }],
        plainList: ['a', 2, true],
      },
      fields,
    );

    expect(entries.map((entry) => entry.key)).toEqual(['plainList']);
    const [entry] = entries;

    expect(entry).toBeDefined();
    expect(entry && formatDetailDisplayValue(entry)).toBe('a, 2, 是');
  });

  it('does not show unconfigured complex values in detail pages', () => {
    const entries = buildDetailDisplayEntries(
      {
        createdAt: '2026-05-20T15:00:00',
        metadata: { unsafe: true },
      },
      fields,
    );

    expect(entries.map((entry) => entry.key)).toEqual(['createdAt']);
    const [entry] = entries;

    expect(entry).toBeDefined();
    expect(entry && formatDetailDisplayValue(entry)).toBe(
      '2026-05-20 15:00:00',
    );
  });
  it('已隐藏的配置字段不回退显示，无配置结果字段保持原语义', () => {
    const known = [
      { key: 'name', label: '名称' },
      { key: 'secret', label: '隐藏信息' },
    ];
    const entries = buildDetailDisplayEntries(
      { name: '示例', secret: '不可显示', result: '操作结果' },
      known.slice(0, 1),
      known,
    );
    expect(entries.map((entry) => entry.key)).toEqual(['name', 'result']);
    expect(
      buildDetailDisplayEntries({ secret: '不可显示' }, [], known),
    ).toEqual([]);
  });
  it('默认展示空值，关闭后过滤空标量、数组和显式空 JSON', () => {
    const configured = [
      { key: 'json', label: 'JSON', type: 'json' as const },
      { key: 'jsonText', label: 'JSON文本', type: 'json' as const },
      { key: 'jsonList', label: 'JSON数组', type: 'json' as const },
    ];
    const data = {
      nil: null,
      missing: undefined,
      empty: '',
      blank: '  ',
      array: [],
      json: {},
      jsonText: ' {} ',
      jsonList: '[]',
      zero: 0,
      no: false,
      text: '{}',
      unknownObject: {},
    };
    const all = buildDetailDisplayEntries(data, configured);
    expect(all.map((entry) => entry.key)).toEqual(
      expect.arrayContaining([
        'nil',
        'missing',
        'empty',
        'blank',
        'array',
        'json',
        'jsonText',
        'jsonList',
        'zero',
        'no',
        'text',
      ]),
    );
    expect(all.some((entry) => entry.key === 'unknownObject')).toBe(false);
    expect(
      buildDetailDisplayEntries(data, configured, configured, false).map(
        (entry) => entry.key,
      ),
    ).toEqual(['zero', 'no', 'text']);
  });
  it('详情仅来自响应或声明契约，查询配置只补充同名元数据', () => {
    const metadata = [
      { key: 'containsName', label: '名称', form: false, search: true },
      { key: 'name', label: '名称' },
      { key: 'id', label: 'ID', form: false },
    ];
    expect(
      resolveDetailFields({ id: 1, name: '示例' }, metadata).map(
        (field) => field.key,
      ),
    ).toEqual(['id', 'name']);
    expect(
      resolveDetailFields(undefined, metadata).map((field) => field.key),
    ).toEqual(['name', 'id']);
    expect(resolveDetailFields(undefined, metadata, [metadata[1]])).toEqual([
      metadata[1],
    ]);
    expect(resolveDetailFields({ returnedOnly: true }, metadata)).toEqual([
      { key: 'returnedOnly', label: 'returnedOnly' },
    ]);
    expect(
      resolveDetailFields(
        { containsName: '接口确实返回该字段', name: '示例' },
        metadata,
      ).map((field) => field.key),
    ).toEqual(['containsName', 'name']);
  });
});
