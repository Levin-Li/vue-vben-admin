import { describe, expect, it } from 'vitest';

import { shouldShowCrudFormField } from '../crud-form-field-visibility';
import { isSuperAdminUser } from '../user-identity';

const editableField = {
  key: 'editable',
  label: '是否可编辑',
  type: 'switch' as const,
};

describe('crud form field visibility', () => {
  it('shows editable in create forms for normal users', () => {
    expect(
      shouldShowCrudFormField(editableField, 'create', {
        username: 'normal-user',
      }),
    ).toBe(true);
  });

  it('hides editable in edit forms for non-super admins', () => {
    expect(
      shouldShowCrudFormField(editableField, 'edit', {
        username: 'normal-user',
      }),
    ).toBe(false);
  });

  it('shows editable in edit forms for super admins', () => {
    expect(
      shouldShowCrudFormField(editableField, 'edit', {
        superAdmin: true,
      }),
    ).toBe(true);
  });

  it('hides super-admin-only form fields in create forms for normal users', () => {
    expect(
      shouldShowCrudFormField(
        {
          formVisibleForSuperAdmin: true,
          key: 'assignPreCondition',
          label: '角色分配前置条件',
          type: 'textarea',
        },
        'create',
        { username: 'normal-user' },
      ),
    ).toBe(false);
  });

  it('shows super-admin-only form fields in create and edit forms for super admins', () => {
    const field = {
      formVisibleForSuperAdmin: true,
      key: 'assignPreCondition',
      label: '角色分配前置条件',
      type: 'textarea' as const,
    };

    expect(shouldShowCrudFormField(field, 'create', { superAdmin: true })).toBe(
      true,
    );
    expect(shouldShowCrudFormField(field, 'edit', { superAdmin: true })).toBe(
      true,
    );
  });

  it('recognizes super admins from role identity values', () => {
    expect(
      isSuperAdminUser({
        roleList: [{ code: 'R_SA' }],
      }),
    ).toBe(true);
  });

  it('keeps non-editable fields controlled by normal form mode flags', () => {
    expect(
      shouldShowCrudFormField(
        {
          formEdit: false,
          key: 'enable',
          label: '是否启用',
          type: 'switch',
        },
        'edit',
        { superAdmin: true },
      ),
    ).toBe(false);
  });
});
