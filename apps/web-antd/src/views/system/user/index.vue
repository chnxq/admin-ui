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

const USER_ACCESS = {
  create: ['users:create'],
  delete: ['users:delete'],
  edit: ['users:edit'],
} as const;

const statusOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '禁用', value: 'DISABLED' },
  { label: '待激活', value: 'PENDING' },
  { label: '锁定', value: 'LOCKED' },
  { label: '过期', value: 'EXPIRED' },
  { label: '关闭', value: 'CLOSED' },
];

const genderOptions = [
  { label: '保密', value: 'SECRET' },
  { label: '男', value: 'MALE' },
  { label: '女', value: 'FEMALE' },
];

const statusTextMap: Record<AdminUserStatus, string> = {
  CLOSED: '关闭',
  DISABLED: '禁用',
  EXPIRED: '过期',
  LOCKED: '锁定',
  NORMAL: '正常',
  PENDING: '待激活',
};

const columns: AdminTableColumn<AdminUser>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: 'ID',
    width: 80,
  },
  {
    key: 'identity',
    sortField: 'username',
    sortable: true,
    sorter: true,
    title: '用户',
    width: 220,
  },
  {
    dataIndex: 'mobile',
    key: 'mobile',
    sortable: true,
    sorter: true,
    title: '手机',
    width: 140,
  },
  {
    dataIndex: 'telephone',
    key: 'telephone',
    sortable: true,
    sorter: true,
    title: '电话',
    width: 140,
  },
  {
    key: 'orgUnits',
    title: '组织',
    width: 220,
  },
  {
    key: 'positions',
    title: '岗位',
    width: 220,
  },
  {
    key: 'roles',
    title: '角色',
    width: 220,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'lastLoginAt',
    key: 'lastLoginAt',
    sortField: 'last_login_at',
    sortable: true,
    sorter: true,
    title: '最后登录',
    width: 170,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: '创建时间',
    width: 170,
  },
  {
    fixed: 'right',
    key: 'action',
    title: '操作',
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
const sorting = ref<AdminTableSorting[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

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

const modalTitle = computed(() => (editingId.value ? '编辑用户' : '新增用户'));
const displayColumns = computed<TableColumnsType<AdminUser>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  email: [{ message: '请输入有效邮箱', type: 'email' }],
  password: editingId.value
    ? []
    : [{ message: '请输入初始密码', required: true }],
  status: [{ message: '请选择状态', required: true }],
  username: [{ message: '请输入用户名', required: true }],
}));

const orgSelectOptions = computed(() =>
  orgOptions.value.map((item) => ({
    label: item.name ?? `#${item.id}`,
    value: item.id,
  })),
);
const positionSelectOptions = computed(() =>
  positionOptions.value.map((item) => ({
    label: item.name ?? `#${item.id}`,
    value: item.id,
  })),
);
const roleSelectOptions = computed(() =>
  roleOptions.value.map((item) => ({
    label: item.name ?? `#${item.id}`,
    value: item.id,
  })),
);

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
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
      listAdminOrgUnitsApi({ page: 1, pageSize: 200 }),
      listAdminPositionsApi({ page: 1, pageSize: 200 }),
      listAdminRolesApi({ page: 1, pageSize: 200 }),
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
    message.error((error as Error).message || '加载用户列表失败');
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
  sorting.value = [];
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
    message.warning('缺少用户 ID');
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
    message.error((error as Error).message || '加载用户详情失败');
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
    message.error((error as Error).message || '表单校验失败');
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
      message.success('用户已更新');
    } else {
      await createAdminUserApi(payload);
      message.success('用户已创建');
    }
    modalOpen.value = false;
    await loadUsers();
  } catch (error) {
    message.error((error as Error).message || '保存用户失败');
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminUserTableRecord) {
  const user = toAdminUser(record);
  if (!user.id) {
    message.warning('缺少用户 ID');
    return;
  }

  await deleteAdminUserApi(user.id);
  message.success('用户已删除');
  await loadUsers();
}

onMounted(async () => {
  await Promise.all([loadReferenceOptions(), loadUsers()]);
});
</script>

