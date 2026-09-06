<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView } from 'vue-router';

import {
  AuthenticationColorToggle,
  AuthenticationLayoutToggle,
  LanguageToggle,
  ThemeToggle,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';

import { useAuthBrand } from '@levin/admin-framework/framework-commons/app/views/_core/authentication/auth-brand';

const { authPanelCenter, isDark } = usePreferences();
const {
  appName,
  copyright,
  heroImageCandidates,
  loadAuthBrand,
  logoCandidates,
  techSupport,
  titleImageCandidates,
} = useAuthBrand();
const heroImageCandidateIndex = ref(0);
const logoCandidateIndex = ref(0);
const titleImageCandidateIndex = ref(0);

const fallbackLogo = computed(() =>
  isDark.value && preferences.logo.sourceDark
    ? preferences.logo.sourceDark
    : preferences.logo.source,
);
const displayLogo = computed(
  () => logoCandidates.value[logoCandidateIndex.value] || fallbackLogo.value,
);

const displayHeroImage = computed(() =>
  Boolean(heroImageCandidates.value[heroImageCandidateIndex.value]),
);
const displayHeroImageUrl = computed(
  () => heroImageCandidates.value[heroImageCandidateIndex.value] || '',
);
const displayTitleImage = computed(
  () => titleImageCandidates.value[titleImageCandidateIndex.value] || '',
);

watch(heroImageCandidates, () => {
  heroImageCandidateIndex.value = 0;
});

watch(logoCandidates, () => {
  logoCandidateIndex.value = 0;
});

watch(titleImageCandidates, () => {
  titleImageCandidateIndex.value = 0;
});

function useNextImageCandidate(
  candidateIndex: typeof heroImageCandidateIndex,
  candidates: string[],
) {
  if (candidateIndex.value < candidates.length - 1) {
    candidateIndex.value += 1;
    return;
  }

  candidateIndex.value = candidates.length;
}

function handleHeroImageError() {
  useNextImageCandidate(heroImageCandidateIndex, heroImageCandidates.value);
}

function handleLogoImageError() {
  useNextImageCandidate(logoCandidateIndex, logoCandidates.value);
}

function handleTitleImageError() {
  useNextImageCandidate(titleImageCandidateIndex, titleImageCandidates.value);
}

onMounted(() => {
  void loadAuthBrand();
});
</script>

<template>
  <div
    :class="[isDark ? 'dark' : '']"
    class="auth-shell text-foreground relative flex h-screen flex-col overflow-hidden"
  >
    <div class="absolute inset-0 overflow-hidden">
      <div class="auth-glow auth-glow-one"></div>
      <div class="auth-glow auth-glow-two"></div>
      <div class="auth-grid"></div>
    </div>

    <header
      class="relative z-10 flex items-center justify-between px-6 py-6 lg:px-10"
    >
      <div class="auth-brand-card flex items-center gap-3">
        <div
          class="auth-brand-logo flex h-12 w-12 items-center justify-center rounded-2xl"
        >
          <img
            v-if="displayLogo"
            :alt="appName"
            :src="displayLogo"
            class="h-8 w-8 object-contain"
            @error="handleLogoImageError"
          />
        </div>
        <div>
          <div class="auth-brand-title text-lg font-semibold">
            {{ appName }}
          </div>
        </div>
      </div>

      <div
        class="auth-toolbar flex items-center gap-1 rounded-full px-3 py-1.5"
      >
        <AuthenticationColorToggle />
        <AuthenticationLayoutToggle />
        <LanguageToggle v-if="preferences.widget.languageToggle" />
        <ThemeToggle v-if="preferences.widget.themeToggle" />
      </div>
    </header>

    <main
      class="relative z-10 flex-1 overflow-hidden px-6 pb-16 lg:px-10 lg:pb-20"
    >
      <div
        class="mx-auto grid h-full min-h-0 max-w-[1520px] items-center gap-8 xl:grid-cols-[1.12fr_0.88fr]"
        :class="{ 'grid-cols-1': authPanelCenter }"
      >
        <section
          v-if="!authPanelCenter"
          class="hidden h-full min-h-0 overflow-hidden p-10 xl:block"
        >
          <img
            v-if="displayTitleImage"
            :alt="`${appName} 标题图`"
            :src="displayTitleImage"
            class="mx-auto mb-6 block max-h-24 max-w-full object-contain"
            @error="handleTitleImageError"
          />
          <div class="auth-flow-art h-full">
            <img
              v-if="displayHeroImage"
              :alt="`${appName} 登录页插画`"
              :src="displayHeroImageUrl"
              class="h-full w-full object-contain"
              @error="handleHeroImageError"
            />
            <svg
              v-else
              aria-hidden="true"
              class="h-full w-full"
              fill="none"
              viewBox="0 0 900 520"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g class="auth-flow-left-lines">
                <path
                  v-for="(path, index) in [
                    'M150 80C224 72 278 126 318 172',
                    'M116 150C208 126 274 176 318 214',
                    'M90 220C178 206 260 232 312 248',
                    'M78 290C176 318 264 292 314 270',
                    'M92 360C184 406 276 330 320 292',
                    'M120 430C216 486 296 374 326 318',
                    'M162 500C250 548 316 390 338 324',
                  ]"
                  :key="index"
                  class="auth-flow-feed-line"
                  :d="path"
                  :style="{ '--delay': `${0.28 + index * 0.22}s` }"
                />
              </g>

              <g class="auth-flow-left-nodes">
                <g
                  v-for="(node, index) in [
                    [92, 50],
                    [64, 120],
                    [42, 190],
                    [32, 260],
                    [44, 330],
                    [66, 400],
                    [100, 470],
                  ]"
                  :key="index"
                  class="auth-flow-node auth-flow-platform"
                  :style="{ '--delay': `${index * 0.18}s` }"
                  :transform="`translate(${node[0]} ${node[1]}) scale(1.3)`"
                >
                  <rect height="48" rx="18" width="58" />
                  <circle class="auth-flow-node-mark" cx="29" cy="24" r="15" />
                  <path
                    class="auth-flow-node-glyph"
                    :d="
                      [
                        'M21 17h16v14H21zM25 13h8v4M25 24h8',
                        'M21 17h16M21 24h16M21 31h16M23 15l12 18',
                        'M20 24a9 9 0 1 0 18 0 9 9 0 1 0-18 0M29 15v18M21 24h16',
                        'M21 17h16v14H21zM25 21h8M25 27h8',
                        'M22 19h14v10H22zM25 16h8v3M25 32h8',
                        'M21 29h16M23 19h12l2 10H21z',
                        'M22 17h14v14H22zM25 21h8M25 26h8',
                      ][index]
                    "
                  />
                </g>
              </g>

              <g class="auth-flow-orbit auth-flow-orbit-left">
                <circle
                  class="auth-flow-ring-shadow"
                  cx="350"
                  cy="260"
                  r="138"
                />
                <circle
                  class="auth-flow-ring-track"
                  cx="350"
                  cy="260"
                  r="122"
                />
                <circle class="auth-flow-ring-main" cx="350" cy="260" r="122" />
                <circle class="auth-flow-ring-dash" cx="350" cy="260" r="154" />
              </g>

              <g class="auth-flow-core" transform="translate(350 260)">
                <circle r="92" />
                <path
                  class="auth-flow-stack auth-flow-primary-fill"
                  d="m0-48 50 28L0 8-50-20 0-48Z"
                />
                <path
                  class="auth-flow-stack"
                  d="m-40 10 40 22 40-22M-40 36 0 58l40-22"
                />
              </g>

              <g class="auth-flow-main-connector">
                <path d="M460 260h82" />
                <circle cx="460" cy="260" r="7" />
                <circle cx="542" cy="260" r="7" />
              </g>

              <g class="auth-flow-right-lines">
                <path
                  v-for="(path, index) in [
                    'M716 170C758 120 810 92 858 76',
                    'M732 218C786 184 832 166 886 162',
                    'M736 274C798 288 840 290 890 286',
                    'M720 338C780 374 818 396 846 400',
                    'M650 356C678 410 686 448 668 468',
                  ]"
                  :key="index"
                  class="auth-flow-spread-line"
                  :d="path"
                  :style="{ '--delay': `${3.1 + index * 0.2}s` }"
                />
              </g>

              <g class="auth-flow-orbit auth-flow-orbit-right">
                <circle
                  class="auth-flow-ring-shadow"
                  cx="640"
                  cy="260"
                  r="142"
                />
                <circle
                  class="auth-flow-ring-track"
                  cx="640"
                  cy="260"
                  r="126"
                />
                <circle
                  class="auth-flow-ring-main auth-flow-ring-main-alt"
                  cx="640"
                  cy="260"
                  r="126"
                />
                <circle class="auth-flow-ring-dash" cx="640" cy="260" r="166" />
              </g>

              <g
                class="auth-flow-core auth-flow-core-right"
                transform="translate(640 260)"
              >
                <circle r="96" />
                <g class="auth-flow-stream">
                  <circle cx="-42" cy="-36" r="9" />
                  <circle cx="-42" cy="-12" r="9" />
                  <circle cx="-42" cy="12" r="9" />
                  <circle cx="-42" cy="36" r="9" />
                  <path d="M-24-36C18-36 18-8 52-8" />
                  <path d="M-24-12C12-12 20-4 52-4" />
                  <path d="M-24 12C12 12 20 4 52 4" />
                  <path d="M-24 36C18 36 18 8 52 8" />
                  <circle cx="60" cy="0" r="9" />
                </g>
              </g>

              <g class="auth-flow-right-nodes">
                <g
                  v-for="(node, index) in [
                    [800, 74],
                    [858, 162],
                    [862, 286],
                    [812, 400],
                    [668, 468],
                  ]"
                  :key="index"
                  class="auth-flow-capability"
                  :style="{ '--delay': `${3.3 + index * 0.2}s` }"
                  :transform="`translate(${node[0]} ${node[1]})`"
                >
                  <circle r="42" />
                  <path
                    class="auth-flow-capability-icon"
                    :d="
                      [
                        'M-18-10h36v24h-36zM10-2h12v10H10M-10-16h20v6',
                        'M-14-18H6l10 10v26h-30zM6-18v10h10M-6-2h14M-6 8h14',
                        'M-16-18h28v34h-28zM-8-6h12M-8 4h10M5 11l6 6 12-16',
                        'M-14-18h28v36l-7-4-7 4-7-4-7 4zM-6-4h12M-6 6h12',
                        'M-22 4h28v12h-28zM6-4h12l10 10v10H6zM-14 18a5 5 0 1 0 0 0.1M18 18a5 5 0 1 0 0.1',
                      ][index]
                    "
                  />
                </g>
              </g>

              <g class="auth-flow-points">
                <circle cx="234" cy="118" r="6" />
                <circle cx="222" cy="174" r="6" />
                <circle cx="208" cy="234" r="6" />
                <circle cx="212" cy="302" r="6" />
                <circle cx="248" cy="392" r="6" />
                <circle cx="548" cy="260" r="6" />
                <circle cx="776" cy="150" r="6" />
                <circle cx="806" cy="230" r="6" />
                <circle cx="808" cy="304" r="6" />
                <circle cx="776" cy="374" r="6" />
              </g>
            </svg>
          </div>
        </section>

        <section
          class="mx-auto flex w-full max-w-[620px] items-center justify-center"
          :class="{ 'max-w-[780px]': authPanelCenter }"
        >
          <div
            class="auth-panel relative w-full overflow-hidden rounded-[36px] p-3"
          >
            <div
              class="auth-panel-glow pointer-events-none absolute inset-x-8 top-0 h-28"
            ></div>
            <div
              class="auth-card relative rounded-[30px] px-5 py-6 sm:px-8 sm:py-8"
            >
              <RouterView v-slot="{ Component, route }">
                <Transition appear mode="out-in" name="slide-right">
                  <div :key="route.fullPath" class="w-full">
                    <KeepAlive :include="['Login']">
                      <component :is="Component" class="w-full" />
                    </KeepAlive>
                  </div>
                </Transition>
              </RouterView>
            </div>
          </div>
        </section>
      </div>
    </main>

    <footer
      class="auth-page-footer fixed inset-x-0 bottom-6 z-10 flex justify-center px-6"
    >
      <div
        v-if="copyright || techSupport"
        class="auth-copyright flex flex-wrap items-center justify-center gap-x-2 text-center text-xs"
      >
        <span v-if="copyright">{{ copyright }}</span>
        <span v-if="copyright && techSupport" aria-hidden="true">·</span>
        <span v-if="techSupport">{{ techSupport }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.auth-shell {
  background:
    radial-gradient(
      circle at 8% 10%,
      hsl(var(--primary) / 0.18),
      transparent 28%
    ),
    radial-gradient(
      circle at 88% 94%,
      hsl(var(--primary) / 0.2),
      transparent 26%
    ),
    linear-gradient(
      135deg,
      hsl(var(--primary) / 0.08),
      hsl(var(--background)) 34%,
      hsl(var(--primary) / 0.06)
    );
}

.auth-brand-card {
  border-radius: 22px;
  padding: 6px 8px;
}

.auth-brand-logo {
  background: transparent;
}

.auth-brand-logo::after {
  display: none;
}

.auth-brand-eyebrow {
  color: hsl(var(--primary));
  letter-spacing: 0;
}

.auth-brand-title {
  color: hsl(var(--foreground));
}

.auth-toolbar {
  border: 1px solid hsl(var(--primary) / 0.12);
  background: hsl(var(--card) / 0.78);
  box-shadow:
    0 18px 46px hsl(var(--primary) / 0.15),
    inset 0 1px 0 hsl(var(--background) / 0.86);
  backdrop-filter: blur(18px);
}

.auth-panel {
  border: 1px solid hsl(var(--primary) / 0.14);
  background:
    linear-gradient(
      145deg,
      hsl(var(--card) / 0.82),
      hsl(var(--primary) / 0.09)
    ),
    hsl(var(--card) / 0.74);
  box-shadow:
    0 34px 90px hsl(var(--primary) / 0.18),
    0 18px 44px hsl(var(--foreground) / 0.07),
    inset 0 1px 0 hsl(var(--background) / 0.9);
  backdrop-filter: blur(24px);
}

.auth-panel-glow {
  background: linear-gradient(180deg, hsl(var(--primary) / 0.22), transparent);
  filter: blur(28px);
}

.auth-card {
  border: 1px solid hsl(var(--primary) / 0.1);
  background:
    linear-gradient(
      180deg,
      hsl(var(--card) / 0.98),
      hsl(var(--primary) / 0.045)
    ),
    hsl(var(--card) / 0.95);
  box-shadow: inset 0 1px 0 hsl(var(--background) / 0.92);
}

.auth-copyright {
  max-width: 100%;
  color: hsl(var(--muted-foreground));
  line-height: 1.6;
  text-wrap: balance;
}

.auth-card :deep(.ant-tabs-nav) {
  margin-bottom: 18px;
}

.auth-card :deep(.ant-tabs-ink-bar) {
  height: 3px;
  border-radius: 999px;
  background: hsl(var(--primary));
}

.auth-card :deep(.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn),
.auth-card :deep(.ant-tabs-tab:hover) {
  color: hsl(var(--primary));
}

.auth-card :deep(.ant-alert-info) {
  border-color: hsl(var(--primary) / 0.12);
  background: hsl(var(--primary) / 0.075);
}

.auth-card :deep(.ant-alert-info .ant-alert-icon) {
  color: hsl(var(--primary));
}

.auth-card :deep(.ant-input),
.auth-card :deep(.ant-input-affix-wrapper) {
  border-color: hsl(var(--border));
  background: hsl(var(--background) / 0.82);
}

.auth-card :deep(.ant-input:hover),
.auth-card :deep(.ant-input-affix-wrapper:hover),
.auth-card :deep(.ant-input:focus),
.auth-card :deep(.ant-input-affix-wrapper-focused) {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
}

.auth-card :deep(.ant-btn-primary) {
  border-color: hsl(var(--primary));
  background: linear-gradient(
    135deg,
    hsl(var(--primary) / 0.9),
    hsl(var(--primary))
  );
  box-shadow: 0 14px 28px hsl(var(--primary) / 0.22);
}

.auth-card :deep(.ant-checkbox-checked .ant-checkbox-inner) {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary));
}

