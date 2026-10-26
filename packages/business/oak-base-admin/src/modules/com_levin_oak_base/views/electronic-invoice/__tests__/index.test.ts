import { flushPromises, shallowMount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import CrudPage from '../../crud-page.vue';
import InvoicePage from '../index.vue';

const mocks = vi.hoisted(() => ({
  redIssue: vi.fn(),
  reload: vi.fn(),
}));

vi.mock('../../../api/electronic-invoice-service', () => ({
  electronicInvoiceService: {
    redIssue: mocks.redIssue,
  },
}));

vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: () => [],
  }),
);

vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));

type InvoicePageState = {
  redIssueForm: { redReason: string };
  redIssueOpen: boolean;
};

describe('开票申请红冲页面', () => {
  beforeEach(() => {
    mocks.redIssue.mockReset();
    mocks.reload.mockReset();
  });

  it('成功后原位刷新列表，失败时保留弹窗、输入及列表状态', async () => {
    const wrapper = shallowMount(InvoicePage);
    const crud = () => wrapper.findComponent(CrudPage);
    const initialKey = crud().vm.$.vnode.key;
    const state = wrapper.vm as unknown as InvoicePageState & {
      openRedIssue: (
        record: { id: string; status: string },
        reload: () => Promise<void>,
      ) => void;
    };
    state.openRedIssue({ id: 'invoice-1', status: 'Issued' }, mocks.reload);
    state.redIssueForm.redReason = '票面错误';

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mocks.redIssue.mockRejectedValueOnce(new Error('failed'));
    wrapper.findComponent({ name: 'AModal' }).vm.$emit('ok');
    await flushPromises();
    expect(state.redIssueOpen).toBe(true);
    expect(state.redIssueForm.redReason).toBe('票面错误');
    expect(crud().vm.$.vnode.key).toBe(initialKey);

    mocks.redIssue.mockResolvedValueOnce({});
    wrapper.findComponent({ name: 'AModal' }).vm.$emit('ok');
    await flushPromises();
    expect(mocks.redIssue).toHaveBeenLastCalledWith({
      originalInvoiceId: 'invoice-1',
      redReason: '票面错误',
      tenantId: undefined,
    });
    expect(state.redIssueOpen).toBe(false);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    expect(crud().vm.$.vnode.key).toBe(initialKey);
    consoleError.mockRestore();
  });

  it('以单个标准 CRUD 为页面主体，不展示额外说明块', () => {
    const wrapper = shallowMount(InvoicePage);
    expect(wrapper.findAllComponents(CrudPage)).toHaveLength(1);
    expect(wrapper.element.tagName).toBe('DIV');
    expect(wrapper.html()).not.toContain('商户自用电子发票');
  });

  it('只在安全链接上打开供应商交付的票据', () => {
    const wrapper = shallowMount(InvoicePage);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const page = wrapper.vm as unknown as {
      openInvoiceFile: (url: string) => void;
    };

    page.openInvoiceFile('https://example.test/invoice.pdf');
    expect(open).toHaveBeenCalledWith(
      'https://example.test/invoice.pdf',
      '_blank',
      'noopener,noreferrer',
    );
    page.openInvoiceFile('javascript:alert(1)');
    expect(open).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });
});
