import type { WorkflowTaskView } from './types';
import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import WorkflowRuntimeWorkbench from './workflow-runtime-workbench.vue';

vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  async () => {
    const component = await import('./workflow-personal-crud-test-double');
    return { default: component.default };
  },
);

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    basePath = '';
  },
}));

// 使用真实工作台与任务面板，锁定只读定位和在途请求的权限边界。
const task = {
  taskId: 'target-task',
  taskName: '邮件关联审批',
  status: 'Todo',
  actions: [{ code: 'approve', label: '通过' }],
};
function setup(overrides: Record<string, unknown> = {}) {
  const api = {
    todo: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
    complete: vi.fn(),
  };
  const loadTargetTask = vi.fn().mockResolvedValue(task);
  const loadTargetInstance = vi.fn().mockResolvedValue({
    instanceId: 'target-instance',
    status: 'Completed',
    businessTitle: '邮件关联实例',
  });
  const wrapper = mount(WorkflowRuntimeWorkbench, {
    props: {
      service: api as unknown as WorkflowRuntimeService,
      canViewTodo: false,
      canViewDone: false,
      canViewStarted: false,
      canViewCopied: false,
      canViewTargetTask: true,
      canViewTargetInstance: true,
      targetTaskId: task.taskId,
      loadTargetTask,
      loadTargetInstance,
      ...overrides,
    },
  });
  return { api, wrapper, loadTargetTask, loadTargetInstance };
}

describe('工作流邮件链接定位', () => {
  it('正式保存失败重试复用原命令，成功仍保留待办且不触发完成', async () => {
    const savedTask = {
      ...task,
      canSave: true,
      businessRevision: 'r2',
      formItems: [{ key: 'reason', label: '原因', required: true }],
    };
    const saveTask = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue(savedTask);
    const { wrapper } = setup({
      canSaveTask: true,
      loadTargetTask: vi
        .fn()
        .mockResolvedValue({ ...savedTask, businessRevision: 'r1' }),
      service: { saveTask } as unknown as WorkflowRuntimeService,
    });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '保存，暂不提交')
      ?.trigger('click');
    await flushPromises();
    expect(saveTask).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('保存未成功');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '保存，暂不提交')
      ?.trigger('click');
    await flushPromises();
    expect(saveTask).toHaveBeenCalledTimes(2);
    expect(saveTask.mock.calls[0]).toEqual(saveTask.mock.calls[1]);
    expect(saveTask.mock.calls[0]?.[0]).toMatchObject({
      taskId: task.taskId,
      actionCode: 'save',
      expectedBusinessRevision: 'r1',
      formData: {},
    });
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('completed')).toBeUndefined();
    expect(wrapper.text()).toContain('保存，暂不提交');
    wrapper.unmount();
  });

  it('关键依据变化阻断审批但保留服务端授权的撤回入口', async () => {
    const { wrapper, api } = setup({
      canWithdraw: true,
      loadTargetTask: vi.fn().mockResolvedValue({
        ...task,
        processInstanceId: 'instance-one',
        businessType: 'expense',
        businessId: 'b1',
        businessBasisChanged: true,
        operationBlockedReason: '业务依据已变化，请安全退出后重发。',
        allowedOperations: ['withdraw'],
      }),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('业务依据已变化');
    expect(
      wrapper.findAll('button').some((item) => item.text() === '通过'),
    ).toBe(false);
    expect(
      wrapper.findAll('button').some((item) => item.text() === '撤回流程'),
    ).toBe(true);
    expect(api.complete).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('列表无权限时仍按独立详情权限定位，打开链接不会自动审批', async () => {
    const { wrapper, api, loadTargetTask } = setup();
    await flushPromises();
    expect(loadTargetTask).toHaveBeenCalledWith('target-task');
    expect(wrapper.text()).toContain('邮件关联审批');
    expect(wrapper.text()).toContain('请核对内容后办理');
    expect(api.todo).not.toHaveBeenCalled();
    expect(api.complete).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('已结束任务保留只读详情且没有审批确认动作', async () => {
    const { wrapper, api } = setup({
      loadTargetTask: vi
        .fn()
        .mockResolvedValue({ ...task, status: 'Completed' }),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('该任务已结束');
    expect(
      wrapper.findAll('button').some((button) => button.text() === '通过'),
    ).toBe(false);
    expect(api.complete).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('实例链接打开只读轨迹，不把实例误当待办', async () => {
    const { wrapper, loadTargetInstance, loadTargetTask } = setup({
      targetTaskId: undefined,
      targetInstanceId: 'target-instance',
    });
    await flushPromises();
    expect(loadTargetInstance).toHaveBeenCalledWith('target-instance');
    expect(loadTargetTask).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('邮件关联实例');
    expect(wrapper.text()).toContain('流程轨迹');
    expect(wrapper.text()).toContain('当前显示只读详情');
    wrapper.unmount();
  });
  it('撤销读取权限后立即清空原详情并停止读取', async () => {
    const { wrapper, loadTargetTask } = setup();
    await flushPromises();
    await wrapper.setProps({ canViewTargetTask: false });
    await flushPromises();
    expect(wrapper.text()).not.toContain('邮件关联审批');
    expect(wrapper.text()).toContain('当前账号无权查看');
    expect(loadTargetTask).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
  it('目标不可用和越权使用相同提示，不展示服务端错误中的业务细节', async () => {
    const { wrapper } = setup({
      loadTargetTask: vi.fn().mockRejectedValue(new Error('其他租户的秘密')),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('流程信息不可用或当前账号无权查看');
    expect(wrapper.text()).not.toContain('其他租户的秘密');
    wrapper.unmount();
  });
  it('旧链接请求迟到不能覆盖新链接目标', async () => {
    let resolveOld!: (task: WorkflowTaskView) => void;
    const loader = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WorkflowTaskView>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({
        ...task,
        taskId: 'new-task',
        taskName: '新的审批',
      });
    const { wrapper } = setup({ loadTargetTask: loader });
    await flushPromises();
    await wrapper.setProps({ targetTaskId: 'new-task' });
    await flushPromises();
    resolveOld(task);
    await flushPromises();
    expect(wrapper.text()).toContain('新的审批');
    expect(wrapper.text()).not.toContain('邮件关联审批');
    wrapper.unmount();
  });
});
