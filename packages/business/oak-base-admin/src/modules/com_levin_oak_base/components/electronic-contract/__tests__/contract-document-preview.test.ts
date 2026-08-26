import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContractDocumentPreview from '../contract-document-preview.vue';

const { renderAsync } = vi.hoisted(() => ({
  renderAsync: vi.fn(async (_file: Blob, container: HTMLElement) => {
    container.innerHTML = `
      <div class="docx-wrapper">
        <section class="docx">第 1 页</section>
        <section class="docx">第 2 页</section>
      </div>`;
  }),
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
});
