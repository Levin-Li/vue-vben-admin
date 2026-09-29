import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import WorkflowBusinessDetail from './workflow-business-detail.vue';
import WorkflowProcessDiagram from './workflow-process-diagram.vue';
import WorkflowRuntimeWorkbench from './workflow-runtime-workbench.vue';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    basePath = '';
  },
}));

describe('运行时公开组件独立挂载', () => {
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
        { id: 'start', name: '开始', status: 'completed' },
        { id: 'end', name: '结束', status: 'completed' },
      ],
      processDiagramEdges: [{ id: 'e1', source: 'start', target: 'end' }],
    };
    const api = {
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
