import type {
  WorkflowBusinessType,
  WorkflowCondition,
  WorkflowDesignerDefinition,
} from './types';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import { addNode, createDefinition } from './definition-model';
import WorkflowConditionEditor from './workflow-condition-editor.vue';
import WorkflowDesigner from './workflow-designer.vue';
import WorkflowParameterEditor from './workflow-parameter-editor.vue';

const business: WorkflowBusinessType = {
  businessType: 'request',
  contractVersion: '1',
  title: '申请单',
  fields: {
    key: { title: '申请编号', type: 'string', display: true },
    subject: { title: '申请标题', type: 'string', display: true },
    ready: {
      title: '资料完整',
      type: 'boolean',
      display: true,
      condition: true,
    },
    secret: { title: '机密', type: 'string', sensitivity: 'secret' },
  },
};

describe('可操作流程设计器', () => {
  it('已发布节点的动作与可读字段真实选中且保持只读', async () => {
    const definition = createDefinition('review', '审核');
    definition.businessBinding = {
      businessType: 'request',
      contractVersion: '1',
      identityField: 'key',
      titleField: 'subject',
    };
    const approval = addNode(definition, 'userTask');
    approval.actions = ['approve', 'reject'];
    approval.readableFields = ['key', 'subject'];
    const wrapper = mount(WorkflowDesigner, {
      props: {
        modelValue: definition,
        options: { businessTypes: [business] },
        readonly: true,
      },
    });
    await wrapper
      .findAll('nav button')
      .find((item) => item.text() === '节点与流转')
      ?.trigger('click');
    await wrapper
      .get(`[aria-label="配置节点 ${approval.name}"]`)
      .trigger('click');
    for (const [label, selected] of [
      ['允许动作', ['approve', 'reject']],
      ['可读业务字段', ['key', 'subject']],
    ] as const) {
      const select = wrapper
        .findAll('label')
        .find((item) => item.text().startsWith(label))
        ?.get('select');
      expect(select).toBeDefined();
      expect(
        Array.from(
          (select?.element as HTMLSelectElement).selectedOptions,
          (option) => option.value,
        ),
      ).toEqual(selected);
      expect(select?.attributes('disabled')).toBeDefined();
    }
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
  it('从能力目录选择对象并映射字段，不自动猜测字段', async () => {
    const definition = createDefinition('review', '审核');
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: definition, options: { businessTypes: [business] } },
    });
    await wrapper.get('select').setValue('request@1');
    const next = wrapper
      .emitted('update:modelValue')
      ?.at(-1)?.[0] as WorkflowDesignerDefinition;
    expect(next.businessBinding).toEqual({
      businessType: 'request',
      contractVersion: '1',
      identityField: '',
      titleField: '',
    });
    expect(definition.businessBinding).toBeUndefined();
    await wrapper.setProps({ modelValue: next });
    expect(wrapper.text()).toContain('申请编号');
    expect(wrapper.text()).not.toContain('机密');
  });

  it('点击新增审批节点会输出显式图，并可以配置节点', async () => {
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: createDefinition('review', '审核') },
    });
    await wrapper
      .findAll('nav button')
      .find((item) => item.text() === '节点与流转')
      ?.trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新增审批节点')
      ?.trigger('click');
    const next = wrapper
      .emitted('update:modelValue')
      ?.at(-1)?.[0] as WorkflowDesignerDefinition;
    expect(next.nodes.some((node) => node.type === 'userTask')).toBe(true);
    expect(next.edges).toHaveLength(2);
    await wrapper.setProps({ modelValue: next });
    expect(wrapper.text()).toContain('候选用户');
    expect(wrapper.text()).toContain('允许动作');
  });

  it('发布后只读模式不接受修改事件', async () => {
    const wrapper = mount(WorkflowDesigner, {
      props: { modelValue: createDefinition('review', '审核'), readonly: true },
    });
    await wrapper.get('input').trigger('input');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});

describe('类型化条件编辑器', () => {
  it('业务操作参数始终使用显式来源，数值与布尔保持类型', async () => {
    const wrapper = mount(WorkflowParameterEditor, {
      props: { parameters: { enabled: { title: '启用', type: 'boolean' } } },
    });
    await wrapper.get('[aria-label="启用参数来源"]').setValue('literal');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      enabled: { literal: false },
    });
    await wrapper.setProps({ modelValue: { enabled: { literal: false } } });
    await wrapper.get('[aria-label="启用参数值"]').setValue('true');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      enabled: { literal: true },
    });
  });
  it('布尔false以布尔值保存而非字符串', async () => {
    const wrapper = mount(WorkflowConditionEditor, {
      props: {
        modelValue: { eq: [{ variable: 'ready' }, { literal: true }] },
        variables: {
          ready: { source: 'business.ready', type: 'boolean', readAt: 'start' },
        },
      },
    });
    await wrapper.get('[aria-label="条件比较值"]').setValue('false');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      eq: [{ variable: 'ready' }, { literal: false }],
    });
  });

  it('前置依赖保留同轮已应用语义', async () => {
    const wrapper = mount(WorkflowConditionEditor, {
      props: { allowDependencies: true },
    });
    await wrapper.get('[aria-label="条件运算符"]').setValue('dependency');
    const next = wrapper
      .emitted('update:modelValue')
      ?.at(-1)?.[0] as WorkflowCondition;
    await wrapper.setProps({ modelValue: next });
    await wrapper.get('[aria-label="前置用途标识"]').setValue('review');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      dependency: {
        purposeKey: 'review',
        outcome: 'Approved',
        round: 'current',
        effects: 'Applied',
      },
    });
  });
});
