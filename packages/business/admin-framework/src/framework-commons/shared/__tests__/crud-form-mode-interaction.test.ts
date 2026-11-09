import { flushPromises, mount } from '@vue/test-utils';

import { Button, Form, Modal } from 'ant-design-vue';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CrudPage from '../dynamic-crud-page.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(async () => ({ items: [], total: 0 })),
  post: vi.fn(async () => ({ id: 'created' })),
  route: { path: '/test', fullPath: '/test', matched: [], meta: {}, query: {} },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api/request', () => ({
  requestClient: { get: mocks.get, post: mocks.post },
  baseRequestClient: { get: mocks.get },
}));
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: { get: mocks.get, post: mocks.post },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (r: { path: string }) => r.path,
  useUserStore: () => ({ userInfo: { id: 'sa', roles: ['R_PLATFORM_SA'] } }),
  useAccessStore: () => ({ accessCodes: [] }),
  useTabbarStore: () => ({ setPageKeepAlive: vi.fn() }),
}));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn() }),
}));

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

async function open(fields: any[], extra: Record<string, unknown> = {}) {
  wrapper = mount(CrudPage, {
    attachTo: document.body,
    props: {
      config: { title: '测试', apiBase: '/Test', fields, ...extra } as any,
    },
    global: {
      plugins: [createPinia()],
      stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
    },
  });
  await flushPromises();
  await (wrapper.vm as any).openCreate();
  await flushPromises();
  const modal = wrapper
    .findAllComponents(Modal)
    .find((item) => item.props('open'));
  if (!modal) throw new Error('新增弹窗未打开');
  return modal;
}

async function openEdit(fields: any[]) {
  wrapper = mount(CrudPage, {
    attachTo: document.body,
    props: { config: { title: '测试', apiBase: '/Test', fields } as any },
    global: {
      plugins: [createPinia()],
      stubs: { Page: { template: '<div><slot /></div>' }, ATable: true },
    },
  });
  await flushPromises();
  await (wrapper.vm as any).$.setupState.handleEdit({
    id: '1',
    name: '原值',
    note: '原备注',
  });
  await flushPromises();
  const modal = wrapper
    .findAllComponents(Modal)
    .find((item) => item.props('open'));
  if (!modal) throw new Error('编辑弹窗未打开');
  return modal;
}

// 每组至少三个字段，符合真实静态分组的展示条件。
const wizardFields = () => [
  {
    key: 'name',
    label: '名称',
    required: true,
    layoutGroup: 'a',
    layoutGroupTitle: '基本信息',
  },
  { key: 'a2', label: '编号', layoutGroup: 'a', layoutGroupTitle: '基本信息' },
  { key: 'a3', label: '简称', layoutGroup: 'a', layoutGroupTitle: '基本信息' },
  {
    key: 'contact',
    label: '联系人',
    required: true,
    layoutGroup: 'b',
    layoutGroupTitle: '联系人信息',
  },
  {
    key: 'b2',
    label: '电话',
    layoutGroup: 'b',
    layoutGroupTitle: '联系人信息',
  },
  {
    key: 'b3',
    label: '邮箱',
    layoutGroup: 'b',
    layoutGroupTitle: '联系人信息',
  },
  {
    key: 'note',
    label: '备注',
    layoutGroup: 'c',
    layoutGroupTitle: '其他信息',
  },
  { key: 'c2', label: '说明', layoutGroup: 'c', layoutGroupTitle: '其他信息' },
  { key: 'c3', label: '标签', layoutGroup: 'c', layoutGroupTitle: '其他信息' },
];

