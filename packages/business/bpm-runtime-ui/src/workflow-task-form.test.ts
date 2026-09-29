import type { WorkflowTaskAction, WorkflowTaskView } from './types';

import { describe, expect, it } from 'vitest';

import {
  isWorkflowEmpty,
  validateWorkflowAction,
  workflowActionUnavailable,
  workflowFormData,
  workflowStatusLabel,
} from './workflow-task-form';

// 本地校验是交互保护，不把缺少后端许可解释成可执行。
const approve: WorkflowTaskAction = { code: 'approve', label: '通过' };
function task(action = approve): WorkflowTaskView {
  return {
    taskId: 't1',
    status: 'Todo',
    actions: [action],
    formItems: [
      { key: 'amount', label: '金额', type: 'number', required: true },
      { key: 'confirmed', label: '是否确认', type: 'boolean', required: true },
    ],
  };
}
const values = { formData: { amount: 0, confirmed: false } };

describe('任务动作提交契约', () => {
  it('零与false是合法必填值，空白和空集合不满足必填', () => {
    expect(validateWorkflowAction(task(), approve, values)).toEqual([]);
    expect(isWorkflowEmpty('  ')).toBe(true);
    expect(isWorkflowEmpty([])).toBe(true);
    expect(isWorkflowEmpty(false)).toBe(false);
    expect(validateWorkflowAction(task(), approve, { formData: {} })).toEqual([
      '请填写金额',
      '请填写是否确认',
    ]);
  });

  it('缺少授权或任务已经结束时阻止提交', () => {
    expect(
      validateWorkflowAction({ ...task(), actions: [] }, approve, values),
    ).toEqual(['当前任务不允许执行此动作']);
    expect(
      validateWorkflowAction(
        { ...task(), status: 'Completed' },
        approve,
        values,
      ),
    ).toEqual(['当前任务不允许执行此动作']);
  });

  it('只提交明确可写字段，排除旧任务残留和只读字段', () => {
    const input = {
      amount: 0,
      confirmed: false,
      secret: '不可提交',
      title: '只读标题',
    };
    const current = task();
    current.formItems?.push({
      key: 'title',
      label: '标题',
      readOnly: true,
      required: true,
    });
    expect(workflowFormData(current, input)).toEqual(values.formData);
    expect(validateWorkflowAction(current, approve, values)).toEqual([]);
  });

  it('拒绝需要意见，退回仅允许服务端列出的目标', () => {
    const reject = { code: 'reject', label: '拒绝', requiresComment: true };
    expect(validateWorkflowAction(task(reject), reject, values)).toContain(
      '请填写审批意见',
    );
    const back = {
      code: 'return',
      label: '退回',
      returnTargets: [{ label: '申请节点', value: 'apply' }],
    };
    expect(
      validateWorkflowAction(task(back), back, {
        ...values,
        targetNodeId: 'foreign',
      }),
    ).toContain('请选择允许的退回节点');
    expect(
      validateWorkflowAction(task(back), back, {
        ...values,
        targetNodeId: 'apply',
      }),
    ).toEqual([]);
  });

  it.each(['transfer', 'delegate'])('%s不允许未授权用户成为目标', (code) => {
    const action = {
      code,
      label: '交办',
      candidateUsers: [{ label: '甲', value: 'u1' }],
    };
    expect(
      validateWorkflowAction(task(action), action, {
        ...values,
        targetUserId: 'u2',
      }),
    ).toContain('请选择允许的处理人');
    expect(
      validateWorkflowAction(task(action), action, {
        ...values,
        targetUserId: 'u1',
      }),
    ).toEqual([]);
  });

  it('加签同时校验人员集合和加签顺序，未知能力不开放', () => {
    const action = {
      code: 'add-sign',
      label: '加签',
      candidateUsers: [{ label: '甲', value: 'u1' }],
      addSignPositions: [{ label: '前加签', value: 'before' }],
    };
    expect(
      validateWorkflowAction(task(action), action, {
        ...values,
        targetUserIds: ['u1', 'u2'],
        addSignPosition: 'after',
      }),
    ).toHaveLength(2);
    expect(
      validateWorkflowAction(task(action), action, {
        ...values,
        targetUserIds: ['u1'],
        addSignPosition: 'before',
      }),
    ).toEqual([]);
    expect(workflowActionUnavailable({ code: 'transfer', label: '转办' })).toBe(
      '服务端未提供可选处理人',
    );
    expect(workflowActionUnavailable({ code: 'script', label: '脚本' })).toBe(
      '当前界面尚不支持该动作',
    );
  });

  it('执行结束与业务处理失败分别展示，不把结束当成通过', () => {
    expect(workflowStatusLabel('Completed')).toBe('已结束');
    expect(workflowStatusLabel('Failed')).toBe('处理失败');
    expect(workflowStatusLabel('PendingEffects')).toBe('等待业务处理');
    expect(workflowStatusLabel('Approved')).toBe('通过');
  });
});
