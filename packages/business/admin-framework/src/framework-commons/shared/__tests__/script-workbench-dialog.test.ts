import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('script workbench dialog source', () => {
  it('pins the dialog to the requested 80% viewport shell and 30/70 content split', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/script-workbench-dialog.vue',
      'utf8',
    );

    expect(source).toContain('wrap-class-name="script-workbench-dialog"');
    expect(source).toContain("flex: '0 0 30%'");
    expect(source).toContain("minWidth: '400px'");
    expect(source).toContain("height: `calc((${workbenchPaneHeight}) * 0.7)`");
    expect(source).toContain("height: `calc((${workbenchPaneHeight}) * 0.3)`");
    expect(source).toContain("width: min(80vw, 1600px) !important");
    expect(source).toContain("max-height: 80vh");
  });

  it('renders a read-only console with distinct success and error colors', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/script-workbench-dialog.vue',
      'utf8',
    );

    expect(source).toContain('aria-label="运行输出控制台"');
    expect(source).toContain('text-green-600');
    expect(source).toContain('text-red-600');
    expect(source).toContain('运行测试后将在此显示结果或错误信息。');
  });
});
