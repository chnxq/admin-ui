<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { $t } from '@vben/locales';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { Alert, message, Spin } from 'ant-design-vue';

import {
  clearLinkOAuthContext,
  confirmLinkSocialAccountApi,
  restoreLinkOAuthContext,
} from '#/api';
import { useAuthStore, useSocialAuthStore } from '#/store';

defineOptions({ name: 'SocialAuthCallback' });

const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const socialAuthStore = useSocialAuthStore();

const errorText = ref('');
const loading = ref(true);

async function finishLogin() {
  const accessToken = socialAuthStore.applyLogin(
    socialAuthStore.currentPending?.login,
  );
  accessStore.setAccessToken(accessToken);
  const [userInfo, accessCodes] = await Promise.all([
    authStore.fetchUserInfo(),
    authStore.fetchAccessCodes(),
  ]);
  if (userInfo?.profileCompleted === false) {
    await router.replace('/profile');
    return;
  }
  await router.replace(userInfo?.homePath || preferences.app.defaultHomePath);
  void accessCodes;
}

async function finishBinding(provider: 'dingtalk' | 'github' | 'wechat') {
  const bindingContext = restoreLinkOAuthContext();
  const operationId = String(bindingContext?.operationId || '').trim();
  const code = String(route.query.code || '').trim();
  const state = String(route.query.state || '').trim();
  if (!code || !state) {
    throw new Error($t('page.profile.socialBindingSettingStartFailed'));
  }
  await confirmLinkSocialAccountApi({
    code,
    operationId,
    provider,
    state,
  });
  clearLinkOAuthContext();
  message.success($t('authentication.bindSuccess'));
  await router.replace('/profile');
}

onMounted(async () => {
  try {
    const restoredSession = socialAuthStore.restore();
    const provider = (route.params.provider as string) || 'github';
    const code = String(route.query.code || '').trim();
    const state = String(route.query.state || '').trim();
    if (
      provider !== 'github' &&
      provider !== 'wechat' &&
      provider !== 'dingtalk'
    ) {
      throw new Error($t('authentication.socialProviderNotSupported'));
    }
    if (!code) {
      throw new Error($t('authentication.socialCallbackMissingCode'));
    }
    const bindingContext = restoreLinkOAuthContext();
    if (
      bindingContext?.provider === 'github' ||
      bindingContext?.provider === 'wechat' ||
      bindingContext?.provider === 'dingtalk'
    ) {
      await finishBinding(bindingContext.provider);
      return;
    }
    if (!restoredSession) {
      socialAuthStore.currentProvider = provider as
        | 'dingtalk'
        | 'github'
        | 'wechat';
    }
    const result = await socialAuthStore.complete(code, state);
    if (!result) {
      throw new Error($t('authentication.socialCallbackFailed'));
    }
    if (result.state === 'confirmed') {
      await finishLogin();
      return;
    }
    if (result.state === 'unbound') {
      await router.replace('/auth/social/bind');
      return;
    }
    throw new Error($t('authentication.socialCallbackUnexpectedState'));
  } catch (error: any) {
    errorText.value =
      error instanceof Error ? error.message : $t('authentication.loginFailed');
    message.error(errorText.value);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-col gap-4 py-12">
    <div class="rounded-2xl border bg-card px-6 py-10 text-center shadow-sm">
      <Spin v-if="loading" size="large" />
      <Alert
        v-else-if="errorText"
        :description="errorText"
        :message="$t('authentication.socialCallbackFailed')"
        show-icon
        type="error"
      />
      <div v-else class="text-muted-foreground text-sm">
        {{ $t('authentication.socialCallbackProcessing') }}
      </div>
    </div>
  </div>
</template>
