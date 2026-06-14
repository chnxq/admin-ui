<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ProfileBaseSetting } from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { userProfileClient } from '#/api/admin/clients';
import { getProfileTenantOptionsApi } from '#/api/admin/user';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';

const profileBaseSettingRef = ref();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const router = useRouter();
const tenantOptions = ref<{ label: string; value: number }[]>([]);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'tenantId',
      component: 'Select',
      label: $t('page.profile.tenant'),
      componentProps: {
        options: tenantOptions.value,
        placeholder: $t('page.profile.tenantPlaceholder'),
        showSearch: true,
        optionFilterProp: 'label',
      },
    },
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
  const [tenantResult, user] = await Promise.all([
    getProfileTenantOptionsApi(),
    userProfileClient.GetUser({}),
  ]);
  tenantOptions.value = (tenantResult.items || [])
    .map((item) => ({
      label: `${item.name || '-'} (${item.code || item.id || '-'})`,
      value: Number(item.id || 0),
    }))
    .filter((item) => item.value > 0);
  profileBaseSettingRef.value.getFormApi().setValues({
    tenantId: user.tenantId || undefined,
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
    updateMask: 'tenantId,nickname,realname,email,mobile,description',
    data: {
      tenantId: values.tenantId,
      realname: values.realname,
      nickname: values.nickname,
      email: values.email,
      mobile: values.mobile,
      description: values.description,
    } as any,
  });
  const [userInfo] = await Promise.all([
    authStore.fetchUserInfo(),
    authStore.fetchAccessCodes(),
  ]);
  accessStore.setAccessMenus([]);
  accessStore.setAccessRoutes([]);
  accessStore.setIsAccessChecked(false);
  message.success($t('page.profile.profileUpdated'));
  if (userInfo?.profileCompleted) {
    await router.replace(userInfo.homePath || preferences.app.defaultHomePath);
  }
}
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
