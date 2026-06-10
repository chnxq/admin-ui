<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationQrCodeLogin } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Badge, Button, Card } from 'ant-design-vue';

import { useSocialAuthStore } from '#/store';

defineOptions({ name: 'SocialAuthPending' });

const router = useRouter();
const socialAuthStore = useSocialAuthStore();

const providerLabel = computed(() => {
  switch (socialAuthStore.currentProvider) {
    case 'alipay': {
      return $t('authentication.alipayLogin');
    }
    case 'dingtalk': {
      return $t('authentication.dingdingLogin');
    }
    case 'github': {
      return $t('authentication.githubLogin');
    }
    case 'wechat': {
      return $t('authentication.wechatLogin');
    }
    default: {
      return $t('authentication.thirdPartyLogin');
    }
  }
});

const steps = computed(() => [
  $t('authentication.qrcodeStatusPending'),
  $t('authentication.qrcodeStatusScanned'),
  $t('authentication.qrcodeStatusConfirmed'),
]);

const currentStatus = computed(() => {
  switch (socialAuthStore.currentPending?.state) {
    case 'confirmed': {
      return $t('authentication.qrcodeStatusConfirmed');
    }
    case 'expired': {
      return $t('authentication.qrcodeStatusExpired');
    }
    case 'scanned': {
      return $t('authentication.qrcodeStatusScanned');
    }
    case 'unbound': {
      return $t('authentication.qrcodeStatusUnbound');
    }
    default: {
      return $t('authentication.qrcodeStatusPending');
    }
  }
});

const qrCodeText = computed(
  () => socialAuthStore.currentSession?.qrCodeUrl || 'about:blank',
);

let pollTimer: null | ReturnType<typeof setInterval> = null;

function goToBindPage() {
  void router.push('/auth/social/bind');
}

onMounted(async () => {
  if (!socialAuthStore.currentSession || !socialAuthStore.currentProvider) {
    await socialAuthStore.start('dingtalk');
  }
  await socialAuthStore.complete(
    `${socialAuthStore.currentProvider || 'dingtalk'}-demo-code`,
    socialAuthStore.currentSession?.sessionToken,
  );
  pollTimer = setInterval(() => {
    void socialAuthStore.poll();
  }, 3000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template>
  <div class="space-y-5">
    <AuthenticationQrCodeLogin
      :description="
        $t('authentication.qrcodeFlowPromptByProvider', [providerLabel])
      "
      :qr-code-text="qrCodeText"
      :sub-title="
        $t('authentication.qrcodeFlowSubtitleByProvider', [providerLabel])
      "
      :title="$t('authentication.qrcodeFlowTitleByProvider', [providerLabel])"
    />

    <Card>
      <div class="mb-3 flex items-center justify-between">
        <div class="text-foreground text-sm font-medium">
          {{ $t('authentication.qrcodeStatusTitle') }}
        </div>
        <Badge :text="currentStatus" status="processing" />
      </div>
      <div class="space-y-2">
        <div
          v-for="step in steps"
          :key="step"
          class="bg-muted/60 text-muted-foreground rounded-md px-3 py-2 text-sm"
        >
          {{ step }}
        </div>
      </div>
      <Button block class="mt-4" @click="goToBindPage">
        {{ $t('authentication.mockGoToBindPage') }}
      </Button>
    </Card>
  </div>
</template>
