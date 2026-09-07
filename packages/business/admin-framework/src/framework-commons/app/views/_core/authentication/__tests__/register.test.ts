import type { VueWrapper } from '@vue/test-utils';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authLoginWithAccessToken, getLoginOptions, getVerifyCode, register } =
  vi.hoisted(() => ({
    authLoginWithAccessToken: vi.fn(),
    getLoginOptions: vi.fn(),
    getVerifyCode: vi.fn(),
    register: vi.fn(),
  }));

vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: { getLoginOptions, getVerifyCode, register },
  }),
);
vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({ authLoginWithAccessToken, loginLoading: false }),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('ant-design-vue', () => {
  const input = defineComponent({
    props: { value: String },
    emits: ['update:value'],
    methods: {
      updateValue(event: Event) {
        this.$emit('update:value', (event.target as HTMLInputElement).value);
      },
    },
    template: '<input :value="value" @input="updateValue" />',
  });
  return {
    Alert: defineComponent({
      props: { description: String, message: String },
      template: '<div role="alert">{{ message }}{{ description }}</div>',
    }),
    Button: defineComponent({
      props: {
        disabled: Boolean,
        htmlType: String,
        loading: Boolean,
        type: String,
      },
      emits: ['click'],
      template:
        '<button :disabled="disabled || loading" :type="htmlType || \'button\'" @click="$emit(\'click\', $event)"><slot /></button>',
    }),
    Input: Object.assign(input, { Password: input }),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const wrappers: VueWrapper[] = [];
async function mountRegister() {
  const { default: component } = await import('../register.vue');
  const wrapper = mount(component, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
  wrappers.push(wrapper);
  return wrapper;
}

async function renderRegister() {
  const wrapper = await mountRegister();
  await flushPromises();
  await wrapper.get('#register-account').setValue('new-user');
  await wrapper.get('#register-password').setValue('test-password');
  await wrapper.get('#register-confirm-password').setValue('test-password');
  return wrapper;
}

async function requestCode(wrapper: VueWrapper) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text() === '获取验证码');
  expect(button).toBeDefined();
  if (!button) throw new Error('未找到获取验证码按钮');
  await button.trigger('click');
  await flushPromises();
}

async function prepareRegistration(wrapper: VueWrapper) {
  await requestCode(wrapper);
  await wrapper.get('#register-code').setValue('123456');
}

function inputValue(wrapper: VueWrapper, selector: string) {
  return (wrapper.get(selector).element as HTMLInputElement).value;
}

describe('注册页面', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getLoginOptions.mockResolvedValue({
      enableUserRegister: true,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });
    getVerifyCode.mockResolvedValue({
      type: 'Captcha',
      interactionData: 'aW1hZ2U=',
      interactionDataType: 'image/png',
    });
    register.mockResolvedValue({ accessToken: 'new-account-token' });
    authLoginWithAccessToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  });

  it('注册开关开启才展示注册账号表单', async () => {
    const wrapper = await renderRegister();
    expect(getLoginOptions).toHaveBeenCalledTimes(1);
    expect(wrapper.get('h1').text()).toBe('注册账号');
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('注册开关关闭时直接访问也没有可提交表单', async () => {
    getLoginOptions.mockResolvedValue({
      enableUserRegister: false,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });
    const wrapper = await mountRegister();
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('当前站点未开放用户注册');
    expect(getVerifyCode).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('登录选项未返回时不提前展示注册表单', async () => {
    const pending = deferred<object>();
    getLoginOptions.mockReturnValueOnce(pending.promise);
    const wrapper = await mountRegister();
    expect(wrapper.find('form').exists()).toBe(false);
    pending.resolve({ enableUserRegister: true });
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('选项加载失败隐藏表单并可重新加载恢复', async () => {
    getLoginOptions.mockRejectedValueOnce(new Error('登录选项暂不可用'));
    const wrapper = await mountRegister();
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('登录选项暂不可用');
    const retry = wrapper
      .findAll('button')
      .find((button) => /重试|重新加载/.test(button.text()));
    if (!retry) throw new Error('缺少重新加载按钮');
    await retry.trigger('click');
    await flushPromises();
    expect(getLoginOptions).toHaveBeenCalledTimes(2);
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('新账号仅提交注册白名单字段并使用返回令牌登录', async () => {
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(getVerifyCode).toHaveBeenCalledWith({ account: 'new-user' });
    expect(register).toHaveBeenCalledWith({
      account: 'new-user',
      name: 'new-user',
      password: 'test-password',
      verifyCode: '123456',
      verifyCodeType: 'Captcha',
    });
    expect(authLoginWithAccessToken).toHaveBeenCalledWith('new-account-token');
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
  });

  it('重复账号被拒绝后展示错误并保留账号且不登录', async () => {
    register.mockRejectedValueOnce(new Error('账号已存在，请登录'));
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('账号已存在');
    expect(inputValue(wrapper, '#register-account')).toBe('new-user');
    expect(authLoginWithAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'ServiceResp 对象',
      error: {
        code: 10_000,
        successful: false,
        msg: '账号已存在，请使用登录入口',
      },
    },
    {
      label: 'Axios 响应体',
      error: {
        message: 'Request failed with status code 400',
        response: {
          data: {
            code: 10_000,
            successful: false,
            msg: '账号已存在，请使用登录入口',
          },
        },
      },
    },
  ])('$label 拒绝时在表单持久展示后端原因', async ({ error }) => {
    register.mockRejectedValueOnce(error);
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '账号已存在，请使用登录入口',
    );
    expect(wrapper.text()).not.toContain('注册或登录失败，请重试');
    expect(wrapper.text()).not.toContain('Request failed');
    await wrapper.get('#register-password').setValue('corrected-password');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '账号已存在，请使用登录入口',
    );
    expect(authLoginWithAccessToken).not.toHaveBeenCalled();
  });

  it('两次密码不一致时不调用注册接口', async () => {
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('#register-confirm-password').setValue('different');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(register).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('不一致');
  });

  it('更换账号清除旧验证码并阻止沿用旧挑战注册', async () => {
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('#register-account').setValue('other-user');
    expect(inputValue(wrapper, '#register-code')).toBe('');
    await wrapper.get('#register-code').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(register).not.toHaveBeenCalled();
  });

  it('账号切换后忽略之前在途验证码响应', async () => {
    const pending = deferred<object>();
    getVerifyCode.mockReturnValueOnce(pending.promise);
    const wrapper = await renderRegister();
    await requestCode(wrapper);
    await wrapper.get('#register-account').setValue('other-user');
    pending.resolve({
      type: 'Captcha',
      mock: true,
      code: 'OLD123',
      interactionData: 'b2xk',
      interactionDataType: 'image/png',
    });
    await flushPromises();

    expect(inputValue(wrapper, '#register-code')).toBe('');
    expect(wrapper.find('img').exists()).toBe(false);
    await wrapper.get('#register-code').setValue('OLD123');
    await wrapper.get('form').trigger('submit');
    expect(register).not.toHaveBeenCalled();
  });

  it('提交在途时重复回车只注册一次', async () => {
    const pending = deferred<object>();
    register.mockReturnValueOnce(pending.promise);
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await wrapper.get('form').trigger('submit');
    expect(register).toHaveBeenCalledTimes(1);
    pending.resolve({ accessToken: 'single-token' });
    await flushPromises();
    expect(authLoginWithAccessToken).toHaveBeenCalledTimes(1);
  });

  it.each(['Sms', 'Email'])(
    '使用后端返回的 %s 类型并自动填入明确模拟码',
    async (type) => {
      getVerifyCode.mockResolvedValue({ type, mock: true, code: '654321' });
      const wrapper = await renderRegister();
      await requestCode(wrapper);
      expect(inputValue(wrapper, '#register-code')).toBe('654321');
      await wrapper.get('form').trigger('submit');
      await flushPromises();
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({ verifyCodeType: type, verifyCode: '654321' }),
      );
    },
  );

  it.each([false, undefined])(
    '未明确标记 mock=true 时不自动填入返回码（%s）',
    async (mock) => {
      getVerifyCode.mockResolvedValue({
        type: 'Captcha',
        mock,
        code: '654321',
        interactionData: 'aW1hZ2U=',
        interactionDataType: 'image/png',
      });
      const wrapper = await renderRegister();
      await requestCode(wrapper);
      expect(inputValue(wrapper, '#register-code')).toBe('');
      expect(wrapper.get('img').attributes('src')).toBe(
        'data:image/png;base64,aW1hZ2U=',
      );
    },
  );

  it('仅含 isMock 字段不自动填入验证码', async () => {
    getVerifyCode.mockResolvedValue({
      type: 'Captcha',
      isMock: true,
      code: '654321',
      interactionData: 'aW1hZ2U=',
      interactionDataType: 'image/png',
    });
    const wrapper = await renderRegister();
    await requestCode(wrapper);
    expect(inputValue(wrapper, '#register-code')).toBe('');
  });

  it('注册被拒绝后重新获取验证码可以恢复提交', async () => {
    register.mockRejectedValueOnce(new Error('验证码错误'));
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(inputValue(wrapper, '#register-password')).toBe('test-password');
    expect(inputValue(wrapper, '#register-code')).toBe('');
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(register).toHaveBeenCalledTimes(2);
    expect(authLoginWithAccessToken).toHaveBeenCalledTimes(1);
  });

  it('不支持的验证码类型不能降级为图片验证码注册', async () => {
    getVerifyCode.mockResolvedValue({
      type: 'Hmi',
      mock: true,
      code: '123456',
    });
    const wrapper = await renderRegister();
    await requestCode(wrapper);
    await wrapper.get('#register-code').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(register).not.toHaveBeenCalled();
  });

  it('页面卸载后在途注册成功不再触发登录', async () => {
    const pending = deferred<object>();
    register.mockReturnValueOnce(pending.promise);
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    pending.resolve({ accessToken: 'late-token' });
    await flushPromises();
    expect(authLoginWithAccessToken).not.toHaveBeenCalled();
  });

  it('注册成功但初始化登录失败时继续登录只重试令牌登录', async () => {
    authLoginWithAccessToken.mockRejectedValueOnce(new Error('登录初始化失败'));
    const wrapper = await renderRegister();
    await prepareRegistration(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('继续登录');
    expect(wrapper.text()).toContain('登录初始化失败');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(register).toHaveBeenCalledTimes(1);
    expect(authLoginWithAccessToken).toHaveBeenCalledTimes(2);
    expect(authLoginWithAccessToken).toHaveBeenLastCalledWith(
      'new-account-token',
    );
  });
});
