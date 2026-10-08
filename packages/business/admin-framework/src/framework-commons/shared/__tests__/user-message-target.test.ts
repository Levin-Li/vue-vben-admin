import { describe, expect, it } from 'vitest';

import {
  resolvePersonalMessageSourceRoute,
  resolveWorkflowMessageRoute,
} from '../user-message-target';

/** 服务端目标仍按固定路由处理；非法运行时数据不获得链接。 */
describe('个人消息工作流定位', () => {
  it.each([
    ['WorkflowTask', 'taskId'],
    ['WorkflowInstance', 'instanceId'],
  ] as const)('按%s提供固定路由与编码交给路由器的参数', (kind, key) => {
    expect(
      resolveWorkflowMessageRoute({
        sourceType: 'Workflow',
        actionTarget: { kind, id: 'id+&1' },
      }),
    ).toEqual({ path: '/clob/V1/MyWorkflow', query: { [key]: 'id+&1' } });
  });

  it.each([
    undefined,
    null,
    {},
    { kind: 'Url', id: 'https://evil.example' },
    { kind: 'WorkflowTask', id: '' },
    { kind: 'WorkflowTask', id: ' ' },
    { kind: 'WorkflowTask', id: 'a'.repeat(129) },
    { kind: 'WorkflowTask', id: 'task\n1' },
    { kind: 'WorkflowTask', id: ['task'] },
  ])('缺失或非法目标不回退到来源ID', (actionTarget) => {
    expect(
      resolveWorkflowMessageRoute({
        sourceType: 'Workflow',
        actionTarget,
      } as Parameters<typeof resolveWorkflowMessageRoute>[0]),
    ).toBeUndefined();
  });

  it('非工作流来源不能借动作目标导航工作流', () => {
    expect(
      resolveWorkflowMessageRoute({
        sourceType: 'Inbox',
        actionTarget: { kind: 'WorkflowTask', id: 'task-1' },
      }),
    ).toBeUndefined();
  });
});

describe('个人消息邮件工单来源路由', () => {
  it.each([
    ['Inbox', '/clob/V1/Inbox'],
    ['Ticket', '/clob/V1/Ticket'],
  ])('合法%s来源只导航固定详情页面', (sourceType, path) => {
    expect(
      resolvePersonalMessageSourceRoute({ sourceType, sourceId: 'record-1' }),
    ).toEqual({ path, query: { id: 'record-1' } });
  });
  it.each(['javascript:alert(1)', 'https://evil.example', '', 'a'.repeat(65)])(
    '非法来源标识不生成链接',
    (sourceId) => {
      expect(
        resolvePersonalMessageSourceRoute({ sourceType: 'Inbox', sourceId }),
      ).toBeUndefined();
    },
  );
});

describe('个人公告来源固定路由', () => {
  it('公告进入个人来源入口，不要求管理公告菜单权限', () => {
    expect(
      resolvePersonalMessageSourceRoute({
        sourceType: 'Notice',
        sourceId: 'notice-1',
      }),
    ).toEqual({ path: '/clob/V1/MyMessages', query: { noticeId: 'notice-1' } });
    expect(
      resolvePersonalMessageSourceRoute({
        sourceType: 'Notice',
        sourceId: 'https://evil.example',
      }),
    ).toBeUndefined();
  });
});
