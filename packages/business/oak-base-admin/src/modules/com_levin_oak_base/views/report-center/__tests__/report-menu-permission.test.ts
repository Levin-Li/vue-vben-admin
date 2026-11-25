import { describe, expect, it } from 'vitest';

import { isGeneratedReportMenuPath } from '../report-menu-permission';

describe('报表菜单权限策略', () => {
  it('仅识别服务端生成的具体报表菜单路径', () => {
    expect(isGeneratedReportMenuPath('/clob/V1/ReportView/0123456789abcdef0123456789abcdef')).toBe(true);
    for (const path of ['/clob/V1/ReportView', '/clob/V1/ReportView/other', '/clob/V1/ReportView/0123456789abcdef0123456789abcdef/extra'])
      expect(isGeneratedReportMenuPath(path)).toBe(false);
  });
});
