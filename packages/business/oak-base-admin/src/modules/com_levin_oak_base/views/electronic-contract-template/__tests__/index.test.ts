import { flushPromises, mount, shallowMount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { electronicContractTemplatePageCrudConfig } from '../config';
import ContractTemplateDocxUpload from '../contract-template-docx-upload.vue';
import ContractTemplateVariablesEditor from '../contract-template-variables-editor.vue';
import TemplatePage from '../index.vue';

const mocks = vi.hoisted(() => ({ uploadTemplateDocx: vi.fn() }));
vi.mock('../../../api/electronic-contract-template-service', () => ({
  electronicContractTemplateService: {
    uploadTemplateDocx: mocks.uploadTemplateDocx,
  },
}));
vi.mock('ant-design-vue', () => ({
  Alert: {
    name: 'Alert',
    props: ['message'],
    template: '<div>{{ message }}</div>',
  },
  Button: {
    name: 'Button',
    template: '<button><slot /></button>',
  },
  Checkbox: {
    name: 'Checkbox',
    template: '<label><slot /></label>',
  },
  Input: {
    name: 'Input',
    template: '<input />',
  },
}));
vi.mock('../../crud-page.vue', () => ({
  default: { name: 'CrudPage', props: ['config'], template: '<div />' },
}));

describe('电子合同模板标准 CRUD 页面', () => {
  it('将受控上传放入标准新增表单', () => {
    const wrapper = shallowMount(TemplatePage);
    const crud = wrapper.findComponent({ name: 'CrudPage' });
    expect(crud.exists()).toBe(true);
    expect(crud.props('config')).toBe(electronicContractTemplatePageCrudConfig);
    expect(Object.keys(crud.vm.$slots)).toContain('form-field-fileResId');
    expect(Object.keys(crud.vm.$slots)).toContain(
      'form-field-templateFieldSchema',
    );
    expect(wrapper.html()).not.toContain('新建 Word 合同模板');
  });

  it('变量编辑器说明固定合同无需填写项，并能逐项添加', async () => {
    const formState = reactive<Record<string, any>>({
      templateFieldSchema: [],
    });
    const wrapper = mount(ContractTemplateVariablesEditor, {
      props: {
        formState,
        onUpdate: (value) => (formState.templateFieldSchema = value),
      },
    });
    expect(wrapper.text()).toContain('合同内容固定时可直接保存');
    expect(wrapper.text()).toContain('添加要填写的内容');

    (wrapper.vm as any).addRow();
    await nextTick();
    expect(formState.templateFieldSchema).toEqual([
      { key: '', title: '', required: false },
    ]);
  });

  it('上传元数据进入表单，归属改变后必须重新上传', async () => {
    mocks.uploadTemplateDocx.mockReset();
    mocks.uploadTemplateDocx.mockResolvedValue({
      data: {
        fileResId: 'res-1',
        fileName: 'contract.docx',
        fileUrl: '/controlled/res-1',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });
    const formState = reactive<Record<string, any>>({
      tenantId: 'tenant-1',
      orgId: 'org-1',
    });
    const wrapper = mount(ContractTemplateDocxUpload, {
      props: {
        formState,
        onUpdate: (values: Record<string, any>) =>
          Object.assign(formState, values),
      },
    });
    await (wrapper.vm as any).uploadTemplate({
      target: { files: [new File(['docx'], 'contract.docx')] },
    } as unknown as Event);
    await flushPromises();
    expect(mocks.uploadTemplateDocx).toHaveBeenCalledWith(expect.any(File), {
      tenantId: 'tenant-1',
      orgId: 'org-1',
      ownerId: undefined,
    });
    expect(formState.fileResId).toMatchObject({ fileResId: 'res-1' });
    formState.orgId = 'org-2';
    await nextTick();
    expect(formState.fileResId).toBeUndefined();
    expect(wrapper.text()).toContain('请重新上传');
  });

  it('上传进行中切换归属不会接收旧归属文件', async () => {
    mocks.uploadTemplateDocx.mockReset();
    let finishUpload: (value: unknown) => void = () => {};
    mocks.uploadTemplateDocx.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    );
    const formState = reactive<Record<string, any>>({ tenantId: 'tenant-1' });
    const wrapper = mount(ContractTemplateDocxUpload, {
      props: {
        formState,
        onUpdate: (values: Record<string, any>) =>
          Object.assign(formState, values),
      },
    });
    const upload = (wrapper.vm as any).uploadTemplate({
      target: { files: [new File(['docx'], 'contract.docx')] },
    } as unknown as Event);
    formState.tenantId = 'tenant-2';
    finishUpload({
      data: {
        fileResId: 'res-1',
        fileName: 'contract.docx',
        fileUrl: '/controlled/res-1',
      },
    });
    await upload;

    expect(formState.fileResId).toBeUndefined();
    expect(wrapper.text()).toContain('请重新上传');
  });

  it('上传缺少归属时给出普通用户可执行的提示', async () => {
    mocks.uploadTemplateDocx.mockReset();
    mocks.uploadTemplateDocx.mockRejectedValue(
      new Error('模板上传缺少身份或归属范围'),
    );
    const wrapper = mount(ContractTemplateDocxUpload, {
      props: { formState: reactive<Record<string, any>>({}) },
    });
    await (wrapper.vm as any).uploadTemplate({
      target: { files: [new File(['docx'], 'contract.docx')] },
    } as unknown as Event);
    expect(wrapper.text()).toContain('请先选择使用租户和使用组织');
  });
});
