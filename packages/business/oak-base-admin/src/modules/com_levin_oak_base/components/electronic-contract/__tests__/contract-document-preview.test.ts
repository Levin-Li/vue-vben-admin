import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileStyle, parse } from 'vue/compiler-sfc';

import ContractDocumentPreview from '../contract-document-preview.vue';
import componentSource from '../contract-document-preview.vue?raw';

const { renderAsync } = vi.hoisted(() => ({
  renderAsync: vi.fn(
    async (
      _file: Blob,
      container: HTMLElement,
      _style?: HTMLElement,
      _options?: Record<string, unknown>,
    ) => {
      container.innerHTML = `
      <div class="docx-wrapper">
        <section class="docx">第 1 页</section>
        <section class="docx">第 2 页</section>
      </div>`;
    },
  ),
}));

vi.mock('docx-preview', () => ({ renderAsync }));

const buttonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
};

describe('合同 Word 预览组件', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    renderAsync.mockClear();
  });

  it('分页展示 Word 内容并在对应页面叠加模拟签章', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: async () => new Blob(['contract']),
        ok: true,
      }),
    );

    const wrapper = mount(ContractDocumentPreview, {
      props: {
        documentUrl: '/api/files/contract.docx',
        positions: [
          {
            height: 0.12,
            pageNo: 1,
            signerLabel: '甲方盖章',
            source: 'provider-default',
            width: 0.2,
            x: 0.68,
            y: 0.74,
          },
          {
            height: 0.12,
            pageNo: 2,
            signerLabel: '乙方签字',
            source: 'business-override',
            width: 0.2,
            x: 0.2,
            y: 0.5,
          },
        ],
      },
      global: {
        stubs: {
          Alert: true,
          Button: buttonStub,
          Empty: true,
          Pagination: true,
          Spin: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();

    expect(renderAsync).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('第 1 / 2 页');
    expect(wrapper.text()).toContain('模拟签章');
    expect(wrapper.text()).toContain('供应商默认');

    await wrapper.get('button:nth-of-type(2)').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('第 2 / 2 页');
    expect(wrapper.text()).toContain('业务覆盖');
    expect(wrapper.emitted('pageChange')?.[0]).toEqual([2]);
  });
  it('渲染器display:flex不会覆盖隐藏页，翻页显示对应正文', async () => {
    const wrapper = mount(ContractDocumentPreview, {
      attachTo: document.body,
      props: { documentBlob: new Blob(['two-pages']) },
      global: {
        stubs: {
          Alert: true,
          Button: buttonStub,
          Empty: true,
          Pagination: true,
          Spin: { template: '<div><slot /></div>' },
        },
      },
    });
    const scopedStyle = document.createElement('style');
    const rendererStyle = document.createElement('style');
    try {
      const { descriptor } = parse(componentSource);
      const id = Object.keys(wrapper.attributes()).find((name) =>
        name.startsWith('data-v-'),
      );
      const componentStyle = descriptor.styles[0];
      if (!id || !componentStyle) throw new Error('组件缺少scoped样式');
      scopedStyle.textContent = compileStyle({
        filename: 'contract-document-preview.vue',
        source: componentStyle.content,
        id,
        scoped: true,
      }).code;
      // 真实渲染器样式后插入，不能靠偶然的CSS加载先后维持分页。
      rendererStyle.textContent =
        '.docx-wrapper > section.docx { display: flex; }';
      document.head.append(scopedStyle, rendererStyle);
      await flushPromises();
      const [firstPage, secondPage] = wrapper.findAll('section.docx');
      if (!firstPage || !secondPage) throw new Error('渲染器未生成两页');
      expect(getComputedStyle(firstPage.element).display).toBe('flex');
      expect(getComputedStyle(secondPage.element).display).toBe('none');
      await wrapper.get('button:nth-of-type(2)').trigger('click');
      await flushPromises();
      expect(wrapper.text()).toContain('第 2 / 2 页');
      expect(getComputedStyle(firstPage.element).display).toBe('none');
      expect(getComputedStyle(secondPage.element).display).toBe('flex');
      expect(secondPage.text()).toBe('第 2 页');
      await wrapper.get('button:nth-of-type(1)').trigger('click');
      expect(getComputedStyle(firstPage.element).display).toBe('flex');
      expect(getComputedStyle(secondPage.element).display).toBe('none');
    } finally {
      scopedStyle.remove();
      rendererStyle.remove();
      wrapper.unmount();
    }
  });

  it('旧Word渲染迟到时不得覆盖新文档，页面链接保持只读', async () => {
    let finishOld!: () => void;
    renderAsync.mockImplementationOnce(
      async (
        _file: Blob,
        container: HTMLElement,
        _style?: HTMLElement,
        _options?: Record<string, unknown>,
      ) => {
        await new Promise<void>((done) => {
          finishOld = done;
        });
        container.innerHTML =
          '<div class="docx-wrapper"><section class="docx">旧合同</section></div>';
      },
    );
    renderAsync.mockImplementationOnce(
      async (
        _file: Blob,
        container: HTMLElement,
        _style?: HTMLElement,
        _options?: Record<string, unknown>,
      ) => {
        container.innerHTML =
          '<div class="docx-wrapper"><section class="docx"><a href="javascript:alert(1)">新合同</a></section></div>';
      },
    );
    const wrapper = mount(ContractDocumentPreview, {
      props: { documentBlob: new Blob(['old']) },
      global: {
        stubs: {
          Alert: true,
          Button: buttonStub,
          Empty: true,
          Pagination: true,
          Spin: { template: '<div><slot /></div>' },
        },
      },
    });
    await wrapper.setProps({ documentBlob: new Blob(['new']) });
    await flushPromises();
    expect(wrapper.text()).toContain('新合同');
    expect(wrapper.find('a').exists()).toBe(false);
    finishOld();
    await flushPromises();
    expect(wrapper.text()).not.toContain('旧合同');
    expect(renderAsync.mock.calls.at(-1)?.[3]).toMatchObject({
      renderAltChunks: false,
      ignoreFonts: true,
      useBase64URL: true,
    });
    wrapper.unmount();
  });

  it('拒绝跨域或脚本地址，不启动任何文件下载', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const wrapper = mount(ContractDocumentPreview, {
      props: { documentUrl: 'https://untrusted.invalid/contract.docx' },
      global: {
        stubs: {
          Alert: true,
          Button: buttonStub,
          Empty: true,
          Pagination: true,
          Spin: { template: '<div><slot /></div>' },
        },
      },
    });
    await flushPromises();
    expect(fetcher).not.toHaveBeenCalled();
    expect(wrapper.emitted('loadError')?.[0]?.[0]).toContain('同源');
    wrapper.unmount();
  });
});
