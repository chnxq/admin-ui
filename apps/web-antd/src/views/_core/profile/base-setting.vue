<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { userProfileClient } from '#/api/admin/clients';
import { $t } from '#/locales';

const profileBaseSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'realname',
      component: 'Input',
      label: $t('page.profile.realname'),
    },
    {
      fieldName: 'nickname',
      component: 'Input',
      label: $t('page.profile.nickname'),
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: $t('page.profile.email'),
    },
    {
      fieldName: 'mobile',
      component: 'Input',
      label: $t('page.profile.mobile'),
    },
    {
      fieldName: 'description',
      component: 'Textarea',
      label: $t('page.profile.description'),
    },
  ];
});

onMounted(async () => {
  const user = await userProfileClient.GetUser({});
  profileBaseSettingRef.value.getFormApi().setValues({
    realname: user.realname || '',
    nickname: user.nickname || '',
    email: user.email || '',
    mobile: user.mobile || '',
    description: user.description || '',
  });
});

async function handleSubmit(values: Record<string, any>) {
  await userProfileClient.UpdateUser({
    id: 0,
    updateMask: 'nickname,realname,email,mobile,description',
    data: {
      realname: values.realname,
      nickname: values.nickname,
      email: values.email,
      mobile: values.mobile,
      description: values.description,
    } as any,
  });
  message.success($t('page.profile.profileUpdated'));
}
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
