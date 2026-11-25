import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';
import type { PartyOwnershipDescriptor } from '@levin/admin-framework/framework-commons/shared/party-ownership-types';

function group(key: string, label: string): PartyOwnershipDescriptor {
  return { key, label, orgLabel: `${label}组织`, userLabel: `${label}人员`, orgField: `${key}OrgId`, userField: `${key}UserId` };
}
export const partnerOwnershipGroups = [group('subject', '主体方'), group('business', '商务'), group('presales', '售前'), group('aftersales', '售后'), group('finance', '财务')];
export const legalSubjectOwnershipGroups = [group('subject', '主体方'), group('business', '商务')];
export const settlementOwnershipGroups = [group('payee', '收款方'), group('business', '商务'), group('finance', '财务')];
export function ownershipSelectorFields(groups: PartyOwnershipDescriptor[]) {
  return groups.flatMap((item) => [
    { field: item.orgField, orgField: item.orgField, userField: item.userField },
    { field: item.userField, orgField: item.orgField, userField: item.userField },
  ]);
}
export function ownershipFieldsReadOnlyOnEdit(fields: CrudFieldConfig[], groups: PartyOwnershipDescriptor[]) {
  const names = new Set(groups.flatMap((item) => [item.orgField, item.userField]));
  return fields.map((field) => names.has(field.key) ? { ...field, formEdit: false } : field);
}
