<script lang="ts" setup>
import { computed, onMounted } from 'vue';
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
const { appName, brand, copyright, loadAuthBrand, logo } = useAuthBrand();

const displayLogo = computed(
  () =>
    logo.value ||
    (isDark.value && preferences.logo.sourceDark
      ? preferences.logo.sourceDark
      : preferences.logo.source),
);

onMounted(() => {
  void loadAuthBrand();
});
</script>

<template>
  <div
    :class="[isDark ? 'dark' : '']"
    class="relative min-h-screen overflow-hidden bg-[#f4f8ff] text-slate-900 dark:bg-[#07111f] dark:text-slate-100"
  >
    <div class="absolute inset-0 overflow-hidden">
      <div class="auth-glow auth-glow-one"></div>
      <div class="auth-glow auth-glow-two"></div>
      <div class="auth-grid"></div>
    </div>

    <header
      class="relative z-10 flex items-center justify-between px-6 py-6 lg:px-10"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 shadow-[0_12px_30px_rgba(46,109,255,0.15)] ring-1 ring-white/70 dark:bg-slate-900/80 dark:ring-white/10"
        >
          <img
            v-if="displayLogo"
            :alt="appName"
            :src="displayLogo"
            class="h-8 w-8 object-contain"
          />
        </div>
        <div>
          <div
            class="text-sm font-medium uppercase text-sky-600 dark:text-sky-300"
          >
            {{ brand.eyebrow }}
          </div>
          <div class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ appName }}
          </div>
        </div>
      </div>

      <div
        class="flex items-center gap-1 rounded-full border border-white/65 bg-white/70 px-3 py-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/45"
      >
        <AuthenticationColorToggle />
        <AuthenticationLayoutToggle />
        <LanguageToggle v-if="preferences.widget.languageToggle" />
        <ThemeToggle v-if="preferences.widget.themeToggle" />
      </div>
    </header>

    <main class="relative z-10 px-6 pb-8 lg:px-10 lg:pb-10">
      <div
        class="mx-auto grid min-h-[calc(100vh-112px)] max-w-[1520px] items-center gap-8 xl:grid-cols-[1.12fr_0.88fr]"
        :class="{ 'grid-cols-1': authPanelCenter }"
      >
        <section
          v-if="!authPanelCenter"
          class="hidden min-h-[720px] overflow-hidden p-10 xl:block"
        >
          <div class="auth-line-art h-full">
            <svg
              aria-hidden="true"
              class="h-full w-full"
              fill="none"
              viewBox="0 0 760 640"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                class="auth-line-muted"
                d="M104 534c70-34 112-26 164 22 48 44 98 42 152-2 72-58 144-66 238-18"
              />

              <path
                class="auth-line-flow auth-line-accent"
                d="M212 238c64-72 166-96 260-48"
              />
              <path
                class="auth-line-flow auth-line-success"
                d="M548 250c44 38 60 92 42 148"
              />
              <path
                class="auth-line-flow auth-line-warm"
                d="M510 458c-70 54-176 64-262 10"
              />

              <rect
                class="auth-line-card"
                height="264"
                rx="34"
                width="330"
                x="214"
                y="174"
              />
              <path class="auth-line-main" d="M248 226h118M398 226h82" />
              <path class="auth-line-muted" d="M248 270h228" />
              <path class="auth-line-muted" d="M248 314h176" />
              <path class="auth-line-muted" d="M248 358h214" />
              <path class="auth-line-accent" d="M248 402h82" />
              <path class="auth-line-success" d="M376 402h86" />

              <circle class="auth-line-hub-fill" cx="380" cy="318" r="54" />
              <circle class="auth-line-accent" cx="380" cy="318" r="54" />
              <path class="auth-line-main" d="M350 318h60" />
              <path class="auth-line-main" d="M380 288v60" />
              <circle class="auth-line-soft-fill" cx="380" cy="318" r="16" />

              <rect
                class="auth-line-mini-card"
                height="186"
                rx="26"
                width="162"
                x="96"
                y="190"
              />
              <path class="auth-line-main" d="M130 234h58M130 270h88" />
              <path class="auth-line-muted" d="M130 306h62M130 336h84" />
              <path class="auth-line-accent" d="M130 354h18M160 354h18" />
              <path class="auth-line-accent" d="M196 354h18" />
              <circle class="auth-line-warm" cx="220" cy="230" r="18" />
              <path class="auth-line-warm" d="M210 230h20M220 220v20" />

              <rect
                class="auth-line-mini-card"
                height="170"
                rx="26"
                width="174"
                x="508"
                y="140"
              />
              <path class="auth-line-main" d="M544 184h72M544 220h92" />
              <path class="auth-line-muted" d="M544 252h54" />
              <circle class="auth-line-success" cx="626" cy="254" r="24" />
              <path class="auth-line-success" d="m614 254 9 9 18-22" />

              <rect
                class="auth-line-mini-card"
                height="160"
                rx="26"
                width="188"
                x="482"
                y="382"
              />
              <path class="auth-line-main" d="M524 430h74M524 464h96" />
              <path class="auth-line-accent" d="M514 488h102" />
              <path class="auth-line-main" d="M518 414h22l16 46h58l14-34h-74" />
              <circle class="auth-line-main" cx="566" cy="492" r="7" />
              <circle class="auth-line-main" cx="612" cy="492" r="7" />

              <rect
                class="auth-line-mini-card"
                height="150"
                rx="26"
                width="180"
                x="118"
                y="408"
              />
              <path class="auth-line-main" d="M158 452h70M158 486h100" />
              <path class="auth-line-muted" d="M158 514h58" />
              <path
                class="auth-line-warm"
                d="M246 438c22 0 38 16 38 36s-16 36-38 36-38-16-38-36 16-36 38-36Z"
              />
              <path class="auth-line-warm" d="M246 454v40M228 474h36" />

              <path class="auth-line-accent" d="M258 284h74" />
              <path class="auth-line-success" d="M466 268h70" />
              <path class="auth-line-warm" d="M458 430h62" />
              <path class="auth-line-accent" d="M288 458h74" />

              <circle
                class="auth-line-dot auth-line-accent"
                cx="258"
                cy="284"
              />
              <circle
                class="auth-line-dot auth-line-success"
                cx="536"
                cy="268"
              />
              <circle class="auth-line-dot auth-line-warm" cx="520" cy="430" />
              <circle
                class="auth-line-dot auth-line-accent"
                cx="288"
                cy="458"
              />
            </svg>
          </div>
        </section>

        <section
          class="mx-auto flex w-full max-w-[620px] items-center justify-center"
          :class="{ 'max-w-[780px]': authPanelCenter }"
        >
          <div
            class="auth-panel bg-white/82 dark:bg-slate-950/58 relative w-full overflow-hidden rounded-[36px] border border-white/70 p-3 shadow-[0_32px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10"
          >
            <div
              class="pointer-events-none absolute inset-x-6 top-0 h-24 bg-gradient-to-b from-sky-200/45 to-transparent blur-2xl dark:from-sky-500/20"
            ></div>
            <div
              class="relative rounded-[30px] border border-slate-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,250,255,0.9))] px-5 py-6 sm:px-8 sm:py-8 dark:border-white/5 dark:bg-[linear-gradient(180deg,rgba(7,18,35,0.92),rgba(6,16,30,0.88))]"
            >
              <RouterView v-slot="{ Component, route }">
                <Transition appear mode="out-in" name="slide-right">
                  <KeepAlive :include="['Login']">
                    <component
                      :is="Component"
                      :key="route.fullPath"
                      class="w-full"
                    />
                  </KeepAlive>
                </Transition>
              </RouterView>

              <div
                class="mt-8 border-t border-slate-100/80 pt-5 text-center text-xs text-slate-500 dark:border-white/5 dark:text-slate-400"
              >
                {{ copyright }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.07) 1px, transparent 1px);
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
  background: rgba(56, 189, 248, 0.28);
}

