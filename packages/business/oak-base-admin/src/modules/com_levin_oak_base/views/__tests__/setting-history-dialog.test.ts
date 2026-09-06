import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import SettingHistoryDialog from '../setting-history-dialog.vue';

const { moduleFetchCrudList } = vi.hoisted(() => ({
  moduleFetchCrudList: vi.fn(),
}));

vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { superAdmin: true } }),
}));

vi.mock('../api-module', () => ({
  moduleCreateCrudRecord: vi.fn(),
  moduleDeleteCrudRecord: vi.fn(),
  moduleFetchCrudList,
}));

vi.mock('../setting-value-content-field.vue', () => ({
  default: defineComponent({
    props: { formState: { required: true, type: Object } },
    template: '<div class="history-json-editor">{{ formState.editor }}</div>',
  }),
}));

const uiSettingBizType = 'com.levin.oak.base.entities.UiSetting';

function mountDialog() {
  return mount(SettingHistoryDialog, {
    attachTo: document.body,
    props: {
      bizDataId: 'setting-1',
      bizType: uiSettingBizType,
      open: true,
    },
  });
}

describe('设置历史工作台', () => {
  it('显示规范化历史列表中的版本', async () => {
    moduleFetchCrudList.mockResolvedValue({
      items: [
        {
          bizType: uiSettingBizType,
          createTime: '2026-09-06T22:13:47',
          id: 'history-1',
          title: '界面设置 -> 2026-09-06 22:13:47',
        },
      ],
    });

    const wrapper = mountDialog();
    await flushPromises();

    expect(document.body.textContent).toContain(
      '界面设置 -> 2026-09-06 22:13:47',
    );
    expect(moduleFetchCrudList).toHaveBeenCalledWith(
      '/SettingHistoryData/list',
      expect.objectContaining({
        bizDataId: 'setting-1',
        bizType: uiSettingBizType,
      }),
    );
    wrapper.unmount();
  });

  it('详情在 editor 为空时以业务类型获取 JSON Schema', async () => {
    moduleFetchCrudList.mockResolvedValue({
      data: {
        items: [
          {
            bizType: uiSettingBizType,
            content: { version: 1 },
            editor: '  ',
            id: 'history-2',
            title: '界面设置',
          },
        ],
      },
    });

    const wrapper = mountDialog();
    await flushPromises();
    const detailButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '查看数据',
    );
    detailButton?.click();
    await flushPromises();

    expect(
      document.body.querySelector('.history-json-editor')?.textContent,
    ).toBe(`class:${uiSettingBizType}`);
    wrapper.unmount();
  });
});
