import { describe, expect, it } from 'vitest';
import type { DataAttrPolicy } from '../../data-attr-policy';
import { ownershipAccess, ownershipFieldAllowed } from '../party-ownership-policy';

function policy(allowed: boolean): DataAttrPolicy {
  return {
    id: 'operation', operation: 'operation', methods: ['PUT'], pathPatterns: ['/ownership'], restricted: true,
    groups: [{ id: 'business', name: '商务', allowed }],
    requestRoots: [{ location: 'body', nodeId: 'model', parameterIndex: 0 }],
    viewRoots: { request: ['model'], response: ['model'] },
    nodes: { model: { kind: 'object', fields: [
      { name: 'businessOrgId', wireName: 'businessOrgId', nodeId: 'value', groupIds: ['business'] },
      { name: 'ungrouped', wireName: 'ungrouped', nodeId: 'value' },
    ] }, value: { kind: 'value' } },
  };
}

describe('动态归属字段策略', () => {
  it('只允许已声明并授权的字段，未知和未分组字段失败关闭', () => {
    expect(ownershipFieldAllowed(policy(true), 'input', 'businessOrgId')).toBe(true);
    expect(ownershipFieldAllowed(policy(false), 'input', 'businessOrgId')).toBe(false);
    expect(ownershipFieldAllowed(policy(true), 'input', 'missing')).toBe(false);
    expect(ownershipFieldAllowed(policy(true), 'input', 'ungrouped')).toBe(false);
    expect(ownershipFieldAllowed(undefined, 'input', 'businessOrgId')).toBe(false);
  });
  it('绑定和调整分别消费各自的操作与字段授权', () => {
    const access = ownershipAccess(policy(true), policy(true), policy(false), { bind: true, adjust: true });
    expect(access.canRead('businessOrgId')).toBe(true);
    expect(access.canWrite('bind', 'businessOrgId')).toBe(true);
    expect(access.canWrite('adjust', 'businessOrgId')).toBe(false);
    expect(ownershipAccess(policy(true), policy(true), policy(true), { bind: false, adjust: true })
      .canWrite('bind', 'businessOrgId')).toBe(false);
  });
});
