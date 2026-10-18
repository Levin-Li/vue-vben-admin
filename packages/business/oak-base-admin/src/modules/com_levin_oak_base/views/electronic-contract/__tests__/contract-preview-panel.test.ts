import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import ContractPreviewPanel from '../contract-preview-panel.vue';

const { document, documentPage } = vi.hoisted(() => ({
  document: vi.fn(),
  documentPage: vi.fn(),
}));
vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: { document, documentPage },
}));
vi.mock(
  '../../../components/electronic-contract/controlled-document-preview.vue',
  () => ({
    default: {
      name: 'ControlledDocumentPreview',
      props: [
        'documentName',
        'documentKey',
        'loadDocument',
        'loadDocumentPage',
        'mode',
      ],
      template: '<div>受控正文</div>',
    },
  }),
);

// 使用后端真实字段验证请求，不允许旧sourceFile字段或公网URL作为读取授权。
describe('合同正文入口', () => {
  it('演示文稿只按合同种类和修订读取分页图片，忽略远程地址', async () => {
    const wrapper = mount(ContractPreviewPanel, {
      props: {
        contract: {
          id: 'contract-1',
          optimisticLock: 3,
          fileResId: 'resource-1',
          fileName: '合同.pptx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          fileUrl: 'https://untrusted.invalid/file',
          tenantId: 'tenant-1',
          orgId: 'org-1',
        },
      },
    });
    const preview = wrapper.findComponent({
      name: 'ControlledDocumentPreview',
    });
    await preview.props('loadDocumentPage')(2);
    expect(documentPage).toHaveBeenCalledWith({
      id: 'contract-1',
      kind: 'original',
      page: 2,
      revision: 3,
      tenantId: 'tenant-1',
      orgId: 'org-1',
    });
    expect(preview.props('documentName')).toBe('合同.pptx');
    expect(preview.props('mode')).toBe('pages');
    expect(wrapper.text()).toContain('分页图片');
  });

  it('管理页URL-only对象可预览，但不向内容接口透传链接或签名', async () => {
    const wrapper = mount(ContractPreviewPanel, {
      props: {
        contract: {
          id: 'url-only',
          optimisticLock: 2,
          fileUrl:
            'https://files.example.test/contract.docx?signature=fixture-private',
          fileName: '合同.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      },
    });
    const preview = wrapper.findComponent({
      name: 'ControlledDocumentPreview',
    });
    expect(preview.exists()).toBe(true);
    expect(preview.props('mode')).toBe('docx');
    await preview.props('loadDocument')();
    expect(document).toHaveBeenLastCalledWith({
      id: 'url-only',
      kind: 'original',
      representation: 'original',
      revision: 2,
    });
    expect(wrapper.html()).not.toContain('fixture-private');
    wrapper.unmount();
  });

  it('审批元数据不需要URL或FileRes，修订变化进入新预览键', async () => {
    const reference = {
      id: 'remote',
      optimisticLock: 1,
      hasOriginal: true,
      hasSigned: false,
      fileName: '线上合同.pdf',
      mimeType: 'application/pdf',
    };
    const wrapper = mount(ContractPreviewPanel, {
      props: { contract: reference },
    });
    const preview = wrapper.findComponent({
      name: 'ControlledDocumentPreview',
    });
    const key = preview.props('documentKey');
    await preview.props('loadDocumentPage')(1);
    expect(documentPage).toHaveBeenLastCalledWith({
      id: 'remote',
      kind: 'original',
      revision: 1,
      page: 1,
    });
    await wrapper.setProps({ contract: { ...reference, optimisticLock: 2 } });
    expect(preview.props('documentKey')).not.toBe(key);
    await preview.props('loadDocumentPage')(2);
    expect(documentPage).toHaveBeenLastCalledWith({
      id: 'remote',
      kind: 'original',
      revision: 2,
      page: 2,
    });
    wrapper.unmount();
  });

  it('只有存在标志而无文件名和MIME时仍请求后端识别的分页表示', async () => {
    const wrapper = mount(ContractPreviewPanel, {
      props: {
        contract: {
          id: 'unknown-type',
          name: '合同文档',
          optimisticLock: 5,
          hasOriginal: true,
          hasSigned: false,
        },
      },
    });
    const preview = wrapper.findComponent({
      name: 'ControlledDocumentPreview',
    });
    expect(preview.exists()).toBe(true);
    expect(preview.props('mode')).toBe('pages');
    await preview.props('loadDocumentPage')(1);
    expect(documentPage).toHaveBeenLastCalledWith({
      id: 'unknown-type',
      kind: 'original',
      revision: 5,
      page: 1,
    });
    wrapper.unmount();
  });

  it('存在标志优先于管理字段，未授权或失效引用不展示旧链接', () => {
    const wrapper = mount(ContractPreviewPanel, {
      props: {
        contract: {
          id: 'denied',
          hasOriginal: false,
          hasSigned: false,
          fileUrl: 'https://files.example.test/old.pdf?signature=hidden',
        },
      },
    });
    expect(
      wrapper.findComponent({ name: 'ControlledDocumentPreview' }).exists(),
    ).toBe(false);
    expect(wrapper.text()).toContain('线上链接可能已失效');
    expect(wrapper.html()).not.toContain('signature');
    wrapper.unmount();
  });

  it('仅有已签文档元数据时直接展示已签文件', async () => {
    const wrapper = mount(ContractPreviewPanel, {
      props: {
        contract: {
          id: 'signed',
          optimisticLock: 4,
          hasOriginal: false,
          hasSigned: true,
          signedFileName: '已签.pdf',
          signedFileMimeType: 'application/pdf',
        },
      },
    });
    const preview = wrapper.findComponent({
      name: 'ControlledDocumentPreview',
    });
    expect(preview.props('documentName')).toBe('已签.pdf');
    await preview.props('loadDocumentPage')(1);
    expect(documentPage).toHaveBeenLastCalledWith({
      id: 'signed',
      kind: 'signed',
      revision: 4,
      page: 1,
    });
    wrapper.unmount();
  });
});
