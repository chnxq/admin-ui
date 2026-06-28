<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AdminOrgUnit } from '#/api/admin/org-units';
import type { AdminPosition } from '#/api/admin/positions';
import type { AdminRole } from '#/api/admin/roles';
import type {
  AdminUser,
  AdminUserSaveInput,
  AdminUserStatus,
} from '#/api/admin/users';

import { computed, nextTick, onMounted, reactive, ref, unref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Form,
  message,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listAdminOrgUnitsApi } from '#/api/admin/org-units';
import { listAdminPositionsApi } from '#/api/admin/positions';
import { listAdminRolesApi } from '#/api/admin/roles';
import {
  createAdminUserApi,
  deleteAdminUserApi,
  getAdminUserApi,
  listAdminUsersApi,
  updateAdminUserApi,
} from '#/api/admin/users';
import AdminGeneratedForm from '#/components/admin-generated-form/index.vue';
import { normalizeAdminTableSortDirection } from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';
import {
  buildFormOptions as buildGeneratedDialogFormOptions,
  buildListGridColumns as buildGeneratedListGridColumns,
  buildSearchFormOptions as buildGeneratedSearchFormOptions,
} from '#/views/generated/admin/system/user.meta';

interface AdminUserFormModel extends AdminUserSaveInput {
  address: string;
  avatar: string;
  gender?: 'FEMALE' | 'MALE' | 'SECRET';
  orgUnitIds: number[];
  password: string;
  positionIds: number[];
  region: string;
  roleIds: number[];
  status?: AdminUserStatus;
  telephone: string;
  username: string;
}

type UserSelectOption = {
  label: string;
  meta: string;
  value: number;
};

const USER_ACCESS = {
  create: ['users:create'],
  delete: ['users:delete'],
  edit: ['users:edit'],
  export: ['users:export'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const currentTenantId = computed(() => userStore.userInfo?.tenantId ?? 0);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || '-',
);

const statusOptions = [
  { label: $t('enum.user.status.NORMAL'), value: 'NORMAL' },
  { label: $t('enum.user.status.DISABLED'), value: 'DISABLED' },
  { label: $t('enum.user.status.PENDING'), value: 'PENDING' },
  { label: $t('enum.user.status.LOCKED'), value: 'LOCKED' },
  { label: $t('enum.user.status.EXPIRED'), value: 'EXPIRED' },
  { label: $t('enum.user.status.CLOSED'), value: 'CLOSED' },
];

const genderOptions = [
  { label: $t('enum.user.gender.SECRET'), value: 'SECRET' },
  { label: $t('enum.user.gender.MALE'), value: 'MALE' },
  { label: $t('enum.user.gender.FEMALE'), value: 'FEMALE' },
];

const statusTextMap: Record<AdminUserStatus, string> = {
  CLOSED: $t('enum.user.status.CLOSED'),
  DISABLED: $t('enum.user.status.DISABLED'),
  EXPIRED: $t('enum.user.status.EXPIRED'),
  LOCKED: $t('enum.user.status.LOCKED'),
  NORMAL: $t('enum.user.status.NORMAL'),
  PENDING: $t('enum.user.status.PENDING'),
};

const modalOpen = ref(false);
const submitting = ref(false);
const optionLoading = ref(false);
const editingId = ref<number>();
const editingReadonly = ref(false);
const formRef = ref();
const orgOptions = ref<AdminOrgUnit[]>([]);
const positionOptions = ref<AdminPosition[]>([]);
const roleOptions = ref<AdminRole[]>([]);

const formModel = reactive<AdminUserFormModel>({
  address: '',
  avatar: '',
  description: '',
  email: '',
  gender: undefined,
  mobile: '',
  nickname: '',
  orgUnitIds: [],
  password: '',
  positionIds: [],
  realname: '',
  region: '',
  remark: '',
  roleIds: [],
  status: undefined,
  telephone: '',
  username: '',
});

const modalTitle = computed(() =>
  editingId.value
    ? editingReadonly.value
      ? $t('common.detail')
      : $t('page.user.editTitle')
    : $t('page.user.createTitle'),
);

const orgSelectOptions = computed(
  () =>
    orgOptions.value.map((item) => ({
      label: item.name ?? `#${item.id}`,
      meta: item.code ?? item.type ?? '-',
      value: item.id as number,
    })) satisfies UserSelectOption[],
);

const positionSelectOptions = computed(
  () =>
    positionOptions.value.map((item) => ({
      label: item.name ?? `#${item.id}`,
      meta: item.orgUnitName ?? item.code ?? '-',
      value: item.id as number,
    })) satisfies UserSelectOption[],
);

const roleSelectOptions = computed(
  () =>
    roleOptions.value.map((item) => ({
      label: item.name ?? `#${item.id}`,
      meta: item.code ?? item.type ?? '-',
      value: item.id as number,
    })) satisfies UserSelectOption[],
);

const formRules = computed<Record<string, Rule[]>>(() => ({
  email: [
    {
      message: $t('ui.formRules.required', [$t('page.user.email')]),
      type: 'email',
    },
  ],
  password: editingId.value
    ? []
    : [
        {
          message: $t('ui.formRules.required', [$t('page.user.password')]),
          required: true,
        },
      ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.user.status')]),
      required: true,
    },
  ],
  username: [
    {
      message: $t('ui.formRules.required', [$t('page.user.username')]),
      required: true,
    },
  ],
}));

