import { reactive } from 'vue';

import { describe, expect, it } from 'vitest';

import { snapshotCrudFormValues } from '../crud-form-snapshot';

// 快照与原输入独立，比较业务值而非输入事件或响应式对象身份。
describe('表单关闭的业务值快照', () => {
  it('嵌套修改可识别，恢复原值后与初始基准一致', () => {
    const values = reactive({ config: { name: '原值' } });
    const initial = snapshotCrudFormValues(values);
    values.config.name = '新值';
    expect(snapshotCrudFormValues(values)).not.toBe(initial);
    values.config.name = '原值';
    expect(snapshotCrudFormValues(values)).toBe(initial);
  });

  it('对象和 JSON 的键顺序变化不算业务修改', () => {
    expect(snapshotCrudFormValues({ config: { a: 1, b: 2 } })).toBe(
      snapshotCrudFormValues({ config: { b: 2, a: 1 } }),
    );
    const jsonKeys = new Set(['config']);
    expect(snapshotCrudFormValues({ config: '{"b":2,"a":1}' }, jsonKeys)).toBe(
      snapshotCrudFormValues({ config: { a: 1, b: 2 } }, jsonKeys),
    );
  });

  it('数组顺序、空字符串、null、undefined 和类型均保留差异', () => {
    expect(snapshotCrudFormValues({ list: [1, 2] })).not.toBe(
      snapshotCrudFormValues({ list: [2, 1] }),
    );
    const snapshots = ['', null, undefined, false, 0, '0'].map((value) =>
      snapshotCrudFormValues({ value }),
    );
    expect(new Set(snapshots).size).toBe(snapshots.length);
  });

  it('普通文本和富文本不按 JSON 或空白等价转换', () => {
    expect(snapshotCrudFormValues({ text: '{"a":1}' })).not.toBe(
      snapshotCrudFormValues({ text: '{ "a": 1 }' }),
    );
    expect(snapshotCrudFormValues({ text: '<p>文字</p>' })).not.toBe(
      snapshotCrudFormValues({ text: '<p>文字 </p>' }),
    );
  });

  it('尚未完成的 JSON 保留原文本供修改比较', () => {
    const keys = new Set(['json']);
    expect(snapshotCrudFormValues({ json: '{' }, keys)).not.toBe(
      snapshotCrudFormValues({ json: '{}' }, keys),
    );
  });

  it('日期控件的新实例只按相同时间或序列化值比较', () => {
    expect(snapshotCrudFormValues({ date: new Date('2026-10-19') })).toBe(
      snapshotCrudFormValues({ date: new Date('2026-10-19') }),
    );
    const dateControl = (internal: number) => ({
      internal,
      toJSON: () => '2026-10-19T00:00:00.000Z',
    });
    expect(snapshotCrudFormValues({ date: dateControl(1) })).toBe(
      snapshotCrudFormValues({ date: dateControl(2) }),
    );
  });

  it('文件保留原对象身份，同名同大小的不同内容仍是修改', () => {
    const original = new File(['a'], 'test.txt', { lastModified: 1 });
    const replacement = new File(['b'], 'test.txt', { lastModified: 1 });
    const initial = snapshotCrudFormValues({ file: original });
    expect(snapshotCrudFormValues(reactive({ file: original }))).toBe(initial);
    expect(snapshotCrudFormValues({ file: replacement })).not.toBe(initial);
  });
});
