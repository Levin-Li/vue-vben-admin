import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TicketImagePicker from '../ticket-image-picker.vue';

const convert = vi.hoisted(() => vi.fn(async (file: File) => file.name));
vi.mock('../image-convert', () => ({ ticketImageToPng: convert }));

describe('工单图片选择', () => {
  afterEach(() => vi.clearAllMocks());

  it('添加多图、查看大图并单独移除', async () => {
    const modal = {
      name: 'AModal',
      props: ['open'],
      template: '<div v-if="open"><slot /></div>',
    };
    const wrapper = mount(TicketImagePicker, {
      props: { modelValue: ['auto'], active: true },
      global: { stubs: { AModal: modal } },
    });
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [
        new File(['a'], 'one.png', { type: 'image/png' }),
        new File(['b'], 'two.png', { type: 'image/png' }),
      ],
    });
    await input.trigger('change');
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'auto',
      'one.png',
      'two.png',
    ]);
    await wrapper.setProps({ modelValue: ['auto', 'one.png', 'two.png'] });
    await wrapper.get('button[aria-label="查看图片 2"]').trigger('click');
    expect(wrapper.find('img[alt="图片大图预览"]').exists()).toBe(true);
    await wrapper.get('button[aria-label="移除图片 1"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'one.png',
      'two.png',
    ]);
    wrapper.unmount();
  });

  it('在图片卡片粘贴时替换目标，不拦截输入框粘贴', async () => {
    const wrapper = mount(TicketImagePicker, {
      props: { modelValue: ['old'], active: true },
      attachTo: document.body,
      global: { stubs: { AModal: true } },
    });
    await wrapper
      .get('.ticket-image-picker__card')
      .trigger('mouseenter', { clientX: 10, clientY: 10 });
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        items: [
          {
            type: 'image/png',
            getAsFile: () =>
              new File(['a'], 'replacement.png', { type: 'image/png' }),
          },
        ],
      },
    });
    document.body.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'replacement.png',
    ]);
    const text = document.createElement('textarea');
    document.body.append(text);
    const inputPaste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(inputPaste, 'clipboardData', {
      value: {
        items: [
          {
            type: 'image/png',
            getAsFile: () =>
              new File(['a'], 'ignored.png', { type: 'image/png' }),
          },
        ],
      },
    });
    text.dispatchEvent(inputPaste);
    expect(inputPaste.defaultPrevented).toBe(false);
    text.remove();
    wrapper.unmount();
  });
});
