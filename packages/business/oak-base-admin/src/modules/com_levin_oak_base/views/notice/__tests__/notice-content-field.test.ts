import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NoticeContentField from '../notice-content-field.vue';

const { uploadFileByFileStorageController } = vi.hoisted(() => ({
  uploadFileByFileStorageController: vi.fn(),
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/api/file-storage-service',
  () => ({ uploadFileByFileStorageController }),
);

const UploadStub = {
  emits: ['remove'],
  props: ['accept', 'customRequest', 'fileList', 'listType', 'maxCount'],
  template: `
    <div
      class="upload-stub"
      :data-accept="accept"
      :data-file-count="fileList?.length || 0"
      :data-list-type="listType"
      :data-max-count="maxCount"
    >
      <slot />
    </div>
  `,
};

const CodeEditorStub = {
  emits: ['update:modelValue'],
  props: ['inline', 'language', 'modelValue'],
  template: '<div class="code-editor-stub" :data-language="language" />',
};

const JsonEditorStub = {
  emits: ['update:modelValue'],
  props: ['inline', 'modelValue'],
  template: '<div class="json-editor-stub" />',
};

function mountField(props: Record<string, any>) {
  return mount(NoticeContentField, {
    props,
    global: {
      stubs: {
        AUpload: UploadStub,
        CodeEditorField: CodeEditorStub,
        JsonEditorField: JsonEditorStub,
      },
    },
  });
}

describe('通知内容编辑字段', () => {
  beforeEach(() => {
    uploadFileByFileStorageController.mockReset();
    uploadFileByFileStorageController.mockResolvedValue('/lfs/notice.png');
  });

  it('根据内容类型切换文本、Markdown 和 JSON 编辑器', () => {
    const text = mountField({ contentType: 'Text' });
    expect(text.find('textarea').exists()).toBe(true);

    const markdown = mountField({ contentType: 'Markdown' });
    expect(markdown.get('.code-editor-stub').attributes('data-language')).toBe(
      'markdown',
    );

    const json = mountField({ contentType: 'JsonSchema' });
    expect(json.find('.json-editor-stub').exists()).toBe(true);
  });

  it('为网页内容提供富文本编辑器，并过滤危险属性', async () => {
    const wrapper = mountField({
      contentType: 'Html',
      modelValue: '<p onclick="alert(1)">安全内容</p>',
    });

    await (wrapper.vm as any).$nextTick();

    const editor = wrapper.get('[contenteditable]');
    expect(editor.text()).toBe('安全内容');
    expect(editor.html()).not.toContain('onclick');

    await editor.trigger('input');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '<p>安全内容</p>',
    ]);
  });

  it('图片使用统一上传并把返回地址回写到通知内容', async () => {
    const wrapper = mountField({ contentType: 'Pic' });
    const upload = wrapper.getComponent(UploadStub);

    expect(upload.attributes('data-accept')).toBe('image/*');
    expect(upload.attributes('data-list-type')).toBe('picture-card');
    expect(upload.attributes('data-max-count')).toBe('1');

    await upload.props('customRequest')({
      file: new File(['image'], 'notice.png', { type: 'image/png' }),
      onSuccess: vi.fn(),
    });

    expect(uploadFileByFileStorageController).toHaveBeenCalledWith(
      expect.any(File),
    );
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '/lfs/notice.png',
    ]);
  });

  it('音视频和文件使用上传控件而非文本域', () => {
    for (const contentType of ['Audio', 'File', 'Video']) {
      const wrapper = mountField({ contentType });
      expect(wrapper.find('.upload-stub').exists()).toBe(true);
      expect(wrapper.find('textarea').exists()).toBe(false);
    }
  });
});
