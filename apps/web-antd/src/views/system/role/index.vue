<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminRole,
  AdminRoleSaveInput,
  AdminRoleStatus,
  AdminRoleType,
} from '#/api/admin/roles';
import type { AdminTableColumn } from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  InputNumber,
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
  createAdminRoleApi,
  deleteAdminRoleApi,
  listAdminRolesApi,
  updateAdminRoleApi,
} from '#/api/admin/roles';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
} from '#/components/admin-table-toolbar/shared';

interface AdminRoleFormModel extends AdminRoleSaveInput {
  code: string;
  name: string;
  sortOrder: number;
  status: AdminRoleStatus;
  type: AdminRoleType;
}

type AdminRoleTableRecord = AdminRole | Record<string, any>;

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '停用', value: 'OFF' },
];

const typeOptions = [
  { label: '系统角色', value: 'SYSTEM' },
  { label: '模板角色', value: 'TEMPLATE' },
  { label: '租户角色', value: 'TENANT' },
];

const statusTextMap: Record<AdminRoleStatus, string> = {
  OFF: '停用',
  ON: '启用',
};

const typeTextMap: Record<AdminRoleType, string> = {
  SYSTEM: '系统角色',
  TEMPLATE: '模板角色',
  TENANT: '租户角色',
};

const columns: AdminTableColumn<AdminRole>[] = [
  {
    dataIndex: 'id',
    title: 'ID',
    width: 80,
  },
  {
    key: 'role',
    title: '角色',
    width: 260,
  },
  {
    dataIndex: 'type',
    key: 'type',
    title: '类型',
    width: 120,
  },
  {
    dataIndex: 'sortOrder',
    title: '排序',
    width: 90,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
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
const tableSurfaceRef = ref<HTMLElement>();
const roles = ref<AdminRole[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  code: '',
  name: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const formModel = reactive<AdminRoleFormModel>({
  code: '',
  description: '',
  name: '',
  permissions: [],
  sortOrder: 0,
  status: 'ON',
  type: 'SYSTEM',
});

const modalTitle = computed(() => (editingId.value ? '编辑角色' : '新增角色'));
const displayColumns = computed<TableColumnsType<AdminRole>>(() =>
  filterVisibleAdminTableColumns(columns, visibleColumnKeys.value),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  code: [{ message: '请输入角色编码', required: true }],
  name: [{ message: '请输入角色名称', required: true }],
  status: [{ message: '请选择状态', required: true }],
  type: [{ message: '请选择类型', required: true }],
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
    code: '',
    description: '',
    name: '',
    permissions: [],
    sortOrder: 0,
    status: 'ON',
    type: 'SYSTEM',
  });
}

function toAdminRole(record: AdminRoleTableRecord) {
  return record as AdminRole;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getStatusText(status?: AdminRoleStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminRoleStatus) {
  return status === 'ON' ? 'success' : 'default';
}

function getTypeText(type?: AdminRoleType) {
  return type ? typeTextMap[type] : '-';
}

async function loadRoles() {
  loading.value = true;
  try {
    const response = await listAdminRolesApi({
      code: searchForm.code,
      name: searchForm.name,
      page: pager.page,
      pageSize: pager.pageSize,
    });
    roles.value = response.items;
    pager.total = response.total;
  } catch (error) {
    message.error((error as Error).message || '加载角色列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pager.page = 1;
  await loadRoles();
}

async function handleReset() {
  searchForm.code = '';
  searchForm.name = '';
  pager.page = 1;
  await loadRoles();
}

async function handleTableChange(pagination: TablePaginationConfig) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  await loadRoles();
}

async function openCreate() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminRoleTableRecord) {
  const role = toAdminRole(record);
  if (!role.id) {
    message.warning('缺少角色 ID');
    return;
  }

  editingId.value = role.id;
  Object.assign(formModel, {
    code: role.code ?? '',
    description: role.description ?? '',
    name: role.name ?? '',
    permissions: role.permissions ?? [],
    sortOrder: role.sortOrder ?? 0,
    status: role.status ?? 'ON',
    type: role.type ?? 'SYSTEM',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitRole() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminRoleApi(editingId.value, formModel);
      message.success('角色已更新');
    } else {
      await createAdminRoleApi(formModel);
      message.success('角色已创建');
    }
    modalOpen.value = false;
    await loadRoles();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminRoleTableRecord) {
  const role = toAdminRole(record);
  if (!role.id) {
    message.warning('缺少角色 ID');
    return;
  }

  await deleteAdminRoleApi(role.id);
  message.success('角色已删除');
  await loadRoles();
}

onMounted(() => {
  loadRoles();
});
</script>

<template>
  <Page auto-content-height title="角色管理">
    <div ref="tableSurfaceRef" class="admin-role-surface">
      <div class="admin-role-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item label="角色名称" name="name">
            <Input
              v-model:value="searchForm.name"
              allow-clear
              placeholder="输入角色名称"
            />
          </Form.Item>
          <Form.Item label="角色编码" name="code">
            <Input
              v-model:value="searchForm.code"
              allow-clear
              placeholder="输入角色编码"
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

        <Space>
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :data-source="roles"
            file-name="system-roles"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadRoles"
            storage-key="system-role-list"
          />
          <Button type="primary" @click="openCreate">
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
          新增角色
          </Button>
        </Space>
      </div>

      <Table
        class="admin-role-table"
        :columns="displayColumns"
        :data-source="roles"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <div class="role-cell">
              <span class="role-main">{{ record.name || '-' }}</span>
              <span class="role-sub">{{ record.code || '-' }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'type'">
            <Tag>{{ getTypeText(record.type) }}</Tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </Tag>
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
                title="确认删除该角色？"
                @confirm="handleDelete(record)"
              >
                <Button
                  danger
                  :disabled="record.isProtected"
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
      @ok="submitRole"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item label="角色名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入角色名称" />
        </Form.Item>
        <Form.Item label="角色编码" name="code">
          <Input v-model:value="formModel.code" placeholder="请输入角色编码" />
        </Form.Item>
        <Form.Item label="类型" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item label="排序" name="sortOrder">
          <InputNumber
            v-model:value="formModel.sortOrder"
            class="full-width-control"
            :min="0"
          />
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
.admin-role-surface {
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

.admin-role-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.admin-role-table {
  flex: 1;
  min-height: 0;
}

.role-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
  text-align: left;
}

.role-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.role-sub {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.full-width-control {
  width: 100%;
}

@media (max-width: 640px) {
  .admin-role-surface {
    padding: 12px;
  }

  .admin-role-toolbar {
    align-items: stretch;
  }
}
</style>
