import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  route,
  getLoginOptions,
  getVerifyCode,
  preview,
  redeem,
  getSupportedPlatforms,
  createTransaction,
  redeemInvitation,
} = vi.hoisted(() => ({
  route: { query: {} as Record<string, string> },
  getLoginOptions: vi.fn(),
  getVerifyCode: vi.fn(),
  preview: vi.fn(),
  redeem: vi.fn(),
  getSupportedPlatforms: vi.fn(),
  createTransaction: vi.fn(),
  redeemInvitation: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRoute: () => route }));
vi.mock('../../../../api/rbac-service', () => ({
  rbacService: { getLoginOptions, getVerifyCode },
}));
vi.mock('../../../../api/invitation-register-service', () => ({
  invitationRegisterService: { preview, redeem },
}));
vi.mock('../../../../api/oauth-service', () => ({
  oauthService: { getSupportedPlatforms, createTransaction, redeemInvitation },
}));
vi.mock('ant-design-vue', () => {
  const input = defineComponent({
    props: { value: String },
    emits: ['update:value'],
    template:
      '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  });
  return {
    Alert: defineComponent({
      props: { message: String },
      template: '<div>{{ message }}</div>',
    }),
    Button: defineComponent({
      props: { htmlType: String },
      emits: ['click'],
      template:
        '<button :type="htmlType || \'button\'" @click="$emit(\'click\', $event)"><slot /></button>',
    }),
    Input: Object.assign(input, { Password: input }),
  };
});

const wrappers: ReturnType<typeof mount>[] = [];
async function render(
  query: Record<string, string>,
  registrationChannel: string,
  details: Record<string, unknown> = {},
) {
  route.query = query;
  window.history.replaceState(
    {},
    '',
    `/auth/invitation-register?token=${encodeURIComponent(query.token || '')}${query.oauthTransaction ? `&oauthTransaction=${query.oauthTransaction}` : ''}`,
  );
  preview.mockResolvedValue({
    targetType: 'Internal',
    organizationMode: 'JoinInviterOrg',
    registrationChannel,
    expiresAt: '2030-01-01T00:00:00',
    ...details,
  });
  const { default: component } = await import('../invitation-register.vue');
  const wrapper = mount(component);
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

describe('邀请注册页面令牌保密与回跳', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getLoginOptions.mockResolvedValue({
      enableInvitationRegister: true,
      enableThirdLogin: true,
      enableThirdRegister: true,
    });
    getSupportedPlatforms.mockResolvedValue([
      { code: 'GITHUB', name: 'GitHub' },
    ]);
    redeemInvitation.mockResolvedValue({ accountId: 'new-user' });
    getVerifyCode.mockResolvedValue({
      type: 'Email',
      mock: true,
      code: '654321',
    });
  });

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    window.history.replaceState({}, '', '/');
  });

  it('挂载后立即从地址栏移除令牌，预览仍使用内存令牌', async () => {
    await render({ token: 'link-id.salt.signature' }, 'Either');
    expect(window.location.search).not.toContain('token=');
    expect(preview).toHaveBeenCalledWith('link-id.salt.signature');
  });

  it('邮箱限定链接只提示填写邮箱', async () => {
    const wrapper = await render(
      { token: 'email-link.salt.signature' },
      'Email',
    );
    expect(wrapper.get('label[for="invite-account"]').text()).toBe('邮箱');
  });

  it('第三方发起仍把内存令牌绑定到服务端事务', async () => {
    createTransaction.mockResolvedValue({ id: 'tx' });
    const wrapper = await render(
      { token: 'link-id.salt.signature' },
      'ThirdParty',
    );
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('GitHub'));
    if (!button) throw new Error('缺少第三方认证入口');
    await button.trigger('click');
    await flushPromises();
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'GITHUB',
        purpose: 'INVITE',
        invitationToken: 'link-id.salt.signature',
        returnUrl: expect.stringContaining('token=link-id.salt.signature'),
      }),
    );
    expect(window.location.search).not.toContain('token=');
  });

  it('第三方回跳保留事务号并用内存令牌完成兑换', async () => {
    const wrapper = await render(
      { token: 'link-id.salt.signature', oauthTransaction: 'tx-123' },
      'ThirdParty',
    );
    expect(window.location.search).toContain('oauthTransaction=tx-123');
    expect(window.location.search).not.toContain('token=');
    const form = wrapper.find('form');
    expect(form.exists()).toBe(true);
    await form.trigger('submit');
    await flushPromises();
    expect(redeemInvitation).toHaveBeenCalledWith({
      token: 'link-id.salt.signature',
      transactionId: 'tx-123',
    });
    expect(wrapper.text()).toContain('注册成功，请登录');
  });

  it('会员第三方回跳还需验证邮箱并设置密码后才兑换', async () => {
    const wrapper = await render(
      { token: 'member-link.salt.signature', oauthTransaction: 'tx-member' },
      'ThirdParty',
      { targetType: 'Member' },
    );
    await wrapper.get('#oauth-member-account').setValue('member@example.com');
    await wrapper.get('#oauth-member-password').setValue('member-password');
    await wrapper.get('#oauth-member-confirm').setValue('member-password');
    await wrapper.get('form').trigger('submit');
    expect(redeemInvitation).not.toHaveBeenCalled();

    const codeButton = wrapper
      .findAll('button')
      .find((item) => item.text() === '获取验证码');
    if (!codeButton) throw new Error('会员补全页缺少验证码入口');
    await codeButton.trigger('click');
    await flushPromises();
    expect(getVerifyCode).toHaveBeenCalledWith({
      account: 'member@example.com',
    });
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(redeemInvitation).toHaveBeenCalledWith({
      token: 'member-link.salt.signature',
      transactionId: 'tx-member',
      account: 'member@example.com',
      password: 'member-password',
      verificationCode: '654321',
      verifyCodeType: 'Email',
    });
    expect(wrapper.text()).toContain('登录入口将由后续会员客户端提供');
    expect(wrapper.find('a[href="/auth/login"]').exists()).toBe(false);
  });
});
