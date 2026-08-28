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
  it('uses concise labels for the scope field and custom option', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        orgTree: [],
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    const optionTexts = wrapper
      .findAll('[data-test="select"]')[0]
      ?.findAll('option')
      .map((option) => option.text());

    expect(wrapper.get('[data-test="scope-template-label"]').text()).toBe(
      '组织范围',
    );
    expect(optionTexts).toContain('自定义');
    expect(optionTexts).not.toContain('自定义表达式');
  });

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
    expect(
      wrapper.findAll('[data-test="org-path-pattern-test-target"]'),
    ).toHaveLength(0);
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
    ).toBe('请输入 *?通配表达式');
    expect(wrapper.text()).not.toContain('Groovy');
    expect(wrapper.text()).not.toContain('SpringEL');
  });

  it('explains the matching fields and wildcards for IdPath and NamePath', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        orgTree: [],
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();
    const scopeExpressionSelect = wrapper.findAll('[data-test="select"]')[0];
    if (!scopeExpressionSelect) {
      throw new Error('未找到组织范围表达式选择器');
    }

    await scopeExpressionSelect.setValue('Custom');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'IdPath：按所选组织到被匹配组织的相对组织 ID 路径逐段匹配',
    );
    expect(wrapper.text()).toContain('示例：/SALES/SALES_EAST');
    expect(wrapper.text()).toContain('* 匹配一层，** 匹配零层或多层');
    expect(wrapper.text()).toContain(
      '当前服务端对精确层级的自定义规则（如 /*/*）存在已知匹配问题',
    );

    const expressionTypeSelect = wrapper.findAll('[data-test="select"]')[1];
    if (!expressionTypeSelect) {
      throw new Error('未找到组织范围表达式类型选择器');
    }

    await expressionTypeSelect.setValue('NamePath');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'NamePath：按所选组织到被匹配组织的相对组织名称路径逐段匹配',
    );
    expect(wrapper.text()).toContain('示例：/销售部/华东组');
  });

  it('tests IdPath and NamePath expressions locally with PathPattern', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        orgTree: [],
        value: [],
      },
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');
    await flushPromises();

    const scopeExpressionSelect = wrapper.findAll('[data-test="select"]')[0];
    if (!scopeExpressionSelect) {
      throw new Error('未找到组织范围选择器');
    }

    await scopeExpressionSelect.setValue('Custom');
    await flushPromises();

    const expressionEditor = wrapper.get('[data-test="org-expression-editor"]');
    expect(expressionEditor.classes()).toContain('min-h-20');
    await expressionEditor.setValue('/*/*');
    await wrapper
      .get('[data-test="org-path-pattern-test-target"]')
      .setValue('/SALES/EAST');
    await wrapper.get('[data-test="org-path-pattern-test"]').trigger('click');

    expect(wrapper.get('[data-test="org-path-pattern-test-result"]').text()).toBe(
      '匹配结果：匹配',
    );

    await wrapper
      .get('[data-test="org-path-pattern-test-target"]')
      .setValue('/SALES');
    await wrapper.get('[data-test="org-path-pattern-test"]').trigger('click');

    expect(wrapper.get('[data-test="org-path-pattern-test-result"]').text()).toBe(
      '匹配结果：不匹配',
    );

    const expressionTypeSelect = wrapper.findAll('[data-test="select"]')[1];
    if (!expressionTypeSelect) {
      throw new Error('未找到组织范围表达式类型选择器');
    }

    await expressionTypeSelect.setValue('NamePath');
    await flushPromises();

    expect(
      wrapper.findAll('[data-test="org-path-pattern-test-target"]'),
    ).toHaveLength(1);
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

  it('does not expose an existing tenant Groovy script when scripts are not allowed', async () => {
    const wrapper = mount(OrgScopeEditor, {
      props: {
        orgTree: [],
        showTenantMatchingExpression: true,
        value: [
          {
            isAllow: true,
            orgId: 'org-hq',
            orgName: '集团总部',
            orgScopeExpression: '/**',
            orgScopeExpressionType: 'IdPath',
            tenantMatchingExpression: '#!groovy:_tenant.id == 1',
          },
        ],
      },
    });

    await wrapper.get('[data-test="org-edit-org-hq"]').trigger('click');
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
    expect(wrapper.findAll('[data-test="select"]')[0]!.element.value).toBe(
      'default',
    );
    expect(wrapper.text()).not.toContain('Groovy');
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
