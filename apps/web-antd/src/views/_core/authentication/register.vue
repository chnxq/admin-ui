<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { authenticationClient } from '#/api/admin/clients';

defineOptions({ name: 'Register' });

const loading = ref(false);
const router = useRouter();
const registerMode = ref<'email' | 'mobile' | 'username'>('username');

const formSchema = computed((): VbenFormSchema[] => {
  const baseSchema: VbenFormSchema[] = [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      renderComponentContent() {
        return {
          strengthText: () => $t('authentication.passwordStrength'),
        };
      },
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: $t('authentication.passwordTip') })
            .min(1, { message: $t('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
    {
      component: 'VbenCheckbox',
      fieldName: 'agreePolicy',
      renderComponentContent: () => ({
        default: () =>
          h('span', [
            $t('authentication.agree'),
            h(
              'a',
              {
                class: 'vben-link ml-1 ',
                href: '',
              },
              `${$t('authentication.privacyPolicy')} & ${$t('authentication.terms')}`,
            ),
          ]),
      }),
      rules: z.boolean().refine((value) => !!value, {
        message: $t('authentication.agreeTip'),
      }),
    },
  ];

  if (registerMode.value === 'email') {
    return [
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.emailTip'),
        },
        fieldName: 'email',
        label: $t('authentication.email'),
        rules: z
          .string()
          .min(1, { message: $t('authentication.emailTip') })
          .email({ message: $t('authentication.emailValidErrorTip') }),
      },
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.codeTip', [6]),
        },
        fieldName: 'emailCode',
        label: $t('authentication.code'),
        rules: z
          .string()
          .min(6, { message: $t('authentication.codeTip', [6]) }),
      },
      ...baseSchema.slice(1),
    ];
  }

  if (registerMode.value === 'mobile') {
    return [
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.mobileTip'),
        },
        fieldName: 'mobile',
        label: $t('authentication.mobile'),
        rules: z
          .string()
          .min(1, { message: $t('authentication.mobileTip') })
          .refine((v) => /^\d{11}$/.test(v), {
            message: $t('authentication.mobileErrortip'),
          }),
      },
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.codeTip', [6]),
        },
        fieldName: 'mobileCode',
        label: $t('authentication.code'),
        rules: z
          .string()
          .min(6, { message: $t('authentication.codeTip', [6]) }),
      },
      ...baseSchema.slice(1),
    ];
  }

  return baseSchema;
});

async function handleSubmit(value: Recordable<any>) {
  loading.value = true;
  try {
    if (registerMode.value === 'email') {
      message.warning($t('authentication.registerEmailNotImplemented'));
      return;
    }
    if (registerMode.value === 'mobile') {
      message.warning($t('authentication.registerMobileNotImplemented'));
      return;
    }
    await authenticationClient.RegisterUser({
      byUsername: {
        password: value.password,
        username: value.username,
      },
      clientType: 'admin',
      tenantCode: '',
    });
    message.success($t('authentication.registerSuccess'));
    await router.push('/auth/login');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationRegister
    :form-schema="formSchema"
    :loading="loading"
    :sub-title="$t('authentication.registerModeSubtitle')"
    @submit="handleSubmit"
  >
    <template #title>
      <div class="space-y-3 text-center">
        <h2 class="text-foreground text-2xl font-semibold">
          {{ $t('authentication.createAnAccount') }}
        </h2>
        <p class="text-muted-foreground text-sm">
          {{ $t('authentication.registerModeSubtitle') }}
        </p>
        <div class="flex justify-center gap-2">
          <button
            class="rounded-full border px-3 py-1 text-xs"
            :class="
              registerMode === 'username'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border'
            "
            @click="registerMode = 'username'"
          >
            {{ $t('authentication.registerByUsername') }}
          </button>
          <button
            class="rounded-full border px-3 py-1 text-xs"
            :class="
              registerMode === 'email'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border'
            "
            @click="registerMode = 'email'"
          >
            {{ $t('authentication.registerByEmail') }}
          </button>
          <button
            class="rounded-full border px-3 py-1 text-xs"
            :class="
              registerMode === 'mobile'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border'
            "
            @click="registerMode = 'mobile'"
          >
            {{ $t('authentication.registerByMobile') }}
          </button>
        </div>
      </div>
    </template>
  </AuthenticationRegister>
</template>