<template>
  <Page auto-content-height title="用户管理">
    <div ref="tableSurfaceRef" class="admin-user-surface">
      <div class="admin-user-toolbar">
        <Form
          class="admin-user-search"
          :model="searchForm"
          layout="inline"
          @finish="handleSearch"
        >
          <Form.Item
            class="admin-user-search__item"
            label="用户名"
            name="username"
          >
            <Input
              v-model:value="searchForm.username"
              allow-clear
              placeholder="输入用户名"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            label="姓名"
            name="realname"
          >
            <Input
              v-model:value="searchForm.realname"
              allow-clear
              placeholder="输入姓名"
            />
          </Form.Item>
          <Form.Item class="admin-user-search__item" label="手机" name="mobile">
            <Input
              v-model:value="searchForm.mobile"
              allow-clear
              placeholder="输入手机号"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            label="电话"
            name="telephone"
          >
            <Input
              v-model:value="searchForm.telephone"
              allow-clear
              placeholder="输入电话"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            label="组织"
            name="orgUnitId"
          >
            <Select
              v-model:value="searchForm.orgUnitId"
              allow-clear
              :loading="optionLoading"
              :options="orgSelectOptions"
              placeholder="选择组织"
              show-search
            />
          </Form.Item>
          <Form.Item
            class="admin-user-search__item"
            label="岗位"
            name="positionId"
          >
            <Select
              v-model:value="searchForm.positionId"
              allow-clear
              :loading="optionLoading"
              :options="positionSelectOptions"
              placeholder="选择岗位"
              show-search
            />
          </Form.Item>
          <Form.Item class="admin-user-search__item" label="角色" name="roleId">
            <Select
              v-model:value="searchForm.roleId"
              allow-clear
              :loading="optionLoading"
              :options="roleSelectOptions"
              placeholder="选择角色"
              show-search
            />
          </Form.Item>
          <Form.Item class="admin-user-search__item" label="状态" name="status">
            <Select
              v-model:value="searchForm.status"
              allow-clear
              :options="statusOptions"
              placeholder="选择状态"
            />
          </Form.Item>
          <Form.Item class="admin-user-search__actions">
            <Space>
              <Button html-type="submit" type="primary">
                <template #icon>
                  <IconifyIcon icon="lucide:search" />
                </template>
                查询
              </Button>
              <Button @click="handleReset">
                <template #icon>
                  <IconifyIcon icon="lucide:rotate-ccw" />
                </template>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Space class="admin-user-toolbar__actions">
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
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
            新增用户
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
                编辑
              </Button>
              <Popconfirm
                title="确认删除该用户？"
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
                  删除
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
          <Form.Item label="用户名" name="username">
            <Input
              v-model:value="formModel.username"
              :disabled="Boolean(editingId)"
              autocomplete="off"
              name="admin-user-username"
              placeholder="请输入用户名"
            />
          </Form.Item>
          <Form.Item label="昵称" name="nickname">
            <Input
              v-model:value="formModel.nickname"
              placeholder="请输入昵称"
            />
          </Form.Item>
          <Form.Item label="真实姓名" name="realname">
            <Input
              v-model:value="formModel.realname"
              placeholder="请输入真实姓名"
            />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select v-model:value="formModel.status" :options="statusOptions" />
          </Form.Item>
          <Form.Item label="性别" name="gender">
            <Select
              v-model:value="formModel.gender"
              allow-clear
              :options="genderOptions"
              placeholder="选择性别"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="密码"
            name="password"
          >
            <Input.Password
              v-model:value="formModel.password"
              :autocomplete="editingId ? 'new-password' : 'new-password'"
              name="admin-user-password"
              :placeholder="editingId ? '留空则不修改密码' : '请输入初始密码'"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="归属组织"
            name="orgUnitIds"
          >
            <Select
              v-model:value="formModel.orgUnitIds"
              mode="multiple"
              :loading="optionLoading"
              :options="orgSelectOptions"
              placeholder="选择组织"
              show-search
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="岗位"
            name="positionIds"
          >
            <Select
              v-model:value="formModel.positionIds"
              mode="multiple"
              :loading="optionLoading"
              :options="positionSelectOptions"
              placeholder="选择岗位"
              show-search
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="角色"
            name="roleIds"
          >
            <Select
              v-model:value="formModel.roleIds"
              mode="multiple"
              :loading="optionLoading"
              :options="roleSelectOptions"
              placeholder="选择角色"
              show-search
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="头像"
            name="avatar"
          >
            <Input
              v-model:value="formModel.avatar"
              autocomplete="off"
              name="admin-user-avatar"
              placeholder="请输入头像地址"
            />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input
              v-model:value="formModel.email"
              autocomplete="off"
              name="admin-user-email"
              placeholder="请输入邮箱"
            />
          </Form.Item>
          <Form.Item label="手机" name="mobile">
            <Input
              v-model:value="formModel.mobile"
              autocomplete="off"
              name="admin-user-mobile"
              placeholder="请输入手机号"
            />
          </Form.Item>
          <Form.Item label="电话" name="telephone">
            <Input
              v-model:value="formModel.telephone"
              autocomplete="off"
              name="admin-user-telephone"
              placeholder="请输入电话"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="地址"
            name="address"
          >
            <Input
              v-model:value="formModel.address"
              autocomplete="off"
              name="admin-user-address"
              placeholder="请输入地址"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="地区"
            name="region"
          >
            <Input
              v-model:value="formModel.region"
              autocomplete="off"
              name="admin-user-region"
              placeholder="请输入地区"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="描述"
            name="description"
          >
            <Input.TextArea
              v-model:value="formModel.description"
              :auto-size="{ minRows: 3, maxRows: 5 }"
              placeholder="请输入描述"
            />
          </Form.Item>
          <Form.Item
            class="admin-user-form-grid--full"
            label="备注"
            name="remark"
          >
            <Input.TextArea
              v-model:value="formModel.remark"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="请输入备注"
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
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-user-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
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
