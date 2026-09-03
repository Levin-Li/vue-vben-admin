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
    expect(
      canUseLocalTableColumnSettings({ version: 1 }, 3),
    ).toBe(true);
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
    expect(resolveDefaultTableColumnWidth({ key: 'name', label: '名称' })).toBe(120);
    expect(resolveDefaultTableColumnWidth({ key: 'createdAt', label: '创建时间', type: 'datetime' })).toBe(180);
    expect(resolveDefaultTableColumnWidth({ key: 'amount', label: '金额', valueType: 'number' })).toBe(110);
    expect(resolveDefaultTableColumnWidth({ key: 'code', label: '编码', width: 260 })).toBe(260);
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

  it('distributes only extra list width according to minimum-width proportions', () => {
    expect(distributeExtraTableWidth([100, 200, 300], 600)).toEqual([100, 200, 300]);
    expect(distributeExtraTableWidth([100, 200, 300], 1000)).toEqual([167, 333, 500]);
    expect(distributeExtraTableWidth([100, 200, 300], 900)).toEqual([150, 300, 450]);
    expect(distributeExtraTableWidth([100, 200, 300], 480)).toEqual([100, 200, 300]);
  });

  it('normalizes common organization attributes for expression contexts', () => {
    expect(buildOrganizationScriptContext({
      orgCode: 'HQ',
      orgId: 'org-1',
      orgName: '总部',
      orgType: 'company',
    })).toMatchObject({ code: 'HQ', id: 'org-1', name: '总部', type: 'company' });
    expect(buildOrganizationScriptContext({
      org: { id: 'dept-1', level: 2, parentId: 'root', path: '/root/dept' },
    })).toMatchObject({ id: 'dept-1', level: 2, parentId: 'root', path: '/root/dept' });
  });

  it('uses the complete route path as the page display setting code', () => {
    expect(
      resolvePageDisplaySettingCode('/clob/V1/Address', '/Address'),
    ).toBe('/clob/V1/Address');
    expect(resolvePageDisplaySettingCode(undefined, '/Address')).toBe(
      '/Address',
    );
  });

  it('includes user, org category, and org type in the page display context key', () => {
    expect(resolvePageDisplayContextKey({
      tenantId: 'tenant-1',
      type: 'Employee',
      category: 'Staff',
      orgCategory: 'Dealer',
      orgType: 'Company',
    }, 'portal.example.com')).toBe('tenant-1:portal.example.com:Employee:Staff:Dealer:Company');
    expect(resolvePageDisplayContextKey({
      tenantId: 'tenant-1',
      userType: 'Employee',
      userCategory: 'Staff',
      orgId: 'org-1',
      org: { type: 'Department' },
    }, 'portal.example.com')).toBe('tenant-1:portal.example.com:Employee:Staff:org-1:Department');
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
    expect(resolveQueryCollapsedRows({
      query: { fields: [], unassignedExpandedRows: 2 },
      version: 1,
    })).toBe(2);
    expect(resolveQueryCollapsedRows({
      query: { fields: [], unassignedExpandedRows: 'all' },
      version: 1,
    })).toBe('all');
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
    expect(supportsInlineChoiceOptions({ key: 'kind', type: 'select' })).toBe(false);
    expect(supportsInlineChoiceOptions({ key: 'enabled', type: 'switch' })).toBe(true);
    expect(supportsInlineChoiceOptions({ key: 'active', valueType: 'boolean' })).toBe(true);
    expect(supportsInlineChoiceOptions({ key: 'state', options: [] })).toBe(true);
    expect(supportsInlineChoiceOptions({
      key: 'category',
      loadOptions: Object.assign(async () => [], { optionSource: 'enum' as const }),
    })).toBe(true);
    expect(supportsInlineChoiceOptions({ key: 'name', type: 'text' })).toBe(false);
  });

  it('restricts fields only when the current user has none of the configured roles', () => {
    expect(isRoleVisibilitySatisfied(undefined, ['R_USER'])).toBe(true);
    expect(isRoleVisibilitySatisfied([], ['R_USER'])).toBe(true);
    expect(isRoleVisibilitySatisfied(['R_ADMIN'], ['R_USER'])).toBe(false);
    expect(isRoleVisibilitySatisfied(['R_ADMIN', 'R_USER'], ['R_USER'])).toBe(true);
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
    expect(
      resolvePageDisplayViewTitle({ label: '   ' }, '名称'),
    ).toBe('名称');
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
    expect(sortDisplayGroups([primary, secondary]).map((group) => group.key)).toEqual([
      'secondary',
      'primary',
    ]);

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
