import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SubjectInfoAction from '../subject-info-action.vue';

const mocked = vi.hoisted(() => ({
  user: { tenantId: 'tenant-1', tenantAdmin: false, id: 'u1', orgId: 'o1' },
  partnerRetrieve: vi.fn(),
  subjectRetrieve: vi.fn(),
  update: vi.fn(),
  bind: vi.fn(),
  createAndBind: vi.fn(),
  reload: vi.fn(),
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: mocked.user }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('../../../api/customer-service', () => ({
  customerService: {
    retrieve: mocked.partnerRetrieve,
    bindLegalSubject: mocked.bind,
    createAndBindLegalSubject: mocked.createAndBind,
  },
}));
vi.mock('../../../api/supplier-partner-service', () => ({
  supplierPartnerService: {},
}));
vi.mock('../../../api/channel-partner-service', () => ({
  channelPartnerService: {},
}));
vi.mock('../../../api/legal-subject-service', () => ({
  legalSubjectService: {
    retrieve: mocked.subjectRetrieve,
    update: mocked.update,
  },
}));
vi.mock('../legal-subject-picker.vue', () => ({
  default: { template: '<div />' },
}));
vi.mock('../../support-scope-selector.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../../support-user-selector.vue', () => ({ default: { template: '<div />' } }));
vi.mock('ant-design-vue', async () => {
  const { defineComponent } = await import('vue');
  const Button = defineComponent({
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  });
  const Modal = defineComponent({
    props: ['open'],
    template: '<div v-if="open"><slot /><slot name="footer" /></div>',
  });
  const Wrapper = defineComponent({ template: '<div><slot /></div>' });
  const Form = Object.assign(Wrapper, { Item: Wrapper });
  const Radio = Object.assign(Wrapper, { Group: Wrapper });
  return {
    Button,
    Modal,
    Form,
    Radio,
    Input: defineComponent({ props: ['value', 'disabled'], template: '<input :value="value" :disabled="disabled" />' }),
    Select: Wrapper,
    Spin: Wrapper,
    message: { error: vi.fn(), success: vi.fn() },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocked.user.tenantAdmin = false;
  mocked.user.tenantId = 'tenant-1';
  mocked.partnerRetrieve.mockResolvedValue({
    id: 'p1',
    tenantId: 'tenant-1',
    optimisticLock: 2,
    legalSubjectId: 's1',
  });
  mocked.subjectRetrieve.mockResolvedValue({
    id: 's1',
    tenantId: 'tenant-1',
    optimisticLock: 3,
    subjectName: '甲公司',
    certificationStatus: 'Certified',
  });
});

async function openSubject() {
  const wrapper = mount(SubjectInfoAction, {
    props: {
      target: 'Customer',
      record: { id: 'p1', tenantId: 'tenant-1', legalSubjectId: 's1' },
      reload: mocked.reload,
    },
  });
  await wrapper.find('button').trigger('click');
  await flushPromises();
  return wrapper;
}

describe('伙伴主体信息按钮', () => {
  it('伙伴已有主体方组织时默认展示并沿用，不允许换绑', async () => {
    mocked.partnerRetrieve.mockResolvedValue({ id: 'p1', tenantId: 'tenant-1', optimisticLock: 2,
      legalSubjectId: null, subjectOrgId: 'o2', subjectOrg: { name: '伙伴组织' } });
    const wrapper = mount(SubjectInfoAction, { props: {
      target: 'Customer', record: { id: 'p1', tenantId: 'tenant-1', legalSubjectId: null }, reload: mocked.reload,
    } });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('伙伴组织');
    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(true);
    (wrapper.vm as any).selected = 's2';
    await wrapper.findAll('button').find((button) => button.text() === '提交')!.trigger('click');
    await flushPromises();
    expect(mocked.bind).toHaveBeenCalledWith(expect.objectContaining({ subjectOrgId: 'o2', legalSubjectId: 's2' }));
  });
  it('认证成功时普通用户只有取消按钮', async () => {
    const wrapper = await openSubject();
    expect(wrapper.text()).toContain('取消');
    expect(wrapper.text()).not.toContain('提交');
    expect(mocked.subjectRetrieve).toHaveBeenCalledWith({
      id: 's1',
      tenantId: 'tenant-1',
    });
  });

  it('认证成功时同租户管理员可提交', async () => {
    mocked.user.tenantAdmin = true;
    const wrapper = await openSubject();
    expect(wrapper.text()).toContain('提交');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click');
    await flushPromises();
    expect(mocked.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', optimisticLock: 3 }),
    );
  });

  it('选择已有主体只提交关联所需字段', async () => {
    mocked.partnerRetrieve.mockResolvedValue({
      id: 'p1',
      tenantId: 'tenant-1',
      optimisticLock: 2,
      legalSubjectId: null,
      subjectOrgId: null,
    });
    const wrapper = mount(SubjectInfoAction, {
      props: {
        target: 'Customer',
        record: { id: 'p1', tenantId: 'tenant-1', legalSubjectId: null },
        reload: mocked.reload,
      },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    (wrapper.vm as any).selected = 's2';
    (wrapper.vm as any).selectedOrg = { id: 'o1', tenantId: 'tenant-1' };
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click');
    await flushPromises();
    expect(mocked.bind).toHaveBeenCalledWith({
      id: 'p1',
      tenantId: 'tenant-1',
      optimisticLock: 2,
      legalSubjectId: 's2',
      subjectOrgId: 'o1',
    });
    expect(mocked.reload).toHaveBeenCalled();
  });

  it('缺少主体组织或选择其他租户组织时不提交', async () => {
    mocked.partnerRetrieve.mockResolvedValue({
      id: 'p1', tenantId: 'tenant-1', optimisticLock: 2,
      legalSubjectId: null, subjectOrgId: null,
    });
    const wrapper = mount(SubjectInfoAction, { props: {
      target: 'Customer', record: { id: 'p1', tenantId: 'tenant-1', legalSubjectId: null }, reload: mocked.reload,
    } });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    (wrapper.vm as any).selected = 's2';
    await wrapper.findAll('button').find((button) => button.text() === '提交')!.trigger('click');
    expect(mocked.bind).not.toHaveBeenCalled();
    (wrapper.vm as any).selectedOrg = { id: 'other', tenantId: 'tenant-2' };
    await wrapper.findAll('button').find((button) => button.text() === '提交')!.trigger('click');
    expect(mocked.bind).not.toHaveBeenCalled();
  });

  it('填写新主体使用事务接口同时创建和关联', async () => {
    mocked.partnerRetrieve.mockResolvedValue({
      id: 'p1',
      tenantId: 'tenant-1',
      optimisticLock: 2,
      legalSubjectId: null,
      subjectOrgId: null,
    });
    const wrapper = mount(SubjectInfoAction, {
      props: {
        target: 'Customer',
        record: { id: 'p1', tenantId: 'tenant-1', legalSubjectId: null },
        reload: mocked.reload,
      },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    (wrapper.vm as any).mode = 'new';
    (wrapper.vm as any).selectedOrg = { id: 'o1', tenantId: 'tenant-1' };
    (wrapper.vm as any).form.subjectName = '新主体';
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click');
    await flushPromises();
    expect(mocked.createAndBind).toHaveBeenCalledWith(
      expect.objectContaining({
        partner: { id: 'p1', tenantId: 'tenant-1', optimisticLock: 2, subjectOrgId: 'o1' },
        subject: expect.objectContaining({
          subjectName: '新主体',
          businessOrgId: 'o1',
          businessUserId: 'u1',
        }),
        mine: false,
      }),
    );
  });

  it('跨租户时使用显式选择的商务部门和对接人', async () => {
    mocked.user.tenantId = 'platform';
    mocked.partnerRetrieve.mockResolvedValue({ id: 'p1', tenantId: 'tenant-1', optimisticLock: 2, legalSubjectId: null, subjectOrgId: null });
    const wrapper = mount(SubjectInfoAction, { props: {
      target: 'Customer', record: { id: 'p1', tenantId: 'tenant-1', legalSubjectId: null }, reload: mocked.reload,
    } });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    (wrapper.vm as any).selectedOrg = { id: 'owner-org', tenantId: 'tenant-1' };
    (wrapper.vm as any).businessOrg = { id: 'business-org', tenantId: 'tenant-1' };
    (wrapper.vm as any).businessUser = 'business-user';
    (wrapper.vm as any).mode = 'new';
    (wrapper.vm as any).form.subjectName = '新主体';
    await wrapper.findAll('button').find((button) => button.text() === '提交')!.trigger('click');
    await flushPromises();
    expect(mocked.createAndBind).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.objectContaining({ businessOrgId: 'business-org', businessUserId: 'business-user' }),
    }));
  });
});
