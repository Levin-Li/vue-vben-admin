import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import RichTextEditorField from '../rich-text-editor-field.vue';
import { isSafeRichTextLink, sanitizeRichText } from '../safe-rich-text';

describe('公共富文本编辑器', () => {
  it('仅保留安全展示节点与链接，删除脚本和可执行属性', () => {
    const html = sanitizeRichText(
      '<p onclick="alert(1)"><strong>安全</strong><script>alert(2)</script>' +
        '<a href="javascript:alert(3)" onmouseover="alert(4)">坏链接</a>' +
        '<a href="https://example.com/path">安全链接</a></p>' +
        '<svg><foreignObject><p>不应保留</p></foreignObject></svg>',
    );

    expect(html).toBe(
      '<p><strong>安全</strong><a>坏链接</a>' +
        '<a href="https://example.com/path">安全链接</a></p>',
    );
    expect(sanitizeRichText(html)).toBe(html);
    expect(isSafeRichTextLink('/help')).toBe(true);
    expect(isSafeRichTextLink('mailto:support@example.com')).toBe(true);
    expect(isSafeRichTextLink('//other.example.com')).toBe(false);
    expect(isSafeRichTextLink('javascript:alert(1)')).toBe(false);
  });

  it('回显、编辑和外部值变化保持安全 HTML 字符串', async () => {
    const wrapper = mount(RichTextEditorField, {
      props: { modelValue: '<p onclick="alert(1)">原内容</p>' },
    });
    await flushPromises();

    const editor = wrapper.get('[contenteditable]');
    expect(editor.element.innerHTML).toBe('<p>原内容</p>');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '<p>原内容</p>',
    ]);

    editor.element.innerHTML =
      '<p><b>新内容</b><img src=x onerror="alert(2)"></p>';
    await editor.trigger('input');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '<p><b>新内容</b></p>',
    ]);

    await wrapper.setProps({ modelValue: '<h2>再次打开</h2>' });
    await flushPromises();
    expect(editor.element.innerHTML).toBe('<h2>再次打开</h2>');

    await wrapper.setProps({ disabled: true });
    expect(editor.attributes('contenteditable')).toBe('false');
    expect(
      wrapper
        .get('[role="toolbar"]')
        .findAll('button')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
  });

  it('粘贴网页内容时只向编辑区插入纯文本', () => {
    const wrapper = mount(RichTextEditorField);
    const editor = wrapper.get('[contenteditable]');
    const execCommand = vi.fn();
    const original = document.execCommand;
    document.execCommand = execCommand;
    try {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: { getData: () => '只保留文字' },
      });
      editor.element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(execCommand).toHaveBeenCalledWith(
        'insertText',
        false,
        '只保留文字',
      );
    } finally {
      document.execCommand = original;
    }
  });
});
