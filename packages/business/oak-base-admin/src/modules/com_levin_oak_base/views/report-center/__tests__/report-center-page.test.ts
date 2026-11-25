import { flushPromises, mount } from '@vue/test-utils';
import { message, Modal } from 'ant-design-vue';
import { defineComponent, h, KeepAlive, reactive, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';

const state = vi.hoisted(() => ({
  list: vi.fn(),
  catalog: vi.fn(),
  capabilities: vi.fn(),
  create: vi.fn(),
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn(),
  generateMenu: vi.fn(),
  previewPage: vi.fn(),
  previewQuery: vi.fn(),
  datasetPage: vi.fn(),
  datasetQuery: vi.fn(),
  allowAccess: true,
}));
const userStore = reactive({
  userInfo: { id: 'user-1', tenantId: 'tenant-1' as string | null, orgId: 'org-1', isSuperAdmin: false, isPlatformUser: false },
});

vi.mock('../../../api/report-definition-management-service', () => ({
  ReportDefinitionManagementService: class { constructor() { return state; } },
}));
vi.mock('../../../api/report-menu-service', () => ({
  ReportMenuService: class { constructor() { return { generateMenu: state.generateMenu }; } },
}));
vi.mock('../../../api/report-preview-service', () => ({
  ReportPreviewService: class { constructor() { return { page: state.previewPage, query: state.previewQuery, datasetPage: state.datasetPage, datasetQuery: state.datasetQuery }; } },
}));
vi.mock('../../../api/menu-service', () => ({
  menuService: { create: vi.fn() },
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => userStore,
  useAccessStore: () => ({ accessCodes: [] }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => state.allowAccess }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => [] }),
);
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  notifyApiErrorOnce: vi.fn(),
}));

import ReportCenter from '../index.vue';

