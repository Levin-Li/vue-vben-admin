import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import OrgScopeEditor from '../org-scope-editor.vue';

vi.mock('ant-design-vue', () => ({
  Button: defineComponent({
    name: 'Button',
    template: '<button><slot /></button>',
  }),
  Empty: defineComponent({
    name: 'Empty',
    props: ['description'],
    template: '<div>{{ description }}</div>',
  }),
  message: {
    error: vi.fn(),
    warning: vi.fn(),
  },
  Modal: Object.assign(
    defineComponent({
      name: 'Modal',
      props: ['open', 'title'],
      template: '<div v-if="open"><slot /></div>',
    }),
    {
      confirm: vi.fn(),
    },
  ),
  Radio: {
    Group: defineComponent({
      name: 'RadioGroup',
      props: ['options', 'value'],
      template: '<div data-test="radio-group"></div>',
    }),
  },
  Select: defineComponent({
    name: 'Select',
    emits: ['change'],
    props: ['options', 'value'],
    template: `
      <select data-test="select" :value="value" @change="$emit('change', $event.target.value)">
        <option v-for="option in options" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    `,
  }),
  TreeSelect: defineComponent({
    name: 'TreeSelect',
    emits: ['change'],
    props: ['treeData', 'value'],
    template: '<div data-test="tree-select"></div>',
  }),
}));

describe('OrgScopeEditor', () => {
  it('shows SpringEL variables tip for custom org scope expressions', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        allowScriptExpressionTypes: true,
        orgTree: [],
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    await wrapper.findAll('[data-test="select"]')[0]!.setValue('Custom');
    await flushPromises();

    await wrapper.findAll('[data-test="select"]')[1]!.setValue('SpringEL');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'SpringEL 可用变量：_org 当前被匹配组织节点；_user 当前登录用户。',
    );
    expect(
      wrapper.find('[data-test="org-expression-editor"]').attributes(
        'placeholder',
      ),
    ).toBe('请输入 SpringEL 表达式，可使用 _org、_user');
    expect(wrapper.text()).not.toContain('Groovy 可用变量：_org');
  });

  it('hides script expression types when scripts are not allowed', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        expressionTypes: ['IdPath', 'NamePath', 'Groovy', 'SpringEL'],
        orgTree: [],
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    await wrapper.findAll('[data-test="select"]')[0]!.setValue('Custom');
    await flushPromises();

    const optionTexts = wrapper
      .findAll('[data-test="select"]')[1]!
      .findAll('option')
      .map((option) => option.text());

    expect(optionTexts).toEqual(['IdPath', 'NamePath']);
    expect(
      wrapper.find('[data-test="org-expression-editor"]').attributes(
        'placeholder',
      ),
    ).toBe('请输入 *?通配表达式、Groovy 或 SpringEL 表达式');
  });

  it('shows script expression types when scripts are allowed', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        allowScriptExpressionTypes: true,
        expressionTypes: ['IdPath', 'NamePath', 'Groovy', 'SpringEL'],
        orgTree: [],
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    await wrapper.findAll('[data-test="select"]')[0]!.setValue('Custom');
    await flushPromises();

    const optionTexts = wrapper
      .findAll('[data-test="select"]')[1]!
      .findAll('option')
      .map((option) => option.text());

    expect(optionTexts).toEqual(['IdPath', 'NamePath', 'Groovy', 'SpringEL']);
  });

  it('hides tenant Groovy mode when scripts are not allowed', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        orgTree: [],
        showTenantMatchingExpression: true,
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    const tenantModeOptions = wrapper
      .findAll('[data-test="select"]')[0]!
      .findAll('option')
      .map((option) => option.text());

    expect(tenantModeOptions).toEqual([
      '默认租户',
      '所有租户',
      '无租户',
      '指定租户',
      '路径表达式',
    ]);
    expect(wrapper.text()).not.toContain('普通文本按租户ID精确匹配');

    await wrapper.findAll('[data-test="select"]')[0]!.setValue('path');
    await flushPromises();

    expect(wrapper.find('input').attributes('placeholder')).toBe(
      '请输入租户ID或 *?通配表达式',
    );
  });

  it('shows tenant Groovy mode when scripts are allowed', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        allowScriptExpressionTypes: true,
        orgTree: [],
        showTenantMatchingExpression: true,
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    const tenantModeOptions = wrapper
      .findAll('[data-test="select"]')[0]!
      .findAll('option')
      .map((option) => option.text());

    expect(tenantModeOptions).toEqual([
      '默认租户',
      '所有租户',
      '无租户',
      '指定租户',
      '路径表达式',
      'Groovy 脚本',
    ]);
  });
});
