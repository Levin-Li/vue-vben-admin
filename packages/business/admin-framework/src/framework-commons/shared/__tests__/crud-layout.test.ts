import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import CrudLayout from '../crud-layout.vue';

// 保留真实布局，观测容器尺寸而非浏览器视口，并验证卸载释放观察器。
vi.mock('ant-design-vue', () => ({
  Form: { template: '<form><slot /></form>' },
}));
afterEach(() => vi.unstubAllGlobals());

describe('专用列表复用标准 CRUD 布局', () => {
  it('容器变窄时查询网格回落，业务插槽不被布局创建或提交', async () => {
    let resize: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect = disconnect;
        observe = vi.fn();
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
      },
    );
    const wrapper = mount(CrudLayout, {
      props: { formId: 'test-query', formName: '测试查询' },
      slots: {
        query: '<input aria-label="条件" />',
        'query-actions': '<button>查询</button>',
        toolbar: '<button>新增</button>',
        default: '<table><tbody><tr><td>记录</td></tr></tbody></table>',
      },
    });
    const grid = () => wrapper.get('.grid').attributes('style');
    const notify = async (width: number) => {
      resize?.(
        [{ contentRect: { width } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      await nextTick();
    };
    await notify(872);
    expect(grid()).toContain('repeat(3,');
    await notify(260);
    expect(grid()).toContain('repeat(1,');
    expect(wrapper.findAll('.vben-crud-section')).toHaveLength(2);
    expect(wrapper.get('form').attributes('data-form-id')).toBe('test-query');
    expect(wrapper.text()).toContain('记录');
    wrapper.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('范围上下文没有列表插槽时不渲染空白列表面板', () => {
    const wrapper = mount(CrudLayout, {
      props: { formId: 'scope', formName: '业务范围' },
      slots: { query: '<input aria-label="业务范围" />' },
    });
    expect(wrapper.findAll('.vben-crud-section')).toHaveLength(1);
    expect(wrapper.find('.vben-crud-table').exists()).toBe(false);
    wrapper.unmount();
  });
});
