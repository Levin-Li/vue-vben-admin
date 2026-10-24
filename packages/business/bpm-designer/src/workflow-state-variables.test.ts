import { describe, expect, it } from 'vitest';

import {
  buildStateVariables,
  isStateVariableAlias,
  renameStateCondition,
} from './workflow-state-variables';

describe('状态图业务字段的安全别名', () => {
  it('保留公开workflowStatus和引擎同名字段，碰撞时稳定分配别名且不改source', () => {
    const fields = [
      { key: 'workflowStatus', type: 'string' },
      { key: 'business_workflowStatus', type: 'string' },
      { key: 'nrOfInstances', type: 'integer' },
      { key: 'amount', type: 'decimal' },
    ];
    const existing = {
      approvedAmount: {
        source: 'business.amount',
        type: 'decimal' as const,
        readAt: 'start' as const,
      },
    };
    const plan = buildStateVariables(fields, existing);
    expect(plan.variables.business_workflowStatus_2?.source).toBe(
      'business.workflowStatus',
    );
    expect(plan.variables.business_workflowStatus?.source).toBe(
      'business.business_workflowStatus',
    );
    expect(plan.variables.business_nrOfInstances?.source).toBe(
      'business.nrOfInstances',
    );
    expect(plan.variables.approvedAmount).toEqual(existing.approvedAmount);
    expect(plan.variables).not.toHaveProperty('workflowStatus');
    expect(
      Object.keys(plan.variables).every((name) => isStateVariableAlias(name)),
    ).toBe(true);
    expect(
      buildStateVariables(fields.toReversed(), existing).variables,
    ).toEqual(plan.variables);
  });
  it('已有不安全别名同步生成条件替换表，不改字面量或普通别名', () => {
    const plan = buildStateVariables([], {
      workflowStatus: {
        source: 'business.workflowStatus',
        type: 'string',
        readAt: 'node',
      },
      amount: { source: 'business.amount', type: 'decimal', readAt: 'node' },
    });
    expect(plan.renamedAliases).toEqual({
      workflowStatus: 'business_workflowStatus',
    });
    expect(
      renameStateCondition(
        { eq: [{ variable: 'workflowStatus' }, { literal: 'workflowStatus' }] },
        plan.renamedAliases,
      ),
    ).toEqual({
      eq: [
        { variable: 'business_workflowStatus' },
        { literal: 'workflowStatus' },
      ],
    });
    expect(plan.variables.amount?.source).toBe('business.amount');
  });
});