describe('标准表单首次模式交互', () => {
  it('平台用户快捷填写展示租户前置项和暂不可选的必填目标', async () => {
    const modal = await open([
      { key: 'tenantId', label: '归属租户' },
      {
        key: 'partnerId',
        label: '结算目标',
        required: true,
        tenantDependent: true,
      },
      { key: 'remark', label: '备注' },
    ]);
    const items = modal.findAllComponents(Form.Item);
    expect(
      items.find((item) => item.props('label') === '归属租户')?.isVisible(),
    ).toBe(true);
    expect(
      items.find((item) => item.props('label') === '结算目标')?.isVisible(),
    ).toBe(true);
  });
  it('编辑默认不进入快捷，手动开启后可恢复完整表单及输入', async () => {
    const modal = await openEdit([
      { key: 'name', label: '名称', required: true },
      { key: 'note', label: '备注' },
    ]);
    const quick = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('快捷填写'));
    if (!quick) throw new Error('缺少快捷填写开关');
    expect(quick.props('checked')).toBe(false);
    quick.vm.$emit('update:checked', true);
    await flushPromises();
    const name = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '名称');
    const note = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '备注');
    if (!name || !note) throw new Error('缺少编辑字段');
    expect(name.isVisible()).toBe(true);
    expect(note.isVisible()).toBe(false);
    await name.get('input').setValue('更新值');
    const more = modal
      .findAllComponents(Button)
      .find((item) => item.text() === '更多');
    if (!more) throw new Error('缺少更多按钮');
    await more.trigger('click');
    await flushPromises();
    const restored = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '备注');
    if (!restored) throw new Error('缺少恢复字段');
    expect(restored.isVisible()).toBe(true);
    expect((name.get('input').element as HTMLInputElement).value).toBe(
      '更新值',
    );
  });

  it('没有有效必填字段时快捷填写选项可见但不可用', async () => {
    const modal = await open([{ key: 'note', label: '备注' }]);
    const quick = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('快捷填写'));
    if (!quick) throw new Error('缺少快捷填写开关');
    expect(quick.props('disabled')).toBe(true);
    expect(quick.props('checked')).toBe(false);
  });
  it('页面声明有效简要字段时优先显示简要表单', async () => {
    const modal = await open(
      [
        { key: 'name', label: '名称', required: true },
        { key: 'note', label: '备注' },
        { key: 'extra', label: '扩展' },
      ],
      { briefFields: { create: ['note'] } },
    );
    const brief = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('简要表单'));
    expect(brief?.props('checked')).toBe(true);
    expect(
      modal
        .findAllComponents(Form.Item)
        .some((item) => item.props('label') === '备注'),
    ).toBe(true);
  });
  it('新增默认集中必填字段，点击更多恢复完整表单且保留输入', async () => {
    const create = vi.fn(async () => 'created');
    const modal = await open(
      [
        { key: 'name', label: '名称', required: true },
        { key: 'note', label: '备注' },
      ],
      { apiService: { create } },
    );
    const name = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '名称');
    if (!name) throw new Error('缺少名称字段');
    const note = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '备注');
    if (!note) throw new Error('缺少备注字段');
    expect(name.isVisible()).toBe(true);
    expect(note.isVisible()).toBe(false);
    await name.get('input').setValue('保留内容');
    const more = modal
      .findAllComponents(Button)
      .find((item) => item.text() === '更多');
    if (!more) throw new Error('缺少更多按钮');
    await more.trigger('click');
    await flushPromises();
    expect((name.get('input').element as HTMLInputElement).value).toBe(
      '保留内容',
    );
    const expanded = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '备注');
    if (!expanded) throw new Error('缺少展开后的备注字段');
    expect(expanded.isVisible()).toBe(true);
    await expanded.get('input').setValue('其他信息');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '保留内容', note: '其他信息' }),
    );
  });

  it('三个有效分组的新增默认快捷，切换向导后校验当前步骤', async () => {
    const modal = await open(wizardFields());
    const wizard = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('向导'));
    if (!wizard) throw new Error('缺少向导选项');
    wizard.vm.$emit('update:checked', true);
    await flushPromises();
    expect(document.body.textContent).toContain('1 / 3');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(document.body.textContent).toContain('1 / 3');
    const name = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '名称');
    if (!name) throw new Error('缺少向导名称字段');
    await name.get('input').setValue('客户甲');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(document.body.textContent).toContain('2 / 3');
    const quick = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('快捷填写'));
    if (!quick) throw new Error('缺少快捷填写开关');
    quick.vm.$emit('update:checked', true);
    await flushPromises();
    const more = modal
      .findAllComponents(Button)
      .find((item) => item.text() === '更多');
    if (!more) throw new Error('缺少更多按钮');
    await more.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('2 / 3');
    const previous = modal
      .findAllComponents(Button)
      .find((item) => item.text() === '上一步');
    if (!previous) throw new Error('缺少上一步按钮');
    await previous.trigger('click');
    await flushPromises();
    const nameAgain = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '名称');
    if (!nameAgain) throw new Error('缺少恢复后的名称字段');
    expect((nameAgain.get('input').element as HTMLInputElement).value).toBe(
      '客户甲',
    );
  });

  it('向导最终保存会校验早期步骤并跳回错误字段', async () => {
    const create = vi.fn(async () => 'created');
    const modal = await open(wizardFields(), { apiService: { create } });
    const wizard = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('向导'));
    if (!wizard) throw new Error('缺少向导选项');
    wizard.vm.$emit('update:checked', true);
    await flushPromises();
    const first = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '名称');
    if (!first) throw new Error('缺少名称字段');
    await first.get('input').setValue('客户甲');
    modal.vm.$emit('ok');
    await flushPromises();
    const second = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '联系人');
    if (!second) throw new Error('缺少联系人字段');
    await second.get('input').setValue('张三');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(document.body.textContent).toContain('3 / 3');

    // 从最后一步进入快捷视图后清空第一步字段，再恢复最后一步并保存。
    const quick = modal
      .findAllComponents({ name: 'ACheckbox' })
      .find((item) => item.text().includes('快捷填写'));
    if (!quick) throw new Error('缺少快捷填写开关');
    quick.vm.$emit('update:checked', true);
    await flushPromises();
    const name = modal
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '名称');
    if (!name) throw new Error('快捷视图缺少名称字段');
    await name.get('input').setValue('');
    const more = modal
      .findAllComponents(Button)
      .find((item) => item.text() === '更多');
    if (!more) throw new Error('缺少更多按钮');
    await more.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('3 / 3');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('1 / 3');
  });
});
