<script setup lang="ts">
import type {
  SocialLinkedAccount,
  SocialProvider,
  SocialProviderOption,
} from '#/api';

import { computed, onMounted, ref } from 'vue';

import { Button, Card, Empty, message, Spin, Tag } from 'ant-design-vue';

import {
  clearLinkOAuthContext,
  listLinkedAccountsApi,
  listSocialProvidersApi,
  persistLinkOAuthContext,
  startLinkSocialAccountApi,
  unlinkSocialAccountApi,
} from '#/api';
import { $t } from '#/locales';

const loading = ref(false);
const actionLoading = ref<null | SocialProvider>(null);
const accounts = ref<SocialLinkedAccount[]>([]);
const providers = ref<SocialProviderOption[]>([]);

const cards = computed(() => {
  const linkedMap = new Map(
    accounts.value.map((item) => [item.provider, item]),
  );
  return providers.value.map((provider) => {
    const account = linkedMap.get(provider.provider);
    return {
      account,
      connectedAt: account?.connectedAt || '--',
      credentialId: account?.credentialId || 0,
      enabled: provider.enabled,
      isBound: Boolean(account?.isBound),
      provider: provider.provider,
      providerLabel: provider.displayName,
      providerKey: provider.providerKey,
      title: $t('page.profile.socialBindingSettingCardTitle', [
        provider.displayName,
      ]),
    };
  });
});

async function loadData() {
  loading.value = true;
  try {
    const [linkedAccounts, providerOptions] = await Promise.all([
      listLinkedAccountsApi(),
      listSocialProvidersApi(),
    ]);
    accounts.value = linkedAccounts;
    providers.value = providerOptions;
  } catch (error: any) {
    message.error(
      error instanceof Error
        ? error.message
        : $t('page.profile.socialBindingSettingLoadFailed'),
    );
  } finally {
    loading.value = false;
  }
}

async function handleBind(provider: SocialProvider) {
  actionLoading.value = provider;
  try {
    const result = await startLinkSocialAccountApi(provider);
    if (!result.authorizationUrl) {
      throw new Error($t('page.profile.socialBindingSettingStartFailed'));
    }
    if (!result.operationId) {
      throw new Error($t('page.profile.socialBindingSettingStartFailed'));
    }
    clearLinkOAuthContext();
    persistLinkOAuthContext({
      operationId: result.operationId,
      provider,
      scene: 'bind',
    });
    window.location.href = result.authorizationUrl;
  } catch (error: any) {
    actionLoading.value = null;
    message.error(
      error instanceof Error
        ? error.message
        : $t('page.profile.socialBindingSettingStartFailed'),
    );
  }
}

async function handleUnbind(provider: SocialProvider, credentialId: number) {
  actionLoading.value = provider;
  try {
    await unlinkSocialAccountApi(credentialId);
    message.success($t('page.profile.socialBindingSettingUnbindSuccess'));
    await loadData();
  } catch (error: any) {
    message.error(
      error instanceof Error
        ? error.message
        : $t('page.profile.socialBindingSettingUnbindFailed'),
    );
  } finally {
    actionLoading.value = null;
  }
}

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <div class="space-y-4">
    <div class="text-muted-foreground text-sm">
      {{ $t('page.profile.socialBindingSettingDesc') }}
    </div>

    <Spin :spinning="loading">
      <div v-if="cards.length > 0" class="space-y-4">
        <Card
          v-for="item in cards"
          :key="item.providerKey"
          class="border-border/80"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-2">
                <div class="text-foreground text-sm font-medium">
                  {{ item.title }}
                </div>
                <Tag :color="item.isBound ? 'success' : 'default'">
                  {{
                    item.isBound
                      ? $t('authentication.bindingStatusBound')
                      : $t('authentication.bindingStatusUnbound')
                  }}
                </Tag>
              </div>
              <div class="text-muted-foreground text-sm">
                {{ $t('authentication.bindingAccountLabel') }}:
                {{
                  item.account?.displayName ||
                  $t('authentication.bindingEmptyValue')
                }}
              </div>
              <div class="text-muted-foreground text-sm">
                {{ $t('authentication.bindingConnectedAt') }}:
                {{ item.connectedAt }}
              </div>
            </div>
            <div class="flex gap-2">
              <Button
                v-if="!item.isBound"
                :disabled="!item.enabled"
                :loading="actionLoading === item.provider"
                size="small"
                type="primary"
                @click="handleBind(item.provider)"
              >
                {{ $t('authentication.bindAction') }}
              </Button>
              <Button
                v-else
                :loading="actionLoading === item.provider"
                danger
                size="small"
                @click="handleUnbind(item.provider, item.credentialId)"
              >
                {{ $t('authentication.unbindAction') }}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <Empty
        v-else
        :description="$t('page.profile.socialBindingSettingEmpty')"
      />
    </Spin>
  </div>
</template>
