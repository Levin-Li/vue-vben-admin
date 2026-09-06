import { describe, expect, it } from 'vitest';

import {
  buildTenantScriptContext,
  buildOrganizationScriptContext,
  canUseLocalTableColumnSettings,
  findDisplayRuleCycle,
  distributeExtraTableWidth,
  getDefaultVisibleRoleCodes,
  hasDisplayRuleCycle,
  hasServerListHeaderConfig,
  isDisplayGroupVisible,
  isRoleVisibilitySatisfied,
  initializeVisibleRoleCodes,
  initializeFieldHidden,
  initializeHeaderVisibility,
  moveDisplayGroup,
  moveDisplayFieldToGroupEnd,
  releaseDisplayGroupFields,
  resolveDisplayGroupExpandedFieldCount,
  resolveDisplayGroupOrder,
  resolveDefaultTableColumnWidth,
  resolveRuntimeDisplayField,
  resolveRuntimeDisplayHeader,
  sortDisplayGroups,
  resolveDisplayStates,
  resolveDisplaySubmitKeys,
  getDisplaySubmitMode,
  setDisplaySubmitMode,
  reconcileCrudPageDisplayHeaders,
  resolvePageDisplayContextKey,
  resolvePageDisplayViewTitle,
  resolvePageDisplaySettingCode,
  resolveQueryCollapsedRows,
  resolveQueryCollapsedFieldCount,
  shouldAutoQuery,
  shouldAutoForceUpdateField,
  shouldStartQueryGroupOnNewLine,
  shouldShowManualQueryButton,
  shouldUseSingleTextQueryAutoSearch,
  supportsInlineChoiceOptions,
} from '../crud-page-display';

