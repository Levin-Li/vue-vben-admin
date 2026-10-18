import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettlementContentEditor from '../content-editor.vue';

const { allowed, read } = vi.hoisted(() => ({
  allowed: vi.fn(),
  read: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: allowed }),
}));
vi.mock('../../../api/settlement-statement-service', () => ({
  settlementStatementService: { readFinancialDetails: read },
}));
vi.mock('../config', () => ({
  settlementFinancialPermission: ['测试财务权限'],
}));
vi.mock('ant-design-vue', () => ({
  Alert: {
    props: ['message'],
    template: '<div role="alert">{{ message }}</div>',
  },
  Input: {
    TextArea: {
      props: ['value', 'disabled'],
      emits: ['update:value'],
      template:
        '<textarea :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
    },
  },
}));
beforeEach(() => vi.resetAllMocks());
describe('结算业务内容授权回显', () => {
  it('没有独立财务权限时不请求原 JSON，不提供覆盖入口', async () => {
    allowed.mockReturnValue(false);
    const wrapper = mount(SettlementContentEditor, { props: { id: 's1' } });
    await flushPromises();
    expect(read).not.toHaveBeenCalled();
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
  it('未获内容字段组时不把隐藏原值替换为默认空对象', async () => {
    allowed.mockReturnValue(true);
    read.mockResolvedValue({ id: 's1', payeeBankAccount: { bank: '银行' } });
    const wrapper = mount(SettlementContentEditor, {
      props: { id: 's1', tenantId: 't1' },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('未获结算业务内容字段组授权');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
  it('切换范围后丢弃旧响应，只回显当前授权记录内容', async () => {
    allowed.mockReturnValue(true);
    let resolveOld!: (value: unknown) => void;
    read.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    read.mockResolvedValueOnce({ settlementContent: { orders: ['current'] } });
    const wrapper = mount(SettlementContentEditor, {
      props: { id: 'old', tenantId: 't1' },
    });
    await wrapper.setProps({ id: 'new', tenantId: 't2' });
    await flushPromises();
    resolveOld({ settlementContent: { orders: ['old-secret'] } });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ orders: ['current'] }],
    ]);
    expect(read).toHaveBeenLastCalledWith({
      id: 'new',
    });
  });
});
