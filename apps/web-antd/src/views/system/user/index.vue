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
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
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
import { $t } from '#/locales';

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
  editingId.value ? $t('page.user.editTitle') : $t('page.user.createTitle'),
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

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.user.searchUsername'),
      },
      fieldName: 'username',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.username'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.user.searchRealname'),
      },
      fieldName: 'realname',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.realname'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.user.searchMobile'),
      },
      fieldName: 'mobile',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.mobile'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.user.searchTelephone'),
      },
      fieldName: 'telephone',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.telephone'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        loading: optionLoading.value,
        options: unref(orgSelectOptions),
        placeholder: $t('page.user.selectOrgUnit'),
        showSearch: true,
      }),
      fieldName: 'orgUnitId',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.orgUnits'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        loading: optionLoading.value,
        options: unref(positionSelectOptions),
        placeholder: $t('page.user.selectPosition'),
        showSearch: true,
      }),
      fieldName: 'positionId',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.positions'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        loading: optionLoading.value,
        options: unref(roleSelectOptions),
        placeholder: $t('page.user.selectRole'),
        showSearch: true,
      }),
      fieldName: 'roleId',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.roles'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions,
        placeholder: $t('page.user.selectStatus'),
      },
      fieldName: 'status',
      formItemClass: 'md:col-span-1',
      label: $t('page.user.status'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

const gridOptions: VxeTableGridOptions<AdminUser> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'username',
      slots: { default: 'identity' },
      sortable: true,
      title: $t('page.user.identity'),
      width: 220,
    },
    {
      field: 'mobile',
      sortable: true,
      title: $t('page.user.mobile'),
      width: 140,
    },
    {
      field: 'telephone',
      sortable: true,
      title: $t('page.user.telephone'),
      width: 140,
    },
    {
      field: 'orgUnits',
      slots: { default: 'orgUnits' },
      title: $t('page.user.orgUnits'),
      width: 220,
    },
    {
      field: 'positions',
      slots: { default: 'positions' },
      title: $t('page.user.positions'),
      width: 220,
    },
    {
      field: 'roles',
      slots: { default: 'roles' },
      title: $t('page.user.roles'),
      width: 220,
    },
    {
      field: 'tenantName',
      slots: { default: 'tenant' },
      sortable: true,
      title: $t('page.tenant.tenant'),
      width: 180,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.user.status'),
      width: 100,
    },
    {
      field: 'lastLoginAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.user.lastLoginAt'),
      width: 170,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.user.createdAt'),
      width: 170,
    },
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
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

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

