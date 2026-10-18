import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowInstanceOperations from './workflow-instance-operations.vue';

vi.mock('ant-design-vue', () => ({
  Alert: { props: ['message'], template: '<p>{{ message }}</p>' },
  Button: {
    props: ['disabled'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
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
const requestId = vi.fn(() => 'request-fixture-1');
const props = () => ({
  instanceId: 'instance-one',
  businessReference: {
    businessType: 'expense',
    businessId: 'business-one',
    tenantId: 'tenant-one',
    orgId: 'org-one',
  },
  allowedActions: ['withdraw', 'terminate', 'recover'],
  permissions: { withdraw: true, terminate: false, recover: false },
  execute: vi.fn().mockResolvedValue({}),
});
function button(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('button').find((item) => item.text() === text);
  if (!found) throw new Error(`缺少按钮${text}`);
  return found;
}

// 授权、必填原因与命令原样重放是运行操作的可观察契约。
describe('实例撤回终止与接管操作', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: requestId });
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());
  it('服务端操作和实际API权限必须同时满足', async () => {
    const wrapper = mount(WorkflowInstanceOperations, { props: props() });
    expect(wrapper.text()).toContain('撤回流程');
    expect(wrapper.text()).not.toContain('终止流程');
    expect(wrapper.text()).not.toContain('接管并恢复');
    await wrapper.setProps({ allowedActions: [] });
    expect(wrapper.find('button').exists()).toBe(false);
    wrapper.unmount();
  });
  it('原因必填，失败后重试使用完全相同的实例/原因/请求标识', async () => {
    const value = props();
    value.execute
      .mockRejectedValueOnce(new Error('网络提交结果未知'))
      .mockResolvedValueOnce({});
    const wrapper = mount(WorkflowInstanceOperations, { props: value });
    await button(wrapper, '撤回流程').trigger('click');
    expect(
      button(wrapper, '确认撤回流程').attributes('disabled'),
    ).toBeDefined();
    await wrapper.get('textarea').setValue('业务依据变化，申请重填');
    await button(wrapper, '确认撤回流程').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('网络提交结果未知');
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined();
    await button(wrapper, '重试原命令').trigger('click');
    await flushPromises();
    expect(value.execute).toHaveBeenNthCalledWith(
      1,
      'withdraw',
      expect.objectContaining({
        instanceId: 'instance-one',
        businessType: 'expense',
        businessId: 'business-one',
        reason: '业务依据变化，申请重填',
        requestId: 'request-fixture-1',
      }),
    );
    expect(value.execute.mock.calls[0]).toEqual(value.execute.mock.calls[1]);
    expect(requestId).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('completed')).toHaveLength(1);
    wrapper.unmount();
  });
  it('接管仅在服务端许可且有失败交付标识时提交固定引用', async () => {
    const value = props();
    const wrapper = mount(WorkflowInstanceOperations, {
      props: {
        ...value,
        dispatchId: 'dispatch-one',
        permissions: { recover: true },
      },
    });
    await button(wrapper, '接管并恢复').trigger('click');
    await wrapper.get('textarea').setValue('原执行人已离岗，当前授权人员接管');
    await button(wrapper, '确认接管并恢复').trigger('click');
    await flushPromises();
    expect(value.execute).toHaveBeenCalledWith(
      'recover',
      expect.objectContaining({
        businessType: 'expense',
        businessId: 'business-one',
        dispatchId: 'dispatch-one',
        reason: '原执行人已离岗，当前授权人员接管',
      }),
    );
    wrapper.unmount();
    const unavailable = mount(WorkflowInstanceOperations, {
      props: { ...props(), permissions: { recover: true } },
    });
    expect(unavailable.text()).not.toContain('接管并恢复');
    unavailable.unmount();
  });

  it('权限撤销后不能提交，即使原因表单仍在', async () => {
    const value = props();
    const wrapper = mount(WorkflowInstanceOperations, { props: value });
    await button(wrapper, '撤回流程').trigger('click');
    await wrapper.get('textarea').setValue('确认退出');
    await wrapper.setProps({ permissions: {} });
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(value.execute).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('实例切换隔离迟到命令响应，不刷新另一个对象', async () => {
    let finish!: () => void;
    const value = props();
    value.execute.mockImplementation(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
    const wrapper = mount(WorkflowInstanceOperations, { props: value });
    await button(wrapper, '撤回流程').trigger('click');
    await wrapper.get('textarea').setValue('确认退出');
    await button(wrapper, '确认撤回流程').trigger('click');
    await wrapper.setProps({ instanceId: 'instance-two' });
    finish();
    await flushPromises();
    expect(wrapper.emitted('completed')).toBeUndefined();
    expect(wrapper.find('textarea').exists()).toBe(false);
    wrapper.unmount();
  });
});
