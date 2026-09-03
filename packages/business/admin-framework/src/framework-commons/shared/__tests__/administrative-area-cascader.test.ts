import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentOpenAreaCodes = vi.hoisted(() => vi.fn());

vi.mock('../administrative-area-data', async () => {
  const actual = await vi.importActual<typeof import('../administrative-area-data')>(
    '../administrative-area-data',
  );
  return {
    ...actual,
    getCurrentOpenAreaCodes,
  };
});

import AdministrativeAreaCascader from '../administrative-area-cascader.vue';

const CascaderStub = defineComponent({
  emits: ['dropdown-visible-change'],
  inheritAttrs: false,
  name: 'Cascader',
  props: ['changeOnSelect', 'displayRender', 'options'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        { onClick: () => emit('dropdown-visible-change', true) },
        '展开',
      );
  },
});

function mountCascader(props: Record<string, unknown> = {}) {
  return mount(AdministrativeAreaCascader, {
    global: {
      stubs: {
        Cascader: CascaderStub,
      },
    },
    props,
  });
}

describe('行政区划双模式选择器', () => {
  beforeEach(() => {
    getCurrentOpenAreaCodes.mockReset();
  });

  it('默认展开时只使用完整本地区域数据', async () => {
    const wrapper = mountCascader();

    await wrapper.get('button').trigger('click');

    expect(getCurrentOpenAreaCodes).not.toHaveBeenCalled();
    expect(
      wrapper.findComponent(CascaderStub).props('options'),
    ).toHaveLength(34);
  });

  it('未配置层级时按已有编码限制，空值默认选择区县', () => {
    const emptyWrapper = mountCascader();
    const emptyOptions = emptyWrapper.findComponent(CascaderStub).props(
      'options',
    ) as any[];
    const zhejiang = emptyOptions.find((item) => item.value === '330000');

    expect(
      emptyWrapper.findComponent(CascaderStub).props('changeOnSelect'),
    ).toBe(false);
    expect(zhejiang.children[0].children[0]).toMatchObject({
      isLeaf: true,
      level: 'district',
      value: '330102',
    });

    const cityWrapper = mountCascader({ modelValue: '330100' });
    const cityOptions = cityWrapper.findComponent(CascaderStub).props(
      'options',
    ) as any[];
    const city = cityOptions
      .find((item) => item.value === '330000')
      .children.find((item: any) => item.value === '330100');

    expect(city).toMatchObject({
      children: undefined,
      isLeaf: true,
      level: 'city',
    });
  });

  it('指定开放区域上下文后携带全部参数请求并应用过滤', async () => {
    getCurrentOpenAreaCodes.mockResolvedValue(['330106']);
    const wrapper = mountCascader({
      bizCategory: '支付',
      bizType: '收款',
      domain: 'checkout.example.test',
    });

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(getCurrentOpenAreaCodes).toHaveBeenCalledWith({
      bizCategory: '支付',
      bizType: '收款',
      domain: 'checkout.example.test',
    });
    expect(wrapper.findComponent(CascaderStub).props('options')).toMatchObject([
      {
        children: [
          {
            children: [{ label: '西湖区', value: '330106' }],
            label: '杭州市',
            value: '330100',
          },
        ],
        label: '浙江省',
        value: '330000',
      },
    ]);
  });

  it('受限模式仍用完整本地数据回显既有编码', () => {
    const wrapper = mountCascader({
      domain: 'checkout.example.test',
      modelValue: '110105',
    });
    const displayRender = wrapper.findComponent(CascaderStub).props(
      'displayRender',
    ) as () => string;

    expect(displayRender()).toBe('北京市 / 朝阳区');
  });
});
