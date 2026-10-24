import { describe, expect, it } from 'vitest';

import { withLegalSubjectStatus } from '../legal-subject-status';

describe('法律主体待完善展示', () => {
  it('只在没有主体关联的详情响应补充状态文案', () => {
    const record = {
      id: 'customer-1',
      legalSubjectId: null,
      legalSubjectName: null,
    };
    expect(withLegalSubjectStatus(record)).toEqual({
      ...record,
      legalSubjectStatus: '待完善',
    });
    expect(record.legalSubjectName).toBeNull();
    expect(withLegalSubjectStatus({ data: record })).toEqual({
      data: { ...record, legalSubjectStatus: '待完善' },
    });
    const linked = { legalSubjectId: 'subject-1', legalSubjectName: '甲公司' };
    expect(withLegalSubjectStatus(linked)).toEqual({
      ...linked,
      legalSubjectStatus: '已关联',
    });
    expect(withLegalSubjectStatus({ id: 'hidden' })).toEqual({
      id: 'hidden',
      legalSubjectStatus: '状态不可见',
    });
  });
});
