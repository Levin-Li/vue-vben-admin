import { describe, expect, it, vi } from 'vitest';

import { getCrudOrgLoadApi } from '../crud-org-selector';

describe('公共 CRUD 组织选择器适配', () => {
  it('无页面候选时交给通用选择器加载当前授权组织', () => {
    expect(
      getCrudOrgLoadApi({
        key: 'orgId',
        label: '所属组织',
        type: 'org-tree-select',
      }),
    ).toBeUndefined();
  });

  it('保留页面显式远程候选和固定树候选的优先级', async () => {
    const options = [
      {
        label: '组织甲',
        value: 'org-a',
        children: [{ label: '组织乙', value: 'org-b' }],
      },
    ];
    const loadOptions = vi.fn(async () => options);
    const remote = getCrudOrgLoadApi({
      key: 'orgId',
      label: '所属组织',
      type: 'org-tree-select',
      loadOptions,
      options: [],
    });
    const staticLoader = getCrudOrgLoadApi({
      key: 'orgId',
      label: '所属组织',
      type: 'org-tree-select',
      options,
    });

    expect(await remote?.({} as never)).toEqual(options);
    expect(loadOptions).toHaveBeenCalledWith('');
    expect(await staticLoader?.({} as never)).toEqual(options);
  });
});
