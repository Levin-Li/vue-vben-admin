import { describe, expect, it } from 'vitest';

import {
  buildListOperationCandidates,
  DEFAULT_LIST_OPERATIONS,
  getListOperationKey,
  isListOperationVisible,
} from '../crud-list-operations';

// 固定标识与去重是保存配置的边界，按钮改名不能产生新的配置身份。
describe('列表操作登记', () => {
  it('登记八个内置入口及其左右位置', () => {
    expect(DEFAULT_LIST_OPERATIONS).toEqual([
      { key: 'builtin:create', label: '新增', placement: 'left' },
      { key: 'tool:export', label: '导出', placement: 'right' },
      { key: 'tool:import', label: '导入', placement: 'right' },
      { key: 'tool:refresh', label: '刷新', placement: 'right' },
      { key: 'tool:fullscreen', label: '全屏', placement: 'right' },
      { key: 'tool:columns', label: '列设置', placement: 'right' },
      { key: 'settings:display', label: '页面展示设置', placement: 'right' },
      { key: 'settings:display-v2', label: '展示设置2', placement: 'right' },
    ]);
  });

  it('仅使用去空白的显式标识，缺失标识时不退回名称', () => {
    expect(getListOperationKey({ displayKey: ' publish ' }, 'toolbar')).toBe(
      'toolbar:publish',
    );
    expect(getListOperationKey({ displayKey: 'publish' }, 'batch')).toBe(
      'batch:publish',
    );
    expect(getListOperationKey({}, 'toolbar')).toBeUndefined();
    expect(getListOperationKey({ displayKey: '  ' }, 'batch')).toBeUndefined();

    const before = buildListOperationCandidates(
      [{ displayKey: 'publish', label: '发布' }],
      [],
    );
    const after = buildListOperationCandidates(
      [{ displayKey: 'publish', label: '立即发布' }],
      [],
    );
    expect(after.map((item) => item.key)).toEqual(
      before.map((item) => item.key),
    );
    expect(after.at(-1)?.label).toBe('立即发布');
  });

  it('合并左右扩展并按键去重，扩展不能覆盖内置或已登记操作', () => {
    const extra = [
      { key: 'tool:export', label: '伪造导出', placement: 'left' as const },
      {
        key: 'toolbar:publish',
        label: '重复发布',
        placement: 'right' as const,
      },
      { key: 'extension:help', label: '帮助', placement: 'right' as const },
      { key: 'extension:help', label: '重复帮助', placement: 'left' as const },
    ];
    const candidates = buildListOperationCandidates(
      [
        { displayKey: 'publish', label: '发布' },
        { displayKey: 'publish', label: '第二个发布' },
        { label: '未登记操作' },
      ],
      [{ displayKey: 'publish', label: '批量发布' }],
      extra,
    );
    expect(candidates).toEqual([
      ...DEFAULT_LIST_OPERATIONS,
      { key: 'toolbar:publish', label: '发布', placement: 'left' },
      { key: 'batch:publish', label: '批量发布', placement: 'left' },
      { key: 'extension:help', label: '帮助', placement: 'right' },
    ]);

    const first = candidates[0];
    const last = candidates.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first) first.label = '草稿名称';
    if (last) last.label = '帮助草稿';
    expect(DEFAULT_LIST_OPERATIONS[0]?.label).toBe('新增');
    expect(extra[2]?.label).toBe('帮助');
  });
});

// 原权限、业务条件和选中要求由调用者合成为 baseVisible，脚本只追加限制。
describe('列表操作附加显示条件', () => {
  const base = { baseVisible: true, context: {}, key: 'tool:export' };

  it('未配置、空白和显式 true 默认保留原展示', () => {
    expect(isListOperationVisible(base)).toBe(true);
    for (const expression of [undefined, '', '   ', 'true']) {
      expect(
        isListOperationVisible({
          ...base,
          config: { 'tool:export': { expression } },
        }),
      ).toBe(true);
    }
  });

  it('false、语法错误、未知变量及危险调用都隐藏', () => {
    for (const expression of [
      'false',
      '(',
      'unknown',
      'user.constructor',
      'f()',
    ]) {
      expect(
        isListOperationVisible({
          ...base,
          context: { user: {} },
          config: { 'tool:export': { expression } },
        }),
      ).toBe(false);
    }
  });

  it('用显式列表身份上下文求值，不注入首条记录', () => {
    const config = {
      'tool:export': {
        expression: 'user.id === "u1" && org.id === "o1" && tenant.id === "t1"',
      },
    };
    expect(
      isListOperationVisible({
        ...base,
        config,
        context: {
          user: { id: 'u1' },
          org: { id: 'o1' },
          tenant: { id: 't1' },
        },
      }),
    ).toBe(true);
    expect(
      isListOperationVisible({
        ...base,
        config,
        context: {
          user: { id: 'u2' },
          org: { id: 'o1' },
          tenant: { id: 't1' },
        },
      }),
    ).toBe(false);
    expect(
      isListOperationVisible({
        ...base,
        config: { 'tool:export': { expression: 'row.id === "first"' } },
      }),
    ).toBe(false);
  });

  it('原条件为假时始终隐藏，包括超管设置入口', () => {
    for (const key of [
      'tool:export',
      'settings:display',
      'settings:display-v2',
    ]) {
      expect(
        isListOperationVisible({
          ...base,
          key,
          baseVisible: false,
          isSuperAdmin: true,
          config: { [key]: { expression: 'true' } },
        }),
      ).toBe(false);
    }
  });

  it('超管仅保护两个固定设置入口，其他按钮及非超管仍受脚本约束', () => {
    for (const key of ['settings:display', 'settings:display-v2']) {
      for (const expression of ['false', '(']) {
        const config = { [key]: { expression } };
        expect(
          isListOperationVisible({ ...base, key, config, isSuperAdmin: true }),
        ).toBe(true);
        expect(
          isListOperationVisible({ ...base, key, config, isSuperAdmin: false }),
        ).toBe(false);
      }
    }
    for (const key of [
      'tool:export',
      'settings:custom',
      'settings:display-v3',
    ]) {
      expect(
        isListOperationVisible({
          ...base,
          key,
          isSuperAdmin: true,
          config: { [key]: { expression: 'false' } },
        }),
      ).toBe(false);
    }
  });
});
