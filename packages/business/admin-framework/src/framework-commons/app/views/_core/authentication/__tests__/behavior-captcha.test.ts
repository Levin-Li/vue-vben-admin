import { Click as GoCaptchaClick, Slide as GoCaptchaSlide } from 'go-captcha-vue';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import {
  isObstacleAvoidancePayload,
  normalizeBehaviorCaptchaChallenge,
  type BehaviorCaptchaChallenge,
  type BehaviorCaptchaMode,
} from '../behavior-captcha';
// @ts-ignore Vite resolves Vue SFC imports for Vitest at runtime in this package.
import BehaviorCaptcha from '../behavior-captcha.vue';

const componentSource = readFileSync(
  'packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/behavior-captcha.vue',
  'utf8',
);

const masterImage =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z';
const thumbImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9LwAAAABJRU5ErkJggg==';

function challenge(
  mode: BehaviorCaptchaMode,
  payload: Record<string, unknown> = {},
): BehaviorCaptchaChallenge {
  return {
    challengeId: `challenge-${mode}`,
    mode,
    payload: {
      height: 360,
      image: masterImage,
      thumb: thumbImage,
      width: 640,
      ...payload,
    },
    prompt: `prompt-${mode}`,
    title: `title-${mode}`,
  };
}

function pathChallenge() {
  return challenge('OBSTACLE_AVOIDANCE', {
    ballRadius: 14,
    image: masterImage,
    kind: 'path',
    start: { x: 24, y: 150 },
    width: 320,
    height: 180,
  });
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

function setStageRect(wrapper: ReturnType<typeof mount>) {
  const element = wrapper.get('[data-test="behavior-captcha-path-stage"]').element as HTMLElement;
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: 180,
      height: 180,
      left: 0,
      right: 320,
      top: 0,
      width: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function dispatchPointer(type: string, clientX: number, clientY: number) {
  window.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    }),
  );
}

