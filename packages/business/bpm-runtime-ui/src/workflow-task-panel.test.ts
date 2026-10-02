import { shallowMount } from '@vue/test-utils';

import { BehaviorCaptcha } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import WorkflowTaskPanel from './workflow-task-panel.vue';

// 行为测试保留真实v-model与点击，仅替换外观组件。
const actionStubs = {
  ...Object.fromEntries(
    [
      'a-card',
      'a-descriptions',
      'a-descriptions-item',
      'a-form',
      'a-form-item',
      'a-space',
      'a-tag',
      'a-divider',
      'a-empty',
      'a-timeline',
      'a-timeline-item',
      'a-list',
      'a-list-item',
      'a-list-item-meta',
    ].map((name) => [name, { template: '<div><slot /></div>' }]),
  ),
  'a-alert': { props: ['message'], template: '<div>{{ message }}</div>' },
  'a-button': {
    props: ['disabled'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'a-input': {
    props: ['value'],
    template:
      '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-input-number': { template: '<input />' },
  'a-textarea': {
    props: ['value'],
    template:
      '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-select': {
    name: 'TestSelect',
    props: ['value', 'options'],
    template:
      '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option value=""/><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  },
};

describe('workflowTaskPanel', () => {
  it('人机挑战复用公共控件并透传其验证结果', async () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 'hmi-task',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
          verificationTypes: ['Hmi'],
        },
      },
      global: { stubs: actionStubs },
    });
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '通过')
      ?.trigger('click');
    await wrapper.find('select').setValue('Hmi');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '获取人机挑战')
      ?.trigger('click');
    const contextVersion = (
      wrapper.emitted('prepareVerification')?.at(-1)?.[0] as {
        contextVersion: number;
      }
    ).contextVersion;
    await wrapper.setProps({
      verificationChallenge: {
        taskId: 'hmi-task',
        contextVersion,
        verificationType: 'Hmi',
        successful: true,
        interactionData: {
          mode: 'click',
          challengeId: 'h1',
          instruction: '点击目标',
          puzzle: {
            width: 427,
            height: 240,
            image: 'data:image/jpeg;base64,/9j/AA==',
            thumb: 'data:image/png;base64,iVBORw0KGgo=',
            requiredClicks: 1,
          },
        },
      },
    });
    const captcha = wrapper.findComponent(BehaviorCaptcha);
    expect(captcha.exists()).toBe(true);
    captcha.vm.$emit('complete', '{"challengeId":"h1"}');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '确认通过')
      ?.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      verificationCode: '{"challengeId":"h1"}',
      verificationType: 'Hmi',
    });
    await wrapper.setProps({
      verificationChallenge: {
        taskId: 'hmi-task',
        contextVersion,
        verificationType: 'Hmi',
        successful: true,
        interactionData: {
          mode: 'click',
          challengeId: 'h2',
          puzzle: { image: 'https://invalid.test/pixel', thumb: 'AA==' },
        },
      },
    });
    expect(wrapper.findComponent(BehaviorCaptcha).exists()).toBe(false);
    await wrapper.setProps({
      verificationChallenge: {
        taskId: 'hmi-task',
        contextVersion,
        verificationType: 'Hmi',
        successful: true,
        interactionData: {
          mode: 'idiomClick',
          challengeId: 'h3',
          puzzle: { image: 'data:image/jpeg;base64,/9j/AA==', thumb: '' },
        },
      },
    });
    expect(wrapper.findComponent(BehaviorCaptcha).exists()).toBe(true);
  });

  it('图形挑战只显示本地 GIF，输入改变后旧码不能提交', async () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 't1',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
          verificationTypes: ['Captcha'],
        },
      },
      global: { stubs: actionStubs },
    });
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '通过')
      ?.trigger('click');
    await wrapper.find('select').setValue('Captcha');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '获取验证码')
      ?.trigger('click');
    const contextVersion = (
      wrapper.emitted('prepareVerification')?.at(-1)?.[0] as {
        contextVersion: number;
      }
    ).contextVersion;
    await wrapper.setProps({
      verificationChallenge: {
        taskId: 't1',
        contextVersion,
        verificationType: 'Captcha',
        successful: true,
        interactionData: 'R0lGODlhAQABAIAAAAUEBA==',
      },
    });
    expect(wrapper.get('img[alt="图形验证码"]').attributes('src')).toBe(
      'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
    );
    await wrapper
      .findAll('input')
      .find((item) => item.attributes('autocomplete') === 'one-time-code')
      ?.setValue('1234');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '确认通过')
      ?.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      verificationCode: '1234',
      verificationType: 'Captcha',
    });
    const submitCount = wrapper.emitted('submit')?.length;
    await wrapper.find('textarea').setValue('改动意见');
    expect(wrapper.find('img[alt="图形验证码"]').exists()).toBe(false);
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '确认通过')
      ?.trigger('click');
    expect(wrapper.emitted('submit')).toHaveLength(submitCount ?? 0);
  });

  it('拒绝远程图片和不匹配类型的挑战', async () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 't1',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
          verificationTypes: ['Captcha'],
        },
      },
      global: { stubs: actionStubs },
    });
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '通过')
      ?.trigger('click');
    await wrapper.find('select').setValue('Captcha');
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '获取验证码')
      ?.trigger('click');
    const contextVersion = (
      wrapper.emitted('prepareVerification')?.at(-1)?.[0] as {
        contextVersion: number;
      }
    ).contextVersion;
    await wrapper.setProps({
      verificationChallenge: {
        taskId: 't1',
        contextVersion,
        verificationType: 'Captcha',
        successful: true,
        interactionData: 'https://invalid.test/pixel',
      },
    });
    expect(wrapper.find('img[alt="图形验证码"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('验证挑战格式不受支持');
    await wrapper.setProps({
      verificationChallenge: {
        taskId: 't1',
        contextVersion,
        verificationType: 'Hmi',
        successful: true,
        interactionData: {},
      },
    });
    expect(wrapper.text()).not.toContain('验证挑战格式不受支持');
  });

  it('二次验证展示译名，准备验证仍传服务端枚举值', async () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 't1',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
          verificationTypes: ['Sms', 'Email'],
        },
      },
      global: { stubs: actionStubs },
    });

    // 运行任务只从服务端给定的验证方式选择，不改变动作请求协议。
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '通过')
      ?.trigger('click');
    const select = wrapper
      .findAll('select')
      .find((item) => item.text().includes('短信验证码'));
    expect(
      select
        ?.findAll('option')
        .map((option) => [option.text(), option.attributes('value')]),
    ).toEqual([
      ['', ''],
      ['短信验证码', 'Sms'],
      ['邮箱验证码', 'Email'],
    ]);
    await select?.setValue('Sms');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '获取验证码')
      ?.trigger('click');
    expect(wrapper.emitted('prepareVerification')?.at(-1)?.[0]).toMatchObject({
      verificationType: 'Sms',
    });
  });

  it('没有服务端动作时不补造通过按钮', () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: { task: { taskId: 't1', status: 'Todo' } },
      global: { stubs: actionStubs },
    });
    expect(wrapper.text()).toContain('当前没有可执行的授权动作');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('私有附件上传只提交文件与当前任务，办理及验证均引用待绑定 ID', async () => {
    const attachment = {
      id: 'private-1',
      fileName: '核定依据.txt',
      mimeType: 'text/plain',
      sizeBytes: 7,
      contentSha256: 'digest',
      attached: false,
    };
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 'task-1',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
        },
        attachments: [attachment],
        canUploadAttachment: true,
      },
      global: { stubs: actionStubs },
    });
    const file = new File(['private'], 'fresh.txt', { type: 'text/plain' });
    const input = wrapper.find<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    });
    await input.trigger('change');
    expect(wrapper.emitted('uploadAttachment')?.[0]).toEqual([file]);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '通过')
      ?.trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认通过')
      ?.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      attachmentIds: ['private-1'],
      formData: {},
    });
  });

  it('待绑定附件可撤销，已绑定历史附件不可撤销', async () => {
    const pending = {
      id: 'pending-1',
      fileName: '错误文件.txt',
      mimeType: 'text/plain',
      sizeBytes: 3,
      contentSha256: 'digest',
      attached: false,
    };
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: { taskId: 'task-1', status: 'Todo' },
        attachments: [pending, { ...pending, id: 'bound-1', attached: true }],
        canDeletePendingAttachment: true,
      },
      global: {
        stubs: {
          ...actionStubs,
          'a-list': {
            props: ['dataSource'],
            template:
              '<div><slot v-for="item in dataSource" name="renderItem" :item="item" /></div>',
          },
        },
      },
    });
    const remove = wrapper
      .findAll('button')
      .filter((button) => button.text() === '撤销上传');
    expect(remove).toHaveLength(1);
    await remove[0]?.trigger('click');
    expect(wrapper.emitted('deletePendingAttachment')?.[0]).toEqual([pending]);
  });

  it('转办必须选择授权目标并填写意见后才提交独立动作参数', async () => {
    const action = {
      code: 'transfer',
      label: '转办',
      requiresComment: true,
      candidateUsers: [{ label: '审批员', value: 'u1' }],
    };
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: { task: { taskId: 't1', status: 'Todo', actions: [action] } },
      global: { stubs: actionStubs },
    });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '转办')
      ?.trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认转办')
      ?.trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('请选择允许的处理人');
    await wrapper.find('textarea').setValue('请专业人员处理');
    await wrapper.find('select').setValue('u1');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认转办')
      ?.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      action,
      comment: '请专业人员处理',
      targetUserId: 'u1',
      formData: {},
    });
  });

  it('切换任务清除动作与表单，未知参数能力显示原因', async () => {
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          taskId: 't1',
          status: 'Todo',
          actions: [{ code: 'approve', label: '通过' }],
        },
      },
      global: { stubs: actionStubs },
    });
    await wrapper.find('button').trigger('click');
    await wrapper.find('textarea').setValue('上一对象意见');
    await wrapper.setProps({
      task: {
        taskId: 't2',
        status: 'Todo',
        actions: [{ code: 'transfer', label: '转办' }],
      },
    });
    expect(wrapper.text()).toContain('服务端未提供可选处理人');
    expect(wrapper.findAll('button')).toHaveLength(0);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('renders the pending task and prevents a selected action from bypassing required fields', async () => {
    // 组件只展示服务端声明的节点字段；即使选择了动作，缺少必填项也不得发出 submit 事件。
    const wrapper = shallowMount(WorkflowTaskPanel, {
      props: {
        task: {
          actions: [{ code: 'approve', label: '通过' }],
          businessTitle: '费用报销 #1001',
          processInstanceId: 'process-1',
          requiredFields: ['reason'],
          status: 'Todo',
          taskDefinitionKey: 'approve',
          taskId: 'task-1',
          taskName: '费用审批',
        },
      },
      global: {
        stubs: {
          'a-alert': {
            props: ['message'],
            template: '<div class="alert">{{ message }}</div>',
          },
          'a-button': {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
          'a-card': {
            props: ['title'],
            template:
              '<section>{{ title }}<slot /><slot name="extra" /></section>',
          },
          'a-descriptions': { template: '<dl><slot /></dl>' },
          'a-descriptions-item': { template: '<dt><slot /></dt>' },
          'a-divider': { template: '<hr />' },
          'a-empty': { template: '<div><slot /></div>' },
          'a-form': { template: '<form><slot /></form>' },
          'a-form-item': {
            props: ['label'],
            template: '<label>{{ label }}<slot /></label>',
          },
          'a-input': { template: '<input />' },
          'a-input-number': { template: '<input type="number" />' },
          'a-list': { template: '<ul><slot /></ul>' },
          'a-list-item': { template: '<li><slot /></li>' },
          'a-list-item-meta': {
            template: '<div><slot /><slot name="title" /></div>',
          },
          'a-select': { template: '<select />' },
          'a-space': { template: '<div><slot /></div>' },
          'a-tag': { template: '<span><slot /></span>' },
          'a-textarea': { template: '<textarea />' },
          'a-timeline': { template: '<ol><slot /></ol>' },
          'a-timeline-item': { template: '<li><slot /></li>' },
        },
      },
    });

    expect(wrapper.text()).toContain('费用报销 #1001');
    expect(wrapper.text()).toContain('待处理');
    expect(wrapper.text()).toContain('请填写节点要求的表单字段后再提交。');

    const approve = wrapper
      .findAll('button')
      .find((button) => button.text() === '通过');
    await approve?.trigger('click');
    expect(wrapper.emitted('action')?.at(-1)).toEqual([
      { code: 'approve', label: '通过' },
    ]);

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text() === '确认通过');
    await confirm?.trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
