import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('crud form layout', () => {
  it('lets explicit positive span override tag field defaults', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );
    const spanClassBlock = source.slice(
      source.indexOf("'md:col-span-2'"),
      source.indexOf("'max-w-[480px]'"),
    );

    expect(source).toContain('style.gridColumn');
    expect(spanClassBlock).toContain('field.span === 2');
    expect(spanClassBlock).not.toContain("field.type !== 'tags'");
    expect(spanClassBlock).not.toContain("field.type !== 'string-array'");
    expect(spanClassBlock).not.toContain("field.type !== 'textarea'");
  });
});
