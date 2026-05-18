import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authLogin, getVerifyCodeApi, modalConfirm } = vi.hoisted(() => ({
  authLogin: vi.fn(),
  getVerifyCodeApi: vi.fn(),
  modalConfirm: vi.fn(() => ({ destroy: vi.fn(), update: vi.fn() })),
}));

vi.mock('@vben/locales', () => ({
  $t: (key: string) =>
    ({
      'authentication.welcomeBack': '欢迎回来',
      'common.login': '登录',
    })[key] || key,
}));

vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  getVerifyCodeApi,
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    authLogin,
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
          this.$emit(
            'update:value',
            (event.target as HTMLInputElement).value,
          );
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
    Modal: {
      confirm: modalConfirm,
    },
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
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, String(value));
      }),
    });
    authLogin.mockReset();
    getVerifyCodeApi.mockReset();
    modalConfirm.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the auto-login prompt when initial captcha request returns a verify code', async () => {
    getVerifyCodeApi.mockResolvedValue({
      code: '0462',
      interactionData: '',
      interactionDataType: '',
    });

    const Login = (await import('../login.vue')).default;
    const wrapper = mount(Login);

    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: 'sa',
      verifyCodeType: 'Captcha',
    });
    expect(wrapper.find('input[placeholder="请输入验证码"]').element.value).toBe(
      '0462',
    );
    expect(modalConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '即将自动登录',
      }),
    );

    wrapper.unmount();
  });

  it('refreshes the captcha when the account input loses focus on captcha login', async () => {
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
    await wrapper.find('input[placeholder="请输入手机号或邮箱"]').trigger('blur');
    await flushPromises();

    expect(getVerifyCodeApi).toHaveBeenCalledWith({
      account: 'admin@example.com',
      verifyCodeType: 'Captcha',
    });

    wrapper.unmount();
  });
});
