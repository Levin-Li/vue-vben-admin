/** 工作流通知目标只能来自服务端持久化事件，不承载 URL 或执行指令。 */
export interface WorkflowMessageActionTarget {
  id: string;
  kind: 'WorkflowInstance' | 'WorkflowTask';
}

/** 页面和铃铛复用固定导航；缺失或非法目标不猜测来源 ID。 */
export function resolveWorkflowMessageRoute(message: {
  actionTarget?: null | WorkflowMessageActionTarget;
  sourceType?: string;
}): undefined | { path: string; query: Record<string, string> } {
  if (message.sourceType !== 'Workflow') return undefined;
  const target = message.actionTarget;
  if (
    !target ||
    typeof target.id !== 'string' ||
    !target.id.trim() ||
    target.id.length > 128 ||
    [...target.id].some((character) => {
      const code = character.codePointAt(0) ?? -1;
      return code <= 31 || (code >= 127 && code <= 159);
    })
  )
    return undefined;
  let parameter: string | undefined;
  if (target.kind === 'WorkflowTask') parameter = 'taskId';
  else if (target.kind === 'WorkflowInstance') parameter = 'instanceId';
  if (!parameter) return undefined;
  return { path: '/clob/V1/MyWorkflow', query: { [parameter]: target.id } };
}

/** 邮件与工单页面只接受固定路由及受控业务标识，不读取消息中的 URL。 */
export function resolvePersonalMessageSourceRoute(message: {
  actionTarget?: null | WorkflowMessageActionTarget;
  sourceId?: string;
  sourceType?: string;
}): undefined | { path: string; query: Record<string, string> } {
  if (message.sourceType === 'Workflow')
    return resolveWorkflowMessageRoute(message);
  if (
    !['Inbox', 'Notice', 'Ticket'].includes(message.sourceType || '') ||
    typeof message.sourceId !== 'string' ||
    !/^[A-Z0-9][\w.:-]{0,63}$/i.test(message.sourceId)
  )
    return undefined;
  if (message.sourceType === 'Notice')
    return {
      path: '/clob/V1/MyMessages',
      query: { noticeId: message.sourceId },
    };
  return {
    path: message.sourceType === 'Inbox' ? '/clob/V1/Inbox' : '/clob/V1/Ticket',
    query: { id: message.sourceId },
  };
}
