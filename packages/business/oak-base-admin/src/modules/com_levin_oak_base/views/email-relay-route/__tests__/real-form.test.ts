import { flushPromises, mount } from '@vue/test-utils';

import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { Button, Form, Modal, Select } from 'ant-design-vue';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EmailRelayPage from '../index.vue';
import RelayTargetManager from '../relay-target-manager.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  route: {
    path: '/clob/V1/EmailRelayRoute',
    fullPath: '/clob/V1/EmailRelayRoute',
    matched: [],
    meta: {},
    query: {},
  },
  user: { userInfo: { id: 'sa', roles: ['R_PLATFORM_SA'] } },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api/request', () => ({
  requestClient: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    request: mocks.request,
  },
  baseRequestClient: { get: mocks.get },
}));
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    request: mocks.request,
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { path: string }) => route.path,
  useUserStore: () => mocks.user,
  useAccessStore: () => ({ accessCodes: [] }),
  useTabbarStore: () => ({ setPageKeepAlive: vi.fn() }),
}));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: {
    error: mocks.error,
    warning: mocks.warning,
    success: vi.fn(),
    info: vi.fn(),
  },
}));

let wrapper: ReturnType<typeof mount> | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async (path: string) =>
    path.endsWith('/EmailRelayRoute/list') ? { items: [], total: 0 } : [],
  );
  mocks.post.mockResolvedValue({ id: 'relay-new' });
  mocks.put.mockResolvedValue({});
  mocks.request.mockImplementation(
    (path: string, options: { method: string }) => {
      const method = String(options.method).toUpperCase();
      if (method === 'GET') return mocks.get(path, options);
      if (method === 'PUT') return mocks.put(path, options);
      return mocks.post(path, options);
    },
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

async function openCreate() {
  wrapper = mount(EmailRelayPage, {
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
      stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
    },
  });
  await flushPromises();
  const create = wrapper
    .findAllComponents(Button)
    .find((item) => item.text() === '新增');
  if (!create) throw new Error('缺少标准新增按钮');
  await create.trigger('click');
  await flushPromises();
  expect((wrapper.findComponent(CrudPage).vm as any).isFormOpen()).toBe(true);
  const modal = wrapper
    .findAllComponents({ name: 'AModal' })
    .find((item) => item.props('open'));
  if (!modal) throw new Error('缺少标准新增弹窗');
  return modal;
}

function itemByLabel(modal: any, label: string) {
  const item = modal
    .findAllComponents(Form.Item)
    .find((field: any) => field.props('label') === label);
  if (!item) throw new Error(`缺少表单字段：${label}`);
  return item;
}

function targetManager(modal: any) {
  const manager = modal.findComponent(RelayTargetManager);
  if (!manager.exists()) throw new Error('缺少投递目标子列表');
  return manager;
}

async function confirmTargetEditor(manager: any) {
  manager.findComponent(Modal).vm.$emit('ok');
  await flushPromises();
}

async function fillBase(modal: any) {
  await itemByLabel(modal, '路由名称').get('input').setValue('客服邮件');
  itemByLabel(modal, '邮件域名')
    .getComponent(Select)
    .vm.$emit('update:value', 'example.test');
  itemByLabel(modal, '提供商')
    .getComponent(Select)
    .vm.$emit('update:value', 'forward-email');
  await flushPromises();
}

async function save() {
  const button = document.body.querySelector<HTMLButtonElement>(
    '.ant-modal-footer button.ant-btn-primary',
  );
  if (!button) throw new Error('缺少标准保存按钮');
  button.click();
  await flushPromises();
}