describe('crud page display rules', () => {
  it('treats absent dependencies and exclusions as satisfied', () => {
    expect(
      resolveDisplayStates([
        { key: 'a', visibility: { dependsOn: { fieldKeys: ['missing'] } } },
      ]).a,
    ).toBe('VISIBLE');
    expect(
      resolveDisplayStates([
        { key: 'a', visibility: { exclusiveWith: { fieldKeys: ['missing'] } } },
      ]).a,
    ).toBe('VISIBLE');
  });

  it('detects display-state cycles', () => {
    const fields = [
      { key: 'a', visibility: { dependsOn: { fieldKeys: ['b'] } } },
      { key: 'b', visibility: { exclusiveWith: { fieldKeys: ['a'] } } },
    ];
    expect(hasDisplayRuleCycle(fields)).toBe(true);
    expect(findDisplayRuleCycle(fields)).toEqual(['a', 'b', 'a']);
  });

  it('hides a field when any configured dependency is hidden', () => {
    expect(
      resolveDisplayStates([
        {
          key: 'target',
          visibility: { dependsOn: { fieldKeys: ['first', 'second'] } },
        },
        { key: 'first' },
        { hidden: true, key: 'second' },
      ]).target,
    ).toBe('HIDDEN');
  });

  it('recognizes only non-empty server list headers as column configuration', () => {
    expect(hasServerListHeaderConfig({ version: 1 })).toBe(false);
    expect(
      hasServerListHeaderConfig({
        query: { fields: [] },
        version: 1,
      }),
    ).toBe(false);
    expect(
      hasServerListHeaderConfig({
        list: { headers: [] },
        version: 1,
      }),
    ).toBe(false);
    expect(
      hasServerListHeaderConfig({
        list: { headers: [{ key: 'name' }] },
        version: 1,
      }),
    ).toBe(true);
    expect(canUseLocalTableColumnSettings(undefined, 3)).toBe(true);
    expect(canUseLocalTableColumnSettings({ version: 1 }, 3)).toBe(true);
    expect(
      canUseLocalTableColumnSettings(
        { list: { headers: [{ key: 'name' }] }, version: 1 },
        3,
      ),
    ).toBe(false);
    expect(
      canUseLocalTableColumnSettings(
        { list: { headers: [] }, version: 1 },
        3,
        true,
      ),
    ).toBe(false);
  });

  it('uses the same default widths for list rendering and editable list settings', () => {
    expect(resolveDefaultTableColumnWidth({ key: 'name', label: '名称' })).toBe(
      120,
    );
    expect(
      resolveDefaultTableColumnWidth({
        key: 'createdAt',
        label: '创建时间',
        type: 'datetime',
      }),
    ).toBe(180);
    expect(
      resolveDefaultTableColumnWidth({
        key: 'amount',
        label: '金额',
        valueType: 'number',
      }),
    ).toBe(110);
    expect(
      resolveDefaultTableColumnWidth({
        key: 'code',
        label: '编码',
        width: 260,
      }),
    ).toBe(260);
  });

  it('reuses unchanged list-header records during repeated initialization', () => {
    const fields = [
      { key: 'name', label: '名称', table: true },
      { key: 'remark', label: '备注', table: true },
    ];
    const initial = reconcileCrudPageDisplayHeaders([], fields);
    const repeated = reconcileCrudPageDisplayHeaders(initial, fields);

    expect(repeated).toHaveLength(2);
    expect(repeated[0]).toBe(initial[0]);
    expect(repeated[1]).toBe(initial[1]);
  });

  it('appends the operation column after data fields when the list has row actions', () => {
    const headers = reconcileCrudPageDisplayHeaders(
      [],
      [
        { key: 'name', label: '名称', table: true },
        { key: 'remark', label: '备注', table: true },
      ],
      { includeOperationColumn: true },
    );

    expect(headers.map((header) => header.key)).toEqual([
      'name',
      'remark',
      '__actions',
    ]);
    expect(headers.at(-1)).toMatchObject({
      label: '操作',
      order: 2,
      width: 220,
    });
  });

  it('keeps a hidden operation column configuration so it can be re-enabled', () => {
    const headers = reconcileCrudPageDisplayHeaders(
      [
        {
          key: '__actions',
          title: '处理',
          visible: { mode: 'hidden' },
          width: 260,
        },
      ],
      [{ key: 'name', label: '名称', table: true }],
      { includeOperationColumn: true },
    );

    expect(headers.at(-1)).toMatchObject({
      key: '__actions',
      order: 1,
      title: '处理',
      visible: { mode: 'hidden' },
      width: 260,
    });
  });

  it('restores the operation column default width when its saved width is automatic', () => {
    const headers = reconcileCrudPageDisplayHeaders(
      [{ key: '__actions', width: 'auto' }],
      [{ key: 'name', label: '名称', table: true }],
      { includeOperationColumn: true },
    );

    expect(headers.at(-1)).toMatchObject({
      key: '__actions',
      width: 220,
    });
  });

  it('distributes only extra list width according to minimum-width proportions', () => {
    expect(distributeExtraTableWidth([100, 200, 300], 600)).toEqual([
      100, 200, 300,
    ]);
    expect(distributeExtraTableWidth([100, 200, 300], 1000)).toEqual([
      167, 333, 500,
    ]);
    expect(distributeExtraTableWidth([100, 200, 300], 900)).toEqual([
      150, 300, 450,
    ]);
    expect(distributeExtraTableWidth([100, 200, 300], 480)).toEqual([
      100, 200, 300,
    ]);
  });

  it('normalizes common organization attributes for expression contexts', () => {
    expect(
      buildOrganizationScriptContext({
        orgCode: 'HQ',
        orgId: 'org-1',
        orgName: '总部',
        orgType: 'company',
      }),
    ).toMatchObject({ code: 'HQ', id: 'org-1', name: '总部', type: 'company' });
    expect(
      buildOrganizationScriptContext({
        org: { id: 'dept-1', level: 2, parentId: 'root', path: '/root/dept' },
      }),
    ).toMatchObject({
      id: 'dept-1',
      level: 2,
      parentId: 'root',
      path: '/root/dept',
    });
  });

  it('uses the complete route path as the page display setting code', () => {
    expect(resolvePageDisplaySettingCode('/clob/V1/Address', '/Address')).toBe(
      '/clob/V1/Address',
    );
    expect(resolvePageDisplaySettingCode(undefined, '/Address')).toBe(
      '/Address',
    );
  });

  it('includes user, org category, and org type in the page display context key', () => {
    expect(
      resolvePageDisplayContextKey(
        {
          tenantId: 'tenant-1',
          type: 'Employee',
          category: 'Staff',
          orgCategory: 'Dealer',
          orgType: 'Company',
        },
        'portal.example.com',
      ),
    ).toBe('tenant-1:portal.example.com:Employee:Staff:Dealer:Company');
    expect(
      resolvePageDisplayContextKey(
        {
          tenantId: 'tenant-1',
          userType: 'Employee',
          userCategory: 'Staff',
          orgId: 'org-1',
          org: { type: 'Department' },
        },
        'portal.example.com',
      ),
    ).toBe('tenant-1:portal.example.com:Employee:Staff:org-1:Department');
  });

  it('limits collapsed query fields by configured row count while reserving an action slot', () => {
    expect(resolveQueryCollapsedFieldCount(12, 4, 1)).toBe(3);
    expect(resolveQueryCollapsedFieldCount(12, 4, 2)).toBe(7);
    expect(resolveQueryCollapsedFieldCount(48, 4, 10)).toBe(39);
    expect(resolveQueryCollapsedFieldCount(12, 4, 'all')).toBe(12);
    expect(resolveQueryCollapsedFieldCount(12, 1, 1)).toBe(1);
  });

  it('restores the configured query collapse rows and defaults to one row', () => {
    expect(resolveQueryCollapsedRows({ version: 1 })).toBe(1);
    expect(
      resolveQueryCollapsedRows({
        query: { fields: [], unassignedExpandedRows: 2 },
        version: 1,
      }),
    ).toBe(2);
    expect(
      resolveQueryCollapsedRows({
        query: { fields: [], unassignedExpandedRows: 'all' },
        version: 1,
      }),
    ).toBe('all');
  });

  it('runs changed query fields automatically only after initial data loading', () => {
    expect(shouldAutoQuery(true, true, false)).toBe(true);
    expect(shouldAutoQuery(true, false, false)).toBe(false);
    expect(shouldAutoQuery(true, true, true)).toBe(false);
    expect(shouldAutoQuery(false, true, false)).toBe(false);
  });

  it('hides the manual query button only while automatic querying is enabled', () => {
    expect(shouldShowManualQueryButton(true, false)).toBe(true);
    expect(shouldShowManualQueryButton(true, true)).toBe(false);
    expect(shouldShowManualQueryButton(false, false)).toBe(false);
  });

  it('enables debounced automatic search only for one ordinary text query field', () => {
    expect(
      shouldUseSingleTextQueryAutoSearch(
        [{ key: 'name', label: '名称', search: true }],
        false,
      ),
    ).toBe(true);
    expect(
      shouldUseSingleTextQueryAutoSearch(
        [{ key: 'name', label: '名称', search: true, type: 'text' }],
        false,
      ),
    ).toBe(true);
    expect(
      shouldUseSingleTextQueryAutoSearch(
        [
          { key: 'name', label: '名称', search: true },
          { key: 'code', label: '编码', search: true },
        ],
        false,
      ),
    ).toBe(false);
    expect(
      shouldUseSingleTextQueryAutoSearch(
        [{ key: 'enabled', label: '是否启用', search: true, type: 'switch' }],
        false,
      ),
    ).toBe(false);
    expect(
      shouldUseSingleTextQueryAutoSearch(
        [
          {
            key: 'createdAt',
            label: '创建时间',
            search: true,
            type: 'datetime',
          },
        ],
        false,
      ),
    ).toBe(false);
    expect(
      shouldUseSingleTextQueryAutoSearch(
        [{ key: 'name', label: '名称', search: true }],
        true,
      ),
    ).toBe(false);
  });

  it('enables automatic forced updates unless an edit display configuration disables them', () => {
    expect(shouldAutoForceUpdateField(undefined)).toBe(true);
    expect(shouldAutoForceUpdateField({ version: 1 })).toBe(true);
    expect(
      shouldAutoForceUpdateField({
        edit: { autoForceUpdateField: false, fields: [] },
        version: 1,
      }),
    ).toBe(false);
  });

  it('allows inline options only for boolean, dictionary, enum, and fixed-option fields', () => {
    expect(supportsInlineChoiceOptions({ key: 'kind', type: 'select' })).toBe(
      false,
    );
    expect(
      supportsInlineChoiceOptions({ key: 'enabled', type: 'switch' }),
    ).toBe(true);
    expect(
      supportsInlineChoiceOptions({ key: 'active', valueType: 'boolean' }),
    ).toBe(true);
    expect(supportsInlineChoiceOptions({ key: 'state', options: [] })).toBe(
      true,
    );
    expect(
      supportsInlineChoiceOptions({
        key: 'category',
        loadOptions: Object.assign(async () => [], {
          optionSource: 'enum' as const,
        }),
      }),
    ).toBe(true);
    expect(supportsInlineChoiceOptions({ key: 'name', type: 'text' })).toBe(
      false,
    );
  });

  it('restricts fields only when the current user has none of the configured roles', () => {
    expect(isRoleVisibilitySatisfied(undefined, ['R_USER'])).toBe(true);
    expect(isRoleVisibilitySatisfied([], ['R_USER'])).toBe(true);
    expect(isRoleVisibilitySatisfied(['R_ADMIN'], ['R_USER'])).toBe(false);
    expect(isRoleVisibilitySatisfied(['R_ADMIN', 'R_USER'], ['R_USER'])).toBe(
      true,
    );
  });

  it('preselects role visibility only for tenant and organization ownership fields', () => {
    expect(getDefaultVisibleRoleCodes('tenantId')).toEqual(['R_SA']);
    expect(getDefaultVisibleRoleCodes('orgId')).toEqual([
      'R_ORG_ADMIN',
      'R_SA',
      'R_ADMIN',
      'R_SAAS_ADMIN',
    ]);
    expect(getDefaultVisibleRoleCodes('name')).toEqual([]);
  });

  it('does not overwrite an explicitly saved empty visible-role selection', () => {
    expect(initializeVisibleRoleCodes({ key: 'tenantId' })).toEqual(['R_SA']);
    expect(
      initializeVisibleRoleCodes({ key: 'tenantId', visibleRoleCodes: [] }),
    ).toEqual([]);
  });

  it('hides system identity and metadata fields by default without overriding an explicit display choice', () => {
    expect(initializeFieldHidden({ key: 'id' })).toBe(true);
    expect(initializeFieldHidden({ key: 'editable' })).toBe(true);
    expect(initializeFieldHidden({ key: 'orderCode' })).toBe(true);
    expect(initializeFieldHidden({ key: 'lastUpdateTime' })).toBe(true);
    expect(initializeFieldHidden({ hidden: false, key: 'id' })).toBe(false);
    expect(initializeFieldHidden({ key: 'tenantId' })).toBe(false);
  });

  it('applies the same hidden-by-default rule to list headers unless a value was saved', () => {
    expect(initializeHeaderVisibility({ key: 'lastUpdateTime' })).toEqual({
      mode: 'hidden',
    });
    expect(
      initializeHeaderVisibility({
        key: 'id',
        visible: { mode: 'always' },
      }),
    ).toEqual({ mode: 'always' });
    expect(
      initializeHeaderVisibility({
        key: 'title',
        visible: { expression: 'user.superAdmin' },
      }),
    ).toEqual({ expression: 'user.superAdmin', mode: 'script' });
  });

  it('creates runtime display defaults without mutating the saved configuration', () => {
    const savedField = { key: 'tenantId' };
    const runtimeField = resolveRuntimeDisplayField(savedField);
    const savedHeader = { key: 'lastUpdateTime' };
    const runtimeHeader = resolveRuntimeDisplayHeader(savedHeader);

    expect(runtimeField).toEqual({
      hidden: false,
      inputDisplay: 'default',
      key: 'tenantId',
      visibleRoleCodes: ['R_SA'],
    });
    expect(runtimeField).not.toBe(savedField);
    expect(savedField).toEqual({ key: 'tenantId' });
    expect(runtimeHeader).toEqual({
      key: 'lastUpdateTime',
      visible: { mode: 'hidden' },
      visibleRoleCodes: [],
    });
    expect(runtimeHeader).not.toBe(savedHeader);
    expect(savedHeader).toEqual({ key: 'lastUpdateTime' });
  });

  it('uses independently configured aliases for each display view', () => {
    expect(resolvePageDisplayViewTitle({ label: '查询名称' }, '名称')).toBe(
      '查询名称',
    );
    expect(resolvePageDisplayViewTitle({ label: '新增名称' }, '名称')).toBe(
      '新增名称',
    );
    expect(resolvePageDisplayViewTitle({ label: '   ' }, '名称')).toBe('名称');
  });

  it('builds a safe tenant script context without exposing secret tenant keys', () => {
    expect(
      buildTenantScriptContext(
        {
          appSecret: 'secret',
          domain: 'tenant.example.com',
          encryptKey: 'encrypt',
          logo: '/tenant-logo.png',
          name: '租户站点',
          siteInfo: {
            logo: '/site-logo.png',
            mainImg: '/hero.png',
            title: '站点标题',
          },
          sysName: '平台名称',
          tenantId: 'tenant-1',
        },
        {
          tenantCode: 'TENANT-CODE',
          tenantId: 'tenant-1',
          tenantName: '默认租户',
        },
      ),
    ).toEqual({
      code: 'TENANT-CODE',
      copyright: undefined,
      domain: 'tenant.example.com',
      id: 'tenant-1',
      logo: '/site-logo.png',
      mainImg: '/hero.png',
      name: '租户站点',
      shortcutIcon: undefined,
      siteInfo: {
        copyright: undefined,
        logo: '/site-logo.png',
        mainImg: '/hero.png',
        shortcutIcon: undefined,
        techSupport: undefined,
        title: '站点标题',
        titleImg: undefined,
      },
      sysLogo: undefined,
      sysName: '平台名称',
      techSupport: undefined,
      tenantId: 'tenant-1',
      title: '站点标题',
      titleImg: undefined,
    });
  });

  it('orders groups and returns deleted-group fields to the unassigned state', () => {
    const primary = { key: 'primary', order: 0 };
    const secondary = { key: 'secondary', order: 1 };
    const fields = [
      { key: 'first', layoutGroup: 'primary' },
      { key: 'second', layoutGroup: 'secondary' },
    ];

    expect(moveDisplayGroup([primary, secondary], secondary, -1)).toBe(true);
    expect(
      sortDisplayGroups([primary, secondary]).map((group) => group.key),
    ).toEqual(['secondary', 'primary']);

    releaseDisplayGroupFields(fields, 'primary');
    expect(fields).toEqual([
      { key: 'first', layoutGroup: undefined },
      { key: 'second', layoutGroup: 'secondary' },
    ]);
  });

  it('places fields from lower-numbered groups before unassigned fields', () => {
    const groups = [
      { key: 'later', order: 1 },
      { key: 'first', order: 0 },
    ];
    expect(resolveDisplayGroupOrder(groups, 'first')).toBe(0);
    expect(resolveDisplayGroupOrder(groups, 'later')).toBe(1);
    expect(resolveDisplayGroupOrder(groups, undefined)).toBe(2);
    expect(resolveDisplayGroupOrder(groups, 'removed')).toBe(2);
    expect(resolveDisplayGroupOrder(groups, undefined, 0)).toBe(0);
  });

  it('starts each named query group from a new grid row without drawing chrome', () => {
    expect(shouldStartQueryGroupOnNewLine(undefined, undefined)).toBe(false);
    expect(shouldStartQueryGroupOnNewLine('basic', undefined)).toBe(true);
    expect(shouldStartQueryGroupOnNewLine('basic', 'basic')).toBe(false);
    expect(shouldStartQueryGroupOnNewLine('advanced', 'basic')).toBe(true);
  });

  it('moves a field to the last position of its newly selected group', () => {
    const first = { key: 'first', layoutGroup: 'basic', order: 0 };
    const second = { key: 'second', layoutGroup: 'basic', order: 1 };
    const moving = { key: 'moving', order: 0 };
    const fields = [first, second, moving];

    moveDisplayFieldToGroupEnd(fields, moving, 'basic');
    expect(moving).toEqual({ key: 'moving', layoutGroup: 'basic', order: 2 });
  });

  it('limits default expanded group fields by row count and shows all on demand', () => {
    expect(resolveDisplayGroupExpandedFieldCount(12, 4, 1)).toBe(4);
    expect(resolveDisplayGroupExpandedFieldCount(12, 4, 2)).toBe(8);
    expect(resolveDisplayGroupExpandedFieldCount(12, 4, 0)).toBe(0);
    expect(resolveDisplayGroupExpandedFieldCount(12, 4, 'all')).toBe(12);
  });
});