describe('BehaviorCaptcha', () => {
  it.each<BehaviorCaptchaMode>(['CLICK', 'IDIOM_CLICK'])
    ('uses GoCaptcha Vue Click and submits %s coordinates', (mode) => {
      const submittedMode = mode === 'CLICK' ? 'click' : 'idiomClick';
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
        mode: submittedMode,
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

  it('submits the four idiom characters in the click order', () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: {
        challenge: challenge('IDIOM_CLICK', { requiredClicks: 4 }),
      },
    });
    const events = clickEvents(wrapper);
    events.click(48, 52);
    events.click(156, 78);
    events.click(248, 126);
    events.click(332, 164);

    const [verifyCode] = wrapper.emitted('complete')?.at(-1) || [];
    expect(JSON.parse(String(verifyCode))).toMatchObject({
      answer: {
        points: [
          { x: 48, y: 52 },
          { x: 156, y: 78 },
          { x: 248, y: 126 },
          { x: 332, y: 164 },
        ],
      },
      mode: 'idiomClick',
    });
    wrapper.unmount();
  });

  it('renders only the public start marker for an obstacle-avoidance image', () => {
    const wrapper = mount(BehaviorCaptcha, { props: { challenge: pathChallenge() } });

    expect(wrapper.findAll('[data-test="behavior-captcha-path-obstacle"]')).toHaveLength(0);
    expect(wrapper.get('[data-test="behavior-captcha-path-start"]').text()).toContain('起');
    expect(wrapper.find('[data-test="behavior-captcha-path-target"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('tracks the drag path and submits only the user trajectory for server-side obstacle validation', async () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: pathChallenge() },
      attachTo: document.body,
    });
    setStageRect(wrapper);

    await wrapper.get('[data-test="behavior-captcha-path-ball"]').trigger('pointerdown', {
      button: 0,
      clientX: 24,
      clientY: 150,
      pointerId: 7,
    });
    dispatchPointer('pointermove', 74, 150);
    dispatchPointer('pointermove', 156, 162);
    dispatchPointer('pointermove', 248, 122);
    await nextTick();

    const track = wrapper.get('[data-test="behavior-captcha-path-track"]');
    expect(track.attributes('points')).toContain('24,150');
    expect(track.attributes('points')).toContain('248,122');

    dispatchPointer('pointerup', 296, 32);
    await nextTick();

    const [verifyCode] = wrapper.emitted('complete')?.at(-1) || [];
    expect(JSON.parse(String(verifyCode))).toMatchObject({
      answer: {
        path: expect.arrayContaining([{ x: 24, y: 150 }, { x: 296, y: 32 }]),
        start: { x: 24, y: 150 },
      },
      mode: 'obstacleAvoidance',
      track: {
        points: expect.arrayContaining([
          expect.objectContaining({ type: 'down', x: 24, y: 150 }),
          expect.objectContaining({ type: 'up', x: 296, y: 32 }),
        ]),
      },
    });
    wrapper.unmount();
  });

  it('submits an off-target path for server-side validation without exposing the target coordinate', async () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: pathChallenge() },
      attachTo: document.body,
    });
    setStageRect(wrapper);

    await wrapper.get('[data-test="behavior-captcha-path-ball"]').trigger('pointerdown', {
      button: 0,
      clientX: 24,
      clientY: 150,
    });
    dispatchPointer('pointermove', 92, 138);
    dispatchPointer('pointerup', 140, 120);
    await nextTick();

    expect(wrapper.emitted('complete')).toHaveLength(1);
    wrapper.unmount();
  });

  it('keeps obstacle-avoidance drag coordinates inside the visible image bounds', async () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: { challenge: pathChallenge() },
      attachTo: document.body,
    });
    setStageRect(wrapper);

    await wrapper.get('[data-test="behavior-captcha-path-ball"]').trigger('pointerdown', {
      button: 0,
      clientX: 24,
      clientY: 150,
      pointerId: 7,
    });
    dispatchPointer('pointermove', -20, 220);
    await nextTick();

    expect(wrapper.get('[data-test="behavior-captcha-path-track"]').attributes('points')).toContain(
      '14,166',
    );
    wrapper.unmount();
  });

  it('keeps the enlarged thumbnail only for ordinary click captcha', () => {
    expect(componentSource).toMatch(
      /captcha-mode-CLICK'\] \.go-captcha \.gc-header\)[\s\S]*?height:\s*56px;/,
    );
    expect(componentSource).toMatch(
      /captcha-mode-IDIOM_CLICK'\] \.go-captcha \.gc-header\)[\s\S]*?height:\s*56px;/,
    );
    expect(componentSource).toMatch(
      /captcha-mode-CLICK'\] \.go-captcha \.gc-header img\)[\s\S]*?max-height:\s*56px;/,
    );
    expect(componentSource).not.toMatch(
      /captcha-mode-IDIOM_CLICK'\] \.go-captcha \.gc-header img/,
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

  it('removes the third-party captcha card border without changing its controls', () => {
    expect(componentSource).toMatch(
      /:deep\(\.go-captcha\.gc-theme\)\s*\{\s*border:\s*0;/,
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

  it.each(['SMS_CONFIRM', 'SMS_UP'])
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
    ['idiomClick', 'IDIOM_CLICK'],
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
      payload: {
        image: masterImage,
        thumb: mode === 'idiomClick' ? '' : thumbImage,
      },
    });
  });

  it('normalizes the obstacleAvoidance server contract without retaining private geometry', () => {
    const normalized = normalizeBehaviorCaptchaChallenge({
      challengeId: 'server-obstacle',
      instruction: '拖动白球绕开障碍',
      mode: 'obstacleAvoidance',
      puzzle: {
        backgroundId: 'bg-01-park',
        ballRadius: 15,
        image: masterImage,
        start: { x: 24, y: 150 },
        viewport: { height: 180, width: 320 },
      },
    });

    expect(normalized).toMatchObject({
      mode: 'OBSTACLE_AVOIDANCE',
      payload: {
        backgroundId: 'bg-01-park',
        ballRadius: 15,
        kind: 'path',
        start: { x: 24, y: 150 },
      },
    });
    expect(isObstacleAvoidancePayload(normalized?.payload)).toBe(true);
    if (!isObstacleAvoidancePayload(normalized?.payload)) {
      throw new Error('expected obstacle avoidance payload');
    }
    expect(normalized.payload).not.toHaveProperty('obstacles');
  });

  it('normalizes idiom click with an empty answer thumbnail and semantic instruction', () => {
    expect(
      normalizeBehaviorCaptchaChallenge({
        challengeId: 'server-idiom',
        instruction: '请按语义顺序点击文字',
        mode: 'idiomClick',
        puzzle: {
          image: masterImage,
          requiredClicks: 4,
          thumb: '',
          viewport: { height: 180, width: 320 },
        },
      }),
    ).toMatchObject({
      mode: 'IDIOM_CLICK',
      payload: {
        image: masterImage,
        requiredClicks: 4,
        thumb: '',
      },
      prompt: '请按语义顺序点击文字',
    });
  });

  it('renders an idiom challenge with no answer thumbnail while retaining its operation instruction', () => {
    const wrapper = mount(BehaviorCaptcha, {
      props: {
        challenge: {
          ...challenge('IDIOM_CLICK', { requiredClicks: 4, thumb: '' }),
          prompt: '请按语义顺序点击文字',
        },
      },
    });

    expect(wrapper.findComponent(GoCaptchaClick).exists()).toBe(true);
    expect(wrapper.getComponent(GoCaptchaClick).props('config')).toMatchObject({
      title: '',
    });
    expect(wrapper.find('.gc-header img').exists()).toBe(false);
    wrapper.unmount();
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
      mode: 'slide',
      track: { points: expect.any(Array) },
    });
    wrapper.unmount();
  });

  it('does not accept an ordinary click challenge that lacks its required thumbnail', () => {
    expect(
      normalizeBehaviorCaptchaChallenge({
        challengeId: 'missing-thumb',
        mode: 'textClick',
        puzzle: { image: masterImage },
      }),
    ).toBeNull();
  });
});