const generatedFormOptions = buildGeneratedSearchFormOptions($t);
const generatedDialogFormOptions = buildGeneratedDialogFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => {
    switch (item.fieldName) {
      case 'orgUnitId': {
        return {
          ...item,
          formItemClass: 'md:col-span-1',
          componentProps: () => ({
            allowClear: true,
            loading: optionLoading.value,
            options: unref(orgSelectOptions),
            placeholder: $t('page.user.selectFilterOrgUnitId'),
            showSearch: true,
          }),
        };
      }
      case 'positionId': {
        return {
          ...item,
          formItemClass: 'md:col-span-1',
          componentProps: () => ({
            allowClear: true,
            loading: optionLoading.value,
            options: unref(positionSelectOptions),
            placeholder: $t('page.user.selectFilterPositionId'),
            showSearch: true,
          }),
        };
      }
      case 'roleId': {
        return {
          ...item,
          formItemClass: 'md:col-span-1',
          componentProps: () => ({
            allowClear: true,
            loading: optionLoading.value,
            options: unref(roleSelectOptions),
            placeholder: $t('page.user.selectFilterRoleId'),
            showSearch: true,
          }),
        };
      }
      case 'status': {
        return {
          ...item,
          formItemClass: 'md:col-span-1',
          componentProps: {
            ...item.componentProps,
            options: statusOptions,
          },
        };
      }
      default: {
        return {
          ...item,
          formItemClass: 'md:col-span-1',
        };
      }
    }
  }),
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

