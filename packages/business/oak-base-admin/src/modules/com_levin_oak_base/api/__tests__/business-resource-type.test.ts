import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { customerService } from '../customer-service';
import { electronicContractService } from '../electronic-contract-service';
import { electronicContractTemplateService } from '../electronic-contract-template-service';
import { importExportTemplateService } from '../import-export-template-service';
import { legalSubjectService } from '../legal-subject-service';
import { orgService } from '../org-service';

// 页面接口的资源类型须与 Biz 控制器一致，字段策略才能定位已注册接口。
describe('页面接口资源类型', () => {
  it.each([
    {
      service: orgService,
      type: '系统数据-组织机构',
      actions: ['create', 'delete', 'list', 'retrieve', 'update'],
    },
    {
      service: customerService,
      type: '业务数据-客户',
      actions: ['create', 'list', 'retrieve', 'update'],
    },
    {
      service: legalSubjectService,
      type: '业务数据-法律主体',
      actions: [
        'approveCertification',
        'create',
        'delete',
        'list',
        'rejectCertification',
        'retrieve',
        'revokeCertification',
        'submitCertification',
        'update',
      ],
    },
    {
      service: electronicContractService,
      type: '业务数据-电子合同',
      actions: ['create', 'list', 'retrieve', 'update'],
    },
    {
      service: electronicContractTemplateService,
      type: '业务数据-电子合同模板',
      actions: ['create', 'list', 'retrieve', 'update'],
    },
    {
      service: importExportTemplateService,
      type: '业务数据-导入导出模板',
      actions: ['create', 'list', 'retrieve', 'update'],
    },
  ])('$type 的服务和方法使用相同资源类型', ({ service, type, actions }) => {
    expect(getServiceMeta(service).type).toBe(type);

    for (const action of actions) {
      const method = (service as any)[action];
      expect(getResAuthorizeMeta(method).type, action).toBe(type);
    }
  });

  it('电子合同模板动作与业务控制器的授权身份一致', () => {
    const actions = {
      archive: '归档合同模板',
      create: '创建电子合同模板草稿',
      delete: '电子合同模板删除入口已关闭',
      list: '查询列表',
      publish: '上线合同模板',
      retrieve: '查看详情',
      update: '更新电子合同模板',
      uploadTemplateDocx: '上传受控 DOCX 电子合同模板',
    } as const;
    for (const [method, action] of Object.entries(actions)) {
      expect(
        getResAuthorizeMeta((electronicContractTemplateService as any)[method])
          .action,
        method,
      ).toBe(action);
    }
  });
});