@media (min-width: 1024px) and (max-height: 760px) {
  .auth-shell header {
    padding-top: 16px;
    padding-bottom: 16px;
  }

  .auth-shell main {
    padding-bottom: 72px;
  }

  .auth-shell main > div {
    min-height: auto;
    align-items: center;
  }

  .auth-brand-card {
    padding: 4px 6px;
  }

  .auth-brand-logo {
    width: 44px;
    height: 44px;
    border-radius: 18px;
  }

  .auth-brand-title {
    font-size: 16px;
    line-height: 1.35;
  }

  .auth-panel {
    transform: translateY(14px);
    padding: 8px;
  }

  .auth-card {
    padding-top: 18px;
    padding-bottom: 18px;
  }

  .auth-card :deep(.mb-6) {
    margin-bottom: 14px;
  }

  .auth-card :deep(.ant-tabs-nav) {
    margin-bottom: 12px;
  }

  .auth-card :deep(.space-y-4 > :not([hidden]) ~ :not([hidden])) {
    margin-top: 12px;
  }

  .auth-copyright {
    font-size: 11px;
  }
}

.auth-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(hsl(var(--primary) / 0.045) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--primary) / 0.045) 1px, transparent 1px);
  background-position: center center;
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at center, black 35%, transparent 78%);
}

