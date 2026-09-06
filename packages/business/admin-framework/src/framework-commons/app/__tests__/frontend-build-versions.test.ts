import { beforeEach, describe, expect, it } from 'vitest';

import { configureAdminApplication } from '../options';
import { getFrontendBuildInfo } from '../frontend-build-versions';

describe('frontend build versions', () => {
  beforeEach(() => {
    configureAdminApplication({ modules: [] });
  });

  it('lists the current application and enabled frontend modules', () => {
    configureAdminApplication({
      modules: [
        { name: 'com.example.report', title: '报表模块', version: '1.2.3' },
        { name: 'com.example.crm', title: '客户模块', version: '2.0.0' },
      ],
    });

    expect(
      getFrontendBuildInfo('运营后台', '5.6.9', {
        buildTime: '2026-09-07 10:00:00',
        dependencies: { vue: '3.5.0' },
        devDependencies: { vite: '7.0.0' },
      }),
    ).toEqual({
      buildTime: '2026-09-07 10:00:00',
      versions: [
        {
          category: '应用',
          id: 'application',
          name: '运营后台',
          version: '5.6.9',
        },
        {
          category: '已启用模块',
          id: 'com.example.report',
          name: '报表模块',
          version: '1.2.3',
        },
        {
          category: '已启用模块',
          id: 'com.example.crm',
          name: '客户模块',
          version: '2.0.0',
        },
        { category: '运行依赖', id: 'vue', name: 'vue', version: '3.5.0' },
        { category: '构建依赖', id: 'vite', name: 'vite', version: '7.0.0' },
      ],
    });
  });

  it('marks missing versions explicitly', () => {
    configureAdminApplication({
      modules: [{ name: 'com.example.legacy', title: '旧模块' }],
    });

    expect(getFrontendBuildInfo('', '', {})).toEqual({
      buildTime: '开发模式',
      versions: [
        {
          category: '应用',
          id: 'application',
          name: '当前应用',
          version: '未声明',
        },
        {
          category: '已启用模块',
          id: 'com.example.legacy',
          name: '旧模块',
          version: '未声明',
        },
      ],
    });
  });
});
