<script setup lang="ts">
import { computed } from 'vue';

import { ProfileNotificationSetting } from '@vben/common-ui';

import { $t } from '#/locales';

const formSchema = computed(() => {
  return [
    {
      value: true,
      fieldName: 'accountPassword',
      label: $t('page.profile.notificationAccount'),
      description: $t('page.profile.notificationAccountDesc'),
    },
    {
      value: true,
      fieldName: 'systemMessage',
      label: $t('page.profile.notificationSystem'),
      description: $t('page.profile.notificationSystemDesc'),
    },
    {
      value: true,
      fieldName: 'todoTask',
      label: $t('page.profile.notificationTodo'),
      description: $t('page.profile.notificationTodoDesc'),
    },
  ];
});
</script>
<template>
  <ProfileNotificationSetting :form-schema="formSchema" />
</template>
