import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { buildProviderCallbackUrl } from '../../provider-onboarding-guidance';
import ProviderGuidance from '../../provider-onboarding-guidance.vue';
import { renderSafeMarkdown } from '../../safe-markdown';

// 测试使用真实的控制器相对路径契约，避免加载宿主请求运行时。
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/oauth-service',
  () => ({
    oauthService: { buildRequestPath: (path: string) => `/oauth/${path}` },
  }),
);
vi.mock('ant-design-vue', () => ({
  Button: { template: '<button><slot /></button>' },
  Drawer: {
    name: 'Drawer',
    props: ['open', 'getContainer', 'mask', 'rootStyle'],
    template: '<aside v-if="open"><slot /></aside>',
  },
  message: { success: vi.fn(), warning: vi.fn() },
}));

describe('供应商 Markdown 配置指南', () => {
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
  });

  it('不依赖供应商编码即可打开右侧指南并复制回调', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const wrapper = mount(ProviderGuidance, {
      props: {
        providerCode: 'NEW_ENTERPRISE',
        guidance: {
          markdown:
            '# 新平台\n\n回调 `{{callbackUrl}}`\n\n[官方文档](https://example.com/docs)',
        },
      },
    });
    expect(wrapper.find('aside').exists()).toBe(false);
    await wrapper.get('button').trigger('click');
    expect(wrapper.find('aside').text()).toContain(
      '/oauth/callback/NEW_ENTERPRISE',
    );
    expect(wrapper.find('aside a').attributes('href')).toBe(
      'https://example.com/docs',
    );
    const copyButton = wrapper.findAll('button')[1];
    expect(copyButton).toBeDefined();
    await copyButton?.trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/oauth/callback/NEW_ENTERPRISE`,
    );
    wrapper.unmount();
  });

  it('把指南限制在当前配置弹窗内并默认隐藏', async () => {
    const modal = document.createElement('div');
    modal.className = 'ant-modal-content';
    document.body.append(modal);
    const wrapper = mount(ProviderGuidance, {
      attachTo: modal,
      props: {
        providerCode: 'DINGTALK_V2',
        guidance: { markdown: '# 钉钉配置指南' },
      },
    });
    const drawer = wrapper.findComponent({ name: 'Drawer' });
    expect(wrapper.find('aside').exists()).toBe(false);
    expect((drawer.props('getContainer') as () => HTMLElement)()).toBe(modal);
    expect(drawer.props('rootStyle')).toEqual({
      position: 'absolute',
      inset: '0',
    });
    expect(drawer.props('mask')).toBe(false);
    await wrapper.get('button').trigger('click');
    expect(wrapper.find('aside').text()).toContain('钉钉配置指南');
    wrapper.unmount();
    modal.remove();
  });

  it('切换供应商时不保留旧指南，缺少 Markdown 不显示入口', async () => {
    const wrapper = mount(ProviderGuidance, {
      props: { providerCode: 'FEISHU', guidance: { markdown: '# 飞书' } },
    });
    await wrapper.get('button').trigger('click');
    expect(wrapper.find('aside').text()).toContain('飞书');
    await wrapper.setProps({
      providerCode: 'DINGTALK_V2',
      guidance: { markdown: '# 钉钉' },
    });
    expect(wrapper.find('aside').exists()).toBe(false);
    await wrapper.get('button').trigger('click');
    expect(wrapper.find('aside').text()).toContain('钉钉');
    await wrapper.setProps({ guidance: { steps: ['旧格式'] } });
    expect(wrapper.find('button').exists()).toBe(false);
    wrapper.unmount();
  });

  it('将不可信 HTML 作为文本并拒绝非 HTTPS 链接', () => {
    const html = renderSafeMarkdown(
      '# 标题\n\n<script>alert(1)</script>\n\n[恶意](javascript:alert(1))\n\n- **安全文本**',
    );
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('<strong>安全文本</strong>');
  });
});