.auth-glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(88px);
  opacity: 0.7;
}

.auth-glow-one {
  top: -120px;
  left: -60px;
  height: 320px;
  width: 320px;
  background: hsl(var(--primary) / 0.1);
}

.auth-glow-two {
  right: -120px;
  bottom: -80px;
  height: 360px;
  width: 360px;
  background: hsl(var(--primary) / 0.16);
}

.dark .auth-grid {
  background-image:
    linear-gradient(hsl(var(--primary) / 0.08) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--primary) / 0.08) 1px, transparent 1px);
}

.auth-flow-art {
  color: hsl(var(--primary));
  transform: translate(-28px, 22px);
}

.auth-flow-art svg {
  overflow: visible;
}

@media (min-width: 1024px) and (max-height: 760px) {
  .auth-flow-art {
    transform: translate(-28px, 14px);
  }
}

.auth-flow-feed-line,
.auth-flow-spread-line,
.auth-flow-main-connector path,
.auth-flow-stream path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.auth-flow-feed-line,
.auth-flow-spread-line {
  stroke: hsl(var(--primary) / 0.24);
  stroke-dasharray: 260;
  stroke-dashoffset: 260;
  stroke-width: 2;
  animation: auth-flow-line 7.2s ease-in-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
}

.auth-flow-node,
.auth-flow-capability {
  transform-box: fill-box;
  transform-origin: center;
}

