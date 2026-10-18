import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { buildModuleSyncMenuPayload } from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';
import { describe, expect, it } from 'vitest';

import { workflowNotificationRouteService } from '../api/workflow-notification-route-service';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { createOakBaseAdminModule } from '../module';
import { oakBaseAdminPageMap } from '../page-map';
import { pageMeta as auditMeta } from '../views/notification-audit/config';
import { pageMeta as robotNotifyGroupMeta } from '../views/robot-notify-group/config';
import { pageMeta as mailboxMeta } from '../views/support-mailbox-rule/config';
import { pageMeta as queueMeta } from '../views/ticket-queue/config';
import { pageMeta as ticketMeta } from '../views/ticket/config';
import { pageMeta as workflowRouteMeta } from '../views/workflow-notification-route/config';

// 导入真实配置与真实映射模块，不替换glob/pageMeta或API服务元数据。
describe('新增业务页真实eager元数据注册', () => {
  it('真实启用模块能同步全部页面，mapping不声明name且payload内部名来自path', () => {
    const module = createOakBaseAdminModule();
    expect(
      module.backendRouteMappings?.every(
        (mapping) => !Object.hasOwn(mapping, 'name'),
      ),
    ).toBe(true);
    const payload = buildModuleSyncMenuPayload([module]);
    const flatten = (items: typeof payload.menuList): typeof payload.menuList =>
      items.flatMap((item) => [item, ...flatten(item.children || [])]);
    const items = flatten(payload.menuList);
    expect(items.length).toBeGreaterThan(5);
    expect(
      items.every((item) => item.name === item.path.replaceAll('/', '_')),
    ).toBe(true);
    for (const resource of [
      'WorkflowStart',
      'WorkflowNotificationRoute',
      'Ticket',
      'TicketQueue',
      'SupportMailboxRule',
      'NotificationAudit',
      'RobotNotifyGroup',
    ]) {
      expect(
        items.filter((item) => item.path === `/clob/V1/${resource}`),
      ).toHaveLength(1);
    }
  });

  it.each([
    'notification-audit',
    'robot-notify-group',
    'support-mailbox-rule',
    'ticket-queue',
    'ticket',
    'workflow-notification-route',
  ])('%s真实lazy loader返回Vue页面组件', async (directory) => {
    const loader =
      oakBaseAdminPageMap[`/system/com_levin_oak_base/${directory}/index.vue`];
    expect(loader).toBeTypeOf('function');
    if (typeof loader !== 'function') throw new Error('页面loader未注册');
    const component = await loader();
    expect(component).toHaveProperty('default');
    expect(
      (component as { default: { render?: unknown; setup?: unknown } }).default
        .setup,
    ).toBeTypeOf('function');
    expect(
      (component as { default: { render?: unknown; setup?: unknown } }).default
        .render,
    ).toBeTypeOf('function');
  });

  it('通知路由五个动作与资源均使用真实业务权限，其他资源不被放宽', () => {
    expect(getServiceMeta(workflowNotificationRouteService).type).toBe(
      '业务数据-工作流通知路由',
    );
    for (const key of [
      'list',
      'retrieve',
      'create',
      'update',
      'remove',
    ] as const) {
      const metadata = getResAuthorizeMeta(
        workflowNotificationRouteService[key] as Parameters<
          typeof getResAuthorizeMeta
        >[0],
      );
      expect(metadata.type).toBe('业务数据-工作流通知路由');
      expect(metadata.onlyRequireAuthenticated).not.toBe(true);
      expect(metadata.ignored).not.toBe(true);
    }
  });

  it.each([
    ['NotificationAudit', 'notification-audit', auditMeta],
    ['RobotNotifyGroup', 'robot-notify-group', robotNotifyGroupMeta],
    ['SupportMailboxRule', 'support-mailbox-rule', mailboxMeta],
    ['TicketQueue', 'ticket-queue', queueMeta],
    ['Ticket', 'ticket', ticketMeta],
    [
      'WorkflowNotificationRoute',
      'workflow-notification-route',
      workflowRouteMeta,
    ],
  ] as const)('%s具备唯一的真实页面元数据', (resource, directory, metadata) => {
    const mappings = oakBaseAdminBackendRouteMappings.filter(
      (item) => item.path === `/clob/V1/${resource}`,
    );
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({
      title: metadata.title,
      description: metadata.description,
      sourceFilePath: `modules/com_levin_oak_base/views/${directory}/index.vue`,
      viewPath: `/system/com_levin_oak_base/${directory}/index.vue`,
    });
    expect(mappings[0]?.operations?.length).toBeGreaterThan(0);
  });
});
