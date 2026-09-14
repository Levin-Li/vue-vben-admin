/* eslint-disable vue/one-component-per-file -- 在单测中隔离组件库的轻量替身 */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import AclTestPage from '../index.vue';

const { service } = vi.hoisted(() => ({
  service: {
    sms: vi.fn(),
    email: vi.fn(),
    mfa: vi.fn(),
    hmi: vi.fn(),
    sign: vi.fn(),
    buildRequestPath: () => '/com.levin.oak.base/V1/api/aclTest/sign',
  },
}));
vi.mock('../../../api/acl-test-service', () => ({ aclTestService: service }));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const input = defineComponent({
    props: { value: { type: String, default: '' } },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          value: props.value,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLInputElement).value),
        }),
  });
  return {
    Alert: defineComponent({
      props: { message: { type: String, default: '' } },
      setup: (p) => () => h('p', p.message),
    }),
    Card: box,
    Button: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    Input: Object.assign(input, { TextArea: input, Password: input }),
    Select: input,
  };
});

beforeEach(() => {
  Object.values(service).forEach((fn) => {
    if (vi.isMockFunction(fn))
      fn.mockReset().mockResolvedValue({ message: '回显成功' });
  });
});

function buttonByText(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text() === label);
  if (!button) throw new Error(`没有找到按钮：${label}`);
  return button;
}

describe('访问控制独立测试页', () => {
  it.each(['短信验证码', '邮箱验证码', 'MFA 验证', '行为验证码'])(
    '点击%s调用对应服务并显示回显',
    async (label) => {
      const kind = {
        短信验证码: 'sms',
        邮箱验证码: 'email',
        'MFA 验证': 'mfa',
        行为验证码: 'hmi',
      }[label] as 'sms';
      const wrapper = mount(AclTestPage);
      await buttonByText(wrapper, label).trigger('click');
      await flushPromises();
      expect(service[kind]).toHaveBeenCalledWith(
        JSON.stringify({ message: '访问控制测试' }),
      );
      expect(wrapper.text()).toContain('回显成功');
      wrapper.unmount();
    },
  );
  it('无效 JSON 不发送请求，保持输入并展示错误', async () => {
    const wrapper = mount(AclTestPage);
    await wrapper.find('#acl-test-body').setValue('invalid json');
    await buttonByText(wrapper, '短信验证码').trigger('click');
    expect(service.sms).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('请输入有效 JSON');
    wrapper.unmount();
  });
  it('签名凭据缺失时不发送请求', async () => {
    const wrapper = mount(AclTestPage);
    await buttonByText(wrapper, '签名验证').trigger('click');
    expect(service.sign).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('请先输入应用 ID 和签名密钥');
    wrapper.unmount();
  });
});
