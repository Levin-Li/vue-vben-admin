import { describe, expect, it } from 'vitest';
import {
  resolveActionButtonLabel,
  resolveActionButtonStyle,
} from '../crud-action-display';

describe('操作按钮展示', () => {
  it('正数设置按钮像素尺寸，非正数不指定', () => {
    expect(
      resolveActionButtonStyle({
        key: 'edit',
        label: '编辑',
        width: 120,
        minWidth: 0,
        maxWidth: -1,
      }),
    ).toMatchObject({
      width: '120px',
      minWidth: undefined,
      maxWidth: undefined,
    });
    expect(
      resolveActionButtonStyle({
        key: 'edit',
        label: '编辑',
        width: -1,
        minWidth: 80,
        maxWidth: 180,
        overflowStrategy: 'wrap',
      }),
    ).toMatchObject({
      width: undefined,
      minWidth: '80px',
      maxWidth: '180px',
      whiteSpace: 'normal',
      height: 'auto',
    });
  });
  it('脚本结果优先于标题别名，空值及失败回退别名', () => {
    const config = {
      key: 'edit',
      label: '编辑',
      title: '修改',
      valueDisplay: { mode: 'script' as const, expression: 'row.name' },
    };
    expect(resolveActionButtonLabel(config, '编辑', () => '动态名称')).toBe(
      '动态名称',
    );
    expect(resolveActionButtonLabel(config, '编辑', () => '')).toBe('修改');
    expect(
      resolveActionButtonLabel(config, '编辑', () => {
        throw new Error();
      }),
    ).toBe('修改');
    expect(resolveActionButtonLabel(undefined, '编辑', () => '')).toBe('编辑');
  });
});
