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
  redIssueForm: { redReason: string; redRequestNo: string };
  redIssueOpen: boolean;
};

describe('电子发票红冲页面', () => {
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
    state.redIssueForm.redRequestNo = 'red-1';
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
      redRequestNo: 'red-1',
      tenantId: undefined,
    });
    expect(state.redIssueOpen).toBe(false);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    expect(crud().vm.$.vnode.key).toBe(initialKey);
    consoleError.mockRestore();
  });
});
