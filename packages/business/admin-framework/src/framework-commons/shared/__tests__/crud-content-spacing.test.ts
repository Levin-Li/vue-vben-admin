import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
  ),
  'utf8',
);

describe('shared CRUD content spacing', () => {
  it('does not add default padding to the normal Page content wrapper', () => {
    expect(source).toContain(
      "'!bg-transparent min-w-0 !overflow-hidden !p-0'",
    );
  });

  it('supports an embedded layout that fills the parent remaining height', () => {
    expect(source).toContain('embedded?: boolean;');
    expect(source).toContain(':auto-content-height="!embedded"');
    expect(source).toContain("embedded ? '!min-h-0 flex-1' : undefined");
    expect(source).toContain(
      "'flex min-h-0 flex-1 flex-col !bg-transparent min-w-0 !overflow-hidden !p-0'",
    );
  });
});
