<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLogin } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Button, Card, message } from 'ant-design-vue';

import { useSocialAuthStore } from '#/store';

defineOptions({ name: 'SocialAuthBind' });

const router = useRouter();
const socialAuthStore = useSocialAuthStore();

const providerProfile = computed(() => ({
  avatar:
    socialAuthStore.profileSummary?.avatar ||
    'https://avatars.githubusercontent.com/u/9919?s=160&v=4',
  nickname: socialAuthStore.profileSummary?.nickname || 'octocat',
  provider: socialAuthStore.profileSummary?.providerLabel || 'GitHub',
}));

const supportedProviders = computed(() => [
  $t('authentication.githubLogin'),
  $t('authentication.dingdingLogin'),
  $t('authentication.wechatLogin'),
  $t('authentication.alipayLogin'),
]);

function goToLogin() {
  void router.push('/auth/login');
}

function goToRegister() {
  void router.push('/auth/register');
}

async function goToBindExisting() {
  if (!socialAuthStore.currentPending?.bindToken) {
    message.warning($t('authentication.socialBindMissingToken'));
    return;
  }
  await socialAuthStore.bindExisting({
    captchaCode: '',
    captchaId: '',
    identifier: 'platform_admin',
    password: '123456',
    type: 'username',
  });
  message.success($t('authentication.socialBindSuccess'));
}
</script>

<template>
  <AuthenticationLogin
    :form-schema="[]"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-remember-me="false"
    :show-third-party-login="false"
    :sub-title="$t('authentication.socialBindSubtitle')"
    :title="$t('authentication.socialBindTitle')"
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

      <div class="mb-5 flex flex-wrap gap-2">
        <span
          v-for="provider in supportedProviders"
          :key="provider"
          class="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs"
        >
          {{ provider }}
        </span>
      </div>

      <div class="grid gap-3">
        <Button block type="primary" @click="goToBindExisting">
          {{ $t('authentication.bindExistingAccount') }}
        </Button>
        <Button block @click="goToRegister">
          {{ $t('authentication.createAndBindAccount') }}
        </Button>
        <p class="text-muted-foreground text-center text-xs leading-5">
          {{ $t('authentication.socialBindRiskTip') }}
        </p>
        <Button block type="link" @click="goToLogin">
          {{ $t('authentication.backToLogin') }}
        </Button>
      </div>
    </template>
  </AuthenticationLogin>
</template>