const dialogFormSchema = computed(() =>
  (generatedDialogFormOptions.schema || []).map((item) => {
    const fieldName = item.fieldName;
    const placeholderMap: Record<string, string> = {
      address: $t('page.user.placeholderAddress'),
      avatar: $t('page.user.placeholderAvatar'),
      description: $t('page.user.placeholderDescription'),
      email: $t('page.user.placeholderEmail'),
      mobile: $t('page.user.placeholderMobile'),
      nickname: $t('page.user.placeholderNickname'),
      realname: $t('page.user.placeholderRealname'),
      region: $t('page.user.placeholderRegion'),
      remark: $t('page.user.placeholderRemark'),
      telephone: $t('page.user.placeholderTelephone'),
      username: $t('page.user.placeholderUsername'),
    };
    if (fieldName === 'status') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: statusOptions,
        },
        rules: formRules.value.status,
      };
    }
    if (fieldName === 'gender') {
      return {
        ...item,
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          allowClear: true,
          options: genderOptions,
          placeholder: $t('page.user.selectGender'),
        },
      };
    }
    if (fieldName === 'password') {
      return {
        ...item,
        component: 'Password',
        formItemClass: 'admin-user-form-grid--full',
        componentProps: {
          ...item.componentProps,
          autocomplete: 'new-password',
          name: 'admin-user-password',
          placeholder: editingId.value
            ? $t('page.user.placeholderPasswordKeepEmpty')
            : $t('page.user.placeholderPassword'),
        },
        rules: formRules.value.password,
      };
    }
    if (fieldName === 'orgUnitIds') {
      return {
        ...item,
        formItemClass: 'admin-user-form-grid--full',
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          loading: optionLoading.value,
          mode: 'multiple',
          options: unref(orgSelectOptions),
          placeholder: $t('page.user.selectOrgUnit'),
          showSearch: true,
        },
      };
    }
    if (fieldName === 'positionIds') {
      return {
        ...item,
        formItemClass: 'admin-user-form-grid--full',
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          loading: optionLoading.value,
          mode: 'multiple',
          options: unref(positionSelectOptions),
          placeholder: $t('page.user.selectPosition'),
          showSearch: true,
        },
      };
    }
    if (fieldName === 'roleIds') {
      return {
        ...item,
        formItemClass: 'admin-user-form-grid--full',
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          loading: optionLoading.value,
          mode: 'multiple',
          options: unref(roleSelectOptions),
          placeholder: $t('page.user.selectRole'),
          showSearch: true,
        },
      };
    }
    if (
      fieldName === 'avatar' ||
      fieldName === 'address' ||
      fieldName === 'region'
    ) {
      return {
        ...item,
        formItemClass: 'admin-user-form-grid--full',
        componentProps: {
          ...item.componentProps,
          autocomplete: 'off',
          name: `admin-user-${fieldName}`,
          placeholder: placeholderMap[fieldName],
        },
      };
    }
    if (fieldName === 'description') {
      return {
        ...item,
        formItemClass: 'admin-user-form-grid--full',
        componentProps: {
          ...item.componentProps,
          autoSize: { minRows: 3, maxRows: 5 },
          placeholder: $t('page.user.placeholderDescription'),
        },
      };
    }
    if (fieldName === 'remark') {
      return {
        ...item,
        formItemClass: 'admin-user-form-grid--full',
        componentProps: {
          ...item.componentProps,
          autoSize: { minRows: 2, maxRows: 4 },
          placeholder: $t('page.user.placeholderRemark'),
        },
      };
    }
    return {
      ...item,
      componentProps: {
        ...item.componentProps,
        autocomplete: 'off',
        name: fieldName ? `admin-user-${fieldName}` : undefined,
        placeholder: fieldName ? placeholderMap[fieldName] : undefined,
        disabled:
          fieldName === 'username' ? Boolean(editingId.value) : undefined,
      },
      rules: fieldName ? formRules.value[fieldName] : item.rules,
    };
  }),
);

const generatedColumns = (buildGeneratedListGridColumns($t) ?? []).map(
  (column: any) => {
    if (
      column?.field === 'orgUnits' ||
      column?.field === 'positions' ||
      column?.field === 'roles'
    ) {
      return {
        ...column,
        sortable: false,
      };
    }
    return column;
  },
);

