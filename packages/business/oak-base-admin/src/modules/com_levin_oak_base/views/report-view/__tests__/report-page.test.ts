import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReportPage from '../index.vue';

const api = vi.hoisted(() => ({ page: vi.fn(), query: vi.fn(), exportComponent: vi.fn() }));
const copyApi = vi.hoisted(() => ({ copy: vi.fn(), capabilities: vi.fn() }));
vi.mock('../../../api/report-copy-service', () => ({ ReportCopyService: class { constructor() { return copyApi; } } }));
vi.mock('../../../api/report-definition-management-service', () => ({ reportDefinitionManagementService: {} }));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({ useRbacAccess: () => ({ hasPermission: () => true }) }));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-permissions', () => ({ buildApiMethodPermissions: () => [] }));
vi.mock('../../../api/report-runtime-service', () => ({
  ReportRuntimeService: class { constructor() { return api; } },
}));
const route = reactive({
  path: '/menu/report-1',
  meta: { fixedQuery: { reportId: 'report-1' } },
  query: { reportId: 'forged' },
});
const user = reactive({ userInfo: { id: 'user-1', userId: '', tenantId: 'tenant-1', orgId: 'org-1' } });
type Menu = { path: string; children?: Menu[] };
const access = reactive({ accessCodes: ['one'], accessMenus: [] as Menu[],
  setAccessMenus(menus: Menu[]) { this.accessMenus = menus; } });
vi.mock('vue-router', () => ({ useRoute: () => route }));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => user,
  useAccessStore: () => access,
}));

