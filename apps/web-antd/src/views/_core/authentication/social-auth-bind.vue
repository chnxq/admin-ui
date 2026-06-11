<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { authenticationservicev1_LoginResponse } from '#/api/generated/admin/service/v1';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { Button, Card, message } from 'ant-design-vue';

import { getCaptchaApi } from '#/api';
import { useAuthStore, useSocialAuthStore } from '#/store';

defineOptions({ name: 'SocialAuthBind' });

const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const socialAuthStore = useSocialAuthStore();

const loading = ref(false);
const captchaImage = ref('');
const captchaId = ref('');

const providerProfile = computed(() => ({
  avatar:
    socialAuthStore.profileSummary?.avatar ||
    'https://avatars.githubusercontent.com/u/9919?s=160&v=4',
  nickname: socialAuthStore.profileSummary?.nickname || 'octocat',
  provider: socialAuthStore.profileSummary?.providerLabel || 'GitHub',
}));

async function refreshCaptcha() {
  const captcha = await getCaptchaApi();
  captchaImage.value = captcha.imageBase64;
  captchaId.value = captcha.captchaId;
}

async function finishSocialLogin(
  login?: authenticationservicev1_LoginResponse,
) {
  const accessToken = socialAuthStore.applyLogin(login);
  accessStore.setAccessToken(accessToken);
  const [userInfo] = await Promise.all([
    authStore.fetchUserInfo(),
    authStore.fetchAccessCodes(),
  ]);
  if (userInfo?.profileCompleted === false) {
    await router.replace('/profile');
    return;
  }
  await router.replace(userInfo?.homePath || preferences.app.defaultHomePath);
}

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: {
      autocomplete: 'username',
      placeholder: $t('authentication.usernameTip'),
    },
    fieldName: 'username',
    label: $t('authentication.username'),
    rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      autocomplete: 'current-password',
      placeholder: $t('authentication.password'),
    },
    fieldName: 'password',
    label: $t('authentication.password'),
    rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
  },
  {
    component: 'VbenInput',
    componentProps: {
      autocomplete: 'one-time-code',
      name: 'captchaCode',
      placeholder: $t('authentication.codeTip', [4]),
    },
    fieldName: 'captchaCode',
    label: $t('authentication.code'),
    rules: z.string().min(4, { message: $t('authentication.codeTip', [4]) }),
    suffix: () =>
      h('img', {
        alt: 'captcha',
        onClick: refreshCaptcha,
        src: captchaImage.value,
        style:
          'height:32px;min-width:96px;cursor:pointer;border-radius:4px;border:1px solid #e5e7eb;',
      }),
  },
]);

function goToLogin() {
  socialAuthStore.reset();
  void router.push('/auth/login');
}

function goToRegister() {
  void router.push('/auth/register');
}

async function handleSubmit(values: Recordable<any>) {
  if (!socialAuthStore.currentPending?.bindToken) {
    message.warning($t('authentication.socialBindMissingToken'));
    return;
  }
  loading.value = true;
  try {
    const response = await socialAuthStore.bindExisting({
      captchaCode: values.captchaCode,
      captchaId: captchaId.value,
      identifier: values.username,
      password: values.password,
      type: 'username',
    });
    message.success($t('authentication.socialBindSuccess'));
    await finishSocialLogin(response?.login);
  } catch (error) {
    await refreshCaptcha();
    throw error;
  } finally {
    loading.value = false;
  }
}

void refreshCaptcha();
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="loading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-remember-me="false"
    :show-third-party-login="false"
    :sub-title="$t('authentication.socialBindSubtitle')"
    :title="$t('authentication.socialBindTitle')"
    @submit="handleSubmit"
  >
    <template #title>
      <div class="space-y-2 text-center">
        <h2 class="text-foreground text-2xl font-semibold">
          {{ $t('authentication.socialBindTitle') }}
        </h2>
        <p class="text-muted-foreground text-sm">
          {{ $t('authentication.socialBindSubtitle') }}
        </p>
      </div>
    </template>

    <template #default>
      <Card class="mb-5">
        <div class="flex items-center gap-4">
          <img
            :src="providerProfile.avatar"
            :alt="providerProfile.nickname"
            class="size-14 rounded-full border object-cover"
          />
          <div class="min-w-0 flex-1">
            <div class="text-foreground truncate text-base font-medium">
              {{ providerProfile.nickname }}
            </div>
            <div class="text-muted-foreground text-sm">
              {{ providerProfile.provider }}
            </div>
          </div>
        </div>
      </Card>

      <div class="mb-4 text-center text-sm text-muted-foreground">
        {{ $t('authentication.socialBindRiskTip') }}
      </div>

      <div class="grid gap-3">
        <Button block @click="goToRegister">
          {{ $t('authentication.createAndBindAccount') }}
        </Button>
        <Button block type="link" @click="goToLogin">
          {{ $t('authentication.backToLogin') }}
        </Button>
      </div>
    </template>
  </AuthenticationLogin>
</template>