const gridOptions: VxeTableGridOptions<AdminUser> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    ...generatedColumns,
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 150,
    },
  ],
  exportConfig: {
    filename: 'system-users',
    type: 'csv',
  },
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async (
        { page, sort }: { page: any; sort: any },
        formValues: Record<string, any>,
      ) => {
        const sortField = String(sort.field || 'id');
        const direction =
          normalizeAdminTableSortDirection(sort.order) ?? 'DESC';

        return await listAdminUsersApi({
          mobile: formValues.mobile,
          orgUnitId: formValues.orgUnitId,
          page: page.currentPage,
          pageSize: page.pageSize,
          positionId: formValues.positionId,
          realname: formValues.realname,
          roleId: formValues.roleId,
          sorting: [
            {
              direction,
              field: toUserSortField(sortField),
            },
          ],
          status: formValues.status,
          telephone: formValues.telephone,
          username: formValues.username,
        });
      },
    },
    sort: true,
  },
  rowConfig: {
    isHover: true,
  },
  stripe: true,
  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    slots: {
      toolPrefix: 'toolPrefix',
    },
    zoom: true,
  },
};

function toUserSortField(sortField: string) {
  switch (sortField) {
    case 'createdAt': {
      return 'created_at';
    }
    case 'lastLoginAt': {
      return 'last_login_at';
    }
    case 'nickname': {
      return 'nickname';
    }
    case 'realname': {
      return 'realname';
    }
    case 'tenantName': {
      return 'tenant_id';
    }
    default: {
      return sortField;
    }
  }
}

function resetFormModel() {
  Object.assign(formModel, {
    address: '',
    avatar: '',
    description: '',
    email: '',
    gender: undefined,
    mobile: '',
    nickname: '',
    orgUnitIds: [],
    password: '',
    positionIds: [],
    realname: '',
    region: '',
    remark: '',
    roleIds: [],
    status: undefined,
    telephone: '',
    username: '',
  });
}

function displayRoles(record: AdminUser) {
  return record.roleNames?.length ? record.roleNames : (record.roles ?? []);
}

function displayOrgUnits(record: AdminUser) {
  return record.orgUnitNames ?? [];
}

