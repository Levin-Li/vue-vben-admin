import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 在用例计时前加载页面，避免首次 SFC 转换挤占交互测试超时。
import Login from '../login.vue';

const {
  accessSession,
  routeState,
  routerReplace,
  authLogin,
  authLoginWithAccessToken,
  authLoginWithPasswordChallenge,
  getLoginOptionsApi,
  getVerifyCodeApi,
  messageWarning,
  oauthService,
  startPasswordLoginApi,
} = vi.hoisted(() => {
  return {
    accessSession: { accessToken: '' },
    routeState: { query: {} as Record<string, string> },
    routerReplace: vi.fn(),
    authLogin: vi.fn(),
    authLoginWithAccessToken: vi.fn(),
    authLoginWithPasswordChallenge: vi.fn(),
    getLoginOptionsApi: vi.fn(),
    getVerifyCodeApi: vi.fn(),
    messageWarning: vi.fn(),
    oauthService: {
      cancelTransaction: vi.fn(),
      createTransaction: vi.fn(),
      createInAppTransaction: vi.fn(),
      authorizeInAppTransaction: vi.fn(),
      exchangeTransaction: vi.fn(),
      getSupportedPlatforms: vi.fn(),
      getTransaction: vi.fn(),
    },
    startPasswordLoginApi: vi.fn(),
  };
});

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ replace: routerReplace }),
}));

vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => accessSession,
}));

vi.mock('@vben/runtime/locales', () => ({
  $t: (key: string) =>
    ({
      'authentication.welcomeBack': '欢迎回来',
      'common.login': '登录',
    })[key] || key,
}));

vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  getLoginOptionsApi,
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

