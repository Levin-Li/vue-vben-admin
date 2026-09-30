import type {
  WorkflowActionInput,
  WorkflowTaskAction,
  WorkflowTaskView,
} from './types';

/** 空值判断保留合法的零和 false，不用真值判断替代必填校验。 */
export function isWorkflowEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** 未实现或缺少受控参数目录的动作不开放操作，避免发送无效命令。 */
export function workflowActionUnavailable(
  action: WorkflowTaskAction,
): string | undefined {
  if (
    ![
      'add-sign',
      'approve',
      'delegate',
      'reject',
      'resolve',
      'return',
      'transfer',
    ].includes(action.code)
  )
    return '当前界面尚不支持该动作';
  if (action.code === 'return' && !action.returnTargets?.length)
    return '服务端未提供可退回节点';
  if (
    ['add-sign', 'delegate', 'transfer'].includes(action.code) &&
    !action.candidateUsers?.length
  )
    return '服务端未提供可选处理人';
  if (action.code === 'add-sign' && !action.addSignPositions?.length)
    return '服务端未提供加签顺序';
}

/** 只提交本节点明确公开的可写表单字段，拒绝残留字段进入请求。 */
export function workflowFormData(
  task: WorkflowTaskView,
  values: Record<string, unknown>,
) {
  const fields =
    task.formItems ??
    task.requiredFields?.map((key) => ({ key, label: key, required: true })) ??
    [];
  return Object.fromEntries(
    fields
      .filter(
        (field) =>
          !('readOnly' in field && field.readOnly) &&
          values[field.key] !== undefined,
      )
      .map((field) => [field.key, values[field.key]]),
  );
}

/** 本地校验用于定位输入错误，服务端仍须重新校验任务权限及所有参数。 */
export function validateWorkflowAction(
  task: WorkflowTaskView,
  selectedAction: WorkflowTaskAction,
  input: WorkflowActionInput,
): string[] {
  const action = task.actions?.find(
    (item) => item.code === selectedAction.code,
  );
  if (task.status !== 'Todo' || !action) return ['当前任务不允许执行此动作'];
  const unavailable = workflowActionUnavailable(action);
  if (unavailable) return [unavailable];

  const errors: string[] = [];
  const fields =
    task.formItems ??
    task.requiredFields?.map((key) => ({ key, label: key, required: true })) ??
    [];
  for (const field of fields) {
    if ('readOnly' in field && field.readOnly) continue;
    if (field.required && isWorkflowEmpty(input.formData[field.key]))
      errors.push(`请填写${field.label}`);
  }
  if (action.requiresComment && !input.comment?.trim())
    errors.push('请填写审批意见');
  if (
    action.code === 'return' &&
    !action.returnTargets?.some((item) => item.value === input.targetNodeId)
  )
    errors.push('请选择允许的退回节点');
  if (
    ['delegate', 'transfer'].includes(action.code) &&
    !action.candidateUsers?.some((item) => item.value === input.targetUserId)
  )
    errors.push('请选择允许的处理人');
  if (action.code === 'add-sign') {
    if (
      !input.targetUserIds?.length ||
      input.targetUserIds.some(
        (id) => !action.candidateUsers?.some((item) => item.value === id),
      )
    )
      errors.push('请选择允许的加签人员');
    if (
      !action.addSignPositions?.some(
        (item) => item.value === input.addSignPosition,
      )
    )
      errors.push('请选择允许的加签顺序');
  }
  return errors;
}

/** 展示以服务端事实为准，未知状态保留原值以避免伪造成功。 */
export function workflowStatusLabel(value?: string) {
  const labels: Record<string, string> = {
    Todo: '待处理',
    Completed: '已结束',
    Cancelled: '已取消',
    Running: '运行中',
    Suspended: '已挂起',
    PendingEffects: '等待业务处理',
    Approved: '通过',
    Rejected: '拒绝',
    Withdrawn: '已撤回',
    Terminated: '已终止',
    Pending: '待处理',
    Applied: '已应用',
    Failed: '处理失败',
  };
  return value ? (labels[value] ?? value) : '—';
}