function getUserIdentityTooltip(record: AdminUser) {
  return [
    `${$t('page.user.username')}：${record.username || '-'}`,
    `${$t('page.user.realname')}：${record.realname || '-'}`,
    `${$t('page.user.nickname')}：${record.nickname || '-'}`,
  ].join('\n');
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

async function loadReferenceOptions() {
  optionLoading.value = true;
  try {
    const [orgResult, positionResult, roleResult] = await Promise.all([
      listAdminOrgUnitsApi({
        page: 1,
        pageSize: 200,
        sorting: [{ direction: 'ASC', field: 'sort_order' }],
      }),
      listAdminPositionsApi({
        page: 1,
        pageSize: 200,
        sorting: [{ direction: 'ASC', field: 'sort_order' }],
      }),
      listAdminRolesApi({
        page: 1,
        pageSize: 200,
        sorting: [{ direction: 'ASC', field: 'sort_order' }],
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
  resetFormModel();
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
    editingId.value = record.id;
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
      <Tag color="blue">绉熸埛浼氳瘽</Tag>
      <span class="tenant-session-banner__text">
        褰撳墠浠呮煡鐪嬬鎴峰唴鐢ㄦ埛鏁版嵁锛屾墍灞炵鎴凤細{{
          sessionTenantLabel
        }}
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
        <Tooltip :title="getUserIdentityTooltip(row)">
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
            {{ $t('common.edit') }}
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
          <Form.Item :label="$t('page.user.username')" name="username">
            <Input
              v-model:value="formModel.username"
              :disabled="Boolean(editingId)"
              autocomplete="off"
              name="admin-user-username"
              :placeholder="$t('page.user.placeholderUsername')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.user.nickname')" name="nickname">
            <Input
              v-model:value="formModel.nickname"
              :placeholder="$t('page.user.placeholderNickname')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.user.realname')" name="realname">
            <Input
              v-model:value="formModel.realname"
              :placeholder="$t('page.user.placeholderRealname')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.user.status')" name="status">
            <Select v-model:value="formModel.status" :options="statusOptions" />
          </Form.Item>
          <Form.Item :label="$t('page.user.gender')" name="gender">
            <Select
              v-model:value="formModel.gender"
              allow-clear
              :options="genderOptions"
              :placeholder="$t('page.user.selectGender')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.password')"
            name="password"
          >
            <Input.Password
              v-model:value="formModel.password"
              autocomplete="new-password"
              name="admin-user-password"
              :placeholder="
                editingId
                  ? $t('page.user.placeholderPasswordKeepEmpty')
                  : $t('page.user.placeholderPassword')
              "
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.orgUnitIds')"
            name="orgUnitIds"
          >
            <Select
              v-model:value="formModel.orgUnitIds"
              mode="multiple"
              :loading="optionLoading"
              :options="orgSelectOptions"
              :placeholder="$t('page.user.selectOrgUnit')"
              show-search
            >
              <template #option="{ label, meta }">
                <div class="user-option">
                  <span class="user-option-main">{{ label }}</span>
                  <span class="user-option-meta">{{ meta }}</span>
                </div>
              </template>
            </Select>
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.positionIds')"
            name="positionIds"
          >
            <Select
              v-model:value="formModel.positionIds"
              mode="multiple"
              :loading="optionLoading"
              :options="positionSelectOptions"
              :placeholder="$t('page.user.selectPosition')"
              show-search
            >
              <template #option="{ label, meta }">
                <div class="user-option">
                  <span class="user-option-main">{{ label }}</span>
                  <span class="user-option-meta">{{ meta }}</span>
                </div>
              </template>
            </Select>
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.roleIds')"
            name="roleIds"
          >
            <Select
              v-model:value="formModel.roleIds"
              mode="multiple"
              :loading="optionLoading"
              :options="roleSelectOptions"
              :placeholder="$t('page.user.selectRole')"
              show-search
            >
              <template #option="{ label, meta }">
                <div class="user-option">
                  <span class="user-option-main">{{ label }}</span>
                  <span class="user-option-meta">{{ meta }}</span>
                </div>
              </template>
            </Select>
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.avatar')"
            name="avatar"
          >
            <Input
              v-model:value="formModel.avatar"
              autocomplete="off"
              name="admin-user-avatar"
              :placeholder="$t('page.user.placeholderAvatar')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.user.email')" name="email">
            <Input
              v-model:value="formModel.email"
              autocomplete="off"
              name="admin-user-email"
              :placeholder="$t('page.user.placeholderEmail')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.user.mobile')" name="mobile">
            <Input
              v-model:value="formModel.mobile"
              autocomplete="off"
              name="admin-user-mobile"
              :placeholder="$t('page.user.placeholderMobile')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.user.telephone')" name="telephone">
            <Input
              v-model:value="formModel.telephone"
              autocomplete="off"
              name="admin-user-telephone"
              :placeholder="$t('page.user.placeholderTelephone')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.address')"
            name="address"
          >
            <Input
              v-model:value="formModel.address"
              autocomplete="off"
              name="admin-user-address"
              :placeholder="$t('page.user.placeholderAddress')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.region')"
            name="region"
          >
            <Input
              v-model:value="formModel.region"
              autocomplete="off"
              name="admin-user-region"
              :placeholder="$t('page.user.placeholderRegion')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.description')"
            name="description"
          >
            <Input.TextArea
              v-model:value="formModel.description"
              :auto-size="{ minRows: 3, maxRows: 5 }"
              :placeholder="$t('page.user.placeholderDescription')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            :label="$t('page.user.remark')"
            name="remark"
          >
            <Input.TextArea
              v-model:value="formModel.remark"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              :placeholder="$t('page.user.placeholderRemark')"
            />
          </Form.Item>
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
