<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TableColumnType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type { AdminOrgUnit } from '#/api/admin/org-units';
import type { AdminPosition } from '#/api/admin/positions';
import type { AdminRole } from '#/api/admin/roles';
import type {
  AdminUser,
  AdminUserSaveInput,
  AdminUserStatus,
} from '#/api/admin/users';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

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
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

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
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
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

type AdminTableChangeSorter =
  | Parameters<NonNullable<InstanceType<typeof Table>['$props']['onChange']>>[2]
  | TableColumnType<AdminUser>['sorter'];

type AdminUserTableRecord = AdminUser | Record<string, any>;
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
const defaultSorting: AdminTableSorting[] = [{ direction: 'ASC', field: 'id' }];

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

const columns: AdminTableColumn<AdminUser>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: $t('page.user.id'),
    width: 80,
  },
  {
    key: 'identity',
    sortField: 'username',
    sortable: true,
    sorter: true,
    title: $t('page.user.identity'),
    width: 220,
  },
  {
    dataIndex: 'mobile',
    key: 'mobile',
    sortable: true,
    sorter: true,
    title: $t('page.user.mobile'),
    width: 140,
  },
  {
    dataIndex: 'telephone',
    key: 'telephone',
    sortable: true,
    sorter: true,
    title: $t('page.user.telephone'),
    width: 140,
  },
  {
    key: 'orgUnits',
    title: $t('page.user.orgUnits'),
    width: 220,
  },
  {
    key: 'positions',
    title: $t('page.user.positions'),
    width: 220,
  },
  {
    key: 'roles',
    title: $t('page.user.roles'),
    width: 220,
  },
  {
    dataIndex: 'tenantName',
    key: 'tenant',
    sortField: 'tenant_id',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.tenant'),
    width: 180,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.user.status'),
    width: 100,
  },
  {
    dataIndex: 'lastLoginAt',
    key: 'lastLoginAt',
    sortField: 'last_login_at',
    sortable: true,
    sorter: true,
    title: $t('page.user.lastLoginAt'),
    width: 170,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.user.createdAt'),
    width: 170,
  },
  {
    fixed: 'right',
    key: 'action',
    title: $t('ui.table.action'),
    width: 150,
  },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const optionLoading = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const users = ref<AdminUser[]>([]);
const orgOptions = ref<AdminOrgUnit[]>([]);
const positionOptions = ref<AdminPosition[]>([]);
const roleOptions = ref<AdminRole[]>([]);
const sorting = ref<AdminTableSorting[]>([...defaultSorting]);
const visibleColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(columns).filter(
    (key): key is string => key !== undefined,
  ),
);

const searchForm = reactive({
  mobile: '',
  orgUnitId: undefined as number | undefined,
  positionId: undefined as number | undefined,
  realname: '',
  roleId: undefined as number | undefined,
  status: undefined as AdminUserStatus | undefined,
  telephone: '',
  username: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

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
const displayColumns = computed<TableColumnsType<AdminUser>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
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

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.loginAuditLog.total')} ${total}`,
  total: pager.total,
}));

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

function toAdminUser(record: AdminUserTableRecord) {
  return record as AdminUser;
}

function displayRoles(record: AdminUserTableRecord) {
  const user = toAdminUser(record);
  return user.roleNames?.length ? user.roleNames : (user.roles ?? []);
}

function displayOrgUnits(record: AdminUserTableRecord) {
  return toAdminUser(record).orgUnitNames ?? [];
}

