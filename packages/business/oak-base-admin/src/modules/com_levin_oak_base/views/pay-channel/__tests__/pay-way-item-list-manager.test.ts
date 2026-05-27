import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PayWayItemListManager from '../pay-way-item-list-manager.vue';

const { uploadFileByFileStorageController } = vi.hoisted(() => ({
  uploadFileByFileStorageController: vi.fn(),
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/api/file-storage-service',
  () => ({
    uploadFileByFileStorageController,
  }),
);

vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [{ label: '人民币', value: 'CNY' }],
  buildEnumOptionsLoader: () => async () => [
    { label: '网页支付', value: 'Web' },
  ],
  FILE_STORAGE_SINGLE_UPLOAD_PATH: '/fss/uploadSingleFile',
  OAK_BASE_API_MODULE: '/com.levin.oak.base/V1/api',
}));

const UploadStub = {
  emits: ['preview', 'remove'],
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

const ModalStub = {
  emits: ['ok'],
  props: ['open', 'title'],
  template: `
    <section v-if="open" class="modal-stub">
      <h2>{{ title }}</h2>
      <slot />
      <button type="button" @click="$emit('ok')">确定</button>
    </section>
  `,
};

const SelectStub = {
  emits: ['update:value'],
  props: ['options', 'value'],
  template: `
    <select
      :value="value"
      @change="$emit('update:value', $event.target.value)"
    >
      <option value=""></option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  `,
};

describe('pay way item logo upload', () => {
  beforeEach(() => {
    uploadFileByFileStorageController.mockReset();
    uploadFileByFileStorageController.mockResolvedValue('/lfs/pay-logo.png');
  });

  it('uses image upload for logo and writes back the uploaded url', async () => {
    const wrapper = mount(PayWayItemListManager, {
      global: {
        stubs: {
          AImage: true,
          AModal: ModalStub,
          ASelect: SelectStub,
          AUpload: UploadStub,
        },
      },
      props: {
        items: [],
      },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.find('input[placeholder="请输入logo"]').exists()).toBe(
      false,
    );

    const upload = wrapper.getComponent(UploadStub);

    expect(upload.attributes('data-accept')).toBe('image/*');
    expect(upload.attributes('data-list-type')).toBe('picture-card');
    expect(upload.attributes('data-max-count')).toBe('1');
    expect(wrapper.text()).toContain('上传logo');

    await upload.props('customRequest')({
      file: new File(['logo'], 'pay-logo.png', { type: 'image/png' }),
      onSuccess: vi.fn(),
    });

    expect(uploadFileByFileStorageController).toHaveBeenCalledWith(
      expect.any(File),
      '/com.levin.oak.base/V1/api',
      '/fss/uploadSingleFile',
    );

    await (wrapper.vm as any).$nextTick();

    const uploadedLogo = wrapper.getComponent(UploadStub);

    expect(uploadedLogo.attributes('data-file-count')).toBe('1');
    expect(uploadedLogo.props('fileList')).toEqual([
      expect.objectContaining({
        name: 'pay-logo.png',
        status: 'done',
        url: '/lfs/pay-logo.png',
      }),
    ]);
  });
});
