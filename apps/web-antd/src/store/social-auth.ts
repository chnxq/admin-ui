import type {
  SocialAuthPendingResult,
  SocialAuthStartResult,
  SocialProvider,
} from '#/api';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import {
  applySocialLoginTokens,
  bindExistingSocialAuthApi,
  clearSocialAuthSession,
  completeSocialAuthApi,
  persistSocialAuthSession,
  pollSocialAuthApi,
  registerAndBindSocialAuthApi,
  restoreSocialAuthSession,
  startSocialAuthApi,
} from '#/api';

export const useSocialAuthStore = defineStore('social-auth', () => {
  const currentProvider = ref<null | SocialProvider>(null);
  const currentSession = ref<null | SocialAuthStartResult>(null);
  const currentPending = ref<null | SocialAuthPendingResult>(null);
  const loading = ref(false);

  const profileSummary = computed(() => currentPending.value?.profile ?? null);

  async function start(provider: SocialProvider) {
    loading.value = true;
    try {
      const result = await startSocialAuthApi(provider);
      currentProvider.value = provider;
      currentSession.value = result;
      currentPending.value = null;
      persistSocialAuthSession(provider, result);
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function complete(code: string, state?: string) {
    if (!currentProvider.value) {
      return null;
    }
    loading.value = true;
    try {
      const result = await completeSocialAuthApi(
        currentProvider.value,
        currentSession.value?.sessionId,
        code,
        state || currentSession.value?.sessionToken,
      );
      currentPending.value = result;
      if (result.state === 'confirmed' || result.state === 'unbound') {
        clearSocialAuthSession();
      }
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function poll() {
    if (!currentProvider.value || !currentSession.value) {
      return null;
    }
    loading.value = true;
    try {
      const result = await pollSocialAuthApi(
        currentProvider.value,
        currentSession.value.sessionId,
        currentSession.value.sessionToken,
      );
      currentPending.value = { ...currentPending.value, ...result };
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function bindExisting(params: {
    captchaCode: string;
    captchaId: string;
    identifier: string;
    password: string;
    type: 'email' | 'mobile' | 'username';
  }) {
    if (!currentPending.value?.bindToken) {
      return null;
    }
    loading.value = true;
    try {
      return await bindExistingSocialAuthApi({
        bindToken: currentPending.value.bindToken,
        ...params,
      });
    } finally {
      loading.value = false;
    }
  }

  async function registerAndBind(registration: Record<string, any>) {
    if (!currentPending.value?.bindToken) {
      return null;
    }
    loading.value = true;
    try {
      return await registerAndBindSocialAuthApi(
        currentPending.value.bindToken,
        {
          tenantCode: '',
          ...registration,
        },
      );
    } finally {
      loading.value = false;
    }
  }

  function setMockPending(result: SocialAuthPendingResult) {
    currentPending.value = result;
  }

  function restore() {
    const restored = restoreSocialAuthSession();
    if (!restored) {
      return null;
    }
    currentProvider.value = restored.provider;
    currentSession.value = restored.session;
    return restored;
  }

  function applyLogin(login: SocialAuthPendingResult['login']) {
    return applySocialLoginTokens(login);
  }

  function reset() {
    currentProvider.value = null;
    currentSession.value = null;
    currentPending.value = null;
    loading.value = false;
    clearSocialAuthSession();
  }

  function $reset() {
    reset();
  }

  return {
    $reset,
    applyLogin,
    bindExisting,
    complete,
    currentPending,
    currentProvider,
    currentSession,
    loading,
    poll,
    profileSummary,
    registerAndBind,
    reset,
    restore,
    setMockPending,
    start,
  };
});
