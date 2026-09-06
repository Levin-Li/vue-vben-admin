import { flushPromises, mount } from '@vue/test-utils';

import { downloadFileFromBlob } from '@vben/utils';

import { Image, ImagePreviewGroup, message } from 'ant-design-vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DetailMediaField from '../detail-media-field.vue';

vi.mock('@vben/utils', () => ({ downloadFileFromBlob: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('详情图片与附件', () => {
  it('图集使用同组预览且保留图片顺序和说明', () => {
    const wrapper = mount(DetailMediaField, {
      props: { label: '图集', type: 'image', value: ['/a.png', '/b.png'] },
    });
    expect(wrapper.findComponent(ImagePreviewGroup).exists()).toBe(true);
    expect(
      wrapper.findAllComponents(Image).map((image) => image.props('src')),
    ).toEqual(['/a.png', '/b.png']);
    expect(
      wrapper.findAll('img').map((image) => image.attributes('alt')),
    ).toEqual(['图集 · 第 1 张', '图集 · 第 2 张']);
    wrapper.unmount();
  });

  it('验证 PDF 新标签预览与普通文件打开均隔离 opener 并保留完整 URL', () => {
    const wrapper = mount(DetailMediaField, {
      props: {
        label: '附件',
        type: 'file',
        value: ['/report.PDF?token=a,b', '/readme.txt'],
      },
    });
    const links = wrapper.findAll('a');
    expect(links.map((link) => link.text())).toEqual(['预览', '打开']);
    expect(links[0].attributes('href')).toBe('/report.PDF?token=a,b');
    expect(
      links.every(
        (link) =>
          link.attributes('target') === '_blank' &&
          link.attributes('rel') === 'noopener noreferrer',
      ),
    ).toBe(true);
    expect(wrapper.text()).not.toContain('token=');
    wrapper.unmount();
  });

  it('点击下载后请求资源并通过共享下载函数保存 Blob', async () => {
    const source = new Blob(['附件内容']);
    const fetchFile = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: async () => source });
    vi.stubGlobal('fetch', fetchFile);
    const wrapper = mount(DetailMediaField, {
      props: {
        label: '附件',
        type: 'file',
        value: '/lfs/report.pdf?token=test',
      },
    });
    await wrapper.get('[data-test="detail-file-download"]').trigger('click');
    await flushPromises();
    expect(fetchFile).toHaveBeenCalledWith('/lfs/report.pdf?token=test', {
      credentials: 'same-origin',
    });
    expect(downloadFileFromBlob).toHaveBeenCalledWith({
      fileName: 'report.pdf',
      source,
    });
    wrapper.unmount();
  });

  it('下载失败提示用户且恢复可重试状态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    const error = vi
      .spyOn(message, 'error')
      .mockImplementation(() => ({}) as never);
    const wrapper = mount(DetailMediaField, {
      props: { label: '附件', type: 'file', value: '/a.pdf' },
    });
    await wrapper.get('[data-test="detail-file-download"]').trigger('click');
    await flushPromises();
    expect(error).toHaveBeenCalledWith(
      '下载失败，请重试或通过打开入口访问文件',
    );
    expect(downloadFileFromBlob).not.toHaveBeenCalled();
    expect(wrapper.get('a').attributes('href')).toBe('/a.pdf');
    expect(wrapper.find('.ant-btn-loading').exists()).toBe(false);
    wrapper.unmount();
  });

  it('危险地址不会生成图片请求或可点击附件链接', () => {
    for (const type of ['file', 'image'] as const) {
      const wrapper = mount(DetailMediaField, {
        props: { label: '资源', type, value: 'javascript:alert(1)' },
      });
      expect(wrapper.find('img').exists()).toBe(false);
      expect(wrapper.find('a').exists()).toBe(false);
      expect(wrapper.find('button').exists()).toBe(false);
      expect(wrapper.text()).toContain('资源地址不可用');
      wrapper.unmount();
    }
  });
});
