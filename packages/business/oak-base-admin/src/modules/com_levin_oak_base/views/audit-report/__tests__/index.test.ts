import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import AuditReportPage from '../index.vue';

vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => ['audit-report-retrieve'] }),
);
vi.mock('../../crud-page.vue', () => ({
  default: defineComponent({
    name: 'CrudPage',
    props: { config: { required: true, type: Object } },
    template: '<div class="audit-report-crud" />',
  }),
}));
vi.mock('../audit-report-viewer.vue', () => ({
  default: defineComponent({
    props: { open: { required: true, type: Boolean } },
    template: '<div class="audit-report-viewer" />',
  }),
}));

describe('审计报告页面操作', () => {
  it('同时保留内置详情和独立查看报告操作', () => {
    const wrapper = mount(AuditReportPage);
    const config = wrapper.findComponent({ name: 'CrudPage' }).props('config') as {
      allowRetrieve: boolean;
      retrieveLabel?: string;
      rowActions: Array<{ label: string; permission: string[] }>;
    };

    expect(config.allowRetrieve).toBe(true);
    expect(config.retrieveLabel).toBeUndefined();
    expect(config.rowActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '查看报告',
          permission: ['audit-report-retrieve'],
        }),
      ]),
    );
    wrapper.unmount();
  });
});
