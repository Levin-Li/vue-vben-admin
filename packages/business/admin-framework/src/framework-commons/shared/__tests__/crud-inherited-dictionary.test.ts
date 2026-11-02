import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildDictOptionsLoader } from '../config-helpers';
import CrudPage from '../dynamic-crud-page.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  user: { userInfo: { id: 'test-user' } },
  access: { accessCodes: [] as string[] },
}));

vi.mock('../../runtime', () => ({
  requestClient: { get: mocks.get },
}));
vi.mock('../../app/api/request', () => ({
  requestClient: { get: mocks.get },
  baseRequestClient: { get: mocks.get },
}));
vi.mock('../../rbac-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../rbac-access')>()),
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { path: string }) => route.path,
  useUserStore: () => mocks.user,
  useAccessStore: () => mocks.access,
  useTabbarStore: () => ({ setPageKeepAlive: vi.fn() }),
}));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ path: '/team-account', matched: [], meta: {}, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

enableAutoUnmount(afterEach);

describe('继承字典字段的标准 CRUD 页面', () => {
  it('查询、新增、编辑与列表均使用父类声明的字典编码', async () => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({
      status: 200,
      data: { itemList: [{ code: 'team', name: '团队' }] },
      headers: {},
    });

    // 子类页面配置复用父类字段的真实字典编码；页面自身不是字段的声明类。
    const loader = buildDictOptionsLoader(
      'com.levin.oak.base.entities.Org.category',
    );
    const searchField = {
      key: 'inCategory',
      label: '机构类别',
      type: 'select' as const,
      search: true,
      form: false,
      multiple: true,
      loadOptions: loader,
    };
    const valueField = {
      key: 'category',
      label: '机构类别',
      type: 'select' as const,
      form: true,
      table: true,
      loadOptions: loader,
    };
    const update = vi.fn(async () => ({ affected: 1 }));
    const wrapper = shallowMount(CrudPage, {
      props: {
        config: {
          apiBase: '/TeamAccount',
          title: '团队账号',
          fields: [searchField, valueField],
          apiService: { list: async () => ({ items: [], totals: 0 }), update },
        },
      },
    });
    await flushPromises();
    const state = (
      wrapper.vm.$ as unknown as { setupState: Record<string, any> }
    ).setupState;

    // 查询选项、列表回显、新增及编辑分别经过标准组件的实际加载入口。
    await state.loadFieldOptions(searchField);
    await state.loadTableDisplayOptions(valueField);
    expect(state.getFieldOptions(searchField)).toEqual([
      expect.objectContaining({ label: '团队', value: 'team' }),
    ]);
    expect(state.getTableDisplayFieldOptions(valueField)).toEqual([
      expect.objectContaining({ label: '团队', value: 'team' }),
    ]);
    expect(state.getCellDisplayText(valueField, 'team')).toBe('团队');
    await state.handleCreate();
    await state.loadFieldOptions(valueField);
    expect(state.getFieldOptions(valueField)).toEqual([
      expect.objectContaining({ label: '团队', value: 'team' }),
    ]);

    // 历史值没有字典选项时仍按原值展示，普通编辑不会将它静默清空。
    expect(state.getCellDisplayText(valueField, 'legacy')).toBe('legacy');
    await state.handleEdit({ id: 'team-2', category: 'legacy' });
    await flushPromises();
    expect(state.formState.category).toBe('legacy');
    await state.handleSubmit();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team-2', category: 'legacy' }),
    );
    await state.handleEdit({ id: 'team-1', category: 'team' });
    await flushPromises();
    expect(state.formState.category).toBe('team');
    expect(state.getFieldOptions(valueField)).toEqual([
      expect.objectContaining({ label: '团队', value: 'team' }),
    ]);

    // 各视图复用同一编码，不向子类名对应的字典发请求。
    const dictionaryRequests = mocks.get.mock.calls.filter(([path]) =>
      String(path).includes('/Dict/retrieveByCode'),
    );
    expect(dictionaryRequests.length).toBeGreaterThan(0);
    for (const [, options] of dictionaryRequests) {
      expect(options.params.code).toBe(
        'com.levin.oak.base.entities.Org.category',
      );
    }
  });

  it('多选行业中未收录的历史值保持原样回显并随编辑保留', async () => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({
      status: 200,
      data: { itemList: [{ code: 'retail', name: '零售业' }] },
      headers: {},
    });
    const field = {
      key: 'industries',
      label: '所属行业',
      type: 'select' as const,
      multiple: true,
      form: true,
      table: true,
      loadOptions: buildDictOptionsLoader(
        'com.levin.oak.base.entities.Partner.industries',
      ),
    };
    const update = vi.fn(async () => ({ affected: 1 }));
    const wrapper = shallowMount(CrudPage, {
      props: {
        config: {
          apiBase: '/ChannelPartner',
          title: '渠道伙伴',
          fields: [field],
          apiService: { list: async () => ({ items: [], totals: 0 }), update },
        },
      },
    });
    await flushPromises();
    const state = (
      wrapper.vm.$ as unknown as { setupState: Record<string, any> }
    ).setupState;
    await state.loadTableDisplayOptions(field);
    expect(state.getCellDisplayText(field, ['legacy'])).toBe('legacy');
    await state.handleEdit({ id: 'partner-1', industries: ['legacy'] });
    await flushPromises();
    expect(state.formState.industries).toEqual(['legacy']);
    await state.handleSubmit();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'partner-1', industries: ['legacy'] }),
    );
  });
});
