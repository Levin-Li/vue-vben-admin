import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('CRUD 排序字段映射', () => {
  it('优先使用列声明的后端排序字段', () => {
    // 展示字段可来自 join，排序字段必须能明确指向后端实体别名。
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );

    expect(source).toContain('sortField: getTableSortField(field)');
    expect(source).toContain('sorterItem?.column?.sortField');
    expect(source).toContain('props.config.sortFieldPrefix');
    expect(source).toContain("!field.key.includes('.')");
  });
});