const catalog = {
  sources: [
    {
      id: 'users',
      title: '用户',
      fields: [{ id: 'name', title: '姓名', type: 'STRING' }],
    },
  ],
  relations: [],
};
const validDesign = {
  version: 1,
  title: '用户分析',
  layout: 'GRID',
  background: {},
  parameters: [],
  datasets: [
    {
      id: 'dataset1',
      root: 'users',
      relations: [],
      fields: [{ source: 'users', name: 'name', aggregation: 'NONE' }],
      filters: [],
    },
  ],
  components: [
    {
      id: 'component1',
      title: '用户列表',
      type: 'TABLE',
      dataset: 'dataset1',
      bindings: {},
      position: { x: 0, y: 0, width: 4, height: 2 },
    },
  ],
};
const button = {
  props: ['disabled'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
};
const input = {
  props: ['value', 'placeholder'],
  emits: ['update:value'],
  template:
    '<input :placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
};
const modal = {
  props: ['open'],
  emits: ['cancel'],
  template: '<div v-if="open"><slot /></div>',
};
const editor = {
  props: ['modelValue', 'allowSavedDataPreview'],
  emits: ['update:modelValue', 'preview-saved-dataset'],
  template:
    '<div><button @click="$emit(\'update:modelValue\', design)">配置测试报表</button><button v-if="allowSavedDataPreview" data-dataset-preview @click="$emit(\'preview-saved-dataset\', \'dataset1\')">预览数据集</button></div>',
  data: () => ({ design: validDesign }),
};
const stubs = {
  Page: { template: '<div><slot /></div>' },
  AButton: button,
  AInput: input,
  AModal: modal,
  AAlert: { props: ['message'], template: '<div>{{ message }}</div>' },
  APagination: { template: '<div />' },
  APopconfirm: {
    emits: ['confirm'],
    template: '<div @click="$emit(\'confirm\')"><slot /></div>',
  },
  ASpin: { template: '<div><slot /></div>' },
  ATable: {
    props: ['dataSource', 'loading'],
    template:
      '<div><div v-for="record in dataSource" :key="record.reportId || record.occurTime"><span v-if="record.action">{{ record.operator }} {{ record.action }} {{ record.remark }}</span><slot v-else name="bodyCell" :column="{ key: \'actions\' }" :record="record" /></div></div>',
  },
  ATag: { template: '<span><slot /></span>' },
  UserOrgSelector: { template: '<div />' },
  ReportDesignEditor: editor,
  ReportRuntimeView: { props: ['page', 'query'], template: '<div data-preview>{{ page.title }}</div>' },
};

describe('报表设计管理页', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userStore.userInfo.id = 'user-1';
    userStore.userInfo.tenantId = 'tenant-1';
    userStore.userInfo.isSuperAdmin = false;
    userStore.userInfo.isPlatformUser = false;
    state.allowAccess = true;
    state.list.mockResolvedValue({ items: [], totals: 0 });
    state.catalog.mockResolvedValue(catalog);
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: false, writeEnabled: true, savedPreviewEnabled: true });
    state.create.mockResolvedValue('report-1');
  });

  it.each([false, true])('缓存页失活不加载或恢复旧主体列表（超管 %s）', async (superAdmin) => {
    userStore.userInfo.isSuperAdmin = superAdmin;
    if (superAdmin) { userStore.userInfo.isPlatformUser = true; userStore.userInfo.tenantId = null; }
    let resolveOld!: (value: { items: Array<{ reportId: string; name: string }>; totals: number }) => void;
    state.list.mockReset().mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue({ items: [{ reportId: 'new', name: '新主体报表' }], totals: 1 });
    const showing = ref(true);
    const host = defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => showing.value ? h(ReportCenter) : null }) });
    const wrapper = mount(host, { global: { stubs } });
    await flushPromises();
    expect(state.list).toHaveBeenCalledTimes(1);
    showing.value = false;
    await flushPromises();
    userStore.userInfo.id = 'user-2';
    resolveOld({ items: [{ reportId: 'old', name: '旧主体报表' }], totals: 1 });
    await flushPromises();
    expect(state.list).toHaveBeenCalledTimes(1);
    showing.value = true;
    await flushPromises();
    expect(state.list).toHaveBeenCalledTimes(2);
    expect(wrapper.getComponent(stubs.ATable).props('dataSource')).toEqual([{ reportId: 'new', name: '新主体报表' }]);
    wrapper.unmount();
  });

  it('无列表权限的普通用户切换缓存页时不请求列表', async () => {
    state.allowAccess = false;
    const showing = ref(true);
    const host = defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => showing.value ? h(ReportCenter) : null }) });
    const wrapper = mount(host, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('当前账号没有报表管理列表权限');
    showing.value = false; await flushPromises();
    showing.value = true; await flushPromises();
    expect(state.list).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('保存进行中切换缓存页保留编辑并禁止重复提交', async () => {
    let finishSave!: () => void;
    const summary = { reportId: 'report-1', name: '用户分析', orgId: 'org-1', definitionVersion: 2, optimisticLock: 4, draft: validDesign };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.getDraft.mockResolvedValue(summary);
    state.saveDraft.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    const showing = ref(true);
    const host = defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => showing.value ? h(ReportCenter) : null }) });
    const wrapper = mount(host, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('未完成修改');
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    showing.value = false;
    await flushPromises();
    expect(wrapper.find('input[placeholder="请输入报表名称"]').exists()).toBe(false);
    showing.value = true;
    await flushPromises();
    expect(wrapper.text()).toContain('保存结果或草稿版本需要重新核对');
    expect((wrapper.get('input[placeholder="请输入报表名称"]').element as HTMLInputElement).value).toBe('未完成修改');
    finishSave();
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    expect(state.saveDraft).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('新建请求跨标签完成后不能重复创建', async () => {
    let finishCreate!: (id: string) => void;
    state.create.mockReset().mockImplementationOnce(() => new Promise<string>((resolve) => { finishCreate = resolve; }));
    const showing = ref(true);
    const host = defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => showing.value ? h(ReportCenter) : null }) });
    const wrapper = mount(host, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('新建测试');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    showing.value = false; await flushPromises();
    showing.value = true; await flushPromises();
    finishCreate('new-report'); await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('保存结果或草稿版本需要重新核对');
    wrapper.unmount();
  });

  it.each([
    { reason: '连接中断', failure: () => new Error('连接中断') },
    { reason: '503 响应', failure: () => ({ response: { status: 503, data: { msg: '报表写入暂不可用' } } }) },
  ])('新建请求遇到$reason后保留设计并阻止直接重复创建', async ({ failure }) => {
    state.create.mockReset().mockRejectedValue(failure());
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('待核对草稿');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    await flushPromises();
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.list).toHaveBeenCalledTimes(2);
    expect((wrapper.get('input[placeholder="请输入报表名称"]').element as HTMLInputElement).value).toBe('待核对草稿');
    expect(wrapper.text()).toContain('保存结果或草稿版本需要重新核对');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    expect(state.create).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('新建收到限流响应后保留输入并允许稍后重试', async () => {
    state.create.mockReset().mockRejectedValueOnce({ httpStatusCode: 429, code: 429, msg: '操作过快，请稍后再试' }).mockResolvedValue('new-report');
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('限流草稿');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    await flushPromises();
    expect((wrapper.get('input[placeholder="请输入报表名称"]').element as HTMLInputElement).value).toBe('限流草稿');
    expect(wrapper.text()).not.toContain('保存结果或草稿版本需要重新核对');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    await flushPromises();
    expect(state.create).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('新建请求失败迟到时不影响切换后的身份', async () => {
    let failCreate!: (error: Error) => void;
    state.create.mockReset().mockImplementationOnce(() => new Promise((_, reject) => { failCreate = reject; }));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('旧主体草稿');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    userStore.userInfo.id = 'user-2'; await flushPromises();
    failCreate(new Error('连接中断')); await flushPromises();
    expect(wrapper.text()).not.toContain('旧主体草稿');
    expect(wrapper.text()).not.toContain('保存结果或草稿版本需要重新核对');
    expect(notifyApiErrorOnce).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('编辑已有草稿失败后不套用新建结果不确定提示', async () => {
    const summary = { reportId: 'report-1', name: '用户分析', orgId: 'org-1', definitionVersion: 2, optimisticLock: 4, draft: validDesign };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.getDraft.mockResolvedValue(summary);
    state.saveDraft.mockReset().mockRejectedValue(new Error('请求被拒绝'));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('保存结果或草稿版本需要重新核对');
    expect(notifyApiErrorOnce).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('身份切换后的旧列表失败不提示，当前列表失败仍提示', async () => {
    let rejectOld!: (error: Error) => void;
    state.list.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    userStore.userInfo.id = 'user-2'; await flushPromises();
    rejectOld(new Error('旧请求失败')); await flushPromises();
    expect(notifyApiErrorOnce).not.toHaveBeenCalled();
    state.list.mockRejectedValueOnce(new Error('当前请求失败'));
    userStore.userInfo.id = 'user-3'; await flushPromises();
    expect(notifyApiErrorOnce).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('查看发布日志并在身份切换时清除', async () => {
    const summary = { reportId: 'report-1', name: '销售', definitionVersion: 3 };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 1, draft: validDesign,
      publicationLogs: [{ occurTime: '2026-11-22 12:00:00', operator: '管理员', action: '发布', remark: '版本 3' }] });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '发布日志')!.trigger('click');
    await flushPromises();
    expect(state.getDraft).toHaveBeenCalledWith('report-1');
    expect(wrapper.text()).toContain('管理员 发布 版本 3');
    userStore.userInfo.id = 'user-2';
    await flushPromises();
    expect(wrapper.text()).not.toContain('管理员 发布 版本 3');
    wrapper.unmount();
  });

  it('身份切换后丢弃迟到的发布日志', async () => {
    const summary = { reportId: 'report-1', name: '销售', definitionVersion: 3 };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    let resolve!: (value: unknown) => void;
    state.getDraft.mockReturnValue(new Promise((done) => { resolve = done; }));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '发布日志')!.trigger('click');
    userStore.userInfo.id = 'user-2';
    await flushPromises();
    resolve({ ...summary, publicationLogs: [{ operator: '旧用户', action: '发布', remark: '旧权限数据' }] });
    await flushPromises();
    expect(wrapper.text()).not.toContain('旧权限数据');
    wrapper.unmount();
  });

  it('列表失败时不把未知能力状态误报为菜单生成未启用', async () => {
    state.list.mockRejectedValue(new Error('服务不可用'));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('报表列表加载失败');
    expect(wrapper.text()).not.toContain('当前环境尚未启用报表菜单生成');
    wrapper.unmount();
  });

  it('能力查询失败时提示状态未知，不误报功能已关闭', async () => {
    state.capabilities.mockRejectedValue(new Error('服务不可用'));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('无法获取报表菜单能力状态');
    expect(wrapper.text()).not.toContain('当前环境尚未启用报表菜单生成');
    expect(wrapper.text()).not.toContain('新建报表');
    expect(state.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('能力请求未完成时仍显示管理列表并关闭写入入口', async () => {
    state.list.mockResolvedValue({ items: [{ reportId: 'r1', name: '可读报表' }], totals: 1 });
    state.capabilities.mockReturnValue(new Promise(() => {}));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    expect(wrapper.getComponent(stubs.ATable).props('dataSource')).toEqual([{ reportId: 'r1', name: '可读报表' }]);
    expect(wrapper.getComponent(stubs.ATable).props('loading')).toBe(false);
    expect(wrapper.text()).not.toContain('新建报表');
    wrapper.unmount();
  });

  it('切换身份后不使用旧的管理写入能力', async () => {
    let resolve!: (value: { menuGenerationEnabled: boolean; writeEnabled: boolean; savedPreviewEnabled: boolean }) => void;
    const pending = new Promise<{ menuGenerationEnabled: boolean; writeEnabled: boolean; savedPreviewEnabled: boolean }>((done) => { resolve = done; });
    state.capabilities.mockReturnValueOnce(pending).mockResolvedValue({ menuGenerationEnabled: false, writeEnabled: false, savedPreviewEnabled: true });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    userStore.userInfo.id = 'user-2';
    await flushPromises();
    resolve({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    await flushPromises();
    expect(wrapper.text()).not.toContain('新建报表');
    wrapper.unmount();
  });

  it('旧接口未返回写入能力时保持写入关闭', async () => {
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).not.toContain('新建报表');
    expect(wrapper.text()).toContain('当前报表写入暂不可用');
    expect(state.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('超级管理员只能按已保存草稿版本打开预览', async () => {
    userStore.userInfo.isSuperAdmin = true;
    const summary = { reportId: 'report-1', name: '用户分析', definitionVersion: 2, menuId: null, publishedVersion: null };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 4, draft: validDesign });
    state.previewPage.mockResolvedValue({ title: '草稿结果', layout: 'GRID', background: {}, parameters: [], components: [] });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    const button = wrapper.findAll('button').find((item) => item.text() === '预览草稿');
    expect(button).toBeDefined();
    await button?.trigger('click');
    await flushPromises();
    expect(state.previewPage).toHaveBeenCalledWith({ reportId: 'report-1', expectedLock: 4, expectedDefinitionVersion: 2 });
    expect(wrapper.get('[data-preview]').text()).toBe('草稿结果');
    wrapper.unmount();
  });

  it('写入关闭时保留已保存草稿预览并隐藏写入入口', async () => {
    userStore.userInfo.isSuperAdmin = true;
    const summary = { reportId: 'report-1', name: '用户分析', definitionVersion: 2, menuId: null, publishedVersion: null };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: false, writeEnabled: false, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 4, draft: validDesign });
    state.previewPage.mockResolvedValue({ title: '草稿结果', layout: 'GRID', background: {}, parameters: [], components: [] });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('当前报表写入暂不可用');
    expect(wrapper.text()).not.toContain('新建报表');
    expect(wrapper.findAll('button').some((button) => button.text() === '编辑')).toBe(false);
    const preview = wrapper.findAll('button').find((button) => button.text() === '预览草稿');
    expect(preview).toBeDefined();
    await preview?.trigger('click');
    await flushPromises();
    expect(state.previewPage).toHaveBeenCalledWith({ reportId: 'report-1', expectedLock: 4, expectedDefinitionVersion: 2 });
    expect(state.create).not.toHaveBeenCalled();
    expect(state.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('设计器可预览已保存草稿并保留当前编辑', async () => {
    userStore.userInfo.isSuperAdmin = true;
    const summary = { reportId: 'report-1', name: '用户分析', definitionVersion: 2, menuId: null, publishedVersion: null };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 4, draft: validDesign });
    state.previewPage.mockResolvedValue({ title: '实际草稿', layout: 'GRID', background: {}, parameters: [], components: [] });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('不包含本次未保存的修改');
    await wrapper.findAll('button').find((item) => item.text() === '预览已保存草稿')!.trigger('click');
    await flushPromises();
    expect(state.previewPage).toHaveBeenCalledWith({ reportId: 'report-1', expectedLock: 4, expectedDefinitionVersion: 2 });
    expect(wrapper.get('[data-preview]').text()).toBe('实际草稿');
    expect(wrapper.text()).toContain('保存草稿');
    expect(state.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('数据集实际预览只展示已保存关联组件并保留必要条件', async () => {
    userStore.userInfo.isSuperAdmin = true;
    const summary = { reportId: 'report-1', name: '用户分析', definitionVersion: 2, orgId: 'org-1' };
    const saved = structuredClone(validDesign);
    saved.components.push({ ...saved.components[0]!, id: 'other', dataset: 'dataset2', bindings: { filter: 'otherParam' } });
    saved.components[0]!.bindings = { filter: 'selectedParam' };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 4, draft: saved });
    state.previewPage.mockResolvedValue({ title: '实际草稿', layout: 'GRID', background: {},
      parameters: [{ key: 'required', required: true }, { key: 'selectedParam', required: false }, { key: 'otherParam', required: false }],
      components: [{ id: 'component1' }, { id: 'other' }] });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    await wrapper.get('[data-dataset-preview]').trigger('click');
    await flushPromises();
    const result = wrapper.getComponent(stubs.ReportRuntimeView).props('page') as any;
    expect(result.components.map((item: any) => item.id)).toEqual(['component1']);
    expect(result.parameters.map((item: any) => item.key)).toEqual(['required', 'selectedParam']);
    expect(state.previewPage).toHaveBeenCalledWith({ reportId: 'report-1', expectedLock: 4, expectedDefinitionVersion: 2 });
    wrapper.unmount();
  });

  it('已保存数据集没有组件时使用独立表格预览及对应查询', async () => {
    userStore.userInfo.isSuperAdmin = true;
    const summary = { reportId: 'report-1', name: '用户分析', definitionVersion: 2, orgId: 'org-1' };
    const saved = structuredClone(validDesign);
    saved.components[0]!.dataset = 'other';
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 4, draft: saved });
    state.datasetPage.mockResolvedValue({ title: '数据集预览', layout: 'GRID', background: {}, parameters: [], components: [{ id: 'datasetPreview' }] });
    state.datasetQuery.mockResolvedValue({ rows: [['虚构用户']], hasMore: false });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    await wrapper.get('[data-dataset-preview]').trigger('click');
    await flushPromises();
    expect(state.previewPage).not.toHaveBeenCalled();
    const version = { reportId: 'report-1', expectedLock: 4, expectedDefinitionVersion: 2 };
    expect(state.datasetPage).toHaveBeenCalledWith(version, 'dataset1');
    const view = wrapper.getComponent(stubs.ReportRuntimeView);
    expect((view.props('page') as any).title).toBe('数据集预览');
    await (view.props('query') as any)('datasetPreview', { region: 'north' });
    expect(state.datasetQuery).toHaveBeenCalledWith(version, 'dataset1', { region: 'north' });
    wrapper.unmount();
  });

  it('保存并继续后使用新版本，保存期间输入的修改仍留在编辑器', async () => {
    let finishSave!: () => void;
    const summary = { reportId: 'report-1', name: '用户分析', orgId: 'org-1', definitionVersion: 2, optimisticLock: 4, draft: validDesign };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.getDraft.mockResolvedValueOnce(summary).mockResolvedValue({ ...summary, definitionVersion: 3, optimisticLock: 5 });
    state.saveDraft.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; })).mockResolvedValue(undefined);
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('后续修改');
    finishSave();
    await flushPromises();
    expect((wrapper.get('input[placeholder="请输入报表名称"]').element as HTMLInputElement).value).toBe('后续修改');
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    await flushPromises();
    expect(state.saveDraft.mock.calls[1]?.[0]).toMatchObject({ expectedLock: 5, expectedDefinitionVersion: 3, name: '后续修改' });
    wrapper.unmount();
  });

  it('保存后发现其他操作更新版本时不采纳该版本', async () => {
    const summary = { reportId: 'report-1', name: '用户分析', orgId: 'org-1', definitionVersion: 2, optimisticLock: 4, draft: validDesign };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.getDraft.mockResolvedValueOnce(summary).mockResolvedValue({ ...summary, definitionVersion: 4, optimisticLock: 6 });
    state.saveDraft.mockResolvedValue(undefined);
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '编辑')!.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    await flushPromises();
    expect(notifyApiErrorOnce).toHaveBeenCalled();
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    await flushPromises();
    expect(state.saveDraft).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('保存结果或草稿版本需要重新核对');
    wrapper.unmount();
  });

  it('新建后可继续设计，保存期间新修改不被关闭', async () => {
    let finishCreate!: (value: string) => void;
    state.create.mockReset().mockImplementationOnce(() => new Promise<string>((resolve) => { finishCreate = resolve; }));
    state.getDraft.mockResolvedValue({ reportId: 'new-report', name: '新报表', orgId: 'org-1',
      definitionVersion: 1, optimisticLock: 0, draft: validDesign });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('新报表');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('后续输入');
    finishCreate('new-report');
    await flushPromises();
    expect((wrapper.get('input[placeholder="请输入报表名称"]').element as HTMLInputElement).value).toBe('后续输入');
    expect(state.getDraft).toHaveBeenCalledWith('new-report');
    wrapper.unmount();
  });

  it('新建成功后版本读取失败时禁止重复创建', async () => {
    state.create.mockReset().mockResolvedValue('new-report');
    state.getDraft.mockReset().mockRejectedValue(new Error('读取失败'));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('新报表');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存并继续')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('保存结果或草稿版本需要重新核对');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    expect(state.create).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('仅在能力启用后允许为未发布草稿生成菜单并刷新', async () => {
    const summary = {
      reportId: 'report-1',
      name: '用户分析',
      definitionVersion: 2,
      menuId: null,
      publishedVersion: null,
    };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('当前环境尚未启用报表菜单生成');
    expect(wrapper.text()).not.toContain('生成菜单');
    wrapper.unmount();
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValue({ ...summary, optimisticLock: 4 });
    state.generateMenu.mockResolvedValue('menu-1');
    const enabled = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    const button = enabled
      .findAll('button')
      .find((item) => item.text() === '生成菜单');
    expect(button).toBeDefined();
    await button?.trigger('click');
    await flushPromises();
    expect(state.generateMenu).toHaveBeenCalledWith({
      reportId: 'report-1',
      expectedLock: 4,
      expectedDefinitionVersion: 2,
    });
    expect(state.list).toHaveBeenCalledTimes(3);
    enabled.unmount();
  });

  it('发布前读取最新草稿版本并要求已关联菜单', async () => {
    const summary = { reportId: 'report-1', name: '用户分析', definitionVersion: 1, menuId: 'menu-old', publishedVersion: null };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    state.getDraft.mockResolvedValueOnce({ ...summary, menuId: null, optimisticLock: 3, definitionVersion: 2 })
      .mockResolvedValueOnce({ ...summary, menuId: 'menu-1', optimisticLock: 4, definitionVersion: 3 });
    state.publish.mockResolvedValue(undefined);
    const warning = vi.spyOn(message, 'warning').mockImplementation(() => undefined as never);
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    const publishButton = () => wrapper.findAll('button').find((item) => item.text() === '发布')!;
    await publishButton().trigger('click');
    await flushPromises();
    expect(state.publish).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('请先为报表关联菜单');
    await publishButton().trigger('click');
    await flushPromises();
    expect(state.publish).toHaveBeenCalledWith({ reportId: 'report-1', expectedLock: 4, expectedDefinitionVersion: 3 });
    expect(state.list).toHaveBeenCalledTimes(2);
    warning.mockRestore();
    wrapper.unmount();
  });

  it('身份切换后不提交旧身份读取到的草稿版本', async () => {
    const summary = {
      reportId: 'report-1',
      name: '用户分析',
      definitionVersion: 2,
      menuId: null,
      publishedVersion: null,
    };
    state.list.mockResolvedValue({ items: [summary], totals: 1 });
    state.capabilities.mockResolvedValue({ menuGenerationEnabled: true, writeEnabled: true, savedPreviewEnabled: true });
    let resolve!: (value: unknown) => void;
    state.getDraft.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '生成菜单')
      ?.trigger('click');
    userStore.userInfo.id = 'user-2';
    await flushPromises();
    resolve({ ...summary, optimisticLock: 4 });
    await flushPromises();
    expect(state.generateMenu).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('创建时使用当前组织并提交声明式设计，不传租户和用户身份', async () => {
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    const open = wrapper
      .findAll('button')
      .find((item) => item.text() === '新建报表');
    expect(open).toBeDefined();
    await open!.trigger('click');
    await flushPromises();
    await wrapper
      .get('input[placeholder="请输入报表名称"]')
      .setValue('用户分析');
    const configure = wrapper
      .findAll('button')
      .find((item) => item.text() === '配置测试报表');
    expect(configure).toBeDefined();
    await configure!.trigger('click');
    const save = wrapper
      .findAll('button')
      .find((item) => item.text() === '保存草稿');
    await save!.trigger('click');
    await flushPromises();
    expect(state.create).toHaveBeenCalledWith({
      name: '用户分析',
      orgId: 'org-1',
      design: validDesign,
    });
    expect(state.create.mock.calls[0]?.[0]).not.toHaveProperty('tenantId');
    expect(state.create.mock.calls[0]?.[0]).not.toHaveProperty('userId');
    wrapper.unmount();
  });

  it('身份切换后旧保存结果不能关闭新编辑器', async () => {
    let finish!: (value: string) => void;
    state.create.mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('旧草稿');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    userStore.userInfo.id = 'user-2';
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('新草稿');
    finish('old-report');
    await flushPromises();
    expect((wrapper.get('input[placeholder="请输入报表名称"]').element as HTMLInputElement).value).toBe('新草稿');
    wrapper.unmount();
  });

  it('旧身份保存完成不会解除新身份正在保存的保护', async () => {
    let finishOld!: (value: string) => void;
    let finishNew!: (value: string) => void;
    state.create.mockReset().mockImplementationOnce(() => new Promise<string>((resolve) => { finishOld = resolve; }))
      .mockImplementationOnce(() => new Promise<string>((resolve) => { finishNew = resolve; }));
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('旧草稿');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    userStore.userInfo.id = 'user-2';
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '新建报表')!.trigger('click');
    await flushPromises();
    await wrapper.get('input[placeholder="请输入报表名称"]').setValue('新草稿');
    await wrapper.findAll('button').find((item) => item.text() === '配置测试报表')!.trigger('click');
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    finishOld('old-report');
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '保存草稿')!.trigger('click');
    expect(state.create).toHaveBeenCalledTimes(2);
    finishNew('new-report');
    await flushPromises();
    wrapper.unmount();
  });

  it('修改后关闭会要求确认，并在取消确认时保留输入', async () => {
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() } as never);
    const wrapper = mount(ReportCenter, { global: { stubs } });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '新建报表')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .get('input[placeholder="请输入报表名称"]')
      .setValue('未保存草稿');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '取消')!
      .trigger('click');
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      (
        wrapper.get('input[placeholder="请输入报表名称"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('未保存草稿');
    confirm.mockRestore();
    wrapper.unmount();
  });
});
