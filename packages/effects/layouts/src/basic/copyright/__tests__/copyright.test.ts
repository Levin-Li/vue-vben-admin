import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Copyright from '../copyright.vue';

describe('Copyright', () => {
  it('does not fill empty copyright fields with third-party defaults', () => {
    const wrapper = mount(Copyright);

    expect(wrapper.text()).not.toContain('Vben');
    expect(wrapper.text()).not.toContain('2024');
    expect(wrapper.findAll('a')).toHaveLength(0);
  });

  it('renders explicitly provided copyright fields', () => {
    const wrapper = mount(Copyright, {
      props: {
        companyName: 'Levin',
        companySiteLink: 'https://example.com',
        date: '2026',
        icp: 'ICP 123',
        icpLink: 'https://beian.miit.gov.cn',
      },
    });

    expect(wrapper.text()).toContain('Copyright © 2026 Levin');
    expect(wrapper.get('a[href="https://example.com"]').text()).toBe('Levin');
    expect(
      wrapper.get('a[href="https://beian.miit.gov.cn"]').text(),
    ).toBe('ICP 123');
  });
});
