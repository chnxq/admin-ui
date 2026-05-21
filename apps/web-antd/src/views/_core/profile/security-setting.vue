<script setup lang="ts">
import { computed } from 'vue';

import { ProfileSecuritySetting } from '@vben/common-ui';

import { $t } from '#/locales';

const formSchema = computed(() => {
  return [
    {
      value: true,
      fieldName: 'accountPassword',
      label: $t('page.profile.accountPassword'),
      description: $t('page.profile.currentPasswordStrength'),
    },
    {
      value: true,
      fieldName: 'securityPhone',
      label: $t('page.profile.securityPhone'),
      description: $t('page.profile.securityPhoneDesc'),
    },
    {
      value: true,
      fieldName: 'securityQuestion',
      label: $t('page.profile.securityQuestion'),
      description: $t('page.profile.securityQuestionDesc'),
    },
    {
      value: true,
      fieldName: 'securityEmail',
      label: $t('page.profile.securityEmail'),
      description: $t('page.profile.securityEmailDesc'),
    },
    {
      value: false,
      fieldName: 'securityMfa',
      label: $t('page.profile.securityMfa'),
      description: $t('page.profile.securityMfaDesc'),
    },
  ];
});
</script>
<template>
  <ProfileSecuritySetting :form-schema="formSchema" />
</template>
