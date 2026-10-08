import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import {
  buildProviderCallbackUrl,
  checkProviderRedirectUri,
  isSafeGuidanceUrl,
} from '../../provider-onboarding-guidance';
import ProviderGuidance from '../../provider-onboarding-guidance.vue';

// 测试使用真实的控制器相对路径契约，避免加载宿主请求运行时。
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/oauth-service',
  () => ({
    oauthService: { buildRequestPath: (path: string) => `/oauth/${path}` },
  }),
);
vi.mock('ant-design-vue', () => ({
  Alert: { template: '<section><slot name="description" /></section>' },
  Button: { template: '<button><slot /></button>' },
  message: { success: vi.fn(), warning: vi.fn() },
}));

describe('企业平台配置指导', () => {
  it('从当前站点和实际 API 路径生成回调并拒绝跨域路径', () => {
    expect(
      buildProviderCallbackUrl(
        'https://admin.example/console',
        '/oauth/callback/FEISHU',
      ),
    ).toBe('https://admin.example/oauth/callback/FEISHU');
    expect(
      buildProviderCallbackUrl(
        'https://admin.example',
        '//evil.example/callback',
      ),
    ).toBe('');
    expect(
      buildProviderCallbackUrl(
        'https://admin.example',
        'https://evil.example/callback',
      ),
    ).toBe('');
    expect(
      buildProviderCallbackUrl('file:///tmp/page', '/oauth/callback/FEISHU'),
    ).toBe('');
  });

  it('检查空值、错误协议、凭据、参数和地址不一致', () => {
    const expected = 'https://admin.example/oauth/callback/FEISHU';
    expect(checkProviderRedirectUri(expected, expected)).toContain('一致。');
    expect(checkProviderRedirectUri('', expected)).toContain('请将下方地址');
    expect(
      checkProviderRedirectUri(
        'https://other.example/oauth/callback/FEISHU',
        expected,
      ),
    ).toContain('不一致');
    for (const value of [
      'javascript:alert(1)',
      'https://user:secret@admin.example/path',
      `${expected}?secret=x`,
      `${expected}#fragment`,
      'relative/path',
    ]) {
      expect(checkProviderRedirectUri(value, expected)).toContain('格式不合法');
    }
  });

  it('端内回调单独检查和复制，钉钉要求企业 ID', async () => {
    const expected = `${window.location.origin}/oauth/inApp/callback/FEISHU`;
    expect(
      checkProviderRedirectUri(expected, expected, 'inAppRedirectUri'),
    ).toBe('inAppRedirectUri 与当前站点回调地址一致。');
    expect(
      checkProviderRedirectUri('', expected, 'inAppRedirectUri'),
    ).toContain('填写到 inAppRedirectUri');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const wrapper = mount(ProviderGuidance, {
      props: { loginProvider: true, providerCode: 'FEISHU', configuration: {} },
    });
    expect(wrapper.text()).toContain('/oauth/inApp/callback/FEISHU');
    expect(wrapper.text()).toContain('App 内网页免登默认关闭');
    await wrapper.findAll('button')[1]?.trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expected);
    await wrapper.setProps({ providerCode: 'WECHAT_ENTERPRISE_V2' });
    expect(wrapper.text()).toContain(
      '/oauth/inApp/callback/WECHAT_ENTERPRISE_V2',
    );
    expect(wrapper.text()).not.toContain('/oauth/inApp/callback/FEISHU');
    await wrapper.setProps({
      providerCode: 'DINGTALK_V2',
      configuration: { enable: true, enableInAppLogin: true },
    });
    expect(
      wrapper.find('[data-testid="enterprise-inapp-callback-url"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).toContain('企业 corpId');
    expect(wrapper.text()).toContain('基础免登不保证返回手机号');
    wrapper.unmount();
  });

  it('仅展示安全的官方链接', () => {
    expect(isSafeGuidanceUrl('https://open.feishu.cn/document')).toBe(true);
    expect(isSafeGuidanceUrl('http://open.feishu.cn')).toBe(false);
    expect(isSafeGuidanceUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeGuidanceUrl('https://user:secret@example.com')).toBe(false);
  });

  it('供应商切换同步更新手册、回调和检查结果，复制最新地址', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const wrapper = mount(ProviderGuidance, {
      props: {
        providerCode: 'FEISHU',
        loginProvider: true,
        guidance: {
          prerequisites: ['飞书企业管理员'],
          steps: ['飞书创建应用'],
        },
        configuration: {},
      },
    });
    expect(wrapper.text()).toContain('飞书创建应用');
    expect(wrapper.text()).toContain('/oauth/callback/FEISHU');
    await wrapper.setProps({
      providerCode: 'DINGTALK_V2',
      guidance: { steps: ['钉钉配置回调'] },
      configuration: { redirectUri: 'javascript:alert(1)' },
    });
    expect(wrapper.text()).not.toContain('飞书创建应用');
    expect(wrapper.text()).toContain('钉钉配置回调');
    expect(wrapper.text()).toContain('格式不合法');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/oauth/callback/DINGTALK_V2`,
    );
    await wrapper.setProps({
      loginProvider: false,
      guidance: { steps: ['通讯录只读权限'] },
    });
    expect(wrapper.text()).toContain('通讯录只读权限');
    expect(wrapper.find('button').exists()).toBe(false);
    wrapper.unmount();
  });
});
