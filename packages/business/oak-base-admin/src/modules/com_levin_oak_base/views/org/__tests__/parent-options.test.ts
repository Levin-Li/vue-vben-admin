import { describe, expect, it } from 'vitest';

import { orgPageCrudConfig } from '../config';
import { disableParentSubtree } from '../parent-options';

describe('上级组织选择', () => {
  it('禁止自身及所有后代，保留其他授权组织和原数据', () => {
    const nodes = [
      { id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] },
      { id: 'd' },
    ];
    const result = disableParentSubtree(nodes, 'b');
    expect(result[0]?.disabled).toBe(false);
    expect(result[0]?.children[0].disabled).toBe(true);
    expect(result[0]?.children[0].children[0].disabled).toBe(true);
    expect(result[1]?.disabled).toBe(false);
    expect(nodes[0]?.children?.[0]).not.toHaveProperty('disabled');
  });

  it('授权树缺少当前组织时禁止选择，避免未知后代形成环', () => {
    expect(
      disableParentSubtree([{ id: 'child' }], 'missing')[0]?.disabled,
    ).toBe(true);
  });

  it('仅后端用户信息明确管理员时允许更改上级组织', () => {
    const field = orgPageCrudConfig.fields.find(
      (item) => item.key === 'parentId',
    );
    if (typeof field?.disabledOnEdit !== 'function')
      throw new Error('缺少编辑权限限制');
    expect(field.disabledOnEdit({ userInfo: { admin: true } })).toBe(false);
    expect(
      field.disabledOnEdit({ userInfo: { roles: ['R_PLATFORM_SA'] } }),
    ).toBe(true);
  });
});
