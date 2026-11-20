import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { Checkbox, Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import RuleEditor from '../rule-editor.vue';
import { validateMaskingRuleContent } from '../rules';

vi.mock('../../../api/data-masking-setting-service', () => ({
  dataMaskingSettingService: {
    entityCatalog: vi.fn(async () => [
      {
        entityClass: 'example.Order',
        entityTitle: '订单',
        fieldName: 'id',
        fieldTitle: '订单编号',
      },
      {
        entityClass: 'example.Order',
        entityTitle: '订单',
        fieldName: 'secret',
      },
      {
        entityClass: 'example.User',
        entityTitle: '用户',
        fieldName: 'name',
        fieldTitle: '姓名',
      },
      {
        entityClass: 'example.Legacy',
        fieldName: 'legacyId',
      },
    ]),
  },
}));

describe('实体优先脱敏规则编辑', () => {
  it('旧规则不自动转换，提示移除并重新配置', async () => {
    const formState = reactive({
      valueContent: [
        { entityClass: 'example.Order', fieldName: 'id', treatment: 'MASK' },
      ] as unknown[],
    });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    expect(wrapper.text()).toContain('检测到旧版脱敏规则');
    expect(() => validateMaskingRuleContent(formState.valueContent)).toThrow(
      '重新配置',
    );
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '移除实体')
      ?.trigger('click');
    expect(formState.valueContent).toEqual([]);
    wrapper.findComponent(Select).vm.$emit('update:value', 'example.Order');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '添加实体')
      ?.trigger('click');
    wrapper
      .findAllComponents(Checkbox)
      .find((item) => item.text().includes('id'))
      ?.vm.$emit('change', { target: { checked: true } });
    expect(formState.valueContent).toEqual([
      {
        entityClass: 'example.Order',
        fieldName: 'id',
        schemaVersion: 2,
        treatment: 'HIDE',
      },
    ]);
    expect(validateMaskingRuleContent(formState.valueContent)).toBe(
      formState.valueContent,
    );
    wrapper.unmount();
  });
  it('中文名称优先并支持中文、拼音和技术名称搜索，保留原规则标识', async () => {
    const formState = reactive({
      valueContent: [
        {
          entityClass: 'example.Order',
          fieldName: 'id',
          schemaVersion: 2,
          treatment: 'HIDE',
        },
      ],
    });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    expect(wrapper.text()).toContain('订单（Order）');
    expect(wrapper.text()).toContain('订单编号（id）');
    expect(wrapper.text()).not.toContain('查看实际覆盖接口');
    expect(wrapper.text()).toContain('secret');
    const select = wrapper.findComponent(Select);
    const option = (
      select.props('options') as { label: string; value: string }[]
    )[0];
    expect(option).toEqual({ label: '用户（User）', value: 'example.User' });
    expect(select.props('options')).toContainEqual({
      label: 'Legacy',
      value: 'example.Legacy',
    });
    const filter = select.props('filterOption') as (
      input: string,
      item: typeof option,
    ) => boolean;
    expect(filter('用户', option)).toBe(true);
    expect(filter('yonghu', option)).toBe(true);
    expect(filter('User', option)).toBe(true);
    expect(filter('example.User', option)).toBe(true);
    expect(formState.valueContent).toEqual([
      {
        entityClass: 'example.Order',
        fieldName: 'id',
        schemaVersion: 2,
        treatment: 'HIDE',
      },
    ]);
    wrapper.unmount();
  });

  it('可还原规则只需绑定范围与有效期，不再要求选择接口', async () => {
    const formState = reactive({
      valueContent: [
        {
          entityClass: 'example.Order',
          fieldName: 'id',
          schemaVersion: 2,
          treatment: 'REVERSIBLE_ID',
          binding: 'USER',
          validSeconds: 3600,
        },
      ],
    });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    expect(wrapper.find('[placeholder="接收 ID 的接口"]').exists()).toBe(false);
    expect(wrapper.find('[placeholder="接收 ID 的请求字段"]').exists()).toBe(
      false,
    );
    expect(validateMaskingRuleContent(formState.valueContent)).toBe(
      formState.valueContent,
    );
    expect(formState.valueContent[0]).not.toHaveProperty('inputOperation');
    wrapper.unmount();
  });

  it('同一配置可新增两个实体并移除实体规则，不按接口覆盖限制字段', async () => {
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
    expect(wrapper.text()).not.toContain('映射有歧义');
    expect(
      wrapper
        .findAllComponents(Checkbox)
        .some((item) => item.props('disabled')),
    ).toBe(false);
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
      { entityClass: 'example.Order', fieldName: 'id', schemaVersion: 2 },
      { entityClass: 'example.User', fieldName: 'name', schemaVersion: 2 },
    ]);
    expect(validateMaskingRuleContent(formState.valueContent)).toBe(
      formState.valueContent,
    );

    await wrapper
      .findAll('button')
      .find((item) => item.text() === '移除实体')
      ?.trigger('click');
    expect(formState.valueContent).toMatchObject([
      { entityClass: 'example.User', fieldName: 'name', schemaVersion: 2 },
    ]);
    wrapper.unmount();
  });
});
