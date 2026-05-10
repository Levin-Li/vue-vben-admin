import { defineComponent, h, nextTick } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DraggableFloatingPanelHost from '../draggable-floating-panel-host.vue';
import {
  clearDraggableFloatingPanels,
  getDraggableFloatingPanels,
  useDraggableFloatingPanels,
} from '../draggable-floating-panel-service';

describe('draggable floating panel infrastructure', () => {
  beforeEach(() => {
    clearDraggableFloatingPanels('test-page');
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) || null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });

  it('registers floating panels through useDraggableFloatingPanels and renders them in the host', async () => {
    const FloatingPanelRegistrar = defineComponent({
      name: 'FloatingPanelRegistrar',
      setup: () => {
        const floatingPanels = useDraggableFloatingPanels('test-page');

        floatingPanels.add({
          id: 'project-filter',
          order: 20,
          panelProps: {
            defaultPlacement: 'top-center',
            persist: false,
          },
          render: () =>
            h(
              'div',
              { 'data-testid': 'floating-project-filter' },
              'project-filter',
            ),
        });
        floatingPanels.add({
          id: 'tenant-filter',
          order: 10,
          panelProps: {
            defaultPlacement: 'top-center',
            persist: false,
          },
          render: () =>
            h(
              'div',
              { 'data-testid': 'floating-tenant-filter' },
              'tenant-filter',
            ),
        });

        return () => null;
      },
    });
    const wrapper = mount({
      components: {
        DraggableFloatingPanelHost,
        FloatingPanelRegistrar,
      },
      template: `
        <DraggableFloatingPanelHost scope="test-page">
          <FloatingPanelRegistrar />
          <main data-testid="page-content">page</main>
        </DraggableFloatingPanelHost>
      `,
    });

    await nextTick();
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[data-testid="page-content"]').text()).toBe('page');
    expect(wrapper.find('[data-testid="floating-tenant-filter"]').text()).toBe(
      'tenant-filter',
    );
    expect(wrapper.find('[data-testid="floating-project-filter"]').text()).toBe(
      'project-filter',
    );
    expect(wrapper.text().indexOf('tenant-filter')).toBeLessThan(
      wrapper.text().indexOf('project-filter'),
    );

    const panel = wrapper.find('.vben-draggable-floating-panel');
    expect(panel.exists()).toBe(true);
    expect(panel.attributes('style')).toContain('top: 16px');
    expect(panel.attributes('style')).toContain('left:');

    wrapper.unmount();

    expect(getDraggableFloatingPanels('test-page').value).toEqual([]);
  });

  it('replaces a floating panel with the same id in the same scope', async () => {
    const FloatingPanelRegistrar = defineComponent({
      name: 'FloatingPanelRegistrar',
      setup: () => {
        const floatingPanels = useDraggableFloatingPanels('test-page');

        floatingPanels.add({
          id: 'same-id',
          render: () => h('div', { 'data-testid': 'floating-old' }, 'old'),
        });
        floatingPanels.add({
          id: 'same-id',
          render: () => h('div', { 'data-testid': 'floating-new' }, 'new'),
        });

        return () => null;
      },
    });
    const wrapper = mount({
      components: {
        DraggableFloatingPanelHost,
        FloatingPanelRegistrar,
      },
      template: `
        <DraggableFloatingPanelHost scope="test-page">
          <FloatingPanelRegistrar />
        </DraggableFloatingPanelHost>
      `,
    });

    await nextTick();
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[data-testid="floating-old"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="floating-new"]').text()).toBe('new');
  });
});
