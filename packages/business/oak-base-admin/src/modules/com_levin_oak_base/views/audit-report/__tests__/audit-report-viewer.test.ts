import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import AuditReportViewer from '../audit-report-viewer.vue';

const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
const confidentialLevelOptions = vi.hoisted(() => vi.fn());

vi.mock('../../../api/audit-report-service', () => ({
  auditReportService: { retrieve },
}));
vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => confidentialLevelOptions,
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/json-schema-editor-field.vue',
  () => ({
    default: defineComponent({
      props: {
        modelValue: { required: true, type: Object },
        schemaSource: { required: true, type: String },
      },
      template:
        '<div class="audit-report-schema">{{ schemaSource }}|{{ modelValue.summary }}</div>',
    }),
  }),
);
vi.mock(
  '@levin/admin-framework/framework-commons/shared/json-editor-field.vue',
  () => ({
    default: defineComponent({
      props: { modelValue: { required: true, type: Object } },
      template: '<div class="audit-report-json">{{ modelValue.summary }}</div>',
    }),
  }),
);

describe('审计报告查看弹窗', () => {
  it('从详情接口加载报告，并在 Schema 正文外展示结论和机密等级', async () => {
    retrieve.mockResolvedValue({
      confidentialLevel: 4,
      content: { summary: '发现 1 项需核查问题' },
      editor: 'class:com.levin.oak.base.biz.bo.auditreport.AccessAuditContent',
      id: 'report-1',
      title: '访问日志审计',
    });
    confidentialLevelOptions.mockResolvedValue([
      { label: '平台超级管理员', value: 4 },
    ]);

    const wrapper = mount(AuditReportViewer, {
      attachTo: document.body,
      props: {
        open: true,
        record: { id: 'report-1', orgId: 'org-1' },
      },
    });
    await flushPromises();

    expect(retrieve).toHaveBeenCalledWith({ id: 'report-1', orgId: 'org-1' });
    expect(document.body.textContent).toContain('发现 1 项需核查问题');
    expect(document.body.textContent).toContain('平台超级管理员');
    expect(document.body.querySelector('.audit-report-schema')?.textContent).toContain(
      'class:com.levin.oak.base.biz.bo.auditreport.AccessAuditContent',
    );
    wrapper.unmount();
  });

  it('编辑器为空时使用默认只读 JSON 查看器', async () => {
    retrieve.mockResolvedValue({
      content: { summary: '无编辑器声明' },
      id: 'report-2',
      title: '默认报告',
    });
    confidentialLevelOptions.mockResolvedValue([]);

    const wrapper = mount(AuditReportViewer, {
      attachTo: document.body,
      props: { open: true, record: { id: 'report-2' } },
    });
    await flushPromises();

    expect(document.body.querySelector('.audit-report-json')?.textContent).toBe(
      '无编辑器声明',
    );
    wrapper.unmount();
  });
});
