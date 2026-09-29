import { shallowMount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import WorkflowTaskPanel from './workflow-task-panel.vue';

// 行为测试保留真实v-model与点击，仅替换外观组件。
const actionStubs = {
  ...Object.fromEntries(
    [
      'a-card',
      'a-descriptions',
      'a-descriptions-item',
      'a-form',
      'a-form-item',
      'a-space',
      'a-tag',
      'a-divider',
      'a-empty',
      'a-timeline',
      'a-timeline-item',
      'a-list',
      'a-list-item',
      'a-list-item-meta',
    ].map((name) => [name, { template: '<div><slot /></div>' }]),
  ),
  'a-alert': { props: ['message'], template: '<div>{{ message }}</div>' },
  'a-button': {
    props: ['disabled'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'a-input': {
    props: ['value'],
    template:
      '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-input-number': { template: '<input />' },
  'a-textarea': {
    props: ['value'],
    template:
      '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-select': {
    name: 'TestSelect',
    props: ['value', 'options'],
    template:
      '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option value=""/><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  },
};

describe('workflowTaskPanel', () => {
  it('没有服务端动作时不补造通过按钮', () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: { task: { taskId: 't1', status: 'Todo' } },
      global: { stubs: actionStubs },
    });
    expect(wrapper.text()).toContain('当前没有可执行的授权动作');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('转办必须选择授权目标并填写意见后才提交独立动作参数', async () => {
    const action = {
      code: 'transfer',
      label: '转办',
      requiresComment: true,
      candidateUsers: [{ label: '审批员', value: 'u1' }],
    };
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: { task: { taskId: 't1', status: 'Todo', actions: [action] } },
      global: { stubs: actionStubs },
    });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '转办')
      ?.trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认转办')
      ?.trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('请选择允许的处理人');
    await wrapper.find('textarea').setValue('请专业人员处理');
    await wrapper.find('select').setValue('u1');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认转办')
      ?.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      action,
      comment: '请专业人员处理',
      targetUserId: 'u1',
      formData: {},
    });
  });

  it('切换任务清除动作与表单，未知参数能力显示原因', async () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 't1',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
        },
      },
      global: { stubs: actionStubs },
    });
    await wrapper.find('button').trigger('click');
    await wrapper.find('textarea').setValue('上一对象意见');
    await wrapper.setProps({
      task: {
        taskId: 't2',
        status: 'Todo',
        actions: [{ code: 'transfer', label: '转办' }],
      },
    });
    expect(wrapper.text()).toContain('服务端未提供可选处理人');
    expect(wrapper.findAll('button')).toHaveLength(0);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

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
          'a-alert': {
            props: ['message'],
            template: '<div class="alert">{{ message }}</div>',
          },
          'a-button': {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
          'a-card': {
            props: ['title'],
            template:
              '<section>{{ title }}<slot /><slot name="extra" /></section>',
          },
          'a-descriptions': { template: '<dl><slot /></dl>' },
          'a-descriptions-item': { template: '<dt><slot /></dt>' },
          'a-divider': { template: '<hr />' },
          'a-empty': { template: '<div><slot /></div>' },
          'a-form': { template: '<form><slot /></form>' },
          'a-form-item': {
            props: ['label'],
            template: '<label>{{ label }}<slot /></label>',
          },
          'a-input': { template: '<input />' },
          'a-input-number': { template: '<input type="number" />' },
          'a-list': { template: '<ul><slot /></ul>' },
          'a-list-item': { template: '<li><slot /></li>' },
          'a-list-item-meta': {
            template: '<div><slot /><slot name="title" /></div>',
          },
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

    const approve = wrapper
      .findAll('button')
      .find((button) => button.text() === '通过');
    await approve?.trigger('click');
    expect(wrapper.emitted('action')?.at(-1)).toEqual([
      { code: 'approve', label: '通过' },
    ]);

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text() === '确认通过');
    await confirm?.trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
