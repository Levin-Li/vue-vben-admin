import { defineComponent, h, nextTick } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DraggableFloatingPanelHost from '../draggable-floating-panel-host.vue';
import {
  clearDraggableFloatingPanels,
  getDraggableFloatingPanels,
  useDraggableFloatingPanels,
} from '../draggable-floating-panel-service';

function createPointerEvent(
  type: string,
  options: { button?: number; clientX?: number; clientY?: number } = {},
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as PointerEvent;

  Object.assign(event, {
    button: options.button ?? 0,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
  });

  return event;
}

describe('draggable floating panel infrastructure', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearDraggableFloatingPanels();
    clearDraggableFloatingPanels('other-page');
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
    expect(
      document.body.querySelector('[data-testid="floating-tenant-filter"]')
        ?.textContent,
    ).toBe('tenant-filter');
    expect(
      document.body.querySelector('[data-testid="floating-project-filter"]')
        ?.textContent,
    ).toBe('project-filter');
    expect(document.body.textContent?.indexOf('tenant-filter')).toBeLessThan(
      document.body.textContent?.indexOf('project-filter') ?? 0,
    );

    const panel = document.body.querySelector('.vben-draggable-floating-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('style')).toContain('top: 16px');
    expect(panel?.getAttribute('style')).toContain('left:');
    expect(panel?.getAttribute('style')).toContain('z-index: 1000');

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

    expect(
      document.body.querySelector('[data-testid="floating-old"]'),
    ).toBeNull();
    expect(
      document.body.querySelector('[data-testid="floating-new"]')?.textContent,
    ).toBe('new');

    wrapper.unmount();
  });

  it('renders all scoped floating panels when the root host has no scope', async () => {
    const FloatingPanelRegistrar = defineComponent({
      name: 'FloatingPanelRegistrar',
      setup: () => {
        const testPagePanels = useDraggableFloatingPanels('test-page');
        const otherPagePanels = useDraggableFloatingPanels('other-page');

        testPagePanels.add({
          id: 'test-page-panel',
          panelProps: { persist: false },
          render: () =>
            h('div', { 'data-testid': 'floating-test-page' }, 'test-page'),
        });
        otherPagePanels.add({
          id: 'other-page-panel',
          panelProps: { persist: false },
          render: () =>
            h('div', { 'data-testid': 'floating-other-page' }, 'other-page'),
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
        <FloatingPanelRegistrar />
        <DraggableFloatingPanelHost />
      `,
    });

    await nextTick();
    await flushPromises();

    expect(
      document.body.querySelector('[data-testid="floating-test-page"]')
        ?.textContent,
    ).toBe('test-page');
    expect(
      document.body.querySelector('[data-testid="floating-other-page"]')
        ?.textContent,
    ).toBe('other-page');

    wrapper.unmount();
  });

  it('collapses and expands a floating panel by clicking the drag handle', async () => {
    const FloatingPanelRegistrar = defineComponent({
      name: 'FloatingPanelRegistrar',
      setup: () => {
        const floatingPanels = useDraggableFloatingPanels('test-page');

        floatingPanels.add({
          id: 'collapsible-panel',
          name: '测试收缩面板',
          panelProps: { persist: false },
          render: () =>
            h('div', { 'data-testid': 'floating-collapsible' }, 'content'),
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
        <FloatingPanelRegistrar />
        <DraggableFloatingPanelHost />
      `,
    });

    await nextTick();
    await flushPromises();

    const panel = document.body.querySelector('.vben-draggable-floating-panel');
    const handle = document.body.querySelector<HTMLButtonElement>(
      '.vben-draggable-floating-panel-handle',
    );

    expect(panel?.classList.contains('is-collapsed')).toBe(false);
    expect(handle?.getAttribute('aria-pressed')).toBe('false');
    expect(handle?.getAttribute('title')).toBeNull();
    expect(handle?.getAttribute('aria-label')).toBe(
      '测试收缩面板：点击可收缩，按住可拖动',
    );

    handle?.dispatchEvent(createPointerEvent('pointerdown'));
    window.dispatchEvent(createPointerEvent('pointerup'));
    await nextTick();

    expect(panel?.classList.contains('is-collapsed')).toBe(true);
    expect(handle?.getAttribute('aria-pressed')).toBe('true');
    expect(handle?.getAttribute('aria-label')).toBe(
      '测试收缩面板：点击可展开，按住可拖动',
    );

    handle?.dispatchEvent(createPointerEvent('pointerdown'));
    window.dispatchEvent(createPointerEvent('pointerup'));
    await nextTick();

    expect(panel?.classList.contains('is-collapsed')).toBe(false);
    expect(handle?.getAttribute('aria-pressed')).toBe('false');

    wrapper.unmount();
  });

  it('does not collapse a floating panel when dragging the handle', async () => {
    const FloatingPanelRegistrar = defineComponent({
      name: 'FloatingPanelRegistrar',
      setup: () => {
        const floatingPanels = useDraggableFloatingPanels('test-page');

        floatingPanels.add({
          id: 'drag-panel',
          panelProps: { persist: false },
          render: () => h('div', { 'data-testid': 'floating-drag' }, 'drag'),
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
        <FloatingPanelRegistrar />
        <DraggableFloatingPanelHost />
      `,
    });

    await nextTick();
    await flushPromises();

    const panel = document.body.querySelector('.vben-draggable-floating-panel');
    const handle = document.body.querySelector<HTMLButtonElement>(
      '.vben-draggable-floating-panel-handle',
    );

    handle?.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 10, clientY: 10 }),
    );
    window.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 40, clientY: 40 }),
    );
    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 40, clientY: 40 }),
    );
    await nextTick();

    expect(panel?.classList.contains('is-collapsed')).toBe(false);

    wrapper.unmount();
  });
});
