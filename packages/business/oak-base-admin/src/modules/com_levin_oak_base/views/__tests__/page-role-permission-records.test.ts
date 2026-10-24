import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, ref } from 'vue';

import { setCurrentGlobalDomainId } from '@levin/admin-framework/framework-commons/app/global-domain-context-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageRolePermissionRecords } from '../load-role-permission-records';

const list = vi.hoisted(() => vi.fn());
vi.mock('../../api/role-service', () => ({ roleService: { list } }));

function setupPage() {
  const visible = ref(true);
  const actor = ref({ id: 'reader', tenantId: 'tenant' });
  let page!: ReturnType<typeof usePageRolePermissionRecords>;
  const Content = defineComponent({
    setup() {
      page = usePageRolePermissionRecords(() => actor.value);
      return () => h('div', JSON.stringify(page.records.value));
    },
  });
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () => (visible.value ? h(Content) : null),
        }),
    }),
  );
  return {
    wrapper,
    visible,
    actor,
    get page() {
      return page;
    },
  };
}

async function reactivate(visible: ReturnType<typeof ref<boolean>>) {
  visible.value = false;
  await flushPromises();
  visible.value = true;
  await flushPromises();
}

describe('页面角色展示元数据', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentGlobalDomainId(undefined);
    list.mockResolvedValue({ items: [] });
  });

  it('挂载、首次激活和后续标签往返合并请求并缓存空结果', async () => {
    const view = setupPage();
    await flushPromises();
    for (let index = 0; index < 3; index++) await reactivate(view.visible);
    expect(list).toHaveBeenCalledOnce();
    expect(view.page.records.value).toEqual([]);
    view.wrapper.unmount();
  });

  it('失败在本页不重复重试，显式刷新可重新读取变更后的授权', async () => {
    list.mockRejectedValueOnce(new Error('拒绝访问'));
    const view = setupPage();
    await flushPromises();
    await reactivate(view.visible);
    expect(list).toHaveBeenCalledOnce();
    list.mockResolvedValue({ items: [{ id: 'role', permissions: ['read'] }] });
    await view.page.refresh(true);
    expect(view.page.records.value).toEqual([
      { id: 'role', permissions: ['read'] },
    ]);
    expect(list).toHaveBeenCalledTimes(2);
    view.wrapper.unmount();
  });

  it('后台标签范围变化不查询，重新激活查询新范围且账户隔离', async () => {
    const view = setupPage();
    await flushPromises();
    view.visible.value = false;
    await flushPromises();
    setCurrentGlobalDomainId('domain-b');
    await flushPromises();
    expect(list).toHaveBeenCalledOnce();
    view.visible.value = true;
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
    view.actor.value = { id: 'another', tenantId: 'tenant' };
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(3);
    view.wrapper.unmount();
  });

  it('范围往返期间的旧在途结果不能覆盖当前结果或进入旧范围缓存', async () => {
    let finish!: (value: unknown) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = setupPage();
    await flushPromises();
    setCurrentGlobalDomainId('domain-b');
    await flushPromises();
    list.mockResolvedValue({ items: [{ id: 'fresh' }] });
    setCurrentGlobalDomainId(undefined);
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(3);
    finish({ items: [{ id: 'stale' }] });
    await flushPromises();
    expect(view.page.records.value).toEqual([{ id: 'fresh' }]);
    await reactivate(view.visible);
    expect(list).toHaveBeenCalledTimes(3);
    view.wrapper.unmount();
  });

  it('不同页面实例独享缓存，不把其他页面查询结果当成本页结果', async () => {
    const first = setupPage();
    const second = setupPage();
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
    first.wrapper.unmount();
    second.wrapper.unmount();
  });
});