describe('字段展示提交四状态', () => {
  it('原隐藏布尔保持不提交，显式隐藏提交不进入展示集合', () => {
    const fields = [
      { key: 'shown' },
      { key: 'omitted', hidden: true },
      { key: 'defaulted', hidden: true, submitWhenHidden: true },
    ];
    expect(resolveDisplayStates(fields)).toEqual({ shown: 'VISIBLE', omitted: 'HIDDEN', defaulted: 'HIDDEN' });
    expect([...resolveDisplaySubmitKeys(fields)]).toEqual(['shown', 'defaulted']);
  });
  it('隐藏提交不能绕过显示脚本、依赖和互斥条件', () => {
    const fields = [
      { key: 'shown' },
      { key: 'hidden', hidden: true },
      { key: 'expression', hidden: true, submitWhenHidden: true },
      { key: 'dependent', hidden: true, submitWhenHidden: true, visibility: { dependsOn: { fieldKeys: ['hidden'] } } },
      { key: 'exclusive', hidden: true, submitWhenHidden: true, visibility: { exclusiveWith: { fieldKeys: ['shown'] } } },
    ];
    expect([...resolveDisplaySubmitKeys(fields, { expression: false })]).toEqual(['shown']);
  });
  it('横向四选项可以切换并通过配置保存回显', () => {
    const field = { key: 'priority' };
    for (const mode of ['display-submit', 'hidden-submit', 'disabled-submit', 'hidden-omit'] as const) {
      setDisplaySubmitMode(field, mode);
      expect(getDisplaySubmitMode(JSON.parse(JSON.stringify(field)))).toBe(mode);
    }
  });
});


