export type BehaviorCaptchaMode =
  | 'CLICK'
  | 'IDIOM_CLICK'
  | 'OBSTACLE_AVOIDANCE'
  | 'SLIDE';

type AnyRecord = Record<string, any>;

const MODE_ALIASES: Record<string, BehaviorCaptchaMode> = {
  CLICK: 'CLICK',
  IDIOMCLICK: 'IDIOM_CLICK',
  IDIOM_CLICK: 'IDIOM_CLICK',
  OBSTACLEAVOIDANCE: 'OBSTACLE_AVOIDANCE',
  OBSTACLE_AVOIDANCE: 'OBSTACLE_AVOIDANCE',
  SLIDE: 'SLIDE',
};

export interface BehaviorCaptchaPoint {
  x: number;
  y: number;
}

export interface BehaviorCaptchaBasePayload {
  height: number;
  kind?: string;
  width: number;
}

export interface BehaviorCaptchaClickPayload extends BehaviorCaptchaBasePayload {
  image: string;
  requiredClicks: number;
  thumb: string;
  thumbHeight: number;
  thumbWidth: number;
  thumbX: number;
  thumbY: number;
}

export interface BehaviorCaptchaPathPayload extends BehaviorCaptchaBasePayload {
  backgroundId?: string;
  ballRadius: number;
  image: string;
  kind: 'path';
  start: BehaviorCaptchaPoint;
  targetIcon: string;
}

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

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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

function serverMode(mode: BehaviorCaptchaMode) {
  return {
    CLICK: 'click',
    IDIOM_CLICK: 'idiomClick',
    OBSTACLE_AVOIDANCE: 'obstacleAvoidance',
    SLIDE: 'slide',
  }[mode];
}

function imageData(value: unknown) {
  const image = String(value || '').trim();
  if (!image) {
    return '';
  }
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`;
}

function normalizePoint(value: unknown, fallbackX = 0, fallbackY = 0): BehaviorCaptchaPoint {
  const source = asRecord(value);
  return {
    x: toNumber(source.x ?? source.left ?? source.cx, fallbackX),
    y: toNumber(source.y ?? source.top ?? source.cy, fallbackY),
  };
}

export function isSupportedBehaviorCaptchaMode(value: unknown) {
  return Boolean(canonicalMode(value));
}

export function isObstacleAvoidancePayload(
  payload: unknown,
): payload is BehaviorCaptchaPathPayload {
  const source = asRecord(payload);
  return (
    source.kind === 'path'
    && typeof source.start === 'object'
  );
}

function normalizeChallengePayload(
  mode: BehaviorCaptchaMode,
  source: AnyRecord,
): BehaviorCaptchaClickPayload | BehaviorCaptchaPathPayload | null {
  const puzzle = {
    ...asRecord(source.publicData),
    ...asRecord(source.payload),
    ...asRecord(source.puzzle),
  };
  const viewport = asRecord(puzzle.viewport);
  const width = Math.max(200, toNumber(viewport.width ?? puzzle.width, 427));
  const height = Math.max(120, toNumber(viewport.height ?? puzzle.height, 240));

  if (mode === 'OBSTACLE_AVOIDANCE') {
    const start = normalizePoint(puzzle.start ?? puzzle.origin, 28, height - 32);
    const image = imageData(puzzle.image || puzzle.masterImage || puzzle.backgroundImage || puzzle.sceneImage);
    if (!image) {
      return null;
    }

    return {
      backgroundId: String(puzzle.backgroundId || puzzle.sceneId || '').trim() || undefined,
      ballRadius: Math.max(6, toNumber(puzzle.ballRadius ?? puzzle.radius, 8)),
      height,
      image,
      kind: 'path',
      start,
      targetIcon: String(puzzle.endIcon || '★'),
      width,
    };
  }

  const image = imageData(puzzle.image || puzzle.masterImage);
  const thumb = imageData(puzzle.thumb || puzzle.thumbImage);
  if (!image || (mode !== 'IDIOM_CLICK' && !thumb)) {
    return null;
  }

  return {
    height,
    image,
    requiredClicks: Math.max(1, toNumber(puzzle.requiredClicks, 4)),
    thumb: mode === 'IDIOM_CLICK' ? '' : thumb,
    thumbHeight: Math.max(24, toNumber(puzzle.thumbHeight, 72)),
    thumbWidth: Math.max(24, toNumber(puzzle.thumbWidth, 72)),
    thumbX: toNumber(puzzle.thumbX, 0),
    thumbY: toNumber(puzzle.thumbY, 0),
    width,
  };
}

/**
 * Normalizes the stable HMI server contract into the shared frontend payload.
 * For click and slide, the answer area stays opaque to the browser. For path
 * puzzles, the browser only receives renderable glyph/layout data plus the
 * public start/end markers used to collect the drag track.
 */
export function normalizeBehaviorCaptchaChallenge(input: unknown) {
  const source = asRecord(input);
  const mode = canonicalMode(source.mode || source.type);
  const challengeId = String(source.challengeId || source.id || '').trim();
  if (!mode || !challengeId) {
    return null;
  }

  const payload = normalizeChallengePayload(mode, source);
  if (!payload) {
    return null;
  }

  return {
    challengeId,
    mode,
    payload,
    prompt: String(source.prompt || source.instruction || source.friendlyMessage || '').trim(),
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
  const points = operations
    .map((operation, index) => {
      const point = {
        t: options.startTime + Math.max(0, Number(operation.t) || index * 200),
        type: String(operation.type || 'click'),
        x: Number(operation.x),
        y: Number(operation.y),
      };
      return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
    })
    .filter((point): point is { t: number; type: string; x: number; y: number } => Boolean(point));
  const submission: BehaviorCaptchaSubmission = {
    answer,
    challengeId: challenge.challengeId,
    data: challenge.challengeId,
    mode: serverMode(challenge.mode),
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
