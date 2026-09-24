import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkflowTaskPanel from './workflow-task-panel.vue';

describe('WorkflowTaskPanel', () => {
  it('renders the pending task and prevents a selected action from bypassing required fields', async () => {
    // 组件只展示服务端声明的节点字段；即使选择了动作，缺少必填项也不得发出 submit 事件。
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          actions: [{ code: 'approve', label: '通过' }],
          businessTitle: '费用报销 #1001',
          processInstanceId: 'process-1',
          requiredFields: ['reason'],
          status: 'Todo',
          taskDefinitionKey: 'approve',
          taskId: 'task-1',
          taskName: '费用审批',
        },
      },
      global: {
        stubs: {
          'a-alert': { props: ['message'], template: '<div class="alert">{{ message }}</div>' },
          'a-button': { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'a-card': { props: ['title'], template: '<section>{{ title }}<slot /><slot name="extra" /></section>' },
          'a-descriptions': { template: '<dl><slot /></dl>' },
          'a-descriptions-item': { template: '<dt><slot /></dt>' },
          'a-divider': { template: '<hr />' },
          'a-empty': { template: '<div><slot /></div>' },
          'a-form': { template: '<form><slot /></form>' },
          'a-form-item': { props: ['label'], template: '<label>{{ label }}<slot /></label>' },
          'a-input': { template: '<input />' },
          'a-list': { template: '<ul><slot /></ul>' },
          'a-list-item': { template: '<li><slot /></li>' },
          'a-list-item-meta': { template: '<div><slot /><slot name="title" /></div>' },
          'a-select': { template: '<select />' },
          'a-space': { template: '<div><slot /></div>' },
          'a-tag': { template: '<span><slot /></span>' },
          'a-textarea': { template: '<textarea />' },
          'a-timeline': { template: '<ol><slot /></ol>' },
          'a-timeline-item': { template: '<li><slot /></li>' },
        },
      },
    });

    expect(wrapper.text()).toContain('费用报销 #1001');
    expect(wrapper.text()).toContain('待处理');
    expect(wrapper.text()).toContain('请填写节点要求的表单字段后再提交。');

    const approve = wrapper.findAll('button').find((button) => button.text() === '通过');
    await approve?.trigger('click');
    expect(wrapper.emitted('action')?.at(-1)).toEqual([{ code: 'approve', label: '通过' }]);

    const confirm = wrapper.findAll('button').find((button) => button.text() === '确认通过');
    await confirm?.trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
