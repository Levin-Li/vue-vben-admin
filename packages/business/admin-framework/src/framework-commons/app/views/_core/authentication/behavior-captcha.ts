export type BehaviorCaptchaMode = 'CLICK' | 'OBSTACLE_AVOIDANCE' | 'SLIDE';

type AnyRecord = Record<string, any>;

const MODE_ALIASES: Record<string, BehaviorCaptchaMode> = {
  CLICK: 'CLICK',
  OBSTACLE_AVOIDANCE: 'OBSTACLE_AVOIDANCE',
  SLIDE: 'SLIDE',
};

const MODE_INSTRUCTIONS: Record<BehaviorCaptchaMode, string> = {
  CLICK: '请按缩略图中的顺序完成点选。',
  OBSTACLE_AVOIDANCE: '当前障碍躲避验证暂未开放。',
  SLIDE: '请拖动滑块，使图块对齐缺口。',
};

export interface BehaviorCaptchaChallenge {
  challengeId: string;
  mode: BehaviorCaptchaMode;
  payload: AnyRecord;
  prompt: string;
  title?: string;
}

export interface BehaviorCaptchaSubmission {
  answer: unknown;
  challengeId: string;
  data: string;
  mode: BehaviorCaptchaMode;
  operations: Array<Record<string, any>>;
  startTime: number;
  stopTime: number;
  track: {
    completedAt: number;
    durationMs: number;
    points: Array<Record<string, any>>;
    startedAt: number;
  };
  trackList: Array<Record<string, any>>;
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? { ...(value as AnyRecord) } : {};
}

function canonicalMode(value: unknown) {
  return MODE_ALIASES[
    String(value || '')
      .trim()
      .replaceAll('-', '_')
      .replaceAll(' ', '_')
      .toUpperCase()
  ];
}

function imageData(value: unknown) {
  const image = String(value || '').trim();
  if (!image) {
    return '';
  }
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`;
}

export function getBehaviorCaptchaInstruction(mode?: BehaviorCaptchaMode | null) {
  return mode ? MODE_INSTRUCTIONS[mode] : '请完成当前行为验证。';
}

export function isSupportedBehaviorCaptchaMode(value: unknown) {
  return Boolean(canonicalMode(value));
}

/**
 * Normalizes the GoCaptcha Click-compatible server contract. The image pair is
 * deliberately opaque to the browser: target rectangles remain server-only.
 */
export function normalizeBehaviorCaptchaChallenge(input: unknown) {
  const source = asRecord(input);
  const mode = canonicalMode(source.mode || source.type);
  const challengeId = String(source.challengeId || source.id || '').trim();
  if (!mode || !challengeId) {
    return null;
  }

  const puzzle = {
    ...asRecord(source.publicData),
    ...asRecord(source.payload),
    ...asRecord(source.puzzle),
  };
  const viewport = asRecord(puzzle.viewport);
  const image = imageData(puzzle.image || puzzle.masterImage);
  const thumb = imageData(puzzle.thumb || puzzle.thumbImage);
  if (!image || !thumb) {
    return null;
  }

  return {
    challengeId,
    mode,
    payload: {
      height: Number(viewport.height || puzzle.height) || 240,
      image,
      requiredClicks: Number(puzzle.requiredClicks) || 4,
      thumb,
      thumbHeight: Number(puzzle.thumbHeight) || 72,
      thumbWidth: Number(puzzle.thumbWidth) || 72,
      thumbX: Number(puzzle.thumbX) || 0,
      thumbY: Number(puzzle.thumbY) || 0,
      width: Number(viewport.width || puzzle.width) || 427,
    },
    prompt:
      String(source.prompt || source.instruction || source.friendlyMessage || '').trim() ||
      getBehaviorCaptchaInstruction(mode),
    title: String(source.title || source.label || '').trim() || undefined,
  } satisfies BehaviorCaptchaChallenge;
}

export function encodeBehaviorCaptchaResult(
  challenge: BehaviorCaptchaChallenge,
  answer: unknown,
  operations: Array<Record<string, any>>,
  options: {
    startTime: number;
    stopTime?: number;
  },
) {
  const stopTime = options.stopTime || Date.now();
  const points = operations.map((operation, index) => ({
    t: options.startTime + Math.max(0, Number(operation.t) || index * 200),
    type: String(operation.type || 'click'),
    x: Number(operation.x),
    y: Number(operation.y),
  }));
  const submission: BehaviorCaptchaSubmission = {
    answer,
    challengeId: challenge.challengeId,
    data: challenge.challengeId,
    mode: challenge.mode,
    operations,
    startTime: options.startTime,
    stopTime,
    track: {
      completedAt: stopTime,
      durationMs: Math.max(0, stopTime - options.startTime),
      points,
      startedAt: options.startTime,
    },
    trackList: operations,
  };

  return JSON.stringify(submission);
}
