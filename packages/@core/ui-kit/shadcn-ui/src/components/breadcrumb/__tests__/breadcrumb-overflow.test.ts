import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const breadcrumbListPath =
  'packages/@core/ui-kit/shadcn-ui/src/ui/breadcrumb/BreadcrumbList.vue';
const breadcrumbPath =
  'packages/@core/ui-kit/shadcn-ui/src/components/breadcrumb/breadcrumb.vue';
const breadcrumbBackgroundPath =
  'packages/@core/ui-kit/shadcn-ui/src/components/breadcrumb/breadcrumb-background.vue';

describe('面包屑溢出显示', () => {
  it('普通样式保持单行并隐藏溢出内容', () => {
    const breadcrumbList = readFileSync(breadcrumbListPath, 'utf8');
    const breadcrumb = readFileSync(breadcrumbPath, 'utf8');

    expect(breadcrumbList).toContain('flex-nowrap');
    expect(breadcrumbList).toContain('overflow-hidden');
    expect(breadcrumbList).toContain('whitespace-nowrap');
    expect(breadcrumbList).not.toContain('flex-wrap');
    expect(breadcrumb).toContain('min-w-0 overflow-hidden whitespace-nowrap');
  });

  it('背景样式保持单行并隐藏溢出内容', () => {
    const breadcrumbBackground = readFileSync(breadcrumbBackgroundPath, 'utf8');

    expect(breadcrumbBackground).toContain(
      'flex min-w-0 max-w-full flex-nowrap overflow-hidden whitespace-nowrap',
    );
    expect(breadcrumbBackground).toContain(
      'min-w-0 overflow-hidden whitespace-nowrap',
    );
  });
});
