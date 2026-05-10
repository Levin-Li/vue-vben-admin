export type FrameworkEventType = string;

export interface FrameworkEvent<Data = any> {
  data: Data;
  topic: string;
  type: FrameworkEventType;
}

export type FrameworkEventListener<Data = any> = (
  type: FrameworkEventType,
  topic: string,
  data: Data,
) => void;

export type FrameworkEventObjectListener<Data = any> = (
  event: FrameworkEvent<Data>,
) => void;

export type UnsubscribeFrameworkEvent = () => void;

export interface FrameworkEventListenerInfo {
  enabled: boolean;
  id: string;
  remark?: string;
  topicPattern: string;
  type: FrameworkEventType;
}

interface ListenerEntry extends FrameworkEventListenerInfo {
  listener: FrameworkEventListener;
  once?: boolean;
}

let listenerSeed = 0;

function escapeRegExp(value: string) {
  return value.replaceAll(/[\\^$+?.()|[\]{}]/g, '\\$&');
}

function createListenerId() {
  listenerSeed += 1;
  return `framework-event-listener-${listenerSeed}`;
}

export function matchFrameworkEventTopic(pattern: string, topic: string) {
  const source = String(pattern || '')
    .split('*')
    .map((part) => part.split('?').map(escapeRegExp).join('.'))
    .join('.*');

  return new RegExp(`^${source}$`).test(String(topic || ''));
}

export class FrameworkEventBus {
  private readonly listenerMap = new Map<
    FrameworkEventType,
    Map<string, ListenerEntry>
  >();

  addListener<Data = any>(
    type: FrameworkEventType,
    topicPattern: string,
    listener: FrameworkEventListener<Data>,
    remark?: string,
  ) {
    const listeners = this.listenerMap.get(type) || new Map();
    const id = createListenerId();
    const entry: ListenerEntry = {
      enabled: true,
      id,
      listener: listener as FrameworkEventListener,
      remark,
      topicPattern,
      type,
    };

    listeners.set(id, entry);
    this.listenerMap.set(type, listeners);

    return id;
  }

  clear(type?: FrameworkEventType) {
    if (type) {
      this.listenerMap.delete(type);
      return;
    }

    this.listenerMap.clear();
  }

  emit<Data = any>(type: FrameworkEventType, topic: string, data: Data) {
    const entries = Array.from(this.listenerMap.get(type)?.values() || []);
    let matchedCount = 0;

    for (const entry of entries) {
      if (!entry.enabled) {
        continue;
      }

      if (!matchFrameworkEventTopic(entry.topicPattern, topic)) {
        continue;
      }

      matchedCount += 1;
      try {
        entry.listener(type, topic, data);
      } catch (error) {
        console.error('Framework event listener error:', error);
      }

      if (entry.once) {
        this.removeListener(entry.id);
      }
    }

    return matchedCount;
  }

  getListeners(): FrameworkEventListenerInfo[] {
    return Array.from(this.listenerMap.values()).flatMap((listeners) =>
      Array.from(listeners.values()).map(
        ({ enabled, id, remark, topicPattern, type }) => ({
          enabled,
          id,
          remark,
          topicPattern,
          type,
        }),
      ),
    );
  }

  off(id: string) {
    return this.removeListener(id);
  }

  on<Data = any>(
    type: FrameworkEventType,
    topicPattern: string,
    listener: FrameworkEventObjectListener<Data>,
    remark?: string,
  ): UnsubscribeFrameworkEvent {
    const id = this.addListener<Data>(
      type,
      topicPattern,
      (eventType, topic, data) => {
        listener({
          data,
          topic,
          type: eventType,
        });
      },
      remark,
    );

    return () => {
      this.removeListener(id);
    };
  }

  once<Data = any>(
    type: FrameworkEventType,
    topicPattern: string,
    listener: FrameworkEventObjectListener<Data>,
    remark?: string,
  ): UnsubscribeFrameworkEvent {
    let unsubscribe: UnsubscribeFrameworkEvent = () => {};
    const id = this.addListener<Data>(
      type,
      topicPattern,
      (eventType, topic, data) => {
        unsubscribe();
        listener({
          data,
          topic,
          type: eventType,
        });
      },
      remark,
    );

    unsubscribe = () => {
      this.removeListener(id);
    };

    return unsubscribe;
  }

  removeListener(id: string) {
    for (const [type, listeners] of this.listenerMap) {
      if (!listeners.delete(id)) {
        continue;
      }

      if (listeners.size === 0) {
        this.listenerMap.delete(type);
      }

      return true;
    }

    return false;
  }

  setListenerEnabled(id: string, enabled: boolean) {
    for (const listeners of this.listenerMap.values()) {
      const entry = listeners.get(id);
      if (!entry) {
        continue;
      }

      entry.enabled = enabled;
      return true;
    }

    return false;
  }
}

export const frameworkEventBus = new FrameworkEventBus();

export function addFrameworkEventListener<Data = any>(
  type: FrameworkEventType,
  topicPattern: string,
  listener: FrameworkEventListener<Data>,
  remark?: string,
) {
  return frameworkEventBus.addListener(type, topicPattern, listener, remark);
}

export function emitFrameworkEvent<Data = any>(
  type: FrameworkEventType,
  topic: string,
  data: Data,
) {
  return frameworkEventBus.emit(type, topic, data);
}

export function getFrameworkEventListeners() {
  return frameworkEventBus.getListeners();
}

export function onFrameworkEvent<Data = any>(
  type: FrameworkEventType,
  topicPattern: string,
  listener: FrameworkEventObjectListener<Data>,
  remark?: string,
) {
  return frameworkEventBus.on(type, topicPattern, listener, remark);
}

export function onceFrameworkEvent<Data = any>(
  type: FrameworkEventType,
  topicPattern: string,
  listener: FrameworkEventObjectListener<Data>,
  remark?: string,
) {
  return frameworkEventBus.once(type, topicPattern, listener, remark);
}

export function removeFrameworkEventListener(id: string) {
  return frameworkEventBus.removeListener(id);
}

export function setFrameworkEventListenerEnabled(id: string, enabled: boolean) {
  return frameworkEventBus.setListenerEnabled(id, enabled);
}