.auth-glow-two {
  right: -120px;
  bottom: -80px;
  height: 360px;
  width: 360px;
  background: rgba(99, 102, 241, 0.2);
}

.dark .auth-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
}

.auth-line-art {
  color: rgb(51 65 85 / 0.55);
}

.auth-line-main,
.auth-line-muted,
.auth-line-accent,
.auth-line-success,
.auth-line-warm {
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.auth-line-main {
  stroke: rgb(51 65 85 / 0.55);
}

.auth-line-muted {
  stroke: rgb(71 85 105 / 0.24);
}

.auth-line-accent {
  stroke: rgb(14 165 233 / 0.72);
}

.auth-line-success {
  stroke: rgb(16 185 129 / 0.72);
}

.auth-line-warm {
  stroke: rgb(245 158 11 / 0.72);
}

.auth-line-flow {
  stroke-width: 2.6;
}

.auth-line-card {
  fill: rgb(255 255 255 / 0.36);
  stroke: rgb(51 65 85 / 0.32);
  stroke-width: 2.2;
}

.auth-line-mini-card {
  fill: rgb(255 255 255 / 0.28);
  stroke: rgb(71 85 105 / 0.22);
  stroke-width: 2.2;
}

.auth-line-hub-fill {
  fill: rgb(14 165 233 / 0.08);
}

.auth-line-dot {
  stroke-width: 0;
}

.auth-line-dot.auth-line-accent {
  fill: rgb(14 165 233 / 0.72);
}

.auth-line-dot.auth-line-success {
  fill: rgb(16 185 129 / 0.72);
}

.auth-line-dot.auth-line-warm {
  fill: rgb(245 158 11 / 0.72);
}

.auth-line-soft-fill {
  fill: rgb(255 255 255 / 0.34);
}

.dark .auth-line-main {
  stroke: rgb(226 232 240 / 0.5);
}

.dark .auth-line-muted {
  stroke: rgb(226 232 240 / 0.18);
}

.dark .auth-line-accent {
  stroke: rgb(125 211 252 / 0.75);
}

.dark .auth-line-success {
  stroke: rgb(52 211 153 / 0.76);
}

.dark .auth-line-warm {
  stroke: rgb(251 191 36 / 0.76);
}

.dark .auth-line-card {
  fill: rgb(15 23 42 / 0.3);
  stroke: rgb(226 232 240 / 0.24);
}

.dark .auth-line-mini-card {
  fill: rgb(15 23 42 / 0.22);
  stroke: rgb(226 232 240 / 0.17);
}

.dark .auth-line-hub-fill {
  fill: rgb(14 165 233 / 0.12);
}

.dark .auth-line-dot.auth-line-accent {
  fill: rgb(125 211 252 / 0.75);
}

.dark .auth-line-dot.auth-line-success {
  fill: rgb(52 211 153 / 0.76);
}

.dark .auth-line-dot.auth-line-warm {
  fill: rgb(251 191 36 / 0.76);
}

.dark .auth-line-soft-fill {
  fill: rgb(15 23 42 / 0.28);
}
</style>
