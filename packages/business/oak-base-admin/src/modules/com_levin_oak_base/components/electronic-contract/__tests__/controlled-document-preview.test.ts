import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { documentPageSource } from '../controlled-document-page';
import ControlledDocumentPreview from '../controlled-document-preview.vue';

vi.mock('../contract-document-preview.vue', () => ({
  default: {
    name: 'ContractDocumentPreview',
    props: ['documentBlob', 'documentName'],
    template: '<div>Word只读正文</div>',
  },
}));
vi.mock('ant-design-vue', () => ({
  Alert: { props: ['message'], template: '<p role="alert">{{ message }}</p>' },
  Button: {
    props: ['disabled'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Spin: { template: '<div><slot /></div>' },
}));

// 两个有效PNG有不同像素；测试直接检查受控img，不能以页码替代内容验证。
const firstPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGZkAAAAASUVORK5CYII=';
const secondPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const image = (page: number) => ({
  pageNo: page,
  pageCount: 2,
  mimeType: 'image/png',
  contentBase64: page === 1 ? firstPng : secondPng,
});
function options(loadDocumentPage: (page: number) => Promise<unknown>) {
  return {
    props: {
      documentKey: 'contract:revision1',
      documentName: '合同.pdf',
      mode: 'pages' as const,
      loadDocumentPage,
    },
  };
}

// 每次页码和引用变化都立即清理正文，晚响应不得复活已关闭或失权的文档。
describe('受控文档分页预览', () => {
  it('pDF/PPTX显示分页PNG，下一页正文不同且加载时不显示上一页', async () => {
    let finishSecond!: (value: unknown) => void;
    const load = vi
      .fn()
      .mockResolvedValueOnce(image(1))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            finishSecond = done;
          }),
      )
      .mockResolvedValueOnce(image(1));
    const wrapper = mount(ControlledDocumentPreview, options(load));
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(
      `data:image/png;base64,${firstPng}`,
    );
    expect(wrapper.find('iframe').exists()).toBe(false);
    await wrapper.get('button:nth-of-type(2)').trigger('click');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(load).toHaveBeenLastCalledWith(2);
    finishSecond(image(2));
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(
      `data:image/png;base64,${secondPng}`,
    );
    expect(wrapper.text()).toContain('第 2 / 2 页');
    await wrapper.setProps({ documentKey: 'different-contract:revision1' });
    await flushPromises();
    expect(load).toHaveBeenLastCalledWith(1);
    expect(wrapper.get('img').attributes('src')).toBe(
      `data:image/png;base64,${firstPng}`,
    );
    wrapper.unmount();
  });

  it('修订或权限错误清空旧页并显示错误，不回退到空iframe', async () => {
    const wrapper = mount(
      ControlledDocumentPreview,
      options(vi.fn().mockResolvedValue(image(1))),
    );
    await flushPromises();
    await wrapper.setProps({
      documentKey: 'contract:revision2',
      loadDocumentPage: vi.fn().mockRejectedValue(new Error('合同修订已变化')),
    });
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.text()).toContain('合同修订已变化');
    wrapper.unmount();
  });

  it('切换合同后旧响应和卸载后响应均不显示图片', async () => {
    let finishOld!: (value: unknown) => void;
    const wrapper = mount(
      ControlledDocumentPreview,
      options(
        () =>
          new Promise((done) => {
            finishOld = done;
          }),
      ),
    );
    await flushPromises();
    await wrapper.setProps({
      documentKey: 'denied',
      loadDocumentPage: vi.fn().mockRejectedValue(new Error('无权查看')),
    });
    await flushPromises();
    finishOld(image(1));
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('无权查看');
    let finishAfter!: (value: unknown) => void;
    await wrapper.setProps({
      documentKey: 'after',
      loadDocumentPage: () =>
        new Promise((done) => {
          finishAfter = done;
        }),
    });
    await flushPromises();
    wrapper.unmount();
    finishAfter(image(1));
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('旧页的图片错误与旧请求失败均不能清空新正文', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce(image(1))
      .mockResolvedValueOnce(image(2));
    const wrapper = mount(ControlledDocumentPreview, options(loader));
    await flushPromises();
    const oldImage = wrapper.get('img');
    await wrapper.get('button:nth-of-type(2)').trigger('click');
    await flushPromises();
    await oldImage.trigger('error');
    expect(wrapper.get('img').attributes('src')).toContain(secondPng);
    let failOld!: (error: Error) => void;
    await wrapper.setProps({
      documentKey: 'pending',
      loadDocumentPage: () =>
        new Promise((_done, reject) => {
          failOld = reject;
        }),
    });
    await flushPromises();
    await wrapper.setProps({
      documentKey: 'latest',
      loadDocumentPage: async () => image(1),
    });
    await flushPromises();
    failOld(new Error('上一合同读取失败'));
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toContain(firstPng);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('新页失败时不残留旧图，可明确重试当前页', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce(image(1))
      .mockRejectedValueOnce(new Error('文档转换繁忙'))
      .mockResolvedValueOnce(image(2));
    const wrapper = mount(ControlledDocumentPreview, options(loader));
    await flushPromises();
    await wrapper.get('button:nth-of-type(2)').trigger('click');
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('文档转换繁忙');
    await wrapper.get('button:nth-of-type(3)').trigger('click');
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toContain(secondPng);
    await wrapper.get('img').trigger('error');
    expect(wrapper.text()).toContain('分页图片无法显示');
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
  });

  it('dOCX保持本地Word分页，不调用分页接口', async () => {
    const loadDocumentPage = vi.fn();
    const docx = new Blob(['word'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const wrapper = mount(ControlledDocumentPreview, {
      props: {
        documentKey: 'word',
        documentName: '合同.docx',
        loadDocument: async () => docx,
        loadDocumentPage,
      },
    });
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'ContractDocumentPreview' })
        .props('documentBlob'),
    ).toBe(docx);
    expect(loadDocumentPage).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('允许4MiB范围内的大页图编码，不触发正则调用栈溢出', () => {
    const contentBase64 = btoa(atob(firstPng).padEnd(4 * 1024 * 1024, '\0'));
    const result = documentPageSource({ ...image(1), contentBase64 }, 1);
    expect(result.source.startsWith('data:image/png;base64,')).toBe(true);
    expect(result.pageCount).toBe(2);
  });

  it.each([
    { ...image(1), mimeType: 'image/svg+xml' },
    { ...image(1), contentBase64: 'https://untrusted.invalid/image.png' },
    { ...image(1), contentBase64: btoa('<svg onload="alert(1)"/>') },
    { ...image(1), contentBase64: `${firstPng}\n` },
    { ...image(1), pageNo: 2 },
    { ...image(1), pageCount: 201 },
    { ...image(1), pageCount: 0 },
    {
      ...image(1),
      contentBase64: 'A'.repeat(4 * Math.ceil((4 * 1024 * 1024) / 3) + 4),
    },
  ])('拒绝不可信PNG内容或无效页码元数据', async (value) => {
    const wrapper = mount(
      ControlledDocumentPreview,
      options(async () => value),
    );
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toBeTruthy();
    wrapper.unmount();
  });
});
