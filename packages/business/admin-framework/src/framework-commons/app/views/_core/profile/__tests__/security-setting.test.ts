import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@vben/stores', () => ({
  useUserStore: () => ({
    userInfo: {
      email: 'demo@example.com',
      id: 'user-1',
      mobile: '13800000000',
    },
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
    fetchUserInfo.mockReset();
    getAdminUserSecurityService.mockReset();
    getVerifyCodeApi.mockReset();
    modalConfirm.mockClear();
    oauthService.createTransaction.mockReset();
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
      callbackUrl: 'https://example.test/profile/security',
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
