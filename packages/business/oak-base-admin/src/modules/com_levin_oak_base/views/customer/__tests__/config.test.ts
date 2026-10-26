import { describe, expect, it, vi } from 'vitest';

import { customerPageCrudConfig } from '../config';

const { optionLoaderCalls, orgOptions, optionSearchTerms } = vi.hoisted(() => ({
  optionLoaderCalls: [] as any[],
  orgOptions: [] as any[],
  optionSearchTerms: [] as string[],
}));

vi.mock('../../../api/customer-service', () => ({ customerService: {} }));
vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  buildModuleOptionsLoader: (...args: any[]) => {
    optionLoaderCalls.push(args);
    return async (keyword?: string) => {
      if (args[0] === '/Org/list') {
        optionSearchTerms.push(keyword ?? '');
        return orgOptions;
      }
      return [];
    };
  },
  confidentialLevelOptionsLoader: async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('独立客户页面', () => {
  it('使用客户业务保存接口并独立维护联系人和运营字段', () => {
    const field = (key: string) =>
      customerPageCrudConfig.fields.find((item) => item.key === key);

    expect(customerPageCrudConfig.apiBase).toBe('/Customer');
    expect(customerPageCrudConfig.allowDelete).toBe(false);
    expect(customerPageCrudConfig.createPath).toBe('/Customer/saveCustomer');
    expect(customerPageCrudConfig.updatePath).toBe('/Customer/updateCustomer');
    expect(field('legalSubjectId')).toMatchObject({
      type: 'select',
    });
    expect(field('legalSubjectId')?.required).not.toBe(true);
    expect(field('legalSubjectId')?.disabledOnEdit).not.toBe(true);
    expect(field('legalSubjectName')).toMatchObject({
      form: false,
      table: true,
    });
    expect(field('type')).toMatchObject({ disabledOnEdit: true });
    expect(field('orgId')).toMatchObject({
      label: '新客户组织的内部父级',
      formCreate: true,
      formEdit: false,
      type: 'select',
    });
    expect(field('orgName')).toMatchObject({
      label: '客户组织节点',
      formCreate: false,
      formEdit: true,
      disabledOnEdit: true,
    });
    expect(field('orgId')?.required).not.toBe(true);
    expect(field('ownerId')).toBeUndefined();
    expect(optionLoaderCalls).toContainEqual([
      '/Org/list',
      'name',
      'id',
      {
        pageIndex: 1,
        pageSize: 500,
        inType: ['Company', 'Branch', 'Department', 'Team', 'Group', 'TempOrg'],
      },
      'containsName',
    ]);
    expect(field('channelPartnerId')).toMatchObject({ disabledOnEdit: true });
    expect(field('channelPartnerName')).toMatchObject({
      form: false,
      table: true,
    });
    for (const key of [
      'contactName',
      'contactPhone',
      'contactEmail',
      'level',
      'industries',
      'confidentialLevel',
      'groupName',
      'investmentRelation',
      'expiredTime',
    ]) {
      expect(field(key), key).toBeDefined();
    }
    expect(field('contactName')?.complexGroupKey).toBeUndefined();
    expect(field('subjectName')).toBeUndefined();
    expect(field('subCategory')).toBeUndefined();
  });

  it('无论是否选择内部父级都要求客户名称', () => {
    const nameField = customerPageCrudConfig.fields.find(
      (item) => item.key === 'customerName',
    );
    expect(nameField).toMatchObject({
      formCreate: true,
      formEdit: false,
      required: true,
    });
    expect(nameField?.validator?.('', {})).toBe(
      '自动创建客户组织时请输入客户名称',
    );
    expect(nameField?.validator?.('甲客户', {})).toBeUndefined();
    expect(nameField?.validator?.('   ', {})).toBe(
      '自动创建客户组织时请输入客户名称',
    );
    expect(nameField?.validator?.('', { orgId: 'internal-org' })).toBe(
      '自动创建客户组织时请输入客户名称',
    );
  });

  it('内部父级选项保留远程搜索，并排除外部节点', async () => {
    orgOptions.splice(
      0,
      orgOptions.length,
      { label: '总部', value: 'internal-1', type: 'Company' },
      { label: '其他客户', value: 'external-1', type: 'Customer' },
    );
    const field = customerPageCrudConfig.fields.find(
      (item) => item.key === 'orgId',
    );
    expect(await field?.loadOptions?.('总部')).toEqual([
      { label: '内部父组织 · 总部', value: 'internal-1', type: 'Company' },
    ]);
    expect(optionSearchTerms).toContain('总部');
    orgOptions.length = 0;
  });

  it('渠道客户要求渠道伙伴，直接客户提交时移除该关联', async () => {
    const channelField = customerPageCrudConfig.fields.find(
      (item) => item.key === 'channelPartnerId',
    );
    expect(
      channelField?.validator?.(undefined, { type: 'ChannelCustomer' }),
    ).toBe('渠道客户请选择渠道伙伴');
    expect(
      channelField?.validator?.('partner-1', { type: 'ChannelCustomer' }),
    ).toBeUndefined();
    expect(
      channelField?.validator?.(undefined, { type: 'DirectCustomer' }),
    ).toBeUndefined();
    expect(
      await customerPageCrudConfig.transformSubmit?.(
        { type: 'DirectCustomer', channelPartnerId: 'partner-1' },
        null,
      ),
    ).toEqual({ type: 'DirectCustomer' });
    expect(
      await customerPageCrudConfig.transformSubmit?.(
        { type: 'ChannelCustomer', channelPartnerId: 'partner-1' },
        null,
      ),
    ).toEqual({ type: 'ChannelCustomer', channelPartnerId: 'partner-1' });
  });
});
