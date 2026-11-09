import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

const partyField =
  /^(subject|business|presales|aftersales|finance)(OrgId|UserId)$/;

// 普通新增仅录入商务对接方；“新增我的”由服务端确认主体方，不提交其它参与方。
export function createModeFields(
  fields: CrudPageConfig['fields'],
  mine: boolean,
): CrudPageConfig['fields'] {
  return fields.map((field) => {
    if (field.key === 'parentOrgId') return { ...field, formCreate: false };
    if (!partyField.test(field.key)) return field;

    const business =
      field.key === 'businessOrgId' || field.key === 'businessUserId';
    return {
      ...field,
      formCreate: !mine && business,
      required: !mine && business,
    };
  });
}