.auth-flow-node {
  animation: auth-flow-node-in 7.2s ease-in-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
}

.auth-flow-node rect {
  fill: hsl(var(--background) / 0.72);
  stroke: hsl(var(--primary) / 0.12);
  stroke-width: 1.4;
  filter: drop-shadow(0 12px 22px hsl(var(--primary) / 0.1));
}

.auth-flow-node-mark {
  fill: hsl(var(--primary) / 0.07);
  stroke: hsl(var(--primary) / 0.14);
}

.auth-flow-node-glyph {
  fill: none;
  stroke: hsl(var(--primary) / 0.52);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
}

.auth-flow-orbit {
  transform-box: fill-box;
  transform-origin: center;
  animation: auth-flow-spin 22s linear infinite;
}

.auth-flow-orbit-right {
  animation-duration: 28s;
  animation-direction: reverse;
}

.auth-flow-ring-shadow {
  fill: hsl(var(--primary) / 0.03);
}

.auth-flow-ring-track {
  fill: hsl(var(--background) / 0.36);
  stroke: hsl(var(--primary) / 0.06);
  stroke-width: 6;
}

.auth-flow-ring-main {
  stroke: hsl(var(--primary) / 0.28);
  stroke-dasharray: 300 470;
  stroke-linecap: round;
  stroke-width: 6;
  filter: drop-shadow(0 0 12px hsl(var(--primary) / 0.1));
}