vi.mock('ant-design-vue', () => {
  const Input = Object.assign(
    defineComponent({
      props: ['autocomplete', 'placeholder', 'size', 'value'],
      emits: ['blur', 'update:value'],
      methods: {
        updateValue(event: Event) {
          this.$emit('update:value', (event.target as HTMLInputElement).value);
        },
      },
      template:
        '<input :autocomplete="autocomplete" :placeholder="placeholder" :value="value" @blur="$emit(\'blur\', $event)" @input="updateValue" />',
    }),
    {
      Password: defineComponent({
        props: ['autocomplete', 'placeholder', 'size', 'value'],
        emits: ['update:value'],
        methods: {
          updateValue(event: Event) {
            this.$emit(
              'update:value',
              (event.target as HTMLInputElement).value,
            );
          },
        },
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
      props: ['disabled', 'loading', 'type'],
      emits: ['click'],
      template:
        '<button :disabled="disabled || loading" :type="type || \'button\'" @click="$emit(\'click\', $event)"><slot /></button>',
    }),
    Checkbox: defineComponent({
      props: ['checked'],
      emits: ['update:checked'],
      methods: {
        updateChecked(event: Event) {
          this.$emit(
            'update:checked',
            (event.target as HTMLInputElement).checked,
          );
        },
      },
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
      props: ['confirmLoading', 'okButtonProps', 'open', 'title', 'width'],
      emits: ['cancel', 'ok', 'update:open'],
      template: `
        <div v-if="open" :data-width="width" role="dialog">
          <h2>{{ title }}</h2>
          <slot />
          <button data-test="dialog-cancel" type="button" @click="$emit('cancel')">取消</button>
          <button :disabled="confirmLoading || okButtonProps?.disabled" :style="okButtonProps?.style" data-test="dialog-login" type="button" @click="$emit('ok')">登录</button>
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
    sessionStorage.clear();
    const storage = new Map<string, string>();
    vi.stubGlobal('location', {
      hostname: 'example.test',
      href: 'https://example.test/',
      origin: 'https://example.test',
      pathname: '/',
    });
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
    accessSession.accessToken = '';
    routeState.query = {};
    routerReplace.mockReset();
    oauthService.createInAppTransaction.mockReset();
    oauthService.authorizeInAppTransaction.mockReset();
    authLogin.mockReset();
    authLoginWithAccessToken.mockReset();
    authLoginWithPasswordChallenge.mockReset();
    getVerifyCodeApi.mockReset();
    getLoginOptionsApi.mockReset();
    getLoginOptionsApi.mockResolvedValue({
      enableUserRegister: true,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });
    messageWarning.mockReset();
    oauthService.createTransaction.mockReset();
    oauthService.cancelTransaction.mockReset();
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

  it('普通注册关闭时隐藏注册链接', async () => {
    getLoginOptionsApi.mockResolvedValue({
      enableUserRegister: false,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });

    const wrapper = mount(Login);
    await flushPromises();
    expect(wrapper.find('a[href="/auth/register"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('普通注册开启时展示注册链接', async () => {
    const wrapper = mount(Login);
    await flushPromises();
    expect(wrapper.find('a[href="/auth/register"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('第三方登录关闭时不查询平台也不显示入口', async () => {
    getLoginOptionsApi.mockResolvedValue({
      enableUserRegister: true,
      enableThirdLogin: false,
      enableThirdRegister: true,
    });

    const wrapper = mount(Login);
    await flushPromises();
    expect(oauthService.getSupportedPlatforms).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="oauth-login-section"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it('第三方注册关闭仍保留已有绑定登录入口', async () => {
    getLoginOptionsApi.mockResolvedValue({
      enableUserRegister: false,
      enableThirdLogin: true,
      enableThirdRegister: false,
    });
    oauthService.getSupportedPlatforms.mockResolvedValue([
      { code: 'WECHAT_OPEN', name: '微信', supports: ['qr_login'] },
    ]);

    const wrapper = mount(Login);
    await flushPromises();
    expect(wrapper.find('[aria-label="微信开放平台"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('已有绑定');
    expect(wrapper.find('a[href="/auth/register"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('优先显示供应商配置的自定义图标', async () => {
    getLoginOptionsApi.mockResolvedValue({
      enableUserRegister: false,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });
    oauthService.getSupportedPlatforms.mockResolvedValue([
      {
        code: 'WECHAT_OPEN',
        iconUrl: '/tenant-wechat.svg',
        name: '微信',
        supports: ['oauth'],
      },
    ]);

    const wrapper = mount(Login);

    await flushPromises();

    expect(wrapper.find('img[alt="微信开放平台 图标"]').attributes('src')).toBe(
      '/tenant-wechat.svg',
    );
    wrapper.unmount();
  });

  it('登录选项未返回时注册和第三方入口保持隐藏', async () => {
    let resolveOptions!: (value: object) => void;
    getLoginOptionsApi.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOptions = resolve;
      }),
    );

    const wrapper = mount(Login);
    await flushPromises();
    expect(wrapper.find('a[href="/auth/register"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="oauth-login-section"]').exists()).toBe(
      false,
    );
    expect(oauthService.getSupportedPlatforms).not.toHaveBeenCalled();
    resolveOptions({
      enableUserRegister: true,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });
    await flushPromises();
    expect(wrapper.find('a[href="/auth/register"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('登录选项加载失败时不开放注册和第三方入口', async () => {
    getLoginOptionsApi.mockRejectedValueOnce(new Error('登录选项加载失败'));

    const wrapper = mount(Login);
    await flushPromises();
    expect(wrapper.find('a[href="/auth/register"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="oauth-login-section"]').exists()).toBe(
      false,
    );
    expect(oauthService.getSupportedPlatforms).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('hides the OAuth login section when the tenant has no scan platforms', async () => {
    const wrapper = mount(Login);

    await flushPromises();

    expect(oauthService.getSupportedPlatforms).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="oauth-login-section"]').exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it('企业授权回调错误不再自动授权并提供主动绑定指引', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Feishu' });
    vi.stubGlobal('location', {
      hostname: 'example.test',
      href: 'https://example.test/?redirect=%2Forders%2F42&oauthError=unbound',
      origin: 'https://example.test',
      pathname: '/',
    });
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {});
    oauthService.getSupportedPlatforms.mockResolvedValue([
      { code: 'FEISHU', capabilities: { oauth: true, inAppLogin: true } },
    ]);

    const wrapper = mount(Login);
    await flushPromises();
    expect(oauthService.createInAppTransaction).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('个人中心主动绑定企业账号');
    replaceState.mockRestore();
    wrapper.unmount();
  });

  it.each([false, true])(
    '端内兑换等待期间本地登录或离页后丢弃迟到令牌：离页=%s',
    async (leavePage) => {
      vi.stubGlobal('navigator', { userAgent: 'DingTalk' });
      (window as Window & { dd?: unknown }).dd = {
        ready: (callback: () => void) => callback(),
        runtime: {
          permission: {
            requestAuthCode: ({
              onSuccess,
            }: {
              onSuccess: (result: { code: string }) => void;
            }) => onSuccess({ code: 'code' }),
          },
        },
      };
      oauthService.getSupportedPlatforms.mockResolvedValue([
        {
          code: 'DINGTALK_V2',
          capabilities: { oauth: true, inAppLogin: true },
        },
      ]);
      oauthService.createInAppTransaction.mockResolvedValue({
        id: 'late-inapp',
        state: 'state',
        corpId: 'corp',
      });
      oauthService.authorizeInAppTransaction.mockResolvedValue({
        status: 'COMPLETED',
      });
      oauthService.getTransaction.mockResolvedValue({ status: 'COMPLETED' });
      let completeExchange: (result: {
        accessToken: string;
      }) => void = () => {};
      oauthService.exchangeTransaction.mockReturnValue(
        new Promise((resolve) => {
          completeExchange = resolve;
        }),
      );

      const wrapper = mount(Login);
      await flushPromises();
      expect(oauthService.exchangeTransaction).toHaveBeenCalledWith(
        'late-inapp',
      );
      if (leavePage) wrapper.unmount();
      else accessSession.accessToken = 'password-login-session';
      completeExchange({ accessToken: 'late-enterprise-token' });
      await flushPromises();
      expect(authLoginWithAccessToken).not.toHaveBeenCalled();
      expect(oauthService.cancelTransaction).toHaveBeenCalledWith(
        'late-inapp',
        {
          __silentError: true,
        },
      );
      delete (window as Window & { dd?: unknown }).dd;
      if (!leavePage) wrapper.unmount();
    },
  );

  it('app 内授权失败停止重试并保留普通登录提示', async () => {
    vi.stubGlobal('navigator', { userAgent: 'DingTalk' });
    oauthService.getSupportedPlatforms.mockResolvedValue([
      { code: 'DINGTALK_V2', capabilities: { oauth: true, inAppLogin: true } },
    ]);
    oauthService.createInAppTransaction.mockRejectedValue(
      new Error('企业配置错误'),
    );

    const wrapper = mount(Login);
    await flushPromises();
    expect(oauthService.createInAppTransaction).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('个人中心主动绑定企业账号');
    wrapper.unmount();
    const again = mount(Login);
    await flushPromises();
    expect(oauthService.createInAppTransaction).toHaveBeenCalledTimes(1);
    again.unmount();
  });

  it('已有本地会话不自动获取企业身份', async () => {
    vi.stubGlobal('navigator', { userAgent: 'DingTalk' });
    accessSession.accessToken = 'existing-session';
    sessionStorage.setItem(
      'LOGIN_OAUTH_TRANSACTION_/',
      JSON.stringify({
        transactionId: 'old-session-tx',
        platformCode: 'DINGTALK_V2',
      }),
    );
    oauthService.getSupportedPlatforms.mockResolvedValue([
      { code: 'DINGTALK_V2', capabilities: { oauth: true, inAppLogin: true } },
    ]);

    const wrapper = mount(Login);
    await flushPromises();
    expect(oauthService.createInAppTransaction).not.toHaveBeenCalled();
    expect(oauthService.getTransaction).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('企业 App 优先恢复已有事务而不新建事务', async () => {
    vi.stubGlobal('navigator', { userAgent: 'DingTalk' });
    sessionStorage.setItem(
      'LOGIN_OAUTH_TRANSACTION_/',
      JSON.stringify({
        transactionId: 'restored',
        platformCode: 'DINGTALK_V2',
      }),
    );
    oauthService.getTransaction.mockResolvedValue({ status: 'FAILED' });
    oauthService.getSupportedPlatforms.mockResolvedValue([
      { code: 'DINGTALK_V2', capabilities: { oauth: true, inAppLogin: true } },
    ]);

    const wrapper = mount(Login);
    await flushPromises();
    expect(oauthService.getTransaction).toHaveBeenCalledWith('restored');
    expect(oauthService.createInAppTransaction).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('授权成功显式恢复包含查询参数的安全业务路径', async () => {
    routeState.query = { redirect: '/orders/42?tab=details&a=1' };
    oauthService.getSupportedPlatforms.mockResolvedValue([
      { code: 'GITHUB', name: 'GitHub' },
    ]);
    oauthService.createTransaction.mockResolvedValue({
      id: 'redirect-tx',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
    });
    oauthService.getTransaction.mockResolvedValue({ status: 'COMPLETED' });
    oauthService.exchangeTransaction.mockResolvedValue({
      accessToken: 'oauth-token',
    });
    authLoginWithAccessToken.mockImplementation(async (_token, onSuccess) => {
      await onSuccess?.();
    });

    const wrapper = mount(Login);
    await flushPromises();
    await wrapper.find('[aria-label="GitHub"]').trigger('click');
    await flushPromises();
    expect(routerReplace).toHaveBeenCalledWith('/orders/42?tab=details&a=1');
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

    const wrapper = mount(Login);

    await flushPromises();
    const oauthButton = wrapper.find('[aria-label="微信开放平台"]');
    expect(oauthButton.exists()).toBe(true);
    expect(oauthButton.text()).toBe('');
    expect(oauthButton.element.parentElement?.getAttribute('title')).toBe(
      '微信开放平台',
    );

    await oauthButton.trigger('click');
    await flushPromises();

    expect(oauthService.createTransaction).toHaveBeenCalledWith({
      returnUrl: 'https://example.test/',
      platform: 'WECHAT_OPEN',
      purpose: 'LOGIN',
    });
    expect(oauthService.getTransaction).toHaveBeenCalledWith('tx-login-1');
    expect(oauthService.exchangeTransaction).toHaveBeenCalledWith('tx-login-1');
    expect(authLoginWithAccessToken).toHaveBeenCalledWith(
      'oauth-access-token',
      undefined,
    );

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

    const wrapper = mount(Login);

    await flushPromises();
    await wrapper.find('[aria-label="微信开放平台"]').trigger('click');
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

    const wrapper = mount(Login);

    await flushPromises();
    await wrapper.find('[aria-label="微信开放平台"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('等待【微信开放平台】授权登录');

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    await flushPromises();

    expect(wrapper.text()).not.toContain('等待第三方授权登录');
    expect(messageWarning).toHaveBeenCalledWith('第三方授权已超时');

    wrapper.unmount();
  });

  it('does not prefill credentials on non-loopback hosts when no account was remembered', async () => {
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

  it('requires an account before requesting a contact verify code', async () => {
    const wrapper = mount(Login);

    await flushPromises();
    (wrapper.vm as any).activeVerifyType = 'Contact';
    await flushPromises();

    const getVerifyCodeButton = () =>
      wrapper
        .findAll('button')
        .find((button) => button.text() === '获取验证码');

    expect(wrapper.text()).toContain('输入手机号或邮箱后获取验证码。');
    expect(wrapper.text()).not.toContain('无需输入密码');
    expect(wrapper.text()).not.toContain('当前使用');
    expect(getVerifyCodeButton()?.attributes('disabled')).toBeDefined();

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('contact@example.com');
    await flushPromises();

    expect(getVerifyCodeButton()?.attributes('disabled')).toBeUndefined();

    wrapper.unmount();
  });

  it('prefills local development credentials on 127.0.0.1', async () => {
    vi.stubGlobal('location', { hostname: '127.0.0.1' });

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
          image:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          thumb:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          viewport: { height: 180, width: 320 },
        },
      },
    });

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

  it('expands the HMI verification dialog with the captcha image up to 700px', async () => {
    startPasswordLoginApi.mockResolvedValue({
      challengeId: 'wide-hmi-challenge',
      verifyCodeType: 'Hmi',
    });
    getVerifyCodeApi.mockResolvedValue({
      interactionData: {
        challengeId: 'wide-hmi-captcha-id',
        mode: 'OBSTACLE_AVOIDANCE',
        publicData: {
          image:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          kind: 'path',
          start: { x: 24, y: 150 },
          viewport: { height: 360, width: 800 },
        },
      },
    });

    const wrapper = mount(Login);

    await wrapper
      .find('input[placeholder="请输入手机号或邮箱"]')
      .setValue('wide-hmi-user');
    await wrapper
      .find('input[placeholder="请输入登录密码"]')
      .setValue('123456');
    await wrapper.find('button[type="primary"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').attributes('data-width')).toBe(
      '700',
    );
    expect(
      wrapper.find('[data-test="dialog-login"]').attributes('style'),
    ).toContain('display: none');
    expect(
      wrapper.find('[data-test="dialog-login"]').attributes('disabled'),
    ).toBeDefined();
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
          image:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
          thumb:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
        },
      },
    });

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
