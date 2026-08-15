import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authLogin,
  authLoginWithPasswordChallenge,
  getVerifyCodeApi,
  startPasswordLoginApi,
} = vi.hoisted(() => {
  return {
    authLogin: vi.fn(),
    authLoginWithPasswordChallenge: vi.fn(),
    getVerifyCodeApi: vi.fn(),
    startPasswordLoginApi: vi.fn(),
  };
});

vi.mock('@vben/locales', () => ({
  $t: (key: string) =>
    ({
      'authentication.welcomeBack': '欢迎回来',
      'common.login': '登录',
    })[key] || key,
}));

vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  getVerifyCodeApi,
  startPasswordLoginApi,
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    authLogin,
    authLoginWithPasswordChallenge,
    loginLoading: false,
  }),
}));

vi.mock('../auth-brand', () => ({
  useAuthBrand: () => ({
    techSupport: computed(() => ''),
  }),
}));

vi.mock('ant-design-vue', () => {
  const Input = Object.assign(
    defineComponent({
      emits: ['blur', 'update:value'],
      methods: {
        updateValue(event: Event) {
          this.$emit('update:value', (event.target as HTMLInputElement).value);
        },
      },
      props: ['autocomplete', 'placeholder', 'size', 'value'],
      template:
        '<input :autocomplete="autocomplete" :placeholder="placeholder" :value="value" @blur="$emit(\'blur\', $event)" @input="updateValue" />',
    }),
    {
      Password: defineComponent({
        emits: ['update:value'],
        methods: {
          updateValue(event: Event) {
            this.$emit(
              'update:value',
              (event.target as HTMLInputElement).value,
            );
          },
        },
        props: ['autocomplete', 'placeholder', 'size', 'value'],
        template:
          '<input :autocomplete="autocomplete" :placeholder="placeholder" type="password" :value="value" @input="updateValue" />',
      }),
    },
  );

  return {
    Alert: defineComponent({
      props: ['message'],
      template: '<div>{{ message }}</div>',
    }),
    Button: defineComponent({
      emits: ['click'],
      props: ['disabled', 'loading', 'type'],
      template:
        '<button :disabled="disabled || loading" :type="type || \'button\'" @click="$emit(\'click\', $event)"><slot /></button>',
    }),
    Checkbox: defineComponent({
      emits: ['update:checked'],
      methods: {
        updateChecked(event: Event) {
          this.$emit(
            'update:checked',
            (event.target as HTMLInputElement).checked,
          );
        },
      },
      props: ['checked'],
      template:
        '<label><input type="checkbox" :checked="checked" @change="updateChecked" /><slot /></label>',
    }),
    Input,
    message: {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    Modal: defineComponent({
      emits: ['cancel', 'ok', 'update:open'],
      props: ['confirmLoading', 'open', 'title'],
      template: `
        <div v-if="open" role="dialog">
          <h2>{{ title }}</h2>
          <slot />
          <button data-test="dialog-cancel" type="button" @click="$emit('cancel')">取消</button>
          <button :disabled="confirmLoading" data-test="dialog-login" type="button" @click="$emit('ok')">登录</button>
        </div>
      `,
    }),
    Tabs: Object.assign(
      defineComponent({
        template: '<div><slot /></div>',
      }),
      {
        TabPane: defineComponent({
          props: ['tab'],
          template: '<div role="tab">{{ tab }}</div>',
        }),
      },
    ),
    Tooltip: defineComponent({
      template: '<span><slot /></span>',
    }),
  };
});

describe('login auto-login prompt', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('location', { hostname: 'example.test' });
    vi.stubGlobal('localStorage', {
      clear: vi.fn(() => {
        storage.clear();
      }),
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
      get length() {
        return storage.size;
      },
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, String(value));
      }),
    });
    authLogin.mockReset();
    authLoginWithPasswordChallenge.mockReset();
    getVerifyCodeApi.mockReset();
    startPasswordLoginApi.mockReset();
    startPasswordLoginApi.mockResolvedValue({
      challengeId: 'challenge-1',
      verifyCodeType: 'Captcha',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not prefill credentials on non-loopback hosts when no account was remembered', async () => {
    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();

    expect(
      wrapper.find('input[placeholder="请输入手机号或邮箱"]').element.value,
    ).toBe('');
    expect(
      wrapper.find('input[placeholder="请输入登录密码"]').element.value,
    ).toBe('');
    expect(wrapper.find('input[placeholder="请输入验证码"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('button[type="primary"]').text()).toBe('登录');
    expect(getVerifyCodeApi).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('prefills local development credentials on 127.0.0.1', async () => {
    vi.stubGlobal('location', { hostname: '127.0.0.1' });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();

    expect(
      wrapper.find('input[placeholder="请输入手机号或邮箱"]').element.value,
    ).toBe('sa');
    expect(
      wrapper.find('input[placeholder="请输入登录密码"]').element.value,
    ).toBe('123456');

    wrapper.unmount();
  });

  it('prefills local development credentials on localhost', async () => {
    vi.stubGlobal('location', { hostname: 'localhost' });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();

    expect(
      wrapper.find('input[placeholder="请输入手机号或邮箱"]').element.value,
    ).toBe('sa');
    expect(
      wrapper.find('input[placeholder="请输入登录密码"]').element.value,
    ).toBe('123456');

    wrapper.unmount();
  });

  it('shows a three-second in-dialog countdown when captcha returns a verify code', async () => {
    getVerifyCodeApi.mockResolvedValue({
      code: '0462',
      interactionData: '',
      interactionDataType: '',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();
    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('sa');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: 'sa',
      verifyCodeType: 'Captcha',
    });
    expect(
      wrapper.find('input[placeholder="请输入验证码"]').element.value,
    ).toBe('0462');
    expect(wrapper.text()).toContain('3 秒后将自动登录');

    wrapper.unmount();
  });

  it('automatically completes password login after the three-second countdown', async () => {
    vi.useFakeTimers();
    getVerifyCodeApi.mockResolvedValue({
      code: '0462',
      interactionData: '',
      interactionDataType: '',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('sa');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    await vi.advanceTimersByTimeAsync(3000);

    expect(authLoginWithPasswordChallenge).toHaveBeenCalledWith({
      account: 'sa',
      loginVerifyChallengeId: 'challenge-1',
      verifyCode: '0462',
      verifyCodeType: 'Captcha',
    });

    wrapper.unmount();
    vi.useRealTimers();
  });

  it('keeps original captcha image when wrapped response also returns a verify code', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('sa');
    const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
    getVerifyCodeApi.mockResolvedValue({
      code: '0462',
      data: {
        code: '0462',
        interactionData: imageBase64,
        interactionDataType: 'image/png',
      },
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('img[alt="验证码"]').attributes('src')).toBe(
      `data:image/png;base64,${imageBase64}`,
    );
    expect(
      wrapper.find('input[placeholder="请输入验证码"]').element.value,
    ).toBe('0462');

    wrapper.unmount();
  });

  it('does not query a verification method when the password-login account loses focus', async () => {
    getVerifyCodeApi.mockResolvedValue({
      code: '0462',
      interactionData: '',
      interactionDataType: '',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();
    getVerifyCodeApi.mockClear();

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('admin@example.com');
    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .trigger('blur');
    await flushPromises();

    expect(startPasswordLoginApi).not.toHaveBeenCalled();
    expect(getVerifyCodeApi).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows MFA only after a successful password-login challenge', async () => {
    startPasswordLoginApi.mockResolvedValue({
      challengeId: 'mfa-challenge',
      verifyCodeType: 'Mfa',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('mfa-user');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    expect(startPasswordLoginApi).toHaveBeenCalledWith({
      account: 'mfa-user',
      password: '123456',
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Google 验证器验证');
    expect(wrapper.text()).toContain('Google Authenticator');
    expect(wrapper.find('button[aria-label="刷新验证码"]').exists()).toBe(
      false,
    );
    expect(getVerifyCodeApi).not.toHaveBeenCalled();

    await wrapper
      .find('input[placeholder="请输入 Google 验证器验证码"]')
      .setValue('123456');
    await wrapper.find('[data-test="dialog-login"]').trigger('click');

    expect(authLoginWithPasswordChallenge).toHaveBeenCalledWith({
      account: 'mfa-user',
      loginVerifyChallengeId: 'mfa-challenge',
      verifyCode: '123456',
      verifyCodeType: 'Mfa',
    });

    wrapper.unmount();
  });
});