.auth-flow-ring-main-alt {
  stroke-width: 7;
}

.auth-flow-ring-dash {
  stroke: hsl(var(--primary) / 0.12);
  stroke-dasharray: 6 14;
  stroke-linecap: round;
  stroke-width: 1.6;
}

.auth-flow-core {
  animation: auth-flow-core-pulse 7.2s ease-in-out infinite;
  animation-delay: 1.65s;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}

.auth-flow-core > circle {
  fill: hsl(var(--background) / 0.6);
  stroke: hsl(var(--primary) / 0.08);
}

.auth-flow-primary-fill {
  fill: hsl(var(--primary) / 0.44);
}

.auth-flow-stack {
  stroke: hsl(var(--primary) / 0.46);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 7;
}

.auth-flow-main-connector {
  animation: auth-flow-connector 7.2s ease-in-out infinite;
  animation-delay: 2.35s;
  opacity: 0;
}

.auth-flow-main-connector path {
  stroke: hsl(var(--primary) / 0.34);
  stroke-dasharray: 82;
  stroke-dashoffset: 82;
  stroke-width: 3;
}

.auth-flow-main-connector circle,
.auth-flow-points circle,
.auth-flow-stream circle {
  fill: hsl(var(--primary) / 0.44);
  filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.16));
}

