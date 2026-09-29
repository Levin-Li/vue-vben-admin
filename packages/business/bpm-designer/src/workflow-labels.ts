import type { WorkflowVersionLifecycle } from './types';

/** 生命周期中文标签只用于显示，状态迁移仍使用服务端枚举值。 */
export const workflowLifecycleLabels: Readonly<
  Record<WorkflowVersionLifecycle, string>
> = {
  Draft: '草稿',
  Testing: '测试中',
  Published: '已发布',
  Retiring: '下线中',
  Retired: '已下线',
  Archived: '已归档',
};
