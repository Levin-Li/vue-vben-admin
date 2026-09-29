import { describe, expect, it } from 'vitest';

import {
  addNode,
  createDefinition,
  definitionFingerprint,
  removeNode,
  validateDefinition,
} from './definition-model';

describe('流程设计结构', () => {
  it('服务端JSON键顺序不影响已保存配置比较', () => {
    expect(
      definitionFingerprint({ name: '流程', variables: { a: 1, b: 2 } }),
    ).toBe(definitionFingerprint({ variables: { b: 2, a: 1 }, name: '流程' }));
    expect(definitionFingerprint({ actions: ['approve', 'reject'] })).not.toBe(
      definitionFingerprint({ actions: ['reject', 'approve'] }),
    );
  });
  it('创建显式连线且不要求任何业务状态字段', () => {
    const value = createDefinition('review', '审核');
    expect(value.schemaVersion).toBe(2);
    expect(value.edges).toEqual([
      { id: 'start_end', source: 'start', target: 'end' },
    ]);
    expect(value.businessBinding).toBeUndefined();
  });

  it('删除后再次新增节点仍保持唯一标识和串行线路', () => {
    const value = createDefinition('review', '审核');
    const first = addNode(value, 'userTask');
    removeNode(value, first.id);
    const second = addNode(value, 'userTask');
    const third = addNode(value, 'userTask');
    expect(second.id).not.toBe(third.id);
    expect(value.edges?.some((edge) => edge.target === third.id)).toBe(true);
    expect(new Set(value.nodes.map((node) => node.id)).size).toBe(
      value.nodes.length,
    );
  });

  it('拒绝悬空连线、无法到达的节点和缺少审批人', () => {
    const value = createDefinition('review', '审核');
    const node = addNode(value, 'userTask');
    value.edges = [{ id: 'broken', source: 'start', target: 'missing' }];
    const messages = validateDefinition(value);
    expect(messages.join(',')).toContain('连线');
    expect(messages.join(',')).toContain(node.name);
    expect(messages.join(',')).toContain('候选');
  });

  it('字段映射不能引用能力目录之外的字段', () => {
    const value = createDefinition('review', '审核');
    value.purposeKey = 'review';
    value.businessBinding = {
      businessType: 'order',
      contractVersion: 1,
      identityField: 'secret',
      titleField: 'title',
    };
    const messages = validateDefinition(value, {
      businessTypes: [
        {
          businessType: 'order',
          contractVersion: 1,
          title: '订单',
          fields: { title: { title: '标题', type: 'string' } },
        },
      ],
    });
    expect(messages.join(',')).toContain('secret');
  });

  it('组合依赖可以使用OR但不能隐藏自依赖或未知变量', () => {
    const value = createDefinition('sign', '签署');
    value.purposeKey = 'sign';
    value.dependencies = {
      any: [
        {
          dependency: {
            purposeKey: 'sign',
            outcome: 'Approved',
            effects: 'Applied',
            round: 'current',
          },
        },
        { eq: [{ variable: 'missing' }, { literal: true }] },
      ],
    };
    const messages = validateDefinition(value);
    expect(messages.join(',')).toContain('不能依赖自身');
    expect(messages.join(',')).toContain('未知变量');
  });

  it('可写表单缺少受控业务操作时阻断设计验证', () => {
    const value = createDefinition('review', '审批');
    const node = addNode(value, 'userTask');
    node.candidateUsers = ['user'];
    node.readableFields = ['note'];
    node.editableFields = ['note'];
    expect(validateDefinition(value).join(',')).toContain(
      '必须绑定已公开的保存业务操作',
    );
  });

  it('多人审批不能混用候选组或只有一名用户', () => {
    const value = createDefinition('review', '审批');
    const node = addNode(value, 'userTask');
    node.multiApprovalMode = 'ALL';
    node.candidateUsers = ['user'];
    node.candidateGroups = ['role:approver'];
    expect(validateDefinition(value).join(',')).toContain('至少两名明确用户');
  });
});
