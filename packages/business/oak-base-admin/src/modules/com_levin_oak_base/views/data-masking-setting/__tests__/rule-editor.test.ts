import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { Checkbox, InputNumber, Select } from 'ant-design-vue';
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
        hasInputMapping: true,
      },
      {
        entityClass: 'example.Order',
        entityTitle: '订单',
        fieldName: 'secret',
        hasInputMapping: false,
      },
      {
        entityClass: 'example.Order',
        entityTitle: '订单',
        fieldName: 'image',
        fieldTitle: '图片',
        hasInputMapping: false,
        configurable: false,
        unsupportedReason: '图片字段暂不支持',
      },
      {
        entityClass: 'example.Order',
        entityTitle: '订单',
        fieldName: 'details',
        fieldTitle: '复杂对象',
        hasInputMapping: false,
        configurable: false,
        unsupportedReason: '复杂对象暂不支持',
      },
      {
        entityClass: 'example.User',
        entityTitle: '用户',
        fieldName: 'name',
        fieldTitle: '姓名',
        hasInputMapping: true,
      },
      {
        entityClass: 'example.Legacy',
        fieldName: 'legacyId',
        hasInputMapping: false,
      },
    ]),
  },
}));

describe('实体优先脱敏规则编辑', () => {
  it('有效期输入支持数值及清空，非法输入不会被当成永不过期', async () => {
    const formState = reactive({ valueContent: [{ entityClass: 'example.Order', fieldName: 'id', schemaVersion: 2,
      treatment: 'REVERSIBLE_ID', binding: 'USER', validSeconds: null as null | number }] });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    const input = wrapper.findComponent(InputNumber);
    expect(input.props('value')).toBeUndefined();
    input.vm.$emit('update:value', 3600);
    expect(formState.valueContent[0]?.validSeconds).toBe(3600);
    input.vm.$emit('update:value', null);
    expect(formState.valueContent[0]?.validSeconds).toBeNull();
    input.vm.$emit('update:value', 'invalid');
    expect(() => validateMaskingRuleContent(formState.valueContent)).toThrow();
    wrapper.unmount();
  });
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

  it('新选可还原 ID 默认绑定当前会话且无独立有效期', async () => {
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
    const treatment = wrapper
      .findAllComponents(Select)
      .find((item) =>
        (item.props('options') as undefined | { value?: string }[])?.some(
          (option) => option.value === 'REVERSIBLE_ID',
        ),
      );
    treatment?.vm.$emit('change', 'REVERSIBLE_ID');
    await flushPromises();
    expect(formState.valueContent[0]).toMatchObject({
      treatment: 'REVERSIBLE_ID',
      binding: 'SESSION',
      validSeconds: null,
    });
    expect(wrapper.find('input[placeholder="默认不过期"]').exists()).toBe(true);
    expect(validateMaskingRuleContent(formState.valueContent)).toBe(
      formState.valueContent,
    );
    wrapper.unmount();
  });

  it('图片和复杂对象字段灰显且不会加入规则', async () => {
    const formState = reactive({ valueContent: [] as unknown[] });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    wrapper.findComponent(Select).vm.$emit('update:value', 'example.Order');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '添加实体')
      ?.trigger('click');
    await flushPromises();
    for (const label of ['图片', '复杂对象']) {
      const field = wrapper
        .findAllComponents(Checkbox)
        .find((item) => item.text().includes(label));
      expect(field?.props('disabled')).toBe(true);
      field?.vm.$emit('change', { target: { checked: true } });
    }
    expect(wrapper.text()).toContain('图片字段暂不支持');
    expect(wrapper.text()).toContain('复杂对象暂不支持');
    expect(formState.valueContent).toEqual([]);
    wrapper.unmount();
  });

  it('已选字段变为不支持后仍可取消，不能重新勾选', async () => {
    const formState = reactive({
      valueContent: [
        {
          entityClass: 'example.Order',
          fieldName: 'image',
          schemaVersion: 2,
          treatment: 'HIDE',
        },
      ],
    });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    const field = wrapper
      .findAllComponents(Checkbox)
      .find((item) => item.text().includes('图片'));
    expect(field?.props('disabled')).toBe(false);
    field?.vm.$emit('change', { target: { checked: false } });
    await flushPromises();
    expect(formState.valueContent).toEqual([]);
    expect(field?.props('disabled')).toBe(true);
    field?.vm.$emit('change', { target: { checked: true } });
    expect(formState.valueContent).toEqual([]);
    wrapper.unmount();
  });

  it('编辑已有可还原规则不覆盖原绑定或有效期', async () => {
    const formState = reactive({
      valueContent: [
        {
          entityClass: 'example.Order',
          fieldName: 'id',
          schemaVersion: 2,
          treatment: 'REVERSIBLE_ID',
          binding: 'USER',
          validSeconds: 1200,
        },
      ],
    });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    const treatment = wrapper
      .findAllComponents(Select)
      .find((item) =>
        (item.props('options') as undefined | { value?: string }[])?.some(
          (option) => option.value === 'REVERSIBLE_ID',
        ),
      );
    treatment?.vm.$emit('change', 'REVERSIBLE_ID');
    expect(formState.valueContent[0]).toMatchObject({
      binding: 'USER',
      validSeconds: 1200,
    });
    wrapper.unmount();
  });

  it('无请求字段映射时禁止新增可还原规则，已有规则可改为隐藏', async () => {
    const formState = reactive({
      valueContent: [
        {
          entityClass: 'example.Order',
          fieldName: 'secret',
          schemaVersion: 2,
          treatment: 'REVERSIBLE_ID',
          binding: 'USER',
          validSeconds: 3600,
        },
      ],
    });
    const wrapper = mount(RuleEditor, { props: { formState } });
    await flushPromises();
    expect(wrapper.text()).toContain('当前字段缺少请求映射');
    const treatment = wrapper
      .findAllComponents(Select)
      .find((item) =>
        (item.props('options') as undefined | { value?: string }[])?.some(
          (option) => option.value === 'REVERSIBLE_ID',
        ),
      );
    expect(treatment).toBeDefined();
    expect(treatment?.props('options')).toContainEqual({
      label: '可还原 ID（缺少请求字段映射）',
      value: 'REVERSIBLE_ID',
      disabled: true,
    });
    treatment?.vm.$emit('change', 'HIDE');
    await flushPromises();
    expect(formState.valueContent[0]?.treatment).toBe('HIDE');
    expect(wrapper.text()).not.toContain('当前字段缺少请求映射');
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
        .find((item) => item.text().includes('id'))
        ?.props('disabled'),
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
