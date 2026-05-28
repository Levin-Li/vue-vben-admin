import { describe, expect, it } from 'vitest';

import {
  buildDetailDisplayEntries,
  formatDetailDisplayValue,
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
  { key: 'plainList', label: '普通列表' },
  { key: 'complexList', label: '复杂列表' },
] as any[];

describe('detail display rules', () => {
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
      'allowedPathPatterns',
      'allowedIpList',
      'orderCode',
      'editable',
      'exInfo',
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
});
