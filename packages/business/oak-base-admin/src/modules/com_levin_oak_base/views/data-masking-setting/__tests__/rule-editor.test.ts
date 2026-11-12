import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { Checkbox, Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import RuleEditor from '../rule-editor.vue';
import { validateMaskingRuleContent } from '../rules';

vi.mock('../../../api/data-masking-setting-service', () => ({
  dataMaskingSettingService: {
    catalog: vi.fn(async () => []),
    entityCatalog: vi.fn(async () => [
      {
        entityClass: 'example.Order',
        fieldName: 'id',
        coverage: [
          {
            operation: 'Order.list',
            methods: ['GET'],
            paths: ['/orders'],
            outputFieldPath: 'data.items[*].id',
          },
        ],
        ambiguousOperations: [],
      },
      {
        entityClass: 'example.Order',
        fieldName: 'secret',
        coverage: [],
        ambiguousOperations: ['Order.detail'],
      },
      {
        entityClass: 'example.User',
        fieldName: 'name',
        coverage: [
          {
            operation: 'User.list',
            methods: ['GET'],
            paths: ['/users'],
            outputFieldPath: 'data.items[*].name',
          },
        ],
        ambiguousOperations: [],
      },
    ]),
  },
}));

describe('实体优先脱敏规则编辑', () => {
  it('同一配置可新增两个实体，禁选无明确映射的字段并移除实体规则', async () => {
    const formState = reactive({ valueContent: [] as unknown[] });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();

    wrapper.findComponent(Select).vm.$emit('update:value', 'example.Order');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '添加实体')
      ?.trigger('click');
    expect(wrapper.text()).toContain('Order');
    expect(wrapper.text()).toContain('映射有歧义');
    expect(
      wrapper
        .findAllComponents(Checkbox)
        .some((item) => item.props('disabled')),
    ).toBe(true);
    wrapper
      .findAllComponents(Checkbox)
      .find((item) => item.text().includes('id'))
      ?.vm.$emit('change', { target: { checked: true } });
    await flushPromises();

    wrapper.findComponent(Select).vm.$emit('update:value', 'example.User');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '添加实体')
      ?.trigger('click');
    wrapper
      .findAllComponents(Checkbox)
      .find((item) => item.text().includes('name'))
      ?.vm.$emit('change', { target: { checked: true } });
    await flushPromises();
    expect(formState.valueContent).toMatchObject([
      { entityClass: 'example.Order', fieldName: 'id' },
      { entityClass: 'example.User', fieldName: 'name' },
    ]);
    expect(validateMaskingRuleContent(formState.valueContent)).toBe(
      formState.valueContent,
    );

    await wrapper
      .findAll('button')
      .find((item) => item.text() === '移除实体')
      ?.trigger('click');
    expect(formState.valueContent).toMatchObject([
      { entityClass: 'example.User', fieldName: 'name' },
    ]);
    wrapper.unmount();
  });
});
