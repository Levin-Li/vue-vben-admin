import { flushPromises, mount } from '@vue/test-utils';
import { Tooltip } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PatternListEditor from '../pattern-list-editor.vue';

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('PatternListEditor', () => {
  it('adds typed values and emits a clean string list', async () => {
    const wrapper = mount(PatternListEditor, {
      props: {
        modelValue: ['/api/*'],
      },
    });

    await wrapper
      .find('[data-test="pattern-list-draft"] input')
      .setValue('/admin/?');
    await wrapper.find('[data-test="pattern-list-add"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      ['/api/*', '/admin/?'],
    ]);
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      ['/api/*', '/admin/?'],
      'any',
    ]);
  });

  it('renders the add control as an inline row with an outer border', () => {
    const wrapper = mount(PatternListEditor, {
      props: {
        modelValue: [],
      },
    });

    expect(wrapper.classes()).toContain('border');
    expect(
      wrapper.find('.pattern-list-editor__draft-row').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('暂无内容');
    expect(wrapper.find('[data-test="pattern-list-hint"]').text()).toContain(
      '支持*和?匹配',
    );
  });

  it('edits and deletes rows with icon actions', async () => {
    const wrapper = mount(PatternListEditor, {
      props: {
        modelValue: ['/api/*', '/admin/?'],
      },
    });

    await wrapper
      .findAll('[data-test="pattern-list-edit"]')[0]
      .trigger('click');
    await wrapper
      .find('[data-test="pattern-list-edit-input"]')
      .setValue('/demo/*');
    await wrapper.find('[data-test="pattern-list-save"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      ['/demo/*', '/admin/?'],
    ]);

    await wrapper.setProps({ modelValue: ['/demo/*', '/admin/?'] });
    await wrapper
      .findAll('[data-test="pattern-list-delete"]')[1]
      .trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['/demo/*']]);
  });

  it('copies single entries and JSON arrays', async () => {
    const wrapper = mount(PatternListEditor, {
      props: {
        modelValue: ['/api/*'],
      },
    });

    await wrapper.find('[data-test="pattern-list-copy-item"]').trigger('click');
    expect(writeText).toHaveBeenLastCalledWith('/api/*');

    await wrapper.find('[data-test="pattern-list-copy-json"]').trigger('click');
    expect(writeText).toHaveBeenLastCalledWith(
      JSON.stringify(['/api/*'], null, 2),
    );
  });

  it('shows full row content in a tooltip when values are truncated', () => {
    const longValue =
      '/api/order/very/long/path/with/customer/*/detail/??/segment';
    const wrapper = mount(PatternListEditor, {
      props: {
        modelValue: [longValue],
      },
    });

    expect(wrapper.find('[data-test="pattern-list-row-value"]').text()).toBe(
      longValue,
    );
    expect(
      wrapper
        .findAllComponents(Tooltip)
        .some((tooltip) => tooltip.props('title') === longValue),
    ).toBe(true);
  });

  it('opens a modal test input and shows match feedback', async () => {
    const wrapper = mount(PatternListEditor, {
      attachTo: document.body,
      props: {
        matchMode: 'all',
        modelValue: ['/api/*', '*demo'],
      },
    });

    await wrapper.find('[data-test="pattern-list-test"]').trigger('click');
    await flushPromises();

    const input =
      document.body.querySelector<HTMLInputElement>('.ant-modal input');
    expect(input).toBeTruthy();

    input!.value = '/api/demo';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();

    document.body
      .querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary')!
      .click();
    await flushPromises();

    expect(document.body.textContent).toContain('匹配成功');

    wrapper.unmount();
  });
});
