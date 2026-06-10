<script setup lang="ts">
import { computed, ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { $t } from '#/locales';

import ProfileBase from './base-setting.vue';
import ProfileNotificationSetting from './notification-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSocialBindingSetting from './social-binding-setting.vue';

const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = computed(() => [
  {
    label: $t('page.profile.basicSetting'),
    value: 'basic',
  },
  {
    label: $t('page.profile.passwordSetting'),
    value: 'password',
  },
  {
    label: $t('page.profile.noticeSetting'),
    value: 'notice',
  },
  {
    label: $t('page.profile.socialBindingSetting'),
    value: 'social',
  },
]);
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    :title="$t('page.profile.title')"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
      <ProfileNotificationSetting v-if="tabsValue === 'notice'" />
      <ProfileSocialBindingSetting v-if="tabsValue === 'social'" />
    </template>
  </Profile>
</template>
