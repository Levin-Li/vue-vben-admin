import { defineComponent, h, onMounted, ref } from 'vue';

import {
  acceptCrudCursor,
  createCrudCursorState,
  moveCrudCursor,
} from '@levin/admin-framework/framework-commons/shared/crud-cursor-pagination';
import { Space } from 'ant-design-vue';

/** 工作台测试替身只提供CRUD契约；真实公共组件分页实现有独立回归覆盖。 */
export default defineComponent({
  name: 'CrudPage',
  props: { config: { type: Object, required: true } },
  setup(props, { slots, expose }) {
    const rows = ref<any[]>([]);
    const page = ref(createCrudCursorState());
    const loading = ref(false);
    async function reload() {
      loading.value = true;
      rows.value = [];
      try {
        const result = await props.config.apiService.list({
          cursor: page.value.cursors[page.value.index],
          pageSize: 20,
        });
        rows.value = result.items;
        acceptCrudCursor(page.value, result);
      } catch {
        /* 工作台显示原始错误，替身不制造未处理拒绝。 */
      } finally {
        loading.value = false;
      }
    }
    async function move(direction: 'next' | 'previous') {
      if (moveCrudCursor(page.value, direction)) await reload();
    }
    expose({ reload });
    onMounted(reload);
    return () =>
      h('section', [
        h(
          'div',
          { class: 'ant-card-extra' },
          h('button', { onClick: reload }, '刷新'),
        ),
        ...rows.value.map((record) =>
          h('div', [
            ...props.config.fields.map((field: any) =>
              h(
                'span',
                field.tableValue ? field.tableValue(record) : record[field.key],
              ),
            ),
            slots['row-actions']?.({ record }),
          ]),
        ),
        h(
          Space,
          {},
          {
            default: () => [
              h(
                'span',
                `第 ${page.value.index + 1} 页 · 本页 ${rows.value.length} 条`,
              ),
              h(
                'button',
                {
                  disabled: loading.value || page.value.index === 0,
                  onClick: () => move('previous'),
                },
                '上一页',
              ),
              h(
                'button',
                {
                  disabled: loading.value || !page.value.hasMore,
                  onClick: () => move('next'),
                },
                '下一页',
              ),
            ],
          },
        ),
      ]);
  },
});
