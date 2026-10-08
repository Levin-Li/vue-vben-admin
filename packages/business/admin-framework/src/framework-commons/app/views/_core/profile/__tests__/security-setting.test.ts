import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureBindCallbackBeforeStartup,
  clearPendingBindCallback,
  hasPendingBindCallback,
} from '../oauth-bind-callback';

const currentUser = reactive({
  email: 'demo@example.com',
  id: 'user-1',
  mobile: '13800000000',
});

const {
  fetchUserInfo,
  getAdminUserSecurityService,
  getVerifyCodeApi,
  oauthService,
  updateLoginInfoApi,
} = vi.hoisted(() => {
  return {
    fetchUserInfo: vi.fn(),
    getAdminUserSecurityService: vi.fn(),
    getVerifyCodeApi: vi.fn(),
    oauthService: {
      createTransaction: vi.fn(),
      createInAppTransaction: vi.fn(),
      authorizeInAppTransaction: vi.fn(),
      authorizeTransaction: vi.fn(),
      exchangeTransaction: vi.fn(),
      getMyBindings: vi.fn(),
      getSupportedPlatforms: vi.fn(),
      getTransaction: vi.fn(),
      unbindBinding: vi.fn(),
    },
    updateLoginInfoApi: vi.fn(),
  };
});

const modalConfirm = vi.fn(async (options?: any) => {
  await options?.onOk?.();
});

vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    userInfo: currentUser,
  }),
}));

vi.mock('@vben/common-ui', () => ({
  Profile: defineComponent({
    emits: ['update:modelValue'],
    props: ['tabs'],
    template: `
      <section>
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          @click="$emit('update:modelValue', tab.value)"
        >
          {{ tab.label }}
        </button>
        <slot name="content" />
      </section>
    `,
  }),
}));

vi.mock('../avatar-upload.vue', () => ({
  default: defineComponent({ template: '<div />' }),
}));
vi.mock('../base-setting.vue', () => ({
  default: defineComponent({ template: '<div />' }),
}));
vi.mock('../notification-setting.vue', () => ({
  default: defineComponent({ template: '<div />' }),
}));
vi.mock('../password-setting.vue', () => ({
  default: defineComponent({ template: '<div />' }),
}));

vi.mock('@levin/admin-framework', () => ({
  getAdminUserSecurityService,
}));

vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  getVerifyCodeApi,
  oauthService,
  updateLoginInfoApi,
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    fetchUserInfo,
  }),
}));

vi.mock(
  '../../authentication/login-verify-type',
  async (importOriginal: () => Promise<any>) => {
    const actual = await importOriginal();
    return {
      ...actual,
      extractReturnedVerifyCode: (payload: any) => payload?.code || '',
    };
  },
);

vi.mock('ant-design-vue', () => {
  const Input = defineComponent({
    emits: ['update:value'],
    methods: {
      updateValue(event: Event) {
        this.$emit('update:value', (event.target as HTMLInputElement).value);
      },
    },
    props: ['placeholder', 'value'],
    template:
      '<input :placeholder="placeholder" :value="value" @input="updateValue" />',
  });

  return {
    Alert: defineComponent({
      props: ['message'],
      template: '<div>{{ message }}</div>',
    }),
    Button: defineComponent({
      emits: ['click'],
      props: ['danger', 'disabled', 'loading'],
      template:
        '<button :disabled="disabled || loading" type="button" @click="$emit(\'click\', $event)"><slot /></button>',
    }),
    Card: defineComponent({
      props: ['title'],
      template: '<section><h2>{{ title }}</h2><slot /></section>',
    }),
    Form: Object.assign(
      defineComponent({
        template: '<form><slot /></form>',
      }),
      {
        Item: defineComponent({
          props: ['label'],
          template: '<label><span>{{ label }}</span><slot /></label>',
        }),
      },
    ),
    Input,
    Modal: Object.assign(
      defineComponent({
        emits: ['cancel', 'ok', 'update:open'],
        props: ['open', 'title'],
        template:
          '<div v-if="open" role="dialog"><h3>{{ title }}</h3><slot /></div>',
      }),
      {
        confirm: modalConfirm,
      },
    ),
    QRCode: defineComponent({
      props: ['value'],
      template: '<div>{{ value }}</div>',
    }),
    Tabs: Object.assign(
      defineComponent({
        template: '<div><slot /></div>',
      }),
      {
        TabPane: defineComponent({
          props: ['tab'],
          template: '<div><h3>{{ tab }}</h3><slot /></div>',
        }),
      },
    ),
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  };
});

