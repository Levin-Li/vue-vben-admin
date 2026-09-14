import { computed, ref } from 'vue';

function normalizeIds(value: unknown) {
  const source = Array.isArray(value) ? value : [value];
  return [
    ...new Set(source.map((item) => String(item ?? '').trim()).filter(Boolean)),
  ];
}

const selectedDomainIdsRef = ref<string[]>([]);
const multipleRef = ref(false);
const revisionRef = ref(0);
const listeners = new Set<(ids: string[]) => void>();

export const currentGlobalDomainIds = computed(
  () => selectedDomainIdsRef.value,
);
export const currentGlobalDomainId = computed(
  () => selectedDomainIdsRef.value[0],
);
export const globalDomainContextMultiple = computed(() => multipleRef.value);
export const globalDomainContextRevision = computed(() => revisionRef.value);

export function setCurrentGlobalDomainIds(value: unknown, multiple = false) {
  const ids = normalizeIds(value);
  const next = multiple ? ids : ids.slice(0, 1);
  if (
    multipleRef.value === multiple &&
    next.join('\u0000') === selectedDomainIdsRef.value.join('\u0000')
  )
    return false;
  multipleRef.value = multiple;
  selectedDomainIdsRef.value = next;
  revisionRef.value += 1;
  listeners.forEach((listener) => listener(next));
  return true;
}

export function setCurrentGlobalDomainId(value: unknown) {
  return setCurrentGlobalDomainIds(value, false);
}
export function onGlobalDomainContextChange(listener: (ids: string[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
