<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { userProfileClient } from '#/api/admin/clients';

const profileBaseSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'realname',
      component: 'Input',
      label: '姓名',
    },
    {
      fieldName: 'nickname',
      component: 'Input',
      label: '昵称',
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: '邮箱',
    },
    {
      fieldName: 'mobile',
      component: 'Input',
      label: '手机号',
    },
    {
      fieldName: 'description',
      component: 'Textarea',
      label: '个人简介',
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
  message.success('个人信息已更新');
}
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