function displayPositions(record: AdminUserTableRecord) {
  return toAdminUser(record).positionNames ?? [];
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getTenantText(record: AdminUserTableRecord) {
  const user = toAdminUser(record);
  return user.tenantName || '-';
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

async function loadUsers() {
  loading.value = true;
  try {
    const response = await listAdminUsersApi({
      mobile: searchForm.mobile,
      orgUnitId: searchForm.orgUnitId,
      page: pager.page,
      pageSize: pager.pageSize,
      positionId: searchForm.positionId,
      realname: searchForm.realname,
      roleId: searchForm.roleId,
      sorting: sorting.value,
      status: searchForm.status,
      telephone: searchForm.telephone,
      username: searchForm.username,
    });
    users.value = response.items;
    pager.total = response.total;
  } catch (error) {
    message.error((error as Error).message || $t('page.user.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pager.page = 1;
  await loadUsers();
}

async function handleReset() {
  searchForm.mobile = '';
  searchForm.orgUnitId = undefined;
  searchForm.positionId = undefined;
  searchForm.realname = '';
  searchForm.roleId = undefined;
  searchForm.status = undefined;
  searchForm.telephone = '';
  searchForm.username = '';
  sorting.value = [...defaultSorting];
  pager.page = 1;
  await loadUsers();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, unknown>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
  await loadUsers();
}

async function openCreate() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminUserTableRecord) {
  const user = toAdminUser(record);
  if (!user.id) {
    message.warning($t('page.user.missingId'));
    return;
  }

  optionLoading.value = true;
  try {
    const detail = await getAdminUserApi(user.id);
    editingId.value = user.id;
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
    await loadUsers();
  } catch (error) {
    message.error((error as Error).message || $t('page.user.saveFailed'));
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminUserTableRecord) {
  const user = toAdminUser(record);
  if (!user.id) {
    message.warning($t('page.user.missingId'));
    return;
  }

  await deleteAdminUserApi(user.id);
  message.success($t('page.user.deleteSuccess'));
  await loadUsers();
}

onMounted(async () => {
  await Promise.all([loadReferenceOptions(), loadUsers()]);
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.user')">
    <div ref="tableSurfaceRef" class="admin-user-surface">
      <div v-if="isTenantSession" class="tenant-session-banner">
        <Tag color="blue">租户会话</Tag>
        <span class="tenant-session-banner__text">
          当前仅查看租户内用户数据，所属租户：{{ sessionTenantLabel }}
        </span>
      </div>
      <div class="admin-user-toolbar">
        <Form
          class="admin-user-search"
          :model="searchForm"
          layout="inline"
          @finish="handleSearch"
        >
          <Form.Item
            class="admin-user-search__item"
            :label="$t('page.user.username')"
            name="username"
          >
            <Input
              v-model:value="searchForm.username"
              allow-clear
              :placeholder="$t('page.user.searchUsername')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            :label="$t('page.user.realname')"
            name="realname"
          >
            <Input
              v-model:value="searchForm.realname"
              allow-clear
              :placeholder="$t('page.user.searchRealname')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            :label="$t('page.user.mobile')"
            name="mobile"
          >
            <Input
              v-model:value="searchForm.mobile"
              allow-clear
              :placeholder="$t('page.user.searchMobile')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            :label="$t('page.user.telephone')"
            name="telephone"
          >
            <Input
              v-model:value="searchForm.telephone"
              allow-clear
              :placeholder="$t('page.user.searchTelephone')"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            :label="$t('page.user.orgUnits')"
            name="orgUnitId"
          >
            <Select
              v-model:value="searchForm.orgUnitId"
              allow-clear
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
            class="admin-user-search__item"
            :label="$t('page.user.positions')"
            name="positionId"
          >
            <Select
              v-model:value="searchForm.positionId"
              allow-clear
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
            class="admin-user-search__item"
            :label="$t('page.user.roles')"
            name="roleId"
          >
            <Select
              v-model:value="searchForm.roleId"
              allow-clear
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
            class="admin-user-search__item"
            :label="$t('page.user.status')"
            name="status"
          >
            <Select
              v-model:value="searchForm.status"
              allow-clear
              :options="statusOptions"
              :placeholder="$t('page.user.selectStatus')"
            />
          </Form.Item>
          <Form.Item class="admin-user-search__actions">
            <Space>
              <Button html-type="submit" type="primary">
                <template #icon>
                  <IconifyIcon icon="lucide:search" />
                </template>
                {{ $t('common.query') }}
              </Button>
              <Button @click="handleReset">
                <template #icon>
                  <IconifyIcon icon="lucide:rotate-ccw" />
                </template>
                {{ $t('common.reset') }}
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Space class="admin-user-toolbar__actions">
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :export-access-codes="USER_ACCESS.export"
            :data-source="users"
            file-name="system-users"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadUsers"
            storage-key="system-user-list"
          />
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
        </Space>
      </div>

      <Table
        class="admin-user-table"
        :columns="displayColumns"
        :data-source="users"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'identity'">
            <div class="identity-cell">
              <span class="identity-main">
                {{ record.username || '-' }}
              </span>
              <span class="identity-sub">
                {{ record.realname || record.nickname || '-' }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'orgUnits'">
            <Space v-if="displayOrgUnits(record).length > 0" wrap>
              <Tag v-for="orgUnit in displayOrgUnits(record)" :key="orgUnit">
                {{ orgUnit }}
              </Tag>
            </Space>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'positions'">
            <Space v-if="displayPositions(record).length > 0" wrap>
              <Tag v-for="position in displayPositions(record)" :key="position">
                {{ position }}
              </Tag>
            </Space>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'roles'">
            <Space v-if="displayRoles(record).length > 0" wrap>
              <Tag v-for="role in displayRoles(record)" :key="role">
                {{ role }}
              </Tag>
            </Space>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'tenant'">
            <Tag :color="record.tenantId ? 'blue' : 'default'">
              {{ getTenantText(record) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'lastLoginAt'">
            {{ formatTime(record.lastLoginAt) }}
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="USER_ACCESS.edit"
                size="small"
                type="link"
                @click="openEdit(record)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:pencil" />
                </template>
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                :title="
                  $t('ui.actionMessage.deleteConfirm', [
                    $t('page.user.moduleName'),
                  ])
                "
                @confirm="handleDelete(record)"
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
        </template>
      </Table>
    </div>

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
              :autocomplete="editingId ? 'new-password' : 'new-password'"
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
.admin-user-surface {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding: 16px;
  overflow-y: auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-user-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.tenant-session-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
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

.admin-user-toolbar__actions {
  align-items: center;
}

.admin-user-search {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px 16px;
  min-width: min(100%, 920px);
}

:deep(.admin-user-search .ant-form-item) {
  margin-bottom: 0;
}

:deep(.admin-user-search .ant-form-item-row) {
  width: 100%;
}

:deep(.admin-user-search .ant-form-item-control) {
  min-width: 0;
}

:deep(.admin-user-search .ant-form-item-control-input),
:deep(.admin-user-search .ant-form-item-control-input-content),
:deep(.admin-user-search .ant-input),
:deep(.admin-user-search .ant-select) {
  width: 100%;
}

.admin-user-search__item {
  min-width: 0;
}

.admin-user-search__actions {
  display: flex;
  align-items: flex-end;
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

.admin-user-table {
  flex: 1;
  min-height: 0;
}

.identity-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
  text-align: left;
}

.identity-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.identity-sub {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
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
  .admin-user-surface {
    padding: 12px;
  }

  .admin-user-toolbar {
    align-items: stretch;
  }

  .admin-user-search {
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .admin-user-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
