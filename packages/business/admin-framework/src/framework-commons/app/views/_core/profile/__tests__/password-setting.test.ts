import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = reactive({
  email: 'demo@example.com',
  mobile: '13800000000',
  mustChangeInitialPassword: false,
});
const {
  completeInitialPasswordChangeApi,
  getVerifyCodeApi,
  logout,
  updateLoginInfoApi,
} = vi.hoisted(() => ({
  completeInitialPasswordChangeApi: vi.fn(),
  getVerifyCodeApi: vi.fn(),
  logout: vi.fn(),
  updateLoginInfoApi: vi.fn(),
}));

vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: currentUser }),
}));

vi.mock('../../../../api', () => ({
  completeInitialPasswordChangeApi,
  getVerifyCodeApi,
  updateLoginInfoApi,
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({ logout }),
}));

vi.mock('../../authentication/login-verify-type', () => ({
  extractReturnedVerifyCode: () => '',
}));

vi.mock('ant-design-vue', () => {
  const Input = defineComponent({
    props: ['placeholder', 'value'],
    emits: ['update:value'],
    template:
      '<input :placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  });

  return {
    Alert: defineComponent({
      props: ['message'],
      template: '<div>{{ message }}</div>',
    }),
    Button: defineComponent({
      props: ['disabled', 'loading'],
      emits: ['click'],
      template:
        '<button :disabled="disabled || loading" type="button" @click="$emit(\'click\')"><slot /></button>',
    }),
    Form: Object.assign(
      defineComponent({ template: '<form><slot /></form>' }),
      {
        Item: defineComponent({
          props: ['label'],
          template: '<label><slot /></label>',
        }),
      },
    ),
    Input: Object.assign(Input, { Password: Input }),
    Space: Object.assign(defineComponent({ template: '<div><slot /></div>' }), {
      Compact: defineComponent({ template: '<div><slot /></div>' }),
    }),
    Tabs: Object.assign(
      defineComponent({
        emits: ['change', 'update:activeKey'],
        template: `
          <div>
            <button type="button" @click="$emit('update:activeKey', 'sms'); $emit('change')">短信验证码修改</button>
            <button type="button" @click="$emit('update:activeKey', 'email'); $emit('change')">邮箱验证码修改</button>
            <slot />
          </div>
        `,
      }),
      { TabPane: defineComponent({ template: '<div />' }) },
    ),
    Typography: Object.assign(
      defineComponent({ template: '<div><slot /></div>' }),
      {
        Text: defineComponent({ template: '<span><slot /></span>' }),
      },
    ),
    message: { success: vi.fn(), warning: vi.fn() },
  };
});

describe('password-setting', () => {
  beforeEach(() => {
    currentUser.email = 'demo@example.com';
    currentUser.mobile = '13800000000';
    currentUser.mustChangeInitialPassword = false;
    completeInitialPasswordChangeApi.mockReset();
    getVerifyCodeApi.mockReset();
    logout.mockReset();
    updateLoginInfoApi.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts independent 60-second cooldowns for SMS and email password verification', async () => {
    // 短信和邮箱模式均应在发送成功后单独禁用对应验证码按钮。
    vi.useFakeTimers();
    getVerifyCodeApi.mockResolvedValue({});

    const passwordModule = await import('../password-setting.vue');
    const PasswordSetting = passwordModule.default;
    const wrapper = mount(PasswordSetting);
    const findButton = (text: string) =>
      wrapper.findAll('button').find((button) => button.text() === text);

    await findButton('短信验证码修改')?.trigger('click');
    await findButton('发送验证码')?.trigger('click');
    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: '13800000000',
      verifyCodeType: 'Sms',
    });
    expect(findButton('60s 后重试')?.attributes('disabled')).toBeDefined();

    await findButton('邮箱验证码修改')?.trigger('click');
    expect(findButton('发送验证码')).toBeTruthy();
    await findButton('发送验证码')?.trigger('click');
    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: 'demo@example.com',
      verifyCodeType: 'Email',
    });
    expect(findButton('60s 后重试')?.attributes('disabled')).toBeDefined();

    await vi.advanceTimersByTimeAsync(1000);
    expect(findButton('59s 后重试')).toBeTruthy();

    wrapper.unmount();
  });

  it('forces the dedicated old-password flow and clears the session after success', async () => {
    // 初始口令会话只能走专用接口，不能切换到短信或邮箱模式绕过后端门禁。
    currentUser.mustChangeInitialPassword = true;
    completeInitialPasswordChangeApi.mockResolvedValue(null);
    logout.mockResolvedValue(undefined);
    const passwordModule = await import('../password-setting.vue');
    const PasswordSetting = passwordModule.default;
    const wrapper = mount(PasswordSetting);

    expect(wrapper.text()).toContain('请先修改密码');
    expect(
      wrapper
        .findAll('button')
        .some((button) => button.text() === '短信验证码修改'),
    ).toBe(false);
    await wrapper.find('input[placeholder="请输入原密码"]').setValue('123456');
    await wrapper.find('input[placeholder="请输入新密码"]').setValue('Aa1234');
    await wrapper
      .find('input[placeholder="请再次输入新密码"]')
      .setValue('Aa1234');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '更新密码')
      ?.trigger('click');
    await flushPromises();

    expect(completeInitialPasswordChangeApi).toHaveBeenCalledWith({
      oldPwd: '123456',
      newPwd: 'Aa1234',
    });
    expect(updateLoginInfoApi).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledWith(false, false);
    wrapper.unmount();
  });
});
