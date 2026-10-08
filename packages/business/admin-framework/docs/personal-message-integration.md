# 个人消息服务接入指南

## 安装与配置

在安装 `@levin/admin-framework` 后，通过公开 `configureAdminApplication` 启动入口传入 `userMessageService`。适配器实现 `list({pageIndex,pageSize,unreadOnly})`、`unreadCount()` 和 `markRead({ids})`；页码从1开始，每页及批量已读最多100条。后端必须绑定当前登录用户，不能依据页面传入的用户或租户决定接收人。

铃铛使用服务端未读数和个人消息预览，标记已读成功后重新加载。消息页和铃铛通过框架已有事件总线的 `personal-message/read.changed` 空载荷事件同步计数；失败时不能发送成功事件。`readTime` 为服务器首次已读时间，可以为空。详情与来源授权互相独立：收到摘要不授予业务对象访问权限。

## 工作流精确导航

公开入口 `WorkflowMessageActionTarget` 与 `resolveWorkflowMessageRoute` 从包根导出。目标必须来自后端同作用域通知事件，结构为 `{ kind: 'WorkflowTask' | 'WorkflowInstance', id: string }`。不得由 `sourceId` 猜测任务，也不得接收任意跳转 URL。

```ts
import { resolveWorkflowMessageRoute } from '@levin/admin-framework';

const target = resolveWorkflowMessageRoute({
  sourceType: 'Workflow',
  actionTarget: { kind: 'WorkflowTask', id: 'task-123' },
});
if (target) await router.push(target);
```

此入口返回固定 `/clob/V1/MyWorkflow` 路由及 `taskId` 或 `instanceId` 查询参数。应用必须注册对应工作流页面，并提供按任务或实例定位的受控后端接口。普通登录守卫应保留完整本地路由；业务动作仍需用户在页面提交，并重新校验当前身份、任务状态与业务范围。

缺失目标、非法类型、空标识、超过128字符或控制字符返回 `undefined`。此时仅展示消息摘要，不生成办理链接。

## 最小验证

验证未读计数来自后端、分页不扩大受众、已读请求体为 `{ids:[...]}`、失败不更新成功状态。验证工作流任务及实例分别携带正确参数，未登录回跳保留参数；无权限或已结束的任务不能因消息存在而获得办理权限。框架入口本身不承担业务详情授权。

## 公告、邮件与工单来源

包根公开的 `resolvePersonalMessageSourceRoute` 接受 `{sourceType,sourceId,actionTarget}`。公告返回固定个人页 `/clob/V1/MyMessages` 与 `noticeId`，邮件和工单返回对应固定页面与 `id`；工作流复用可信动作目标。缺失、无效或超长来源标识返回 `undefined`，不得回退到管理员正文接口或任意外站地址。

公告个人页调用仅需登录的本人来源接口；接口仍须验证最新受众快照及当前资格，收到提醒不授予阅读正文的权限。身份、租户或组织范围变化时须清空旧内容并重新授权，旧请求晚到不能覆盖新的来源。来源响应不包含受众配置、审核意见或管理日志。

顶部铃铛点击来源只导航，不触发 `markRead`；显式单条、批量或全部已读操作才修改个人事实。宿主只注入 `userMessageService`，旧公告个人消息接口和 `noticeService` 注入已经移除。相应业务页面及方法权限由使用方注册并在服务端最终校验。
