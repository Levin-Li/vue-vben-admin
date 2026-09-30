import { describe, expect, it } from 'vitest';

import {
  addNode,
  createDefinition,
  createTreeDefinition,
  definitionFingerprint,
  removeNode,
  validateDefinition,
  validateTreeDefinition,
} from './definition-model';

describe('流程设计结构', () => {
  it('新建 v3 草稿仅持有一棵连通树，严格执行门禁另行判断业务绑定', () => {
    const tree = createTreeDefinition('review', '审核');
    expect(tree.schemaVersion).toBe(3);
    expect(tree.flowTree).toMatchObject({
      id: 'start',
      nextEdgeId: 'start_end',
      nextTargetId: 'end',
      next: { id: 'end', outcome: 'Approved' },
    });
    expect(tree).not.toHaveProperty('nodes');
    expect(tree).not.toHaveProperty('edges');
    expect(validateTreeDefinition(tree)).toContain('请填写业务用途标识。');
  });
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

  it('在选定排他分支连线上插入审批节点，不改动另一分支或默认条件', () => {
    const value = createDefinition('review', '审核');
    value.nodes.splice(1, 0, {
      id: 'choice',
      name: '判断',
      type: 'exclusiveGateway',
    });
    value.nodes.push({ id: 'reject', name: '拒绝结束', type: 'end' });
    value.edges = [
      { id: 'start_choice', source: 'start', target: 'choice' },
      {
        id: 'choice_approve',
        source: 'choice',
        target: 'end',
        condition: { exists: { variable: 'ready' } },
      },
      {
        id: 'choice_reject',
        source: 'choice',
        target: 'reject',
        default: true,
      },
    ];

    // 选择默认出口时只拆该边，网关默认判断仍在原边上，新后继边不复制标记。
    const inserted = addNode(value, 'userTask', 'choice_reject');
    expect(value.edges).toEqual([
      { id: 'start_choice', source: 'start', target: 'choice' },
      {
        id: 'choice_approve',
        source: 'choice',
        target: 'end',
        condition: { exists: { variable: 'ready' } },
      },
      {
        id: 'choice_reject',
        source: 'choice',
        target: inserted.id,
        default: true,
      },
      { id: `${inserted.id}_reject`, source: inserted.id, target: 'reject' },
    ]);
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

  it('动态审批人只接受当前契约目录及类型化参数，允许与固定用户合并', () => {
    const value = createDefinition('review', '审批');
    value.purposeKey = 'review';
    value.businessBinding = {
      businessType: 'request',
      contractVersion: 2,
      identityField: 'id',
      titleField: 'title',
    };
    const node = addNode(value, 'userTask');
    node.candidateUsers = ['user:reviewer'];
    node.multiApprovalMode = 'ALL';
    node.approverResolver = {
      key: 'departmentLead',
      parameters: { level: { literal: 2 } },
    };
    const options = {
      businessTypes: [
        {
          businessType: 'request',
          contractVersion: 2,
          title: '申请',
          fields: {
            id: { title: '标识', type: 'string' as const },
            title: { title: '标题', type: 'string' as const },
          },
          approverResolvers: {
            departmentLead: {
              title: '部门负责人',
              parameters: {
                level: { title: '层级', type: 'integer' as const },
              },
            },
          },
        },
      ],
    };
    expect(validateDefinition(value, options)).toEqual([]);
    node.approverResolver.key = 'unlisted';
    expect(validateDefinition(value, options).join(',')).toContain(
      '不在当前业务契约的授权目录',
    );
    node.approverResolver.key = 'departmentLead';
    node.approverResolver.parameters = {
      level: { literal: '2' },
      extra: { literal: true },
    };
    expect(validateDefinition(value, options).join(',')).toContain(
      '固定值与能力目录类型不符',
    );
    expect(validateDefinition(value, options).join(',')).toContain(
      '参数「extra」不在能力目录',
    );
    node.approverResolver.parameters = {};
    expect(validateDefinition(value, options).join(',')).toContain(
      '必填参数「level」未配置',
    );
    node.approverResolver.parameters = { level: { literal: 2 } };
    const businessType = options.businessTypes[0];
    if (!businessType) throw new Error('缺少测试业务契约');
    expect(
      validateDefinition(value, {
        businessTypes: [{ ...businessType, approverResolvers: null }],
      }).join(','),
    ).toContain('不在当前业务契约的授权目录');
  });

  it('空审批人升级必须有明确用户或组，单独升级组也有效', () => {
    const value = createDefinition('review', '审批');
    const node = addNode(value, 'userTask');
    node.candidateUsers = ['user:reviewer'];
    node.emptyAssigneePolicy = 'ESCALATE';
    expect(validateDefinition(value).join(',')).toContain('升级人员或组');

    // 与后端 Flowable 校验一致：组可以单独承担空审批人升级，不强迫配置用户。
    node.escalationCandidateGroups = ['role:backup'];
    expect(validateDefinition(value).join(',')).not.toContain('升级人员或组');
  });
});
