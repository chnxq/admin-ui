<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminUser,
  AdminUserSaveInput,
  AdminUserStatus,
} from '#/api/admin/users';

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

import {
  createAdminUserApi,
  deleteAdminUserApi,
  listAdminUsersApi,
  updateAdminUserApi,
} from '#/api/admin/users';

interface AdminUserFormModel extends AdminUserSaveInput {
  password: string;
  status: AdminUserStatus;
  username: string;
}

type AdminUserTableRecord = AdminUser | Record<string, any>;

const statusOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '禁用', value: 'DISABLED' },
  { label: '待激活', value: 'PENDING' },
  { label: '锁定', value: 'LOCKED' },
  { label: '过期', value: 'EXPIRED' },
  { label: '关闭', value: 'CLOSED' },
];

const statusTextMap: Record<AdminUserStatus, string> = {
  CLOSED: '关闭',
  DISABLED: '禁用',
  EXPIRED: '过期',
  LOCKED: '锁定',
  NORMAL: '正常',
  PENDING: '待激活',
};

const columns: TableColumnsType<AdminUser> = [
  {
    dataIndex: 'id',
    title: 'ID',
    width: 80,
  },
  {
    key: 'identity',
    title: '用户',
    width: 220,
  },
  {
    key: 'contact',
    title: '联系方式',
    width: 220,
  },
  {
    key: 'roles',
    title: '角色',
    width: 180,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'lastLoginAt',
    key: 'lastLoginAt',
    title: '最后登录',
    width: 170,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
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
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const users = ref<AdminUser[]>([]);

const searchForm = reactive({
  username: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const formModel = reactive<AdminUserFormModel>({
  description: '',
  email: '',
  mobile: '',
  nickname: '',
  password: '',
  realname: '',
  remark: '',
  roleIds: [],
  roles: [],
  status: 'NORMAL',
  username: '',
});

const modalTitle = computed(() => (editingId.value ? '编辑用户' : '新增用户'));
const formRules = computed<Record<string, Rule[]>>(() => ({
  email: [{ message: '请输入有效邮箱', type: 'email' }],
  password: editingId.value
    ? []
    : [{ message: '请输入初始密码', required: true }],
  status: [{ message: '请选择状态', required: true }],
  username: [{ message: '请输入用户名', required: true }],
}));

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  total: pager.total,
}));

function resetFormModel() {
  Object.assign(formModel, {
    description: '',
    email: '',
    mobile: '',
    nickname: '',
    password: '',
    realname: '',
    remark: '',
    roleIds: [],
    roles: [],
    status: 'NORMAL',
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

async function loadUsers() {
  loading.value = true;
  try {
    const response = await listAdminUsersApi({
      page: pager.page,
      pageSize: pager.pageSize,
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
  searchForm.username = '';
  pager.page = 1;
  await loadUsers();
}

async function handleTableChange(pagination: TablePaginationConfig) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
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

  editingId.value = user.id;
  Object.assign(formModel, {
    description: user.description ?? '',
    email: user.email ?? '',
    mobile: user.mobile ?? '',
    nickname: user.nickname ?? '',
    password: '',
    realname: user.realname ?? '',
    remark: user.remark ?? '',
    roleIds: user.roleIds ?? [],
    roles: user.roles ?? [],
    status: user.status ?? 'NORMAL',
    username: user.username ?? '',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitUser() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminUserApi(editingId.value, formModel);
      message.success('用户已更新');
    } else {
      await createAdminUserApi(formModel);
      message.success('用户已创建');
    }
    modalOpen.value = false;
    await loadUsers();
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

onMounted(() => {
  loadUsers();
});
</script>

<template>
  <Page auto-content-height title="用户管理">
    <div class="admin-user-surface">
      <div class="admin-user-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item label="用户名" name="username">
            <Input
              v-model:value="searchForm.username"
              allow-clear
              placeholder="输入用户名"
            />
          </Form.Item>
          <Form.Item>
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

        <Button type="primary" @click="openCreate">
          <template #icon>
            <IconifyIcon icon="lucide:plus" />
          </template>
          新增用户
        </Button>
      </div>

      <Table
        class="admin-user-table"
        :columns="columns"
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
                {{ record.realname || record.nickname || '-' }}
              </span>
              <span class="identity-sub">
                {{ record.username || '-' }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'contact'">
            <div class="identity-cell">
              <span>{{ record.mobile || '-' }}</span>
              <span class="identity-sub">{{ record.email || '-' }}</span>
            </div>
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
              <Button size="small" type="link" @click="openEdit(record)">
                <template #icon>
                  <IconifyIcon icon="lucide:pencil" />
                </template>
                编辑
              </Button>
              <Popconfirm
                title="确认删除该用户？"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">
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
      @ok="submitUser"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item label="用户名" name="username">
          <Input
            v-model:value="formModel.username"
            placeholder="请输入用户名"
          />
        </Form.Item>
        <Form.Item label="初始密码" name="password">
          <Input.Password
            v-model:value="formModel.password"
            :placeholder="editingId ? '留空则不修改密码' : '请输入初始密码'"
          />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item label="姓名" name="realname">
          <Input v-model:value="formModel.realname" placeholder="请输入姓名" />
        </Form.Item>
        <Form.Item label="昵称" name="nickname">
          <Input v-model:value="formModel.nickname" placeholder="请输入昵称" />
        </Form.Item>
        <Form.Item label="手机号" name="mobile">
          <Input v-model:value="formModel.mobile" placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item label="邮箱" name="email">
          <Input v-model:value="formModel.email" placeholder="请输入邮箱" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea
            v-model:value="formModel.description"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            placeholder="请输入描述"
          />
        </Form.Item>
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

@media (max-width: 640px) {
  .admin-user-surface {
    padding: 12px;
  }

  .admin-user-toolbar {
    align-items: stretch;
  }
}
</style>
