import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('script workbench dialog source', () => {
  it('pins the dialog to the wide viewport shell, shortcut pane and 30/70 content split', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/script-workbench-dialog.vue',
      'utf8',
    );

    expect(source).toContain('wrap-class-name="script-workbench-dialog"');
    expect(source).toContain("flex: '0 0 440px'");
    expect(source).toContain("minWidth: '440px'");
    expect(source).toContain("height: `calc((${workbenchPaneHeight}) * 0.7)`");
    expect(source).toContain("height: `calc((${workbenchPaneHeight}) * 0.3)`");
    expect(source).toContain("width: min(92vw, 1900px) !important");
    expect(source).toContain("max-height: 80vh");
    expect(source).toContain("flex: '0 0 12%'");
    expect(source).toContain("快捷操作");
    expect(source).toContain('grid-cols-[112px_minmax(0,1fr)]');
    expect(source).toContain('<Tooltip :title="variableLabel(variable)">');
    expect(source).toContain('testContext?: Record<string, any>');
    expect(source).toContain('function cloneTestContext()');
    expect(source).toContain('JSON.parse(JSON.stringify(props.testContext || {}))');
    expect(source).toContain('const testContext = cloneTestContext();');
    expect(source).toContain('{ immediate: true }');
    expect(source).toContain('if (props.open) resetTestValues();');
    expect(source).toContain("if (value === '') return '\"\"（空字符串）'");
    expect(source).toContain('v-if="hasResult"');
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
