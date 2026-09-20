import { describe, expect, it } from 'vitest';

import {
  buildJsonSchemaFormNodes,
  planJsonSchemaColumns,
} from '../json-schema-form-layout';

describe('运行时 Schema 表单布局', () => {
  it('将对象、对象数组和分支解析为结构节点', () => {
    const nodes = buildJsonSchemaFormNodes({
      properties: {
        auth: {
          properties: { token: { format: 'password', type: 'string' } },
          title: '认证信息',
          type: 'object',
        },
        endpoints: {
          items: { properties: { url: { type: 'string' } }, type: 'object' },
          title: '服务端点',
          type: 'array',
        },
        mode: {
          oneOf: [{ title: '模式一', type: 'string' }],
          title: '运行模式',
        },
      },
      type: 'object',
    });

    expect(nodes.map((node) => node.kind)).toEqual([
      'group',
      'collection',
      'branch',
    ]);
    expect((nodes[0] as any).children[0].kind).toBe('password');
  });

  it('少字段单列，三个简单字段最多双列', () => {
    expect(planJsonSchemaColumns(buildJsonSchemaFormNodes({
      properties: { endpoint: { type: 'string' }, token: { type: 'string' } },
    }))).toBe(1);
    expect(planJsonSchemaColumns(buildJsonSchemaFormNodes({
      properties: {
        endpoint: { type: 'string' },
        plan: { type: 'string' },
        token: { type: 'string' },
      },
    }))).toBe(2);
  });
});