const page = {
  title: '销售报表',
  layout: 'GRID',
  background: {},
  parameters: [],
  components: [],
};
const stubs = {
  ASpin: { props: ['spinning'], template: '<div data-spin :data-spinning="spinning"><slot /></div>' },
  Alert: { props: ['message'], template: '<div>{{ message }}</div>' },
  ReportRuntimeView: {
    props: ['page', 'query', 'exportComponent'],
    template: '<div data-report>{{ page.title }}<slot name="actions" /></div>',
  },
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  AModal: { props: ['open', 'okButtonProps'], template: '<div v-if="open"><slot /><button data-submit :disabled="okButtonProps?.disabled" @click="$emit(\'ok\')">创建草稿</button><button data-cancel @click="$emit(\'cancel\')">取消</button></div>' },
  Input: { props: ['value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  UserOrgSelector: { props: ['modelValue'], template: '<span>{{ modelValue }}</span>' },
};

describe('具体报表入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.meta.fixedQuery.reportId = 'report-1';
    route.path = '/menu/report-1';
    access.accessMenus = [{ path: '/reports', children: [{ path: '/menu/report-1' }, { path: '/menu/report-2' }] }];
    user.userInfo.id = 'user-1';
    user.userInfo.userId = '';
    api.page.mockResolvedValue(page);
    copyApi.capabilities.mockResolvedValue(true);
    api.query.mockReset();
    api.exportComponent.mockReset();
  });

  it('复制能力关闭或请求失败时隐藏复制入口', async () => {
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.capabilities.mockResolvedValue(false);
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).not.toContain('复制为租户报表');
    copyApi.capabilities.mockRejectedValue(new Error('能力不可用'));
    user.userInfo.id = 'user-2';
    await flushPromises();
    expect(wrapper.text()).not.toContain('复制为租户报表');
    expect(copyApi.copy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('复制能力请求未完成时仍展示已授权报表', async () => {
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.capabilities.mockReturnValue(new Promise<boolean>(() => {}));
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.get('[data-report]').text()).toContain('销售报表');
    expect(wrapper.get('[data-spin]').attributes('data-spinning')).toBe('false');
    expect(wrapper.text()).not.toContain('复制为租户报表');
    wrapper.unmount();
  });

  it('切换身份后忽略旧复制能力响应', async () => {
    let resolve!: (available: boolean) => void;
    const pending = new Promise<boolean>((done) => { resolve = done; });
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.capabilities.mockReturnValueOnce(pending).mockResolvedValue(false);
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    user.userInfo.id = 'user-2';
    await flushPromises();
    resolve(true);
    await flushPromises();
    expect(wrapper.text()).not.toContain('复制为租户报表');
    wrapper.unmount();
  });

  it('缓存标签停用时清除结果并丢弃迟到响应，重新进入才重新加载', async () => {
    let resolve!: (value: typeof page) => void;
    const delayed = new Promise<typeof page>((done) => { resolve = done; });
    api.page.mockResolvedValueOnce(page).mockReturnValueOnce(delayed).mockResolvedValue(page);
    const showing = ref(true);
    const host = defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => showing.value ? h(ReportPage) : null }) });
    const wrapper = mount(host, { global: { stubs } });
    await flushPromises();
    expect(api.page).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-report]').text()).toContain('销售报表');
    showing.value = false;
    await flushPromises();
    user.userInfo.id = 'user-2';
    await flushPromises();
    expect(api.page).toHaveBeenCalledTimes(1);
    showing.value = true;
    await flushPromises();
    expect(api.page).toHaveBeenCalledTimes(2);
    showing.value = false;
    await flushPromises();
    resolve({ ...page, title: '过期报表' });
    await flushPromises();
    showing.value = true;
    await flushPromises();
    expect(api.page).toHaveBeenCalledTimes(3);
    expect(wrapper.text()).not.toContain('过期报表');
    expect(wrapper.get('[data-report]').text()).toContain('销售报表');
    wrapper.unmount();
  });

  it('只使用菜单固定报表标识，忽略 URL 查询中的伪造值', async () => {
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    expect(api.page).toHaveBeenCalledWith('report-1');
    expect(wrapper.get('[data-report]').text()).toBe('销售报表');
    expect(wrapper.text()).not.toContain('复制为租户报表');
    route.meta.fixedQuery.reportId = '';
    await flushPromises();
    expect(wrapper.text()).toContain('请从已授权的具体报表菜单进入');
    expect(api.page).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('首次读取被拒绝时仅移除对应的会话菜单', async () => {
    api.page.mockRejectedValueOnce(new Error('无权访问'));
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-report]').exists()).toBe(false);
    expect(access.accessMenus[0]?.children?.map((item) => item.path)).toEqual(['/menu/report-2']);
    wrapper.unmount();
  });

  it('主体变化后清空旧页面，迟到的旧响应不能恢复', async () => {
    let resolve!: (value: typeof page) => void;
    api.page.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(ReportPage, { global: { stubs } });
    user.userInfo.id = 'user-2';
    await flushPromises();
    expect(wrapper.get('[data-report]').text()).toBe('销售报表');
    resolve({ ...page, title: '过期报表' });
    await flushPromises();
    expect(wrapper.text()).not.toContain('过期报表');
    wrapper.unmount();
  });

  it.each(['query', 'exportComponent'] as const)('%s 失败且报表撤权时清空整页', async (operation) => {
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    api[operation].mockRejectedValueOnce(new Error('请求失败'));
    api.page.mockRejectedValueOnce(new Error('已撤权'));
    const run = wrapper.getComponent(stubs.ReportRuntimeView).props(operation) as (id: string, params: object) => Promise<unknown>;
    await expect(run('table', {})).rejects.toThrow('请求失败');
    await flushPromises();
    expect(wrapper.find('[data-report]').exists()).toBe(false);
    expect(wrapper.text()).toContain('报表不可用或当前账号无权访问');
    expect(access.accessMenus[0]?.children?.map((item) => item.path)).toEqual(['/menu/report-2']);
    wrapper.unmount();
  });

  it('组件请求失败但报表仍可访问时保留页面', async () => {
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    api.query.mockRejectedValueOnce(new Error('组件参数错误'));
    const run = wrapper.getComponent(stubs.ReportRuntimeView).props('query') as (id: string, params: object) => Promise<unknown>;
    await expect(run('table', {})).rejects.toThrow('组件参数错误');
    expect(wrapper.get('[data-report]').text()).toContain('销售报表');
    wrapper.unmount();
  });

  it('旧报表请求的撤权检查迟到时不清空新报表', async () => {
    let rejectCheck!: (error: Error) => void;
    const delayed = new Promise((_, reject) => { rejectCheck = reject; });
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    api.query.mockRejectedValueOnce(new Error('旧请求失败'));
    api.page.mockReturnValueOnce(delayed);
    const run = wrapper.getComponent(stubs.ReportRuntimeView).props('query') as (id: string, params: object) => Promise<unknown>;
    const pending = expect(run('table', {})).rejects.toThrow('旧请求失败');
    await flushPromises();
    route.meta.fixedQuery.reportId = 'report-2';
    route.path = '/menu/report-2';
    await flushPromises();
    rejectCheck(new Error('旧报表已撤权'));
    await pending;
    await flushPromises();
    expect(wrapper.get('[data-report]').text()).toContain('销售报表');
    expect(access.accessMenus[0]?.children?.map((item) => item.path)).toEqual(['/menu/report-1', '/menu/report-2']);
    wrapper.unmount();
  });

  it('仅全局报表提供复制入口，并提交菜单固定标识和目标组织', async () => {
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.copy.mockResolvedValue('new-report');
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toContain('所属组织');
    await wrapper.get('[data-submit]').trigger('click');
    await flushPromises();
    expect(copyApi.copy).toHaveBeenCalledWith({ sourceReportId: 'report-1', orgId: 'org-1', name: '销售报表副本' });
    wrapper.unmount();
  });

  it('复制收到限流响应后保留输入并允许稍后重试', async () => {
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.copy.mockRejectedValueOnce({ response: { status: 429 } }).mockResolvedValueOnce('new-report');
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await wrapper.get('input').setValue('保留名称');
    await wrapper.get('[data-submit]').trigger('click');
    await flushPromises();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('保留名称');
    expect(wrapper.text()).not.toContain('复制结果尚未确认');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeUndefined();
    await wrapper.get('[data-submit]').trigger('click');
    await flushPromises();
    expect(copyApi.copy).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it.each([
    { reason: '连接中断', failure: () => new Error('连接中断') },
    { reason: '503 响应', failure: () => ({ response: { status: 503, data: { msg: '报表写入暂不可用' } } }) },
  ])('复制遇到$reason后保留输入并阻止重复提交，切换主体互不影响', async ({ failure }) => {
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.copy.mockRejectedValueOnce(failure());
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await wrapper.get('input').setValue('保留名称');
    await wrapper.get('[data-submit]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('复制结果尚未确认');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeDefined();
    await wrapper.get('[data-cancel]').trigger('click');
    await wrapper.get('button').trigger('click');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('保留名称');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeDefined();
    expect(copyApi.copy).toHaveBeenCalledTimes(1);
    user.userInfo.id = 'user-2';
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('复制中切换报表后迟到失败不会影响新报表，返回原报表仍阻止重试', async () => {
    let reject!: (error: Error) => void;
    copyApi.copy.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    api.page.mockResolvedValue({ ...page, global: true });
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await wrapper.get('[data-submit]').trigger('click');
    route.meta.fixedQuery.reportId = 'report-2';
    await flushPromises();
    reject(new Error('连接中断'));
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeUndefined();
    route.meta.fixedQuery.reportId = 'report-1';
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toContain('复制结果尚未确认');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('仅有标准 userId 时按不同用户隔离未确认状态', async () => {
    user.userInfo.id = '';
    user.userInfo.userId = 'standard-user-1';
    api.page.mockResolvedValue({ ...page, global: true });
    copyApi.copy.mockRejectedValueOnce(new Error('连接中断'));
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await wrapper.get('[data-submit]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeDefined();
    user.userInfo.userId = 'standard-user-2';
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeUndefined();
    user.userInfo.userId = 'standard-user-1';
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[data-submit]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('缺少用户标识时不提供复制入口', async () => {
    user.userInfo.id = ''; user.userInfo.userId = '';
    api.page.mockResolvedValue({ ...page, global: true });
    const wrapper = mount(ReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).not.toContain('复制为租户报表');
    wrapper.unmount();
  });
});
