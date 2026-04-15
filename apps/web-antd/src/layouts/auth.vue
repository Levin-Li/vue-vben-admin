<script lang="ts" setup>
import { computed } from 'vue';
import { RouterView } from 'vue-router';

import {
  AuthenticationColorToggle,
  AuthenticationLayoutToggle,
  LanguageToggle,
  ThemeToggle,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';

import { $t } from '#/locales';

const { authPanelCenter, isDark } = usePreferences();

const appName = computed(() => preferences.app.name);
const logo = computed(() =>
  isDark.value && preferences.logo.sourceDark
    ? preferences.logo.sourceDark
    : preferences.logo.source,
);

const quickSellingPoints = [
  '统一接入后台菜单树与租户域名登录策略',
  '支持图片、短信、邮箱、MFA 多种验证码方式',
  '基础管理页与后台 OpenAPI CRUD 已联动打通',
];

const previewCards = [
  {
    badge: '实时联调',
    desc: '角色、菜单、组织、用户、字典、租户、租户站点已接入统一界面。',
    title: '基础模块已贯通',
  },
  {
    badge: '多租户',
    desc: '登录域名、租户站点、站点证书和后台入口保持同一条业务链。',
    title: '域名与站点协同',
  },
];
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
      <div class="auth-orb auth-orb-one"></div>
      <div class="auth-orb auth-orb-two"></div>
    </div>

    <header class="relative z-10 flex items-center justify-between px-6 py-6 lg:px-10">
      <div class="flex items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 shadow-[0_12px_30px_rgba(46,109,255,0.15)] ring-1 ring-white/70 dark:bg-slate-900/80 dark:ring-white/10"
        >
          <img
            v-if="logo"
            :alt="appName"
            :src="logo"
            class="h-8 w-8 object-contain"
          />
        </div>
        <div>
          <div class="text-sm font-medium uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">
            Framework Base
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
          class="hidden min-h-[720px] overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(232,243,255,0.72))] p-10 shadow-[0_35px_80px_rgba(31,78,179,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(10,21,39,0.92),rgba(10,29,58,0.75))] xl:block"
        >
          <div class="flex h-full flex-col justify-between">
            <div>
              <div
                class="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/90 px-4 py-1 text-xs font-semibold tracking-[0.22em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200"
              >
                SHOP-STYLE AUTH
              </div>

              <h1 class="mt-8 max-w-[560px] text-[44px] font-semibold leading-[1.08] tracking-[-0.04em] text-slate-900 dark:text-white">
                {{ $t('authentication.pageTitle') }}
              </h1>
              <p class="mt-5 max-w-[540px] text-lg leading-8 text-slate-600 dark:text-slate-300">
                {{ $t('authentication.pageDesc') }}
              </p>

              <div class="mt-10 space-y-4">
                <div
                  v-for="item in quickSellingPoints"
                  :key="item"
                  class="flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-[0_8px_20px_rgba(59,130,246,0.08)] ring-1 ring-white/70 dark:bg-slate-900/45 dark:ring-white/5"
                >
                  <div
                    class="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-600"
                  ></div>
                  <p class="text-sm leading-7 text-slate-700 dark:text-slate-200">
                    {{ item }}
                  </p>
                </div>
              </div>
            </div>

            <div class="relative mt-10 grid gap-5 lg:grid-cols-2">
              <div
                v-for="card in previewCards"
                :key="card.title"
                class="rounded-[28px] border border-white/60 bg-white/82 p-6 shadow-[0_18px_40px_rgba(30,64,175,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55"
              >
                <div
                  class="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium tracking-[0.18em] text-white dark:bg-sky-300 dark:text-slate-900"
                >
                  {{ card.badge }}
                </div>
                <div class="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
                  {{ card.title }}
                </div>
                <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {{ card.desc }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          class="mx-auto flex w-full max-w-[620px] items-center justify-center"
          :class="{ 'max-w-[780px]': authPanelCenter }"
        >
          <div
            class="auth-panel relative w-full overflow-hidden rounded-[36px] border border-white/70 bg-white/82 p-3 shadow-[0_32px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/58"
          >
            <div
              class="pointer-events-none absolute inset-x-6 top-0 h-24 bg-gradient-to-b from-sky-200/45 to-transparent blur-2xl dark:from-sky-500/20"
            ></div>
            <div
              class="relative rounded-[30px] border border-slate-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,250,255,0.9))] px-5 py-6 dark:border-white/5 dark:bg-[linear-gradient(180deg,rgba(7,18,35,0.92),rgba(6,16,30,0.88))] sm:px-8 sm:py-8"
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
                Copyright © 2026 {{ appName }} · 多租户后台管理平台
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

.auth-orb {
  position: absolute;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
}

.auth-orb-one {
  top: 18%;
  right: 12%;
  height: 150px;
  width: 150px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0.08));
}

.auth-orb-two {
  left: 7%;
  bottom: 12%;
  height: 110px;
  width: 110px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.18), rgba(59, 130, 246, 0.03));
}

.dark .auth-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
}

.dark .auth-orb {
  border-color: rgba(255, 255, 255, 0.08);
}
</style>
