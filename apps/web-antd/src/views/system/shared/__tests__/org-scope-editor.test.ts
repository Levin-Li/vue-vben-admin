import { mount } from '@vue/test-utils';

import { Modal } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import OrgScopeEditor from '../org-scope-editor.vue';

function mountEditor(props: InstanceType<typeof OrgScopeEditor>['$props']) {
  const modalStub = {
    emits: ['cancel', 'ok'],
    props: ['open', 'title'],
    template:
      '<div v-if="open" data-test="modal"><h2>{{ title }}</h2><slot /><button data-test="modal-ok" @click="$emit(\'ok\')">确定</button></div>',
  };

  return mount(OrgScopeEditor, {
    global: {
      stubs: {
        AModal: modalStub,
        ASelect: {
          props: ['options', 'value'],
          template:
            '<select :value="value" @change="$emit(\'change\', $event.target.value)"><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
        },
        ATreeSelect: {
          props: ['treeData', 'value'],
          template:
            '<div data-test="tree-select"><span v-for="item in treeData" :key="item.value">{{ item.title }}</span></div>',
        },
        Modal: modalStub,
        Teleport: true,
      },
    },
    props,
  });
}

describe('org-scope-editor', () => {
  it('renders a CRUD-style rule list and create action', () => {
    const wrapper = mountEditor({
      orgTree: [{ id: 'org-1', name: '总部' }],
      value: [],
    });

    expect(wrapper.text()).toContain('新增规则');
    expect(wrapper.text()).toContain('组织范围表达式');
    expect(wrapper.text()).toContain('暂无组织范围规则');
  });

  it('opens a create modal with default organization options', async () => {
    const wrapper = mountEditor({
      orgTree: [{ id: 'org-1', name: '总部' }],
      value: [],
    });

    await wrapper.get('[data-test="scope-add-rule"]').trigger('click');

    expect(wrapper.text()).toContain('新增组织范围规则');
    expect(wrapper.text()).toContain('用户默认组织');
    expect(wrapper.text()).toContain('所有根组织');
    expect(wrapper.text()).toContain('访问许可');
    expect(wrapper.text()).toContain('组织范围表达式');
    expect(wrapper.text()).not.toContain('表达式内容');
  });

  it('updates a draft after editing a rule in the modal', async () => {
    const wrapper = mountEditor({
      orgTree: [],
      value: [
        {
          isAllow: true,
          mode: 'advanced',
          orgId: 'org-1',
          orgName: '总部',
          orgScopeExpression: '/org-1/**',
          orgScopeExpressionType: 'IdPath',
          templateKey: 'custom',
          tenantMatchingExpression: '_DEFAULT_TENANT_',
        },
      ],
    });

    await wrapper.get('[data-test="org-edit-org-1"]').trigger('click');
    await wrapper
      .get('[data-test="org-expression-editor"]')
      .setValue('/org-1/direct/*');

    await wrapper.get('[data-test="modal-ok"]').trigger('click');

    const emitted = wrapper.emitted('update:value') as
      | Array<[Array<Record<string, any>>]>
      | undefined;
    expect(emitted?.[0]?.[0]?.[0]).toMatchObject({
      orgId: 'org-1',
      orgScopeExpression: '/org-1/direct/*',
      orgScopeExpressionType: 'IdPath',
      tenantMatchingExpression: '_DEFAULT_TENANT_',
    });
  });

  it('shows tenant matching expression only when enabled', async () => {
    const wrapper = mountEditor({
      orgTree: [],
      showTenantMatchingExpression: true,
      value: [
        {
          isAllow: true,
          mode: 'template',
          orgId: '_USER_ORG_',
          orgScopeExpression: '/**',
          orgScopeExpressionType: 'IdPath',
          templateKey: 'All',
          tenantMatchingExpression: '*',
        },
      ],
    });

    expect(wrapper.text()).toContain('租户匹配表达式');
    expect(wrapper.find('tbody td').text()).toBe('所有租户');
  });

  it('removes a rule after delete confirmation', async () => {
    const confirmSpy = vi
      .spyOn(Modal, 'confirm')
      .mockImplementation((options: any) => {
        options.onOk?.();
        return {
          destroy: vi.fn(),
          update: vi.fn(),
        } as any;
      });

    const wrapper = mountEditor({
      orgTree: [],
      value: [
        {
          isAllow: true,
          mode: 'template',
          orgId: 'org-1',
          orgName: '总部',
          orgScopeExpression: '/org-1/**',
          orgScopeExpressionType: 'IdPath',
          templateKey: 'current-and-children',
          tenantMatchingExpression: '_DEFAULT_TENANT_',
        },
      ],
    });

    await wrapper.get('[data-test="org-remove-org-1"]').trigger('click');

    const emitted = wrapper.emitted('update:value') as
      | Array<[Array<Record<string, any>>]>
      | undefined;

    expect(emitted?.[0]?.[0]).toEqual([]);
    expect(confirmSpy).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
  });
});
