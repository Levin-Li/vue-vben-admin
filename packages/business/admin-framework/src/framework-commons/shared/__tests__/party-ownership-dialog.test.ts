import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartyOwnershipDialog from '../party-ownership-dialog.vue';

const collectChanges = vi.hoisted(() => vi.fn());
const messages = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }));
vi.mock('ant-design-vue', () => ({
  Modal: { name: 'AModal', props: ['open', 'title'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  Button: { name: 'AButton', template: '<button @click="$emit(\'click\')"><slot /></button>' },
  message: messages,
}));
vi.mock('../party-ownership-panel.vue', () => ({
  default: { name: 'PartyOwnershipPanel', props: ['groups', 'saving'],
    setup(_: unknown, { expose }: { expose: (value: unknown) => void }) { expose({ collectChanges, markCommitted: vi.fn() }); return {}; }, template: '<div />' },
}));
vi.mock('../../data-attr-policy', () => ({
  validatePolicy: vi.fn(), subscribeDataAttrPolicyInvalidation: () => () => {},
  loadDataAttrPolicyByOperation: vi.fn(async (operation: string) => ({
    operation, restricted: true, methods: ['PUT'], pathPatterns: ['/'], groups: [{ id: 'g', name: '归属', allowed: true }],
    viewRoots: { request: ['model'], response: ['model'] }, requestRoots: [],
    nodes: { model: { kind: 'object', fields: [
      { name: 'operationOrgId', wireName: 'operationOrgId', nodeId: 'value', groupIds: ['g'] },
      { name: 'operationUserId', wireName: 'operationUserId', nodeId: 'value', groupIds: ['g'] },
      { name: 'businessOrgId', wireName: 'businessOrgId', nodeId: 'value', groupIds: ['g'] },
      { name: 'businessUserId', wireName: 'businessUserId', nodeId: 'value', groupIds: ['g'] },
    ] }, value: { kind: 'value' } },
  })),
}));

const operation = { group: 'operation', operation: 'bind', orgField: 'operationOrgId', userField: 'operationUserId',
  orgChanged: true, userChanged: false, orgId: 'org-a' };
const business = { group: 'business', operation: 'bind', orgField: 'businessOrgId', userField: 'businessUserId',
  orgChanged: true, userChanged: false, orgId: 'org-b' };

function props() {
  const target = { method: 'PUT', path: '/ownership' };
  return {
    open: true, identity: 'user-a', record: { id: 'one', optimisticLock: 2 },
    descriptors: [
      { key: 'operation', label: '运营', orgLabel: '团队', userLabel: '人员', orgField: 'operationOrgId', userField: 'operationUserId' },
      { key: 'business', label: '商务', orgLabel: '团队', userLabel: '人员', orgField: 'businessOrgId', userField: 'businessUserId' },
    ],
    readPolicy: { operation: 'read', target }, bindPolicy: { operation: 'bind', target }, adjustPolicy: { operation: 'adjust', target },
    canBind: true, canAdjust: true,
    loadStatus: vi.fn(async () => ({ operation: false, business: false })), save: vi.fn(async () => true),
  };
}

describe('动态归属弹窗', () => {
  beforeEach(() => { vi.clearAllMocks(); collectChanges.mockReturnValue([]); });

  it('一个确定按钮依次提交所有变更并传递最新版本', async () => {
    collectChanges.mockReturnValue([operation, business]);
    const p = props(); const wrapper = mount(PartyOwnershipDialog, { props: p }); await flushPromises();
    expect(wrapper.findComponent({ name: 'AModal' }).props('title')).toBe('绑定归属');
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['取消', '确定']);
    await wrapper.findAll('button').find((button) => button.text() === '确定')!.trigger('click'); await flushPromises();
    expect(p.save).toHaveBeenNthCalledWith(1, operation, expect.objectContaining({ optimisticLock: 2 }));
    expect(p.save).toHaveBeenNthCalledWith(2, business, expect.objectContaining({ optimisticLock: 3 }));
    expect(wrapper.emitted('changed')).toHaveLength(1);
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });

  it('部分失败明确提示已保存数量，停止后续提交并保持弹窗', async () => {
    collectChanges.mockReturnValue([operation, business]);
    const p = props(); p.save = vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('版本冲突'));
    const wrapper = mount(PartyOwnershipDialog, { props: p }); await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '确定')!.trigger('click'); await flushPromises();
    expect(p.save).toHaveBeenCalledTimes(2);
    expect(messages.error).toHaveBeenCalledWith('已保存 1 项，其余未保存：版本冲突');
    expect(wrapper.emitted('changed')).toBeUndefined();
    expect(wrapper.emitted('update:open')).toBeUndefined();
    await wrapper.findAll('button').find((button) => button.text() === '取消')!.trigger('click');
    expect(wrapper.emitted('changed')).toHaveLength(1);
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });

  it('服务返回 false 时停止提交并明确提示已保存项', async () => {
    collectChanges.mockReturnValue([operation, business]);
    const p = props(); p.save = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const wrapper = mount(PartyOwnershipDialog, { props: p }); await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '确定')!.trigger('click'); await flushPromises();
    expect(p.save).toHaveBeenCalledTimes(2);
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).toHaveBeenCalledWith('已保存 1 项，其余未保存：服务未保存该归属');
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('状态冲突或无操作授权时不展示可操作组', async () => {
    const p = props(); p.loadStatus = vi.fn(async (op: string) => ({ operation: op === 'adjust', business: op === 'adjust' }));
    const wrapper = mount(PartyOwnershipDialog, { props: p }); await flushPromises();
    expect(wrapper.findComponent({ name: 'PartyOwnershipPanel' }).props('groups')).toEqual([]);
    expect(wrapper.findAll('button').some((button) => button.text() === '确定')).toBe(false);
  });

  it('不可编辑记录保留可读归属，但不提供写入操作', async () => {
    const p = { ...props(), readOnlyReason: '此记录不可编辑' };
    const wrapper = mount(PartyOwnershipDialog, { props: p }); await flushPromises();
    const groups = wrapper.findComponent({ name: 'PartyOwnershipPanel' }).props('groups') as any[];
    expect(p.loadStatus).toHaveBeenCalledTimes(2);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.canReadOrg && !group.canWriteOrg && !group.canWriteUser)).toBe(true);
    expect(wrapper.text()).toContain('此记录不可编辑');
    expect(wrapper.findAll('button').some((button) => button.text() === '确定')).toBe(false);
    expect(p.save).not.toHaveBeenCalled();
  });

  it('身份变更后不会采用上一个用户迟到的授权结果', async () => {
    const p = props();
    let release!: (value: Record<string, boolean>) => void;
    const pending = new Promise<Record<string, boolean>>((resolve) => { release = resolve; });
    p.loadStatus = vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ operation: true, business: true });
    const wrapper = mount(PartyOwnershipDialog, { props: p }); await flushPromises();
    await wrapper.setProps({ identity: 'user-b' }); await flushPromises();
    release({ operation: false, business: false }); await flushPromises();
    expect((wrapper.findComponent({ name: 'PartyOwnershipPanel' }).props('groups') as any[])[0]?.bound).toBe(true);
  });
});
