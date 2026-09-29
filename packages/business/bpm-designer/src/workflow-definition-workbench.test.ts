import type { WorkflowDefinitionVersion } from './types';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { createDefinition } from './definition-model';
import WorkflowDefinitionWorkbench from './workflow-definition-workbench.vue';
import { WorkflowDesignerService } from './workflow-designer-service';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    constructor(readonly basePath: string) {}
  },
}));

const button = {
  props: ['disabled'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
};
const box = { template: '<div><slot /><slot name="description" /></div>' };
const global = {
  stubs: {
    AButton: button,
    AAlert: {
      props: ['message'],
      template: '<div>{{ message }}<slot name="description" /></div>',
    },
    ACard: box,
    ASpace: box,
    ADescriptions: box,
    ADescriptionsItem: box,
    APopconfirm: box,
  },
};
function setup(lifecycle: WorkflowDefinitionVersion['lifecycle'] = 'Draft') {
  const definition = createDefinition('review', '审核');
  definition.purposeKey = 'review';
  definition.businessBinding = {
    businessType: 'request',
    contractVersion: '1',
    identityField: 'id',
    titleField: 'title',
  };
  const service = new WorkflowDesignerService();
  const options = {
    businessTypes: [
      {
        businessType: 'request',
        contractVersion: '1',
        title: '申请',
        fields: {
          id: { title: '编号', type: 'string' as const },
          title: { title: '标题', type: 'string' as const },
        },
      },
    ],
  };
  return {
    definition,
    options,
    service,
    version: {
      id: 'v1',
      lifecycle,
      optimisticLock: 4,
      lowflowDefinition: structuredClone(definition),
      simulationReport: { successful: true },
    },
  };
}

describe('流程定义工作台', () => {
  it('已发布版本展示中文生命周期且继续保持只读', async () => {
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: setup('Published'),
      global,
    });
    await flushPromises();
    expect(wrapper.text()).toContain('当前版本：已发布');
    expect(wrapper.text()).not.toContain('当前版本：Published');
    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
  it('编辑Testing配置立即禁用旧模拟证明的发布资格', async () => {
    const props = setup('Testing');
    props.definition.name = '已修改审核';
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await flushPromises();
    expect(wrapper.findAll('button').map((item) => item.text())).toEqual(
      expect.arrayContaining(['发布', '保存草稿']),
    );
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '发布')
        ?.attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '保存草稿')
        ?.attributes('disabled'),
    ).toBeUndefined();
  });

  it('保存失败保留输入并携带乐观锁', async () => {
    const props = setup();
    props.definition.name = '尚未保存';
    const save = vi
      .spyOn(props.service, 'saveDraft')
      .mockRejectedValue(new Error('版本已被修改'));
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '保存草稿')
      ?.trigger('click');
    await flushPromises();
    expect(save).toHaveBeenCalledWith('v1', props.definition, 4);
    expect(wrapper.text()).toContain('版本已被修改');
    expect(wrapper.emitted('update:definition')).toBeUndefined();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe(
      '尚未保存',
    );
  });

  it('宿主拒绝操作权限时不展示对应动作', async () => {
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: {
        ...setup(),
        permissions: { save: false, simulate: false, publish: false },
      },
      global,
    });
    await flushPromises();
    const labels = wrapper.findAll('button').map((item) => item.text());
    expect(labels).not.toContain('保存草稿');
    expect(labels).not.toContain('开始自动模拟');
    expect(labels).not.toContain('发布');
  });
});