describe('显示依赖尊重权限及场景排除', () => {
  it('隐藏提交的依赖字段被角色排除时不提交', () => {
    const fields = [
      { key: 'private' },
      { key: 'defaulted', hidden: true, submitWhenHidden: true, visibility: { dependsOn: { fieldKeys: ['private'] } } },
    ];
    expect([...resolveDisplaySubmitKeys(fields, {}, new Set(['private']))]).toEqual([]);
  });
  it('已知字段被场景移除不按未知依赖放行，排除字段也不能自行隐藏提交', () => {
    const fields = [
      { key: 'defaulted', hidden: true, submitWhenHidden: true, visibility: { dependsOn: { fieldKeys: ['createOnly'] } } },
      { key: 'denied', hidden: true, submitWhenHidden: true },
    ];
    expect([...resolveDisplaySubmitKeys(fields, {}, new Set(['createOnly', 'denied']))]).toEqual([]);
  });
});

describe('分组可见条件', () => {
  it('要求角色和展示脚本同时满足', () => {
    const group = { key: 'advanced', visibleRoleCodes: ['R_ADMIN'] };

    expect(isDisplayGroupVisible(group, true, ['R_ADMIN'])).toBe(true);
    expect(isDisplayGroupVisible(group, false, ['R_ADMIN'])).toBe(false);
    expect(isDisplayGroupVisible(group, true, ['R_USER'])).toBe(false);
  });

  it('未设置可见角色时只依赖展示脚本结果', () => {
    expect(isDisplayGroupVisible({ key: 'basic' }, true, [])).toBe(true);
    expect(isDisplayGroupVisible({ key: 'basic' }, false, ['R_SA'])).toBe(
      false,
    );
  });
});


it('UI 禁提保持可见和提交资格，并不能覆盖权限排除', () => {
  const fields = [{ key: 'priority', disabled: true }];
  expect(resolveDisplayStates(fields).priority).toBe('VISIBLE');
  expect([...resolveDisplaySubmitKeys(fields)]).toEqual(['priority']);
  expect([...resolveDisplaySubmitKeys(fields, {}, new Set(['priority']))]).toEqual([]);
});
