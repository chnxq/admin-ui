<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { AuthApi, SocialProvider } from '#/api';

import { computed, h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { SvgDingDingIcon, SvgGithubIcon, SvgWeChatIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import { Button, Tooltip } from 'ant-design-vue';

import { getCaptchaApi } from '#/api';
import { useAuthStore, useSocialAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const socialAuthStore = useSocialAuthStore();
const router = useRouter();
const captchaImage = ref('');
const captchaId = ref('');
const submitPending = ref(false);
const loginFormRef = ref<InstanceType<typeof AuthenticationLogin>>();

async function clearCaptchaCode() {
  const formApi = loginFormRef.value?.getFormApi?.();
  if (!formApi) {
    return;
  }
  await formApi.setFieldValue('captchaCode', '', false);
  await formApi.resetValidate();
}

async function refreshCaptcha() {
  const captcha = await getCaptchaApi();
  captchaImage.value = captcha.imageBase64;
  captchaId.value = captcha.captchaId;
  await clearCaptchaCode();
}

async function handleSubmit(values: Recordable<any>) {
  if (submitPending.value || authStore.loginLoading) {
    return;
  }
  submitPending.value = true;
  try {
    const result = await authStore.authLogin({
      ...values,
      captchaCode: values.captchaCode,
      captchaId: captchaId.value,
    } satisfies AuthApi.LoginParams);
    if (result === null) {
      await refreshCaptcha();
    }
  } finally {
    submitPending.value = false;
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

const socialProviders = computed<
  Array<{
    icon: any;
    key: SocialProvider;
    label: string;
  }>
>(() => [
  {
    icon: SvgGithubIcon,
    key: 'github',
    label: $t('authentication.githubLogin'),
  },
  {
    icon: SvgDingDingIcon,
    key: 'dingtalk',
    label: $t('authentication.dingdingLogin'),
  },
  {
    icon: SvgWeChatIcon,
    key: 'wechat',
    label: $t('authentication.wechatLogin'),
  },
  {
    icon: SvgWeChatIcon,
    key: 'alipay',
    label: $t('authentication.alipayLogin'),
  },
]);

async function openSocialBindPage(provider: SocialProvider = 'github') {
  const session = await socialAuthStore.start(provider);
  if (!session) {
    return;
  }
  if (
    (provider === 'github' ||
      provider === 'wechat' ||
      provider === 'dingtalk') &&
    session.authorizationUrl
  ) {
    window.location.href = session.authorizationUrl;
    return;
  }
  const result = await socialAuthStore.complete(
    `${provider}-demo-code`,
    session.sessionToken,
  );
  if (result?.state === 'unbound') {
    void router.push('/auth/social/bind');
  }
}
</script>

<template>
  <AuthenticationLogin
    ref="loginFormRef"
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="true"
    :show-forget-password="false"
    :show-qrcode-login="true"
    :show-register="true"
    :show-third-party-login="true"
    @submit="handleSubmit"
  >
    <template #third-party-login>
      <div class="w-full sm:mx-auto md:max-w-md">
        <div class="mt-4 flex items-center justify-between">
          <span
            class="w-[35%] border-b border-input dark:border-gray-600"
          ></span>
          <span class="text-center text-xs text-muted-foreground uppercase">
            {{ $t('authentication.thirdPartyLogin') }}
          </span>
          <span
            class="w-[35%] border-b border-input dark:border-gray-600"
          ></span>
        </div>

        <div class="mt-4 flex flex-wrap justify-center gap-3">
          <Tooltip
            v-for="provider in socialProviders"
            :key="provider.key"
            :title="provider.label"
          >
            <Button shape="circle" @click="openSocialBindPage(provider.key)">
              <component :is="provider.icon" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </template>
    <template #third-party-login-extra>
      <div class="mt-3 grid gap-2">
        <Button block @click="openSocialBindPage()">
          {{ $t('authentication.mockOpenSocialBind') }}
        </Button>
      </div>
    </template>
  </AuthenticationLogin>
</template>
