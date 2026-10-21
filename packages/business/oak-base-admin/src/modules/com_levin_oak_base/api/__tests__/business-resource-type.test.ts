import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { customerService } from '../customer-service';
import { legalSubjectService } from '../legal-subject-service';

// 页面接口的资源类型须与 Biz 控制器一致，字段策略才能定位已注册接口。
describe('业务主档接口资源类型', () => {
  it.each([
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
  ])('$type 的服务和方法使用相同资源类型', ({ service, type, actions }) => {
    expect(getServiceMeta(service).type).toBe(type);

    for (const action of actions) {
      const method = (service as any)[action];
      expect(getResAuthorizeMeta(method).type, action).toBe(type);
    }
  });
});