describe('邮件中转真实标准表单', () => {
  it('从真实表格打开编辑，保留既有目标并保存修改后的地址', async () => {
    const record = {
      id: 'relay-existing',
      name: '客服邮件',
      mailDomain: 'example.test',
      localPart: 'support',
      providerCode: 'forward-email',
      enable: true,
      syncStatus: 'Pending',
      editable: true,
      targetList: [
        'email:old@example.test',
        'notify-webhook:https://hooks.example.test/mail',
      ],
    };
    mocks.get.mockImplementation(async (path: string) => {
      if (path.endsWith('/EmailRelayRoute/list'))
        return { items: [record], total: 1 };
      if (path.endsWith('/EmailRelayRoute/retrieve')) return record;
      return [];
    });
    wrapper = mount(EmailRelayPage, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: { Page: { template: '<div><slot /></div>' } },
      },
    });
    await flushPromises();
    const edit = wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replaceAll(/\s/g, '') === '编辑');
    if (!edit) throw new Error('真实列表未提供标准编辑动作');
    await edit.trigger('click');
    await flushPromises();
    const modal = wrapper
      .findAllComponents({ name: 'AModal' })
      .find((item) => item.props('open'));
    if (!modal) throw new Error('缺少标准编辑弹窗');
    const manager = targetManager(modal);
    expect(manager.findAll('[data-relay-target-row]')).toHaveLength(2);
    const editTarget = manager
      .findAllComponents(Button)
      .find((button: any) => button.text() === '编辑');
    await editTarget?.trigger('click');
    await flushPromises();
    const address = itemByLabel(manager.findComponent(Modal), '地址');
    expect((address.get('input').element as HTMLInputElement).value).toBe(
      'old@example.test',
    );
    await address.get('input').setValue('new@example.test');
    await confirmTargetEditor(manager);
    await flushPromises();
    await save();
    await vi.waitFor(() =>
      expect(
        mocks.put.mock.calls.some(([path]) =>
          String(path).endsWith('/EmailRelayRoute/update'),
        ),
      ).toBe(true),
    );
    const submitted = mocks.put.mock.calls.find(([path]) =>
      String(path).endsWith('/EmailRelayRoute/update'),
    );
    expect(submitted?.[1].data).toMatchObject({
      id: 'relay-existing',
      targetList: [
        'email:new@example.test',
        'notify-webhook:https://hooks.example.test/mail',
      ],
    });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('通过新增目标控件填写邮箱并点击保存，提交稳定投递协议', async () => {
    const modal = await openCreate();
    await fillBase(modal);
    const manager = targetManager(modal);
    expect(manager.findAll('[data-relay-target-row]')).toHaveLength(0);
    const add = manager
      .findAllComponents(Button)
      .find((item: any) => item.text() === '新增目标');
    expect(add, '空目标列表必须有可见填写入口').toBeDefined();
    await add?.trigger('click');
    await flushPromises();
    const editor = manager.findComponent(Modal);
    const type = editor
      .findAllComponents(Select)
      .find((control: any) =>
        control
          .props('options')
          ?.some((option: any) => option.value === 'email'),
      );
    expect(type, '投递类型必须保存实际类型值').toBeDefined();
    type?.vm.$emit('update:value', 'email');
    await flushPromises();
    await itemByLabel(editor, '地址').get('input').setValue('ops@example.test');
    await confirmTargetEditor(manager);
    expect(manager.findAll('[data-relay-target-row]')).toHaveLength(1);
    await save();
    await vi.waitFor(() =>
      expect(
        mocks.post.mock.calls.some(([path]) =>
          String(path).endsWith('/EmailRelayRoute/create'),
        ),
      ).toBe(true),
    );
    const submitted = mocks.post.mock.calls.find(([path]) =>
      String(path).endsWith('/EmailRelayRoute/create'),
    );
    expect(submitted?.[1].data).toMatchObject({
      name: '客服邮件',
      mailDomain: 'example.test',
      localPart: 'support',
      providerCode: 'forward-email',
      targetList: ['email:ops@example.test'],
    });
    expect(mocks.error).not.toHaveBeenCalled();
    expect((wrapper?.findComponent(CrudPage).vm as any).isFormOpen()).toBe(
      false,
    );
  });

  it('空目标保留必填帮助，阻断提交并保留可继续填写的表单', async () => {
    const modal = await openCreate();
    await fillBase(modal);
    await save();
    expect(itemByLabel(modal, '投递目标').props('required')).toBe(true);
    expect(itemByLabel(modal, '投递目标').text()).toContain('至少添加一个目标');
    await vi.waitFor(() =>
      expect(mocks.warning).toHaveBeenCalledWith('至少需要一个投递目标'),
    );
    expect(
      mocks.post.mock.calls.some(([path]) =>
        String(path).endsWith('/EmailRelayRoute/create'),
      ),
    ).toBe(false);
    expect((wrapper?.findComponent(CrudPage).vm as any).isFormOpen()).toBe(
      true,
    );
    expect(targetManager(modal).text()).toContain('新增目标');
  });
});
