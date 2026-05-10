<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { AuthApi } from '#/api';

import { computed, h, onMounted, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getCaptchaApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const captchaImage = ref('');
const captchaId = ref('');

async function refreshCaptcha() {
  const captcha = await getCaptchaApi();
  captchaImage.value = captcha.imageBase64;
  captchaId.value = captcha.captchaId;
}

async function handleSubmit(values: Recordable<any>) {
  const result = await authStore.authLogin({
    ...values,
    captchaCode: values.captchaCode,
    captchaId: captchaId.value,
  } satisfies AuthApi.LoginParams);
  if (result === null) {
    await refreshCaptcha();
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        autocomplete: 'username',
        name: 'username',
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.usernameTip') })
        .default('admin'),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        autocomplete: 'current-password',
        name: 'password',
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.passwordTip') })
        .default('123456'),
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
      rules: z
        .string()
        .min(4, { message: $t('authentication.codeTip', [4]) })
        .default(''),
      suffix: () =>
        h('img', {
          alt: 'captcha',
          onClick: refreshCaptcha,
          src: captchaImage.value,
          style:
            'height:32px;min-width:96px;cursor:pointer;border-radius:4px;border:1px solid #e5e7eb;',
        }),
    },
  ];
});

onMounted(async () => {
  await refreshCaptcha();
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    @submit="handleSubmit"
  />
</template>
