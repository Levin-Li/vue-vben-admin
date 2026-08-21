import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { BehaviorCaptcha, normalizeBehaviorCaptchaChallenge } from '../index';

describe('BehaviorCaptcha public export', () => {
  it('can be imported from the admin-framework package root without auth-local paths', async () => {
    const challenge = normalizeBehaviorCaptchaChallenge({
      challengeId: 'public-export-1',
      mode: 'CLICK',
      publicData: {
        image:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
        thumb:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==',
      },
    });

    expect(challenge).toBeTruthy();

    const wrapper = mount(BehaviorCaptcha as any, {
      props: {
        challenge,
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="captcha-mode-CLICK"]').exists()).toBe(
      true,
    );
  });
});
