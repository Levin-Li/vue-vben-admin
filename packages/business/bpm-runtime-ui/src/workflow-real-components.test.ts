import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import WorkflowBusinessDetail from './workflow-business-detail.vue';
import WorkflowProcessDiagram from './workflow-process-diagram.vue';
import WorkflowRuntimeWorkbench from './workflow-runtime-workbench.vue';
import WorkflowTaskPanel from './workflow-task-panel.vue';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    basePath = '';
  },
}));

describe('运行时公开组件独立挂载', () => {
  it('接收人查询权限独立于发送权限，撤销后移除选择入口', async () => {
    const api = {
      todo: vi.fn(),
      done: vi.fn(),
      started: vi.fn().mockResolvedValue([
        {
          instanceId: 'running-1',
          businessTitle: '本人申请',
          status: 'Running',
        },
      ]),
      copied: vi.fn(),
    };
    const loadCopyRecipients = vi
      .fn()
      .mockResolvedValue([{ label: '接收人', value: 'user-1' }]);
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewTodo: false,
        canViewDone: false,
        canViewStarted: true,
        canViewCopied: false,
        canSendCopy: true,
        canLoadCopyRecipients: false,
        loadCopyRecipients,
      },
    });
    await flushPromises();
    await wrapper.get('[aria-label="查看本人申请实例"]').trigger('click');
    expect(wrapper.text()).not.toContain('发送抄送');
    expect(loadCopyRecipients).not.toHaveBeenCalled();

    await wrapper.setProps({ canLoadCopyRecipients: true });
    await flushPromises();
    expect(wrapper.text()).toContain('发送抄送');
    const search = wrapper.get('.ant-select-selection-search-input');
    await search.setValue('王');
    await flushPromises();
    expect(loadCopyRecipients).not.toHaveBeenCalled();
    await search.setValue('小王');
    await flushPromises();
    expect(loadCopyRecipients).toHaveBeenCalledWith('running-1', '小王');
    await wrapper.setProps({ canLoadCopyRecipients: false });
    await flushPromises();
    expect(wrapper.text()).not.toContain('发送抄送');
    wrapper.unmount();
  });

  it('抄送实例只显示只读图和轨迹，撤销查询权限后清除内容', async () => {
    const api = {
      todo: vi.fn(),
      done: vi.fn(),
      started: vi.fn(),
      copied: vi.fn().mockResolvedValue([
        {
          instanceId: 'copied-1',
          businessTitle: '抄送的申请',
          status: 'Running',
          timeline: [{ id: 'event-1', name: '已提交', time: '2026-10-02' }],
          processDiagramNodes: [
            { id: 'start', name: '开始', status: 'completed' },
          ],
        },
      ]),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewTodo: false,
        canViewDone: false,
        canViewStarted: false,
        canViewCopied: true,
      },
    });
    await flushPromises();
    expect(api.copied).toHaveBeenCalledTimes(1);
    await wrapper.get('[aria-label="查看抄送的申请抄送实例"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已提交');
    expect(wrapper.find('[data-node-id="start"]').exists()).toBe(true);
    expect(wrapper.findComponent(WorkflowTaskPanel).exists()).toBe(false);
    expect(wrapper.text()).not.toContain('发送抄送');

    await wrapper.setProps({ canViewCopied: false });
    await flushPromises();
    expect(wrapper.text()).not.toContain('抄送的申请');
    expect(wrapper.text()).not.toContain('已提交');
    expect(wrapper.find('[data-node-id="start"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('切换待办后从服务端恢复本人待绑定附件，不沿用上一任务选择', async () => {
    const tasks = [
      {
        taskId: 'task-a',
        processInstanceId: 'instance-a',
        taskName: '第一审批',
        status: 'Todo',
      },
      {
        taskId: 'task-b',
        processInstanceId: 'instance-b',
        taskName: '第二审批',
        status: 'Todo',
      },
    ];
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue(tasks),
      done: vi.fn().mockResolvedValue([]),
      started: vi.fn().mockResolvedValue([]),
      attachments: vi.fn().mockResolvedValue([]),
      pendingAttachments: vi.fn().mockImplementation(async (taskId: string) => [
        {
          id: `pending-${taskId}`,
          fileName: `${taskId}.txt`,
          sizeBytes: 4,
          mimeType: 'text/plain',
          contentSha256: 'digest',
          attached: false,
        },
      ]),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewPendingAttachments: true,
        canViewAttachments: true,
      },
    });
    await flushPromises();
    await wrapper.find('[aria-label="查看第一审批"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('task-a.txt');
    await wrapper.find('[aria-label="查看第二审批"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('task-b.txt');
    expect(wrapper.text()).not.toContain('task-a.txt');
    await wrapper.find('[aria-label="查看第一审批"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('task-a.txt');
    expect(api.pendingAttachments).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });

  it('只有待办权限时不请求或展示无权限的已办和我发起', async () => {
    // 最小候选只获待办读取权，其他接口即使返回403也不能阻断已授权任务。
    const task = {
      taskId: 'task-only-todo',
      taskName: '核定报销',
      status: 'Todo',
      businessTitle: '普通候选的报销',
    };
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue([task]),
      done: vi.fn().mockRejectedValue(new Error('403')),
      started: vi.fn().mockRejectedValue(new Error('403')),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewTodo: true,
        canViewDone: false,
        canViewStarted: false,
      },
    });
    await flushPromises();

    expect(api.todo).toHaveBeenCalledTimes(1);
    expect(api.done).not.toHaveBeenCalled();
    expect(api.started).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('普通候选的报销');
    expect(wrapper.text()).not.toContain('流程列表加载失败');
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      expect.stringContaining('待办'),
      expect.stringContaining('抄送'),
    ]);
    wrapper.unmount();
  });

  it('列表权限在请求期间失效时仍保留成功加载的待办', async () => {
    // 后端撤权拒绝某个分栏后，不能把另一项合法待办一并清空或误报全局空列表。
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue([
        {
          taskId: 'allowed-task',
          taskName: '待核定报销',
          status: 'Todo',
        },
      ]),
      done: vi.fn().mockRejectedValue(new Error('403')),
      started: vi.fn().mockResolvedValue([]),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: { service: api as unknown as WorkflowRuntimeService },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('待核定报销');
    expect(wrapper.text()).toContain('部分流程列表加载失败');
    expect(wrapper.emitted('error')).toHaveLength(1);
    wrapper.unmount();
  });

  it('没有待办权限但有我发起权限时进入可见分栏', async () => {
    // 工作台不能停留在已隐藏的默认待办页，也不能为此试探无权接口。
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn(),
      done: vi.fn(),
      started: vi.fn().mockResolvedValue([
        {
          instanceId: 'instance-1',
          businessTitle: '我发起的流程',
          status: 'Running',
        },
      ]),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewTodo: false,
        canViewDone: false,
        canViewStarted: true,
      },
    });
    await flushPromises();

    expect(api.todo).not.toHaveBeenCalled();
    expect(api.done).not.toHaveBeenCalled();
    expect(api.started).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toContain(
      '我发起',
    );
    expect(wrapper.text()).toContain('我发起的流程');
    wrapper.unmount();
  });

  it('无人工任务的我发起实例可查看真实只读图和轨迹，撤权后清空', async () => {
    const instance = {
      instanceId: 'exclusive-instance',
      businessTitle: '资料不齐申请',
      purposeKey: 'request.review',
      status: 'Completed',
      executionStatus: 'Completed',
      outcome: 'Rejected',
      effectStatus: 'Applied',
      timeline: [
        { id: 'start-event', name: '开始', time: '2026-09-30T01:00:00Z' },
        { id: 'end-event', name: '拒绝结束', time: '2026-09-30T01:00:01Z' },
      ],
      processDiagramNodes: [
        { id: 'start', name: '开始', type: 'start', status: 'completed' },
        {
          id: 'choice',
          name: '条件',
          type: 'exclusiveGateway',
          status: 'completed',
        },
        { id: 'approved', name: '通过', type: 'end', status: 'skipped' },
        { id: 'rejected', name: '拒绝', type: 'end', status: 'completed' },
      ],
      processDiagramEdges: [
        { id: 'start_choice', source: 'start', target: 'choice' },
        { id: 'choice_approved', source: 'choice', target: 'approved' },
        { id: 'choice_rejected', source: 'choice', target: 'rejected' },
      ],
    };
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn(),
      done: vi.fn(),
      started: vi.fn().mockResolvedValue([instance]),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewTodo: false,
        canViewDone: false,
        canViewStarted: true,
      },
    });
    await flushPromises();

    // 只使用有权的started响应；实例没有taskId，也不能补造审批按钮。
    await wrapper
      .get('[aria-label="查看资料不齐申请实例"]')
      .trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.text()).toContain('拒绝结束');
    expect(wrapper.find('[data-node-id="rejected"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('确认通过');

    // 分栏权限撤销后不保留先前读取的实例图和轨迹。
    await wrapper.setProps({ canViewStarted: false });
    await flushPromises();
    expect(wrapper.text()).not.toContain('拒绝结束');
    expect(wrapper.find('[data-node-id="rejected"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('待办权限被撤销后丢弃先前在途响应', async () => {
    // 权限变化会启动新一代刷新，旧请求即使稍后成功也不能重新显示任务详情。
    let completeTodo!: (
      items: Array<{ taskId: string; taskName: string }>,
    ) => void;
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          completeTodo = resolve;
        }),
      ),
      done: vi.fn(),
      started: vi.fn(),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewTodo: true,
        canViewDone: false,
        canViewStarted: false,
      },
    });
    await wrapper.setProps({ canViewTodo: false });
    completeTodo([{ taskId: 'stale', taskName: '已撤权任务' }]);
    await flushPromises();

    expect(api.todo).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain('已撤权任务');
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      expect.stringContaining('抄送'),
    ]);
    wrapper.unmount();
  });

  it('同名已办节点按业务标题与实例区分，键盘打开保留真实连线和轨迹', async () => {
    const first = {
      taskId: 't1',
      taskName: '部门审批',
      businessTitle: '采购申请甲',
      processInstanceId: 'p1',
      status: 'Completed',
    };
    const second = {
      taskId: 't2',
      taskName: '部门审批',
      businessTitle: '采购申请乙',
      processInstanceId: 'p2',
      status: 'Completed',
      timelineTruncated: true,
      timeline: [
        {
          id: 'h1',
          name: '审批通过',
          actor: '张三',
          comment: '资料已核验',
          time: '2026-09-27T08:00:00Z',
        },
      ],
      processDiagramNodes: [
        { id: 'start', name: '开始', status: 'completed', type: 'start' },
        { id: 'end', name: '结束', status: 'completed', type: 'end' },
      ],
      processDiagramEdges: [{ id: 'e1', source: 'start', target: 'end' }],
    };
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue([]),
      done: vi.fn().mockResolvedValue([first, second]),
      started: vi.fn().mockResolvedValue([]),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: { service: api as unknown as WorkflowRuntimeService },
    });
    await flushPromises();
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().includes('已办'))
      ?.trigger('click');
    await flushPromises();
    const rows = wrapper.findAll('.ant-list-item[role="button"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text()).toContain('采购申请甲');
    expect(rows[1]?.text()).toContain('采购申请乙');
    expect(rows[1]?.text()).toContain('p2');
    expect(rows[1]?.text()).toContain('已处理');
    await rows[1]?.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.find('.levin-workflow-task-panel').text()).toContain(
      '采购申请乙',
    );
    expect(wrapper.find('.ant-timeline').text()).toContain('张三');
    expect(wrapper.find('.ant-timeline').text()).toContain('资料已核验');
    expect(wrapper.text()).toContain('仅展示最近1000条记录');
    expect(wrapper.find('[data-edge-id="e1"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('真实工作台列表可以打开详情、填写表单并提交审批，不依赖全局Ant注册', async () => {
    const task = {
      taskId: 'task-1',
      taskName: '业务审核节点',
      status: 'Todo',
      businessType: 'request',
      businessId: 'r1',
      businessTitle: '审批申请',
      businessFields: [{ key: 'amount', label: '申请金额', value: 300 }],
      actions: [{ code: 'approve', label: '通过', requiresComment: true }],
      formItems: [
        { key: 'reason', label: '办理说明', type: 'text', required: true },
      ],
    };
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue([task]),
      done: vi.fn().mockResolvedValue([]),
      started: vi.fn().mockResolvedValue([]),
      complete: vi.fn().mockResolvedValue({ ...task, status: 'Completed' }),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: { service: api as unknown as WorkflowRuntimeService },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('业务审核节点');
    await wrapper.find('.ant-list-item').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('申请金额');
    expect(wrapper.text()).toContain('300');
    expect(wrapper.text()).toContain('办理说明');
    const findButton = (label: string) =>
      wrapper
        .findAll('button')
        .find((button) => button.text().replaceAll(/\s/g, '') === label);
    await findButton('通过')?.trigger('click');
    await findButton('确认通过')?.trigger('click');
    expect(api.complete).not.toHaveBeenCalled();
    await wrapper.find('input').setValue('资料核验完成');
    await wrapper.find('textarea').setValue('同意办理');
    await findButton('确认通过')?.trigger('click');
    await flushPromises();
    expect(api.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        actionCode: 'approve',
        formData: { reason: '资料核验完成' },
        comment: '同意办理',
      }),
    );
    expect(wrapper.emitted('completed')).toHaveLength(1);
    wrapper.unmount();
  });

  it('拒绝成功后旧任务附件请求失败不能覆盖完成结果', async () => {
    // 并行支路被拒绝时旧引擎任务立即消失，先锁定成功命令与迟到附件失败的竞态。
    const task = {
      taskId: 'cancelled-task',
      processInstanceId: 'cancelled-instance',
      taskName: '并行支路审批',
      status: 'Todo',
      actions: [{ code: 'reject', label: '拒绝' }],
    };
    let rejectAttachments!: (error: Error) => void;
    let rejectPending!: (error: Error) => void;
    let finishRefresh!: (tasks: (typeof task)[]) => void;
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi
        .fn()
        .mockResolvedValueOnce([task])
        .mockImplementationOnce(
          () =>
            new Promise<(typeof task)[]>((resolve) => {
              finishRefresh = resolve;
            }),
        ),
      done: vi.fn().mockResolvedValue([]),
      started: vi.fn().mockResolvedValue([]),
      attachments: vi.fn().mockReturnValue(
        new Promise((_, reject) => {
          rejectAttachments = reject;
        }),
      ),
      pendingAttachments: vi.fn().mockReturnValue(
        new Promise((_, reject) => {
          rejectPending = reject;
        }),
      ),
      complete: vi.fn().mockResolvedValue({ ...task, status: 'Completed' }),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewAttachments: true,
        canViewPendingAttachments: true,
      },
    });
    await flushPromises();
    await wrapper.get('[aria-label="查看并行支路审批"]').trigger('click');
    await flushPromises();

    const button = (label: string) =>
      wrapper
        .findAll('button')
        .find((item) => item.text().replaceAll(/\s/g, '') === label);
    await button('拒绝')?.trigger('click');
    await button('确认拒绝')?.trigger('click');
    await flushPromises();
    expect(api.complete).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('completed')).toHaveLength(1);

    // 旧任务的两个附件读均按服务端消失返回失败，不能再对新列表弹全局错误。
    rejectAttachments(new Error('已取消任务附件 HTTP 500'));
    rejectPending(new Error('已取消待上传附件 HTTP 500'));
    await flushPromises();
    expect(wrapper.emitted('error')).toBeUndefined();
    expect(wrapper.text()).not.toContain('任务处理未成功');

    finishRefresh([]);
    await flushPromises();
    expect(wrapper.find('.levin-workflow-task-panel').exists()).toBe(false);
    wrapper.unmount();
  });

  it('切换到无实例任务后旧附件失败不覆盖当前任务', async () => {
    // 第二个任务没有实例附件入口，仍须废弃第一个任务的在途读取。
    const tasks = [
      {
        taskId: 'old-task',
        processInstanceId: 'old-instance',
        taskName: '旧任务',
        status: 'Todo',
      },
      { taskId: 'new-task', taskName: '新任务', status: 'Todo' },
    ];
    let rejectOldAttachments!: (error: Error) => void;
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue(tasks),
      done: vi.fn().mockResolvedValue([]),
      started: vi.fn().mockResolvedValue([]),
      attachments: vi.fn().mockReturnValue(
        new Promise((_, reject) => {
          rejectOldAttachments = reject;
        }),
      ),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: {
        service: api as unknown as WorkflowRuntimeService,
        canViewAttachments: true,
      },
    });
    await flushPromises();
    await wrapper.get('[aria-label="查看旧任务"]').trigger('click');
    await flushPromises();
    await wrapper.get('[aria-label="查看新任务"]').trigger('click');
    rejectOldAttachments(new Error('旧任务附件不可读取'));
    await flushPromises();

    expect(wrapper.find('.levin-workflow-task-panel').text()).toContain(
      '新任务',
    );
    expect(wrapper.emitted('error')).toBeUndefined();
    wrapper.unmount();
  });

  it('二次验证准备从任务A切到B后不展示迟到提示并清除旧提示', async () => {
    // 服务端挑战绑定原任务，响应迟到后不得误告知另一任务可以继续验证。
    const tasks = [
      { taskId: 'task-a', taskName: '任务A', status: 'Todo' },
      { taskId: 'task-b', taskName: '任务B', status: 'Todo' },
    ];
    let finishOld!: (result: { message: string; successful: boolean }) => void;
    let rejectOld!: (error: Error) => void;
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue(tasks),
      done: vi.fn().mockResolvedValue([]),
      started: vi.fn().mockResolvedValue([]),
      prepareStepUpAuth: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishOld = resolve;
            }),
        )
        .mockResolvedValueOnce({
          successful: true,
          verificationType: 'Sms',
          message: '任务A的新验证提示',
        })
        .mockImplementationOnce(
          () =>
            new Promise((_, reject) => {
              rejectOld = reject;
            }),
        ),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: { service: api as unknown as WorkflowRuntimeService },
    });
    await flushPromises();
    await wrapper.get('[aria-label="查看任务A"]').trigger('click');
    await flushPromises();
    wrapper.findComponent(WorkflowTaskPanel).vm.$emit('prepareVerification', {
      action: { code: 'approve' },
      formData: {},
      verificationType: 'Sms',
    });
    await flushPromises();
    expect(api.prepareStepUpAuth).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-a' }),
    );

    await wrapper.get('[aria-label="查看任务B"]').trigger('click');
    finishOld({ successful: true, message: '任务A的迟到验证提示' });
    await flushPromises();
    expect(wrapper.text()).not.toContain('任务A的迟到验证提示');

    await wrapper.get('[aria-label="查看任务A"]').trigger('click');
    wrapper.findComponent(WorkflowTaskPanel).vm.$emit('prepareVerification', {
      action: { code: 'approve' },
      formData: {},
      verificationType: 'Sms',
    });
    await flushPromises();
    expect(wrapper.text()).toContain('任务A的新验证提示');
    await wrapper.get('[aria-label="查看任务B"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('任务A的新验证提示');

    // 迟到失败也不能把任务B覆盖成任务A的挑战错误。
    await wrapper.get('[aria-label="查看任务A"]').trigger('click');
    wrapper.findComponent(WorkflowTaskPanel).vm.$emit('prepareVerification', {
      action: { code: 'approve' },
      formData: {},
      verificationType: 'Sms',
    });
    await flushPromises();
    await wrapper.get('[aria-label="查看任务B"]').trigger('click');
    rejectOld(new Error('任务A挑战失败'));
    await flushPromises();
    expect(wrapper.text()).not.toContain('获取验证挑战失败');
    expect(wrapper.emitted('error')).toBeUndefined();
    wrapper.unmount();
  });

  it('同一任务的新验证请求优先于旧请求的迟到响应', async () => {
    const task = { taskId: 'task-a', taskName: '任务A', status: 'Todo' };
    let finishOld!: (result: { message: string; successful: boolean }) => void;
    const api = {
      copied: vi.fn().mockResolvedValue([]),
      todo: vi.fn().mockResolvedValue([task]),
      done: vi.fn().mockResolvedValue([]),
      started: vi.fn().mockResolvedValue([]),
      prepareStepUpAuth: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishOld = resolve;
            }),
        )
        .mockResolvedValueOnce({
          successful: true,
          verificationType: 'Sms',
          message: '本次验证提示',
        }),
    };
    const wrapper = mount(WorkflowRuntimeWorkbench, {
      props: { service: api as unknown as WorkflowRuntimeService },
    });
    await flushPromises();
    await wrapper.get('[aria-label="查看任务A"]').trigger('click');
    const payload = {
      action: { code: 'approve' },
      formData: {},
      verificationType: 'Sms',
    };
    wrapper
      .findComponent(WorkflowTaskPanel)
      .vm.$emit('prepareVerification', payload);
    wrapper
      .findComponent(WorkflowTaskPanel)
      .vm.$emit('prepareVerification', payload);
    await flushPromises();
    expect(wrapper.text()).toContain('本次验证提示');

    finishOld({ successful: true, message: '过期验证提示' });
    await flushPromises();
    expect(wrapper.text()).toContain('本次验证提示');
    expect(wrapper.text()).not.toContain('过期验证提示');
    wrapper
      .findComponent(WorkflowTaskPanel)
      .vm.$emit('verificationInvalidated');
    await flushPromises();
    expect(wrapper.text()).not.toContain('本次验证提示');
    wrapper.unmount();
  });

  it('业务详情和流程图独立显示真实Ant内容与空态', () => {
    const detail = mount(WorkflowBusinessDetail, {
      props: {
        detail: {
          businessType: 'request',
          businessId: 'r1',
          businessTitle: '资料审核',
          businessFields: [{ key: 'ready', label: '资料齐全', value: false }],
        },
      },
    });
    expect(detail.find('.ant-descriptions').exists()).toBe(true);
    expect(detail.text()).toContain('资料审核');
    expect(detail.text()).toContain('否');
    const diagram = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          taskId: 't1',
          processDiagramNodes: [
            { id: 'n1', name: '审批节点', status: 'active' },
          ],
        },
      },
    });
    expect(diagram.find('[data-node-id="n1"]').text()).toContain('审批节点');
    const empty = mount(WorkflowProcessDiagram, {
      props: { task: { taskId: 't2' } },
    });
    expect(empty.find('.ant-empty').exists()).toBe(true);
    detail.unmount();
    diagram.unmount();
    empty.unmount();
  });
});