.auth-flow-core-right {
  animation-delay: 2.85s;
}

.auth-flow-stream {
  fill: none;
  stroke: hsl(var(--primary) / 0.46);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.auth-flow-stream path {
  stroke-dasharray: 86;
  stroke-dashoffset: 86;
  animation: auth-flow-stream 7.2s ease-in-out infinite;
  animation-delay: 3s;
}

.auth-flow-capability {
  animation: auth-flow-node-in 7.2s ease-in-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
}

.auth-flow-capability circle {
  fill: hsl(var(--background) / 0.6);
  stroke: hsl(var(--primary) / 0.1);
  stroke-width: 1.6;
  filter: drop-shadow(0 16px 28px hsl(var(--primary) / 0.1));
}

.auth-flow-capability-icon {
  fill: none;
  stroke: hsl(var(--primary) / 0.52);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.auth-flow-points circle {
  animation: auth-flow-point 7.2s ease-in-out infinite;
}

.dark .auth-flow-node rect,
.dark .auth-flow-capability circle,
.dark .auth-flow-core > circle {
  fill: hsl(var(--card) / 0.36);
}

@keyframes auth-flow-node-in {
  0%,
  6% {
    opacity: 0;
  }

  14%,
  74% {
    opacity: 1;
  }

  100% {
    opacity: 0.28;
  }
}

@keyframes auth-flow-line {
  0%,
  8% {
    opacity: 0;
    stroke-dashoffset: 260;
  }

  22%,
  72% {
    opacity: 1;
    stroke-dashoffset: 0;
  }

  100% {
    opacity: 0.18;
    stroke-dashoffset: 0;
  }
}

@keyframes auth-flow-core-pulse {
  0%,
  18% {
    opacity: 0;
  }

  30%,
  82% {
    opacity: 1;
  }

  100% {
    opacity: 0.42;
  }
}

@keyframes auth-flow-connector {
  0%,
  24% {
    opacity: 0;
  }

  36%,
  78% {
    opacity: 1;
  }

  100% {
    opacity: 0.3;
  }
}

@keyframes auth-flow-stream {
  0%,
  35% {
    stroke-dashoffset: 86;
  }

  52%,
  84% {
    stroke-dashoffset: 0;
  }

  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes auth-flow-point {
  0%,
  30% {
    opacity: 0.18;
  }

  48%,
  78% {
    opacity: 1;
  }

  100% {
    opacity: 0.35;
  }
}

@keyframes auth-flow-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-flow-art * {
    animation: none !important;
    opacity: 1 !important;
    stroke-dashoffset: 0 !important;
  }
}
</style>