function displayPositions(record: AdminUser) {
  return record.positionNames ?? [];
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getTenantText(record: AdminUser) {
  return record.tenantName || '-';
}

function getUserIdentityText(record: AdminUser) {
  return record.realname || record.username || record.nickname || '-';
}

function getUserIdentityTooltipLines(record: AdminUser) {
  return [
    `${$t('page.user.username')}: ${record.username || '-'}`,
    `${$t('page.user.realname')}: ${record.realname || '-'}`,
    `${$t('page.user.nickname')}: ${record.nickname || '-'}`,
  ];
}
function getStatusText(status?: AdminUserStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminUserStatus) {
  if (status === 'NORMAL') {
    return 'success';
  }
  if (status === 'PENDING') {
    return 'processing';
  }
  if (status === 'LOCKED') {
    return 'warning';
  }
  if (status === 'DISABLED' || status === 'CLOSED') {
    return 'error';
  }
  return 'default';
}

function canMutateUser(record: AdminUser) {
  return (record.tenantId ?? 0) === currentTenantId.value;
}

async function loadReferenceOptions() {
  return await loadReferenceOptionsForTenant();
}

async function loadReferenceOptionsForTenant(tenantId?: number) {
  optionLoading.value = true;
  try {
    const [orgResult, positionResult, roleResult] = await Promise.all([
      listAdminOrgUnitsApi({
        page: 1,
        pageSize: 200,
        sorting: [{ direction: 'ASC', field: 'sort_order' }],
        tenantId,
      }),
      listAdminPositionsApi({
        page: 1,
        pageSize: 200,
        sorting: [{ direction: 'ASC', field: 'sort_order' }],
        tenantId,
      }),
      listAdminRolesApi({
        page: 1,
        pageSize: 200,
        sorting: [{ direction: 'ASC', field: 'sort_order' }],
        tenantId,
      }),
    ]);
    orgOptions.value = orgResult.items;
    positionOptions.value = positionResult.items;
    roleOptions.value = roleResult.items;
  } finally {
    optionLoading.value = false;
  }
}

async function openCreate() {
  editingId.value = undefined;
  editingReadonly.value = false;
  resetFormModel();
  await loadReferenceOptionsForTenant(currentTenantId.value || undefined);
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminUser) {
  if (!record.id) {
    message.warning($t('page.user.missingId'));
    return;
  }

  optionLoading.value = true;
  try {
    const detail = await getAdminUserApi(record.id);
    await loadReferenceOptionsForTenant(detail.tenantId ?? undefined);
    editingId.value = record.id;
    editingReadonly.value = !canMutateUser(record);
    Object.assign(formModel, {
      address: detail.address ?? '',
      avatar: detail.avatar ?? '',
      description: detail.description ?? '',
      email: detail.email ?? '',
      gender: detail.gender,
      mobile: detail.mobile ?? '',
      nickname: detail.nickname ?? '',
      orgUnitIds: detail.orgUnitIds ?? [],
      password: '',
      positionIds: detail.positionIds ?? [],
      realname: detail.realname ?? '',
      region: detail.region ?? '',
      remark: detail.remark ?? '',
      roleIds: detail.roleIds ?? [],
      status: detail.status,
      telephone: detail.telephone ?? '',
      username: detail.username ?? '',
    });
    modalOpen.value = true;
    await nextTick();
    formRef.value?.clearValidate();
  } catch (error) {
    message.error((error as Error).message || $t('page.user.loadDetailFailed'));
  } finally {
    optionLoading.value = false;
  }
}

async function submitUser() {
  if (editingReadonly.value) {
    modalOpen.value = false;
    return;
  }
  try {
    await formRef.value?.validate();
  } catch (error) {
    if ((error as { errorFields?: unknown[] })?.errorFields) {
      return;
    }
    message.error((error as Error).message || $t('page.user.validateFailed'));
    return;
  }

  submitting.value = true;
  try {
    const payload: AdminUserSaveInput = {
      address: formModel.address,
      avatar: formModel.avatar,
      description: formModel.description,
      email: formModel.email,
      gender: formModel.gender,
      mobile: formModel.mobile,
      nickname: formModel.nickname,
      orgUnitIds: [...formModel.orgUnitIds],
      password: formModel.password,
      positionIds: [...formModel.positionIds],
      realname: formModel.realname,
      region: formModel.region,
      remark: formModel.remark,
      roleIds: [...formModel.roleIds],
      status: formModel.status,
      telephone: formModel.telephone,
      username: formModel.username,
    };
    if (editingId.value) {
      await updateAdminUserApi(editingId.value, payload);
      message.success($t('page.user.updateSuccess'));
    } else {
      await createAdminUserApi(payload);
      message.success($t('page.user.createSuccess'));
    }
    modalOpen.value = false;
    await gridApi.reload();
  } catch (error) {
    message.error((error as Error).message || $t('page.user.saveFailed'));
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminUser) {
  if (!record.id) {
    message.warning($t('page.user.missingId'));
    return;
  }

  await deleteAdminUserApi(record.id);
  message.success($t('page.user.deleteSuccess'));
  await gridApi.reload();
}

const [Grid, gridApi] = useVbenVxeGrid<AdminUser>({
  gridClass: 'admin-user-grid',
  gridOptions,
  formOptions,
});

onMounted(() => {
  void loadReferenceOptions();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.user')">
    <div v-if="isTenantSession" class="tenant-session-banner">
      <Tag color="blue">{{ $t('page.commonSession.tenantSession') }}</Tag>
      <span class="tenant-session-banner__text">
        {{ $t('page.commonSession.userReadonlyBanner', [sessionTenantLabel]) }}
      </span>
    </div>

    <Grid :table-title="$t('menu.system.user')">
      <template #toolPrefix>
        <div class="admin-user-tool-prefix">
          <div class="admin-user-tool-prefix__item">
            <Button
              v-access:code="USER_ACCESS.create"
              type="primary"
              @click="openCreate"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.user.createTitle') }}
            </Button>
          </div>
        </div>
      </template>

      <template #identity="{ row }">
        <Tooltip>
          <template #title>
            <div class="admin-tooltip-lines">
              <div v-for="line in getUserIdentityTooltipLines(row)" :key="line">
                {{ line }}
              </div>
            </div>
          </template>
          <span class="identity-main">
            {{ getUserIdentityText(row) }}
          </span>
        </Tooltip>
      </template>

      <template #orgUnits="{ row }">
        <Space v-if="displayOrgUnits(row).length > 0" wrap>
          <Tag v-for="orgUnit in displayOrgUnits(row)" :key="orgUnit">
            {{ orgUnit }}
          </Tag>
        </Space>
        <span v-else>-</span>
      </template>

      <template #positions="{ row }">
        <Space v-if="displayPositions(row).length > 0" wrap>
          <Tag v-for="position in displayPositions(row)" :key="position">
            {{ position }}
          </Tag>
        </Space>
        <span v-else>-</span>
      </template>

      <template #roles="{ row }">
        <Space v-if="displayRoles(row).length > 0" wrap>
          <Tag v-for="role in displayRoles(row)" :key="role">
            {{ role }}
          </Tag>
        </Space>
        <span v-else>-</span>
      </template>

      <template #tenant="{ row }">
        <Tag :color="row.tenantId ? 'blue' : 'default'">
          {{ getTenantText(row) }}
        </Tag>
      </template>

      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusText(row.status) }}
        </Tag>
      </template>

      <template #lastLoginAt="{ row }">
        {{ formatTime(row.lastLoginAt) }}
      </template>

      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>

      <template #action="{ row }">
        <Space>
          <Button
            v-access:code="USER_ACCESS.edit"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            <template #icon>
              <IconifyIcon icon="lucide:pencil" />
            </template>
            {{ canMutateUser(row) ? $t('common.edit') : $t('common.detail') }}
          </Button>
          <Popconfirm
            :title="
              $t('ui.actionMessage.deleteConfirm', [$t('page.user.moduleName')])
            "
            @confirm="handleDelete(row)"
          >
            <Button
              v-access:code="USER_ACCESS.delete"
              danger
              size="small"
              type="link"
            >
              <template #icon>
                <IconifyIcon icon="lucide:trash-2" />
              </template>
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>

    <Modal
      v-model:open="modalOpen"
      destroy-on-close
      :confirm-loading="submitting"
      :ok-button-props="{ disabled: editingReadonly }"
      :title="modalTitle"
      width="720px"
      @ok="submitUser"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        autocomplete="off"
        layout="vertical"
      >
        <input
          aria-hidden="true"
          autocomplete="username"
          class="admin-user-autofill-guard"
          tabindex="-1"
          type="text"
        />
        <input
          aria-hidden="true"
          autocomplete="current-password"
          class="admin-user-autofill-guard"
          tabindex="-1"
          type="password"
        />
        <div class="admin-user-form-grid">
          <AdminGeneratedForm :model="formModel" :schema="dialogFormSchema" />
        </div>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.tenant-session-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 16px;
  background: linear-gradient(
    135deg,
    hsl(var(--primary) / 8%),
    hsl(var(--accent) / 28%)
  );
  border: 1px solid hsl(var(--primary) / 16%);
  border-radius: 10px;
}

.tenant-session-banner__text {
  font-size: 13px;
  color: hsl(var(--foreground) / 82%);
}

.admin-user-tool-prefix {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}

.admin-user-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-user-tool-prefix :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
}

.admin-user-autofill-guard {
  position: absolute;
  width: 0;
  height: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  pointer-events: none;
  border: 0;
  opacity: 0;
}

.user-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.user-option-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.user-option-meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.admin-tooltip-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.identity-main {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.admin-user-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.admin-user-form-grid--full {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .admin-user-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
