import { shallowMount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import TemplatePage from '../index.vue';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  uploadTemplateDocx: vi.fn(),
}));
vi.mock('../../../api/electronic-contract-template-service', () => ({
  electronicContractTemplateService: mocks,
}));

type Page = {
  category: string;
  createTemplate: () => Promise<void>;
  error: string;
  fieldSchemaText: string;
  name: string;
  templateNo: string;
  uploadTemplate: (event: Event) => Promise<void>;
};

describe('受控电子合同模板创建', () => {
  it('uses the controlled upload result when saving the template', async () => {
    mocks.uploadTemplateDocx.mockResolvedValueOnce({
      fileResId: 'res-1',
      fileUrl: '/controlled/res-1',
      fileName: 'contract.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    mocks.create.mockResolvedValueOnce('template-1');
    const page = shallowMount(TemplatePage).vm as unknown as Page;
    page.templateNo = 'T-1';
    page.name = '销售合同';
    page.category = '销售';
    page.fieldSchemaText =
      '[{"key":"customerName","title":"客户名称","required":true}]';
    await page.uploadTemplate({
      target: { files: [new File(['docx'], 'contract.docx')] },
    } as unknown as Event);
    await page.createTemplate();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileResId: 'res-1',
        fileUrl: '/controlled/res-1',
        templateFieldSchema: [
          { key: 'customerName', title: '客户名称', required: true },
        ],
      }),
    );
  });
});