describe('social-account-setting', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearPendingBindCallback();
    // 恢复测试账号资料，避免联系方式刷新用例污染其它个人中心测试。
    currentUser.email = 'demo@example.com';
    currentUser.mobile = '13800000000';

    fetchUserInfo.mockReset();
    getAdminUserSecurityService.mockReset();
    getVerifyCodeApi.mockReset();
    modalConfirm.mockClear();
    oauthService.createTransaction.mockReset();
    oauthService.createInAppTransaction.mockReset();
    oauthService.authorizeInAppTransaction.mockReset();
    oauthService.authorizeTransaction.mockReset();
    oauthService.exchangeTransaction.mockReset();
    oauthService.getMyBindings.mockReset();
    oauthService.getSupportedPlatforms.mockReset();
    oauthService.getTransaction.mockReset();
    oauthService.unbindBinding.mockReset();
    updateLoginInfoApi.mockReset();

    getAdminUserSecurityService.mockReturnValue(null);
    oauthService.getMyBindings.mockResolvedValue({
      items: [
        {
          boundAt: '2026-08-17 10:00:00',
          externalUsername: 'wechat-user',
          id: 'binding-1',
          platform: 'WECHAT_OPEN',
          platformName: '微信',
        },
      ],
    });
    oauthService.getSupportedPlatforms.mockResolvedValue([
      {
        code: 'WECHAT_OPEN',
        name: '微信',
        supports: ['qr_login'],
      },
    ]);
    vi.stubGlobal('location', {
      href: 'https://example.test/profile/security',
      pathname: '/profile/security',
    });
    vi.stubGlobal(
      'open',
      vi.fn(() => ({
        close: vi.fn(),
        closed: false,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('真实sourcePlatform绑定卡片和编码目录显示中文名称，请求保留编码', async () => {
    // 使用实际API字段，避免旧平台name模拟值掩盖绑定来源缺失。
    const platforms = ['FEISHU', 'WECHAT_ENTERPRISE_V2', 'DINGTALK_V2'];
    oauthService.getSupportedPlatforms.mockResolvedValue(platforms.map((code) => ({ code, name: code })));
    oauthService.getMyBindings.mockResolvedValue(platforms.map((sourcePlatform) => ({ id: sourcePlatform, sourcePlatform, nickname: '测试成员' })));
    oauthService.createTransaction.mockResolvedValue({ transactionId: 'name-tx', authorizeUrl: 'https://example.test/authorize' });
    const component = (await import('../social-account-setting.vue')).default;
    const wrapper = mount(component);
    await flushPromises();
    expect(wrapper.findAll('.font-medium').map((heading) => heading.text())).toEqual(['可绑定平台', '已绑定账号', '飞书', '企业微信', '钉钉']);
    const button = wrapper.findAll('button').find((item) => item.text() === '飞书');
    expect(button).toBeDefined();
    await button?.trigger('click');
    await flushPromises();
    expect(oauthService.createTransaction.mock.calls[0]?.[0]).toMatchObject({ platform: 'FEISHU', purpose: 'BIND' });
    wrapper.unmount();
  });

  it('未知平台的显式名称按文本渲染', async () => {
    // 平台名称不是HTML，外部文字不能插入可执行图片节点。
    const label = '<img src=x onerror="window.injected=true">';
    oauthService.getMyBindings.mockResolvedValue([{ id: 'custom', sourcePlatform: 'CUSTOM', platformName: label, nickname: '成员昵称' }]);
    const component = (await import('../social-account-setting.vue')).default;
    const wrapper = mount(component);
    await flushPromises();
    expect(wrapper.text()).toContain(label);
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders social bindings and available bind platforms', async () => {
    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);

    await flushPromises();

    expect(oauthService.getMyBindings).toHaveBeenCalledTimes(1);
    expect(oauthService.getSupportedPlatforms).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('第三方账号绑定');
    expect(wrapper.text()).toContain('微信');
    expect(wrapper.text()).toContain('wechat-user');

    wrapper.unmount();
  });

  it('keeps third-party account binding out of security settings', async () => {
    const SecuritySetting = (await import('../security-setting.vue')).default;
    const wrapper = mount(SecuritySetting);

    await flushPromises();

    expect(wrapper.text()).not.toContain('第三方账号绑定');

    wrapper.unmount();
  });

  it('starts independent 60-second cooldowns for phone and email verification codes', async () => {
    // 使用虚拟时钟验证发送成功后的按钮冷却与剩余秒数展示。
    vi.useFakeTimers();
    getVerifyCodeApi.mockResolvedValue({});

    const SecuritySetting = (await import('../security-setting.vue')).default;
    const wrapper = mount(SecuritySetting);
    const verifyCodeButtons = () =>
      wrapper
        .findAll('button')
        .filter(
          (button) =>
            button.text().includes('验证码') ||
            button.text().includes('后重试'),
        );

    await verifyCodeButtons()[0]?.trigger('click');
    await flushPromises();

    expect(verifyCodeButtons()[0]?.text()).toBe('60s 后重试');
    expect(verifyCodeButtons()[0]?.attributes('disabled')).toBeDefined();

    // 邮箱发送入口必须拥有自己的冷却状态，不能被手机号入口阻塞。
    await verifyCodeButtons()[2]?.trigger('click');
    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: '13800000000',
      verifyCodeType: 'Sms',
    });
    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: 'demo@example.com',
      verifyCodeType: 'Email',
    });
    expect(verifyCodeButtons()[2]?.text()).toBe('60s 后重试');

    await vi.advanceTimersByTimeAsync(1000);
    expect(verifyCodeButtons()[0]?.text()).toBe('59s 后重试');
    expect(verifyCodeButtons()[2]?.text()).toBe('59s 后重试');

    wrapper.unmount();
  });

  it('refreshes the displayed phone number after a successful binding', async () => {
    // 绑定成功后仅使用服务端刷新资料更新当前联系方式展示。
    updateLoginInfoApi.mockResolvedValue({});
    fetchUserInfo.mockImplementation(async () => {
      currentUser.mobile = '13900000000';
    });

    const SecuritySetting = (await import('../security-setting.vue')).default;
    const wrapper = mount(SecuritySetting);
    const inputs = wrapper.findAll('input');

    await inputs
      .find(
        (input) => input.attributes('placeholder') === '请输入当前手机号验证码',
      )
      ?.setValue('old-code');
    await inputs
      .find((input) => input.attributes('placeholder') === '请输入新手机号')
      ?.setValue('13900000000');
    await inputs
      .find(
        (input) => input.attributes('placeholder') === '请输入新手机号验证码',
      )
      ?.setValue('new-code');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('提交绑定'))
      ?.trigger('click');
    await flushPromises();

    expect(updateLoginInfoApi).toHaveBeenCalledWith({
      newTelephone: '13900000000',
      newTelephoneVerifyCode: 'new-code',
      verifyCode: 'old-code',
      verifyCodeType: 'Sms',
    });
    expect(fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('139****0000');

    wrapper.unmount();
  });

  it('refreshes the displayed email after a successful binding', async () => {
    // 邮箱换绑与手机号共用资料刷新契约，但必须独立验证新值展示。
    updateLoginInfoApi.mockResolvedValue({});
    fetchUserInfo.mockImplementation(async () => {
      currentUser.email = 'next@example.com';
    });

    const SecuritySetting = (await import('../security-setting.vue')).default;
    const wrapper = mount(SecuritySetting);
    const inputs = wrapper.findAll('input');

    await inputs
      .find(
        (input) => input.attributes('placeholder') === '请输入当前邮箱验证码',
      )
      ?.setValue('old-code');
    await inputs
      .find((input) => input.attributes('placeholder') === '请输入新邮箱')
      ?.setValue('next@example.com');
    await inputs
      .find((input) => input.attributes('placeholder') === '请输入新邮箱验证码')
      ?.setValue('new-code');
    await wrapper
      .findAll('button')
      .filter((button) => button.text().includes('提交绑定'))[1]
      ?.trigger('click');
    await flushPromises();

    expect(updateLoginInfoApi).toHaveBeenCalledWith({
      newEmail: 'next@example.com',
      newEmailVerifyCode: 'new-code',
      verifyCode: 'old-code',
      verifyCodeType: 'Email',
    });
    expect(fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('ne***@example.com');

    wrapper.unmount();
  });

  it('取出回调后等待本地用户超过内存期限也不能提交 code', async () => {
    vi.useFakeTimers();
    captureBindCallbackBeforeStartup(
      'https://example.test/profile/security?oauthTransaction=expired-tx&oauthInAppCode=code&oauthInAppState=state',
      vi.fn(),
    );
    let finishUser: (value: object) => void = () => {};
    fetchUserInfo.mockReturnValue(
      new Promise((resolve) => {
        finishUser = resolve;
      }),
    );
    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(180_000);
    finishUser({ id: 'user-1' });
    await flushPromises();
    expect(oauthService.authorizeInAppTransaction).not.toHaveBeenCalled();
    expect(oauthService.authorizeTransaction).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('重新发起账号绑定');
    wrapper.unmount();
  });

  it('独立个人页在回调到达后自动进入绑定面板并消费内存 code', async () => {
    captureBindCallbackBeforeStartup(
      'https://example.test/profile/security?oauthTransaction=profile-tx&oauthInAppCode=code&oauthInAppState=state',
      vi.fn(),
    );
    fetchUserInfo.mockResolvedValue({ id: 'user-1' });
    oauthService.authorizeInAppTransaction.mockResolvedValue({});
    oauthService.getTransaction.mockResolvedValue({ status: 'COMPLETED' });
    oauthService.exchangeTransaction.mockResolvedValue({});
    const ProfileIndex = (await import('../index.vue')).default;
    const wrapper = mount(ProfileIndex);
    await flushPromises();
    expect(oauthService.authorizeInAppTransaction).toHaveBeenCalledWith(
      'profile-tx',
      { code: 'code', state: 'state' },
    );
    expect(hasPendingBindCallback()).toBe(false);
    wrapper.unmount();
  });

  it('opens third-party account binding from the profile navigation', async () => {
    const ProfileIndex = (await import('../index.vue')).default;
    const wrapper = mount(ProfileIndex);

    const socialEntry = wrapper
      .findAll('button')
      .find((item) => item.text().includes('第三方账号绑定'));
    expect(socialEntry).toBeTruthy();

    await socialEntry!.trigger('click');

    expect(
      wrapper.findComponent({ name: 'SocialAccountSetting' }).exists(),
    ).toBe(true);

    wrapper.unmount();
  });

  it.each([
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ])(
    '绑定回调立即清理 URL，等待真实会话后 POST：端内=%s，存在原事务=%s',
    async (inApp, hasResume) => {
      if (hasResume)
        sessionStorage.setItem(
          'SECURITY_OAUTH_BIND_TRANSACTION_/profile/security',
          JSON.stringify({
            transactionId: 'callback-tx',
            platformCode: 'FEISHU',
          }),
        );
      const params = new URLSearchParams({ oauthTransaction: 'callback-tx' });
      if (inApp) {
        params.set('oauthInAppCode', 'temporary-code');
        params.set('oauthInAppState', 'state');
      } else
        params.set(
          'oauthBindCallback',
          JSON.stringify({
            state: 'state',
            code: 'temporary-code',
            accessToken: 'must-not-submit',
          }),
        );
      vi.stubGlobal('location', {
        href: `https://example.test/profile/security?${params}`,
        pathname: '/profile/security',
      });
      const replaceState = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      let finishUser: (value: object) => void = () => {};
      fetchUserInfo.mockReturnValue(
        new Promise((resolve) => {
          finishUser = resolve;
        }),
      );
      oauthService.authorizeInAppTransaction.mockResolvedValue({});
      oauthService.authorizeTransaction.mockResolvedValue({});
      oauthService.getTransaction.mockResolvedValue({ status: 'COMPLETED' });
      oauthService.exchangeTransaction.mockResolvedValue({});
      const SocialAccountSetting = (
        await import('../social-account-setting.vue')
      ).default;
      const wrapper = mount(SocialAccountSetting);
      await flushPromises();
      expect(replaceState).toHaveBeenCalledWith(
        window.history.state,
        '',
        'https://example.test/profile/security',
      );
      expect(oauthService.authorizeInAppTransaction).not.toHaveBeenCalled();
      expect(oauthService.authorizeTransaction).not.toHaveBeenCalled();
      expect(fetchUserInfo).toHaveBeenCalledTimes(1);
      finishUser({ userId: 'user-1' });
      await flushPromises();
      const authorize = inApp
        ? oauthService.authorizeInAppTransaction
        : oauthService.authorizeTransaction;
      expect(authorize).toHaveBeenCalledWith('callback-tx', {
        code: 'temporary-code',
        state: 'state',
      });
      expect(oauthService.exchangeTransaction).toHaveBeenCalledWith(
        'callback-tx',
      );
      for (let index = 0; index < sessionStorage.length; index++)
        expect(
          sessionStorage.getItem(sessionStorage.key(index) || ''),
        ).not.toContain('temporary-code');
      replaceState.mockRestore();
      wrapper.unmount();
    },
  );

  it('存在另一个绑定事务时拒绝回调而不提交授权码', async () => {
    sessionStorage.setItem(
      'SECURITY_OAUTH_BIND_TRANSACTION_/profile/security',
      JSON.stringify({ transactionId: 'different-tx', platformCode: 'FEISHU' }),
    );
    vi.stubGlobal('location', {
      href: 'https://example.test/profile/security?oauthTransaction=callback-tx&oauthInAppCode=temporary-code&oauthInAppState=state',
      pathname: '/profile/security',
    });
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {});
    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);
    await flushPromises();
    expect(oauthService.authorizeInAppTransaction).not.toHaveBeenCalled();
    expect(fetchUserInfo).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem(
        'SECURITY_OAUTH_BIND_TRANSACTION_/profile/security',
      ),
    ).toBeNull();
    replaceState.mockRestore();
    wrapper.unmount();
  });

  it('绑定回调遇到失效本地会话清除 URL 且不提交 code', async () => {
    sessionStorage.setItem(
      'SECURITY_OAUTH_BIND_TRANSACTION_/profile/security',
      JSON.stringify({ transactionId: 'callback-tx', platformCode: 'FEISHU' }),
    );
    vi.stubGlobal('location', {
      href: 'https://example.test/profile/security?oauthTransaction=callback-tx&oauthInAppCode=temporary-code&oauthInAppState=state',
      pathname: '/profile/security',
    });
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {});
    fetchUserInfo.mockRejectedValue(new Error('会话失效'));
    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);
    await flushPromises();
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      '',
      'https://example.test/profile/security',
    );
    expect(oauthService.authorizeInAppTransaction).not.toHaveBeenCalled();
    expect(oauthService.getTransaction).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem(
        'SECURITY_OAUTH_BIND_TRANSACTION_/profile/security',
      ),
    ).toBeNull();
    expect(wrapper.text()).toContain('重新发起账号绑定');
    replaceState.mockRestore();
    wrapper.unmount();
  });

  it('企业 App 内绑定仅在用户确认后调用当前身份授权', async () => {
    vi.stubGlobal('navigator', { userAgent: 'DingTalk' });
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => callback(),
      runtime: {
        permission: {
          requestAuthCode: ({
            onSuccess,
          }: {
            onSuccess: (result: { code: string }) => void;
          }) => onSuccess({ code: 'bind-code' }),
        },
      },
    };
    oauthService.getSupportedPlatforms.mockResolvedValue([
      {
        code: 'DINGTALK_V2',
        name: '钉钉',
        capabilities: { oauth: true, inAppLogin: true },
      },
    ]);
    oauthService.createInAppTransaction.mockResolvedValue({
      id: 'bind-inapp',
      state: 'state',
      corpId: 'corp',
    });
    oauthService.authorizeInAppTransaction.mockResolvedValue({
      status: 'COMPLETED',
    });
    oauthService.getTransaction.mockResolvedValue({ status: 'COMPLETED' });
    oauthService.exchangeTransaction.mockResolvedValue({});
    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);
    await flushPromises();
    expect(oauthService.createInAppTransaction).not.toHaveBeenCalled();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('钉钉'));
    await button?.trigger('click');
    await flushPromises();
    expect(modalConfirm).toHaveBeenCalledTimes(1);
    expect(oauthService.createInAppTransaction).toHaveBeenCalledWith({
      platform: 'DINGTALK_V2',
      purpose: 'BIND',
      returnUrl: 'https://example.test/profile/security',
    });
    expect(oauthService.authorizeInAppTransaction).toHaveBeenCalledWith(
      'bind-inapp',
      { code: 'bind-code', state: 'state' },
    );
    expect(oauthService.createTransaction).not.toHaveBeenCalled();
    expect(oauthService.exchangeTransaction).toHaveBeenCalledWith('bind-inapp');
    delete (window as Window & { dd?: unknown }).dd;
    wrapper.unmount();
  });

  it('creates and exchanges a bind transaction after confirmation', async () => {
    oauthService.createTransaction.mockResolvedValue({
      authorizeUrl: 'https://oauth.example.test/wechat',
      id: 'bind-tx-1',
    });
    oauthService.getTransaction.mockResolvedValue({
      id: 'bind-tx-1',
      status: 'COMPLETED',
    });
    oauthService.exchangeTransaction.mockResolvedValue({
      binding: {
        id: 'binding-2',
      },
    });

    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);

    await flushPromises();

    const bindButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('微信'));
    expect(bindButton).toBeTruthy();

    await bindButton!.trigger('click');
    await flushPromises();

    expect(modalConfirm).toHaveBeenCalledTimes(1);
    expect(oauthService.createTransaction).toHaveBeenCalledWith({
      returnUrl: 'https://example.test/profile/security',
      platform: 'WECHAT_OPEN',
      purpose: 'BIND',
    });
    expect(oauthService.getTransaction).toHaveBeenCalledWith('bind-tx-1');
    expect(oauthService.exchangeTransaction).toHaveBeenCalledWith('bind-tx-1');
    expect(fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(oauthService.getMyBindings).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('unbinds a social account after confirmation and refreshes the list', async () => {
    oauthService.unbindBinding.mockResolvedValue({});

    const SocialAccountSetting = (await import('../social-account-setting.vue'))
      .default;
    const wrapper = mount(SocialAccountSetting);

    await flushPromises();

    const unbindButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('解绑'));
    expect(unbindButton).toBeTruthy();

    await unbindButton!.trigger('click');
    await flushPromises();

    expect(modalConfirm).toHaveBeenCalledTimes(1);
    expect(oauthService.unbindBinding).toHaveBeenCalledWith('binding-1');
    expect(fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(oauthService.getMyBindings).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});
