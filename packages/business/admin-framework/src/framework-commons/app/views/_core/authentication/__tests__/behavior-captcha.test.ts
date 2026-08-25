import { Click as GoCaptchaClick, Slide as GoCaptchaSlide } from 'go-captcha-vue';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  normalizeBehaviorCaptchaChallenge,
  type BehaviorCaptchaChallenge,
  type BehaviorCaptchaMode,
} from '../behavior-captcha';
import BehaviorCaptcha from '../behavior-captcha.vue';

const componentSource = readFileSync(
  'packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/behavior-captcha.vue',
  'utf8',
);

const masterImage =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z';
const thumbImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==';

function challenge(mode: BehaviorCaptchaMode): BehaviorCaptchaChallenge {
  return {
    challengeId: `challenge-${mode}`,
    mode,
    payload: {
      height: 360,
      image: masterImage,
      thumb: thumbImage,
      width: 640,
    },
    prompt: `prompt-${mode}`,
    title: `title-${mode}`,
  };
}

function clickEvents(wrapper: ReturnType<typeof mount>) {
  return wrapper.getComponent(GoCaptchaClick).props('events') as {
    click: (x: number, y: number) => void;
    confirm: (
      dots: Array<{ index: number; key: number; x: number; y: number }>,
      reset: () => void,
    ) => boolean;
    refresh: () => void;
  };
}

describe('BehaviorCaptcha', () => {
  it.each<BehaviorCaptchaMode>(['CLICK'])
    ('uses GoCaptcha Vue Click and submits %s coordinates', (mode) => {
      const wrapper = mount(BehaviorCaptcha, {
        props: { challenge: challenge(mode) },
      });
      const events = clickEvents(wrapper);
      events.click(80, 60);
      events.click(220, 120);
      expect(
        events.confirm(
          [
            { index: 1, key: 1, x: 80, y: 60 },
            { index: 2, key: 2, x: 220, y: 120 },
          ],
          vi.fn(),
        ),
      ).toBe(true);

      const [verifyCode] = wrapper.emitted('complete')?.at(-1) || [];
      expect(JSON.parse(String(verifyCode))).toMatchObject({
        answer: { points: [{ x: 80, y: 60 }, { x: 220, y: 120 }] },
        challengeId: `challenge-${mode}`,
        mode,
        track: { points: expect.any(Array) },
      });
      wrapper.unmount();
    });

  it('delegates refresh to GoCaptcha Vue', () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: challenge('CLICK') },
    });
    clickEvents(wrapper).refresh();
    expect(wrapper.emitted('refresh')).toHaveLength(1);
    wrapper.unmount();
  });

  it('removes the third-party captcha card border without changing its controls', () => {
    expect(componentSource).toMatch(
      /:deep\(\.go-captcha\.gc-theme\)\s*\{\s*border:\s*0;/,
    );
  });

  it('centers the third-party loading indicator within the captcha image area', () => {
    expect(componentSource).toMatch(
      /:deep\(\.go-captcha \.gc-body \.gc-body-inner\)[\s\S]*?width:\s*100%;/,
    );
    expect(componentSource).toMatch(
      /:deep\(\.go-captcha \.gc-body \.gc-loading\)[\s\S]*?inset:\s*0;[\s\S]*?margin:\s*0;/,
    );
  });

  it('keeps enough header space for the enlarged click-order thumbnail', () => {
    expect(componentSource).toMatch(
      /captcha-mode-CLICK'\] \.go-captcha \.gc-header\)[\s\S]*?height:\s*56px;/,
    );
    expect(componentSource).toMatch(
      /captcha-mode-CLICK'\] \.go-captcha \.gc-header img\)[\s\S]*?max-height:\s*56px;/,
    );
  });

  it('shows a circular loading indicator until a captcha challenge is ready', () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: null, loading: true },
    });

    expect(wrapper.find('[data-test="behavior-captcha-loading"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).not.toContain('当前行为验证码类型暂不支持');
    wrapper.unmount();
  });

  it('overlays the loading indicator on an existing captcha instead of adding a sibling column', () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: challenge('CLICK'), loading: true },
    });

    expect(wrapper.get('[data-test="behavior-captcha-loading"]').classes()).toEqual(
      expect.arrayContaining(['absolute', 'inset-0']),
    );
    expect(wrapper.findComponent(GoCaptchaClick).exists()).toBe(true);
    wrapper.unmount();
  });

  it.each(['SMS_CONFIRM', 'SMS_UP', 'obstacleAvoidance'])
    ('rejects disabled HMI mode %s', (mode) => {
      expect(
        normalizeBehaviorCaptchaChallenge({
          challengeId: 'disabled-mode',
          mode,
          puzzle: { image: masterImage, thumb: thumbImage },
        }),
      ).toBeNull();
    });

  it.each([
    ['click', 'CLICK'],
    ['slide', 'SLIDE'],
  ] as const)('normalizes server mode %s to %s', (mode, expectedMode) => {
    expect(
      normalizeBehaviorCaptchaChallenge({
        challengeId: `server-${mode}`,
        instruction: '按提示顺序点击',
        mode,
        puzzle: {
          image: masterImage,
          thumb: thumbImage,
          viewport: { height: 180, width: 320 },
        },
      }),
    ).toMatchObject({
      mode: expectedMode,
      payload: { image: masterImage, thumb: thumbImage },
    });
  });

  it('submits the GoCaptcha Slide final coordinate instead of click points', () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: challenge('SLIDE') },
    });
    const events = wrapper.getComponent(GoCaptchaSlide).props('events') as {
      confirm: (point: { x: number; y: number }, reset: () => void) => boolean;
      move: (x: number, y: number) => void;
    };
    events.move(80, 90);
    expect(events.confirm({ x: 180, y: 90 }, vi.fn())).toBe(true);
    const [verifyCode] = wrapper.emitted('complete')?.at(-1) || [];
    expect(JSON.parse(String(verifyCode))).toMatchObject({
      answer: { x: 180, y: 90 },
      mode: 'SLIDE',
      track: { points: expect.any(Array) },
    });
    wrapper.unmount();
  });

  it('does not accept a server challenge that lacks either image', () => {
    expect(
      normalizeBehaviorCaptchaChallenge({
        challengeId: 'missing-thumb',
        mode: 'textClick',
        puzzle: { image: masterImage },
      }),
    ).toBeNull();
  });
});
