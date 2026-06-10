<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { AuthenticationQrCodeLogin } from '@vben/common-ui';
import { LOGIN_PATH } from '@vben/constants';
import { $t } from '@vben/locales';

import { Button, Card } from 'ant-design-vue';

defineOptions({ name: 'QrCodeLogin' });

const router = useRouter();

function goToPendingFlow() {
  void router.push('/auth/social/pending');
}
</script>

<template>
  <div class="space-y-5">
    <AuthenticationQrCodeLogin
      :description="$t('authentication.qrcodeFlowPrompt')"
      :login-path="LOGIN_PATH"
      qr-code-text="about:blank"
      :sub-title="$t('authentication.qrcodeFlowSubtitle')"
      :title="$t('authentication.qrcodeFlowTitle')"
    />
    <Card>
      <div class="space-y-3">
        <div class="text-foreground text-sm font-medium">
          {{ $t('authentication.qrcodeStatusTitle') }}
        </div>
        <p class="text-muted-foreground text-sm leading-6">
          {{ $t('authentication.qrcodeFlowDetail') }}
        </p>
        <Button block @click="goToPendingFlow">
          {{ $t('authentication.mockStartQrcodeFlow') }}
        </Button>
      </div>
    </Card>
  </div>
</template>
