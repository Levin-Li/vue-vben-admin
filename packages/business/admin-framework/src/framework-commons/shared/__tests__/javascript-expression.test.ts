import { describe, expect, it } from 'vitest';

import { evaluateJavaScriptExpression } from '../javascript-expression';

describe('restricted JavaScript expressions', () => {
  it('evaluates the supported page-display variables and operators', () => {
    expect(
      evaluateJavaScriptExpression(
        'user.superAdmin && form.status === "enabled" ? row.name + "\\n" + tenant.id : ""',
        {
          form: { status: 'enabled' },
          row: { name: '演示租户' },
          tenant: { id: 'tenant-1' },
          user: { superAdmin: true },
        },
      ),
    ).toBe('演示租户\ntenant-1');
  });

  it('rejects executable calls and dangerous prototype access', () => {
    expect(() => evaluateJavaScriptExpression('row.format()', { row: {} })).toThrow('不支持的表达式');
    expect(() => evaluateJavaScriptExpression('row.__proto__', { row: {} })).toThrow('不允许访问危险属性');
  });
});
