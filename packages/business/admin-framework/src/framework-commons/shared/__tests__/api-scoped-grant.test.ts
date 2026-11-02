import { describe, expect, it } from 'vitest';

import {
  mergedApiScopedGrant,
  parseApiScopedGrant,
  projectOperationPermission,
  serializeApiScopedGrant,
  updateApiScopedGrant,
} from '../api-scoped-grant';
import {
  collectPermissionValues,
  mergeUnmappedPermissions,
  splitMappedAndUnmappedPermissions,
} from '../data-permission-transform';

const operation = 'com.levin.oak.base:系统数据-用户::*';

describe('接口复合授权', () => {
  it('一条授权包含多个组、枚举来源和字典来源字段', () => {
    const expression = `@${operation}:@销售信息@财务信息|enum#com.levin.oak.base.entities.User$Type#type@Customer@Supplier|dict#region-dict#region@East`;
    expect(parseApiScopedGrant(expression)).toEqual({
      operation,
      groups: ['销售信息', '财务信息'],
      values: {
        'enum#com.levin.oak.base.entities.User$Type#type': [
          'Customer',
          'Supplier',
        ],
        'dict#region-dict#region': ['East'],
      },
    });
    expect(projectOperationPermission(expression)).toBe(operation);
  });

  it('普通权限和历史六段枚举值许可保持原样', () => {
    for (const expression of [
      '*',
      'R_ADMIN',
      operation,
      'example:业务数据:合作伙伴:@value:field:Customer',
    ]) {
      expect(parseApiScopedGrant(expression)).toBeUndefined();
      expect(projectOperationPermission(expression)).toBe(expression);
    }
  });

  it('编辑组和值时合并为一条授权并保留其它权限', () => {
    const old = ['R_ADMIN', operation, 'legacy:DataAttrGroup:key:access'];
    const next = updateApiScopedGrant(old, operation, (grant) => ({
      ...grant,
      groups: ['财务信息'],
      values: {
        'enum#com.levin.oak.base.entities.User$Type#type': [
          'Customer',
          'Supplier',
        ],
      },
    }));
    expect(next).toEqual([
      'R_ADMIN',
      'legacy:DataAttrGroup:key:access',
      `@${operation}:@财务信息|enum#com.levin.oak.base.entities.User$Type#type@Customer@Supplier`,
    ]);
    expect(serializeApiScopedGrant({ operation, groups: [], values: {} })).toBe(
      operation,
    );
  });

  it('历史同接口多条授权编辑时不丢失其它组和值', () => {
    const old = [
      `@${operation}:@财务信息|enum#Type#kind@A`,
      `@${operation}:@销售信息|enum#Type#kind@B`,
    ];
    expect(mergedApiScopedGrant(old, operation)).toEqual({
      operation,
      groups: ['财务信息', '销售信息'],
      values: { 'enum#Type#kind': ['A', 'B'] },
    });
    expect(
      updateApiScopedGrant(old, operation, (grant) => ({
        ...grant,
        groups: grant.groups.filter((group) => group !== '销售信息'),
      })),
    ).toEqual([`@${operation}:@财务信息|enum#Type#kind@A@B`]);
  });

  it('角色保存保留历史未知授权且不会重复保存操作权限', () => {
    const scoped = `@${operation}:@财务信息|dict#user.type#type@Customer`;
    const legacy = 'legacy:DataAttrGroup:old:access';
    const tree = [
      {
        id: 'list',
        name: '查询列表',
        nodeType: 'Action' as const,
        permissionExpr: operation,
      },
    ];
    const state = splitMappedAndUnmappedPermissions([scoped, legacy], [], tree);
    expect(state).toEqual({ mapped: [scoped], unmapped: [legacy] });
    expect(
      mergeUnmappedPermissions(
        collectPermissionValues(state.mapped),
        state.unmapped,
      ),
    ).toEqual([scoped, legacy]);
  });

  it('拒绝无效或含糊条款', () => {
    for (const expression of [
      `@${operation}:`,
      `@${operation}:enum#source#type@`,
      `@${operation}:enum#source#type@A|enum#source#type@B`,
      `@${operation}:@组|@另一组`,
      `@${operation}:enum#source#type@A:B`,
      `@${operation}:type@A`,
      `@${operation}:other#source#type@A`,
    ]) {
      expect(() => parseApiScopedGrant(expression)).toThrow();
    }
  });
});
