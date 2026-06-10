<script setup lang="ts">
import { computed } from 'vue';

import { Button, Card, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

const accounts = computed(() => [
  {
    id: 'github',
    provider: 'GitHub',
    name: 'octocat',
    status: $t('authentication.bindingStatusBound'),
    connectedAt: '2026-06-10 10:00',
  },
  {
    id: 'wechat-web',
    provider: $t('authentication.providerWechatWeb'),
    name: $t('authentication.bindingEmptyValue'),
    status: $t('authentication.bindingStatusUnbound'),
    connectedAt: '--',
  },
  {
    id: 'dingtalk-web',
    provider: $t('authentication.providerDingtalkWeb'),
    name: $t('authentication.bindingEmptyValue'),
    status: $t('authentication.bindingStatusUnbound'),
    connectedAt: '--',
  },
  {
    id: 'alipay-miniapp',
    provider: $t('authentication.providerAlipayMiniapp'),
    name: $t('authentication.bindingEmptyValue'),
    status: $t('authentication.bindingStatusUnbound'),
    connectedAt: '--',
  },
]);
</script>

<template>
  <div class="space-y-4">
    <Card
      v-for="account in accounts"
      :key="account.id"
      class="border-border/80"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <div class="text-foreground text-sm font-medium">
              {{ account.provider }}
            </div>
            <Tag>
              {{ account.status }}
            </Tag>
          </div>
          <div class="text-muted-foreground text-sm">
            {{ $t('authentication.bindingAccountLabel') }}: {{ account.name }}
          </div>
          <div class="text-muted-foreground text-sm">
            {{ $t('authentication.bindingConnectedAt') }}:
            {{ account.connectedAt }}
          </div>
        </div>
        <div class="flex gap-2">
          <Button size="small">
            {{ $t('authentication.bindAction') }}
          </Button>
          <Button size="small" type="link">
            {{ $t('authentication.unbindAction') }}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>
