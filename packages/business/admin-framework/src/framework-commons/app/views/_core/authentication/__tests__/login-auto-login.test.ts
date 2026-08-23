import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authLogin,
  authLoginWithAccessToken,
  authLoginWithPasswordChallenge,
  getVerifyCodeApi,
  messageWarning,
  oauthService,
  startPasswordLoginApi,
} = vi.hoisted(() => {
  return {
    authLogin: vi.fn(),
    authLoginWithAccessToken: vi.fn(),
    authLoginWithPasswordChallenge: vi.fn(),
    getVerifyCodeApi: vi.fn(),
    messageWarning: vi.fn(),
    oauthService: {
      createTransaction: vi.fn(),
      exchangeTransaction: vi.fn(),
      getSupportedPlatforms: vi.fn(),
      getTransaction: vi.fn(),
    },
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
  oauthService,
  startPasswordLoginApi,
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    authLogin,
    authLoginWithAccessToken,
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
      warning: messageWarning,
    },
    Modal: defineComponent({
      emits: ['cancel', 'ok', 'update:open'],
      props: ['confirmLoading', 'open', 'title', 'width'],
      template: `
        <div v-if="open" :data-width="width" role="dialog">
          <h2>{{ title }}</h2>
          <slot />
          <button data-test="dialog-cancel" type="button" @click="$emit('cancel')">取消</button>
          <button :disabled="confirmLoading" data-test="dialog-login" type="button" @click="$emit('ok')">登录</button>
        </div>
      `,
    }),
    Spin: defineComponent({
      props: ['size'],
      template: '<span class="ant-spin"><slot /></span>',
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
      props: ['title'],
      template: '<span :title="title"><slot /></span>',
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
    authLoginWithAccessToken.mockReset();
    authLoginWithPasswordChallenge.mockReset();
    getVerifyCodeApi.mockReset();
    messageWarning.mockReset();
    oauthService.createTransaction.mockReset();
    oauthService.exchangeTransaction.mockReset();
    oauthService.getSupportedPlatforms.mockReset();
    oauthService.getTransaction.mockReset();
    startPasswordLoginApi.mockReset();
    startPasswordLoginApi.mockResolvedValue({
      challengeId: 'challenge-1',
      verifyCodeType: 'Captcha',
    });
    oauthService.getSupportedPlatforms.mockResolvedValue([]);
    vi.stubGlobal(
      'open',
      vi.fn(() => ({
        close: vi.fn(),
        closed: false,
        location: {
          replace: vi.fn(),
        },
        opener: null,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hides the OAuth login section when the tenant has no scan platforms', async () => {
    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();

    expect(oauthService.getSupportedPlatforms).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="oauth-login-section"]').exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it('creates an OAuth transaction and exchanges the token after polling completes', async () => {
    oauthService.getSupportedPlatforms.mockResolvedValue([
      {
        code: 'WECHAT_OPEN',
        name: '微信',
        supports: ['qr_login'],
      },
    ]);
    oauthService.createTransaction.mockResolvedValue({
      authorizeUrl: 'https://oauth.example.test/wechat',
      id: 'tx-login-1',
    });
    oauthService.getTransaction.mockResolvedValue({
      id: 'tx-login-1',
      status: 'COMPLETED',
    });
    oauthService.exchangeTransaction.mockResolvedValue({
      accessToken: 'oauth-access-token',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();
    const oauthButton = wrapper.find('[aria-label="微信"]');
    expect(oauthButton.exists()).toBe(true);
    expect(oauthButton.text()).toBe('');
    expect(oauthButton.element.parentElement?.getAttribute('title')).toBe(
      '微信',
    );

    await oauthButton.trigger('click');
    await flushPromises();

    expect(oauthService.createTransaction).toHaveBeenCalledWith({
      callbackUrl: 'https://example.test/',
      platform: 'WECHAT_OPEN',
      purpose: 'LOGIN',
    });
    expect(oauthService.getTransaction).toHaveBeenCalledWith('tx-login-1');
    expect(oauthService.exchangeTransaction).toHaveBeenCalledWith('tx-login-1');
    expect(authLoginWithAccessToken).toHaveBeenCalledWith('oauth-access-token');

    wrapper.unmount();
  });

  it('closes the waiting dialog when OAuth polling reports a failed transaction', async () => {
    oauthService.getSupportedPlatforms.mockResolvedValue([
      {
        code: 'WECHAT_OPEN',
        name: '微信',
        supports: ['qr_login'],
      },
    ]);
    oauthService.createTransaction.mockResolvedValue({
      authorizeUrl: 'https://oauth.example.test/wechat',
      id: 'tx-login-failed',
    });
    oauthService.getTransaction.mockResolvedValue({
      errorMessage: '第三方授权失败',
      id: 'tx-login-failed',
      status: 'FAILED',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();
    await wrapper.find('[aria-label="微信"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).not.toContain('等待第三方授权登录');
    expect(messageWarning).toHaveBeenCalledWith('第三方授权失败');

    wrapper.unmount();
  });

  it('closes the waiting dialog after three minutes without OAuth completion', async () => {
    vi.useFakeTimers();
    oauthService.getSupportedPlatforms.mockResolvedValue([
      {
        code: 'WECHAT_OPEN',
        name: '微信',
        supports: ['qr_login'],
      },
    ]);
    oauthService.createTransaction.mockResolvedValue({
      authorizeUrl: 'https://oauth.example.test/wechat',
      id: 'tx-login-timeout',
    });
    oauthService.getTransaction.mockResolvedValue({
      id: 'tx-login-timeout',
      status: 'PENDING',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();
    await wrapper.find('[aria-label="微信"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('等待【微信】授权登录');

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    await flushPromises();

    expect(wrapper.text()).not.toContain('等待第三方授权登录');
    expect(messageWarning).toHaveBeenCalledWith('第三方授权已超时');

    wrapper.unmount();
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

  it('shows a five-second in-dialog countdown when captcha returns a verify code', async () => {
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
    const countdown = wrapper.get('[data-test="auto-login-countdown"]');
    expect(countdown.text()).toBe('5');
    expect(countdown.classes()).toContain('text-destructive');
    expect(countdown.classes()).toContain('text-lg');
    expect(countdown.classes()).toContain('motion-safe:animate-bounce');
    expect(wrapper.text()).toContain('5 秒后将自动登录');

    wrapper.unmount();
  });

  it('automatically completes password login after the five-second countdown', async () => {
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

    await vi.advanceTimersByTimeAsync(5000);

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
    expect(wrapper.text()).toContain('MFA 验证');
    expect(wrapper.text()).toContain('Microsoft Authenticator');
    expect(wrapper.find('button[aria-label="刷新验证码"]').exists()).toBe(
      false,
    );
    expect(getVerifyCodeApi).not.toHaveBeenCalled();

    await wrapper
      .find('input[placeholder="请输入 MFA 验证码"]')
      .setValue('12a345');
    await flushPromises();

    expect(
      wrapper.find('input[placeholder="请输入 MFA 验证码"]').element.value,
    ).toBe('12345');
    expect(authLoginWithPasswordChallenge).not.toHaveBeenCalled();

    await wrapper
      .find('input[placeholder="请输入 MFA 验证码"]')
      .setValue('123456');
    await flushPromises();

    expect(authLoginWithPasswordChallenge).toHaveBeenCalledWith({
      account: 'mfa-user',
      loginVerifyChallengeId: 'mfa-challenge',
      verifyCode: '123456',
      verifyCodeType: 'Mfa',
    });

    wrapper.unmount();
  });

  it('keeps the MFA dialog open and renews the challenge after a code error', async () => {
    startPasswordLoginApi
      .mockResolvedValueOnce({
        challengeId: 'mfa-challenge-1',
        verifyCodeType: 'Mfa',
      })
      .mockResolvedValueOnce({
        challengeId: 'mfa-challenge-2',
        verifyCodeType: 'Mfa',
      });
    authLoginWithPasswordChallenge.mockRejectedValueOnce(
      new Error('验证码错误'),
    );

    const { default: Login } = await import('../login.vue');
    const wrapper = mount(Login);

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('mfa-user');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    await wrapper
      .find('input[placeholder="请输入 MFA 验证码"]')
      .setValue('123456');
    await flushPromises();

    expect(startPasswordLoginApi).toHaveBeenCalledTimes(2);
    expect(startPasswordLoginApi).toHaveBeenLastCalledWith({
      account: 'mfa-user',
      password: '123456',
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(
      wrapper.find('input[placeholder="请输入 MFA 验证码"]').element.value,
    ).toBe('');

    wrapper.unmount();
  });

  it('renders the shared behavior captcha and submits its encoded payload with the password challenge', async () => {
    startPasswordLoginApi.mockResolvedValue({
      challengeId: 'hmi-challenge',
      verifyCodeType: 'Hmi',
    });
    getVerifyCodeApi.mockResolvedValue({
      interactionData: {
        challengeId: 'hmi-captcha-id',
        mode: 'CLICK',
        publicData: {
          image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          thumb: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          viewport: { height: 180, width: 320 },
        },
      },
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('hmi-user');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: 'hmi-user',
      verifyCodeType: 'Hmi',
    });
    expect(wrapper.find('[role="dialog"]').attributes('data-width')).toBe(
      '368',
    );
    wrapper.findComponent({ name: 'BehaviorCaptcha' }).vm.$emit(
      'complete',
      JSON.stringify({
        answer: { points: [{ x: 80, y: 60 }] },
        challengeId: 'hmi-captcha-id',
        data: 'hmi-captcha-id',
        mode: 'CLICK',
        operations: [{ type: 'click', x: 80, y: 60 }],
      }),
    );
    await flushPromises();

    expect(authLoginWithPasswordChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'hmi-user',
        loginVerifyChallengeId: 'hmi-challenge',
        verifyCodeType: 'Hmi',
      }),
    );
    const submitted = authLoginWithPasswordChallenge.mock.calls.at(-1)?.[0];
    expect(JSON.parse(submitted?.verifyCode || '{}')).toEqual(
      expect.objectContaining({
        challengeId: 'hmi-captcha-id',
        data: 'hmi-captcha-id',
        mode: 'CLICK',
        operations: expect.any(Array),
      }),
    );

    wrapper.unmount();
  });

  it('closes the dialog and shows a temporary warning for unsupported behavior captcha types', async () => {
    startPasswordLoginApi.mockResolvedValue({
      challengeId: 'unsupported-hmi-challenge',
      verifyCodeType: 'Hmi',
    });
    getVerifyCodeApi.mockResolvedValue({
      interactionData: {
        challengeId: 'unsupported-hmi-captcha',
        mode: 'ROTATE',
        publicData: {
          image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          thumb: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
        },
      },
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('hmi-user');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(messageWarning).toHaveBeenCalledWith('当前行为验证码类型暂不支持');
    wrapper.unmount();
  });
});
