import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
  'utf8',
);

function getToolbarButtonBlock(label: string) {
  const buttonStart = source.indexOf(`aria-label="${label}"`);
  const nextTooltip = source.indexOf('<Tooltip', buttonStart + 1);

  return source.slice(buttonStart, nextTooltip);
}

describe('crud toolbar import/export icons', () => {
  it('uses an outbound icon for export and an inbound icon for import', () => {
    expect(getToolbarButtonBlock('导出')).toContain('icon="lucide:upload"');
    expect(getToolbarButtonBlock('导入')).toContain('icon="lucide:download"');
  });

  it('uses the icon slot for loading toolbar buttons', () => {
    expect(getToolbarButtonBlock('导出')).toMatch(
      /<template #icon>\s*<IconifyIcon class="size-4" icon="lucide:upload"/,
    );
    expect(getToolbarButtonBlock('刷新')).toMatch(
      /<template #icon>\s*<IconifyIcon class="size-4" icon="lucide:refresh-cw"/,
    );
  });
});
