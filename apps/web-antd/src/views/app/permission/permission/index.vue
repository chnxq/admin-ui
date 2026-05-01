<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
  TreeProps,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminPermission,
  AdminPermissionGroup,
  AdminPermissionGroupSaveInput,
  AdminPermissionGroupStatus,
  AdminPermissionSaveInput,
  AdminPermissionStatus,
} from '#/api/admin/permissions';
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
  Tree,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAdminPermissionApi,
  createAdminPermissionGroupApi,
  deleteAdminPermissionApi,
  deleteAdminPermissionGroupApi,
  listAdminPermissionGroupsApi,
  listAdminPermissionsApi,
  syncAdminPermissionsApi,
  updateAdminPermissionApi,
  updateAdminPermissionGroupApi,
} from '#/api/admin/permissions';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
} from '#/components/admin-table-toolbar/shared';

interface AdminPermissionFormModel extends AdminPermissionSaveInput {
  code: string;
  name: string;
  status: AdminPermissionStatus;
}

interface AdminPermissionGroupFormModel extends AdminPermissionGroupSaveInput {
  module: string;
  name: string;
  sortOrder: number;
  status: AdminPermissionGroupStatus;
}

type PermissionRecord = AdminPermission | Record<string, any>;

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
];

const statusTextMap: Record<AdminPermissionStatus, string> = {
  OFF: '禁用',
  ON: '启用',
};

const columns: AdminTableColumn<AdminPermission>[] = [
  {
    key: 'permission',
    title: '权限点',
    width: 280,
  },
  {
    dataIndex: 'groupName',
    key: 'group',
    title: '权限组',
    width: 150,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    key: 'resource',
    title: '资源绑定',
    width: 160,
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
const groupLoading = ref(false);
const modalOpen = ref(false);
const groupModalOpen = ref(false);
const submitting = ref(false);
const groupSubmitting = ref(false);
const syncing = ref(false);
const editingId = ref<number>();
const editingGroupId = ref<number>();
const selectedGroupId = ref<number>();
const formRef = ref<FormInstance>();
const groupFormRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const permissions = ref<AdminPermission[]>([]);
const groups = ref<AdminPermissionGroup[]>([]);
const groupTree = ref<AdminPermissionGroup[]>([]);
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

const formModel = reactive<AdminPermissionFormModel>({
  apiIds: [],
  code: '',
  description: '',
  groupId: undefined,
  menuIds: [],
  name: '',
  status: 'ON',
});

const groupFormModel = reactive<AdminPermissionGroupFormModel>({
  description: '',
  module: '',
  name: '',
  parentId: undefined,
  sortOrder: 0,
  status: 'ON',
});

const selectedGroupName = computed(() => {
  if (!selectedGroupId.value) {
    return '全部权限组';
  }
  return (
    groups.value.find((item) => item.id === selectedGroupId.value)?.name ??
    '当前权限组'
  );
});

const modalTitle = computed(() =>
  editingId.value ? '编辑权限点' : '新增权限点',
);
const groupModalTitle = computed(() =>
  editingGroupId.value ? '编辑权限组' : '新增权限组',
);

const displayColumns = computed<TableColumnsType<AdminPermission>>(() =>
  filterVisibleAdminTableColumns(columns, visibleColumnKeys.value),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  code: [{ message: '请输入权限编码', required: true }],
  name: [{ message: '请输入权限名称', required: true }],
  status: [{ message: '请选择状态', required: true }],
}));

const groupFormRules = computed<Record<string, Rule[]>>(() => ({
  module: [{ message: '请输入模块标识', required: true }],
  name: [{ message: '请输入权限组名称', required: true }],
  status: [{ message: '请选择状态', required: true }],
}));

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  total: pager.total,
}));

const groupOptions = computed(() =>
  groups.value.map((group) => ({
    label: group.name ?? `#${group.id}`,
    value: group.id,
  })),
);

const parentGroupOptions = computed(() =>
  groups.value
    .filter((group) => group.id !== editingGroupId.value)
    .map((group) => ({
      label: group.name ?? `#${group.id}`,
      value: group.id,
    })),
);

const treeData = computed<TreeProps['treeData']>(() => [
  {
    key: 'all',
    title: '全部权限组',
    children: groupTree.value.map((group) => toTreeNode(group)),
  },
]);

const selectedTreeKeys = computed(() => [
  selectedGroupId.value ? String(selectedGroupId.value) : 'all',
]);

function toTreeNode(
  group: AdminPermissionGroup,
): NonNullable<TreeProps['treeData']>[number] {
  return {
    key: String(group.id),
    title: group.name ?? `#${group.id}`,
    children: group.children?.map((child) => toTreeNode(child)) ?? [],
  };
}

function resetFormModel() {
  Object.assign(formModel, {
    apiIds: [],
    code: '',
    description: '',
    groupId: selectedGroupId.value,
    menuIds: [],
    name: '',
    status: 'ON',
  });
}

function resetGroupFormModel() {
  Object.assign(groupFormModel, {
    description: '',
    module: 'sys',
    name: '',
    parentId: selectedGroupId.value,
    sortOrder: 0,
    status: 'ON',
  });
}

function toPermission(record: PermissionRecord) {
  return record as AdminPermission;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getStatusText(status?: AdminPermissionStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminPermissionStatus) {
  return status === 'ON' ? 'success' : 'error';
}

async function loadGroups() {
  groupLoading.value = true;
  try {
    const response = await listAdminPermissionGroupsApi({ pageSize: 200 });
    groups.value = response.items;
    groupTree.value = response.tree;
  } catch (error) {
    message.error((error as Error).message || '加载权限组失败');
  } finally {
    groupLoading.value = false;
  }
}

async function loadPermissions() {
  loading.value = true;
  try {
    const response = await listAdminPermissionsApi({
      code: searchForm.code,
      groupId: selectedGroupId.value,
      name: searchForm.name,
      page: pager.page,
      pageSize: pager.pageSize,
    });
    permissions.value = response.items;
    pager.total = response.total;
  } catch (error) {
    message.error((error as Error).message || '加载权限点失败');
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadGroups(), loadPermissions()]);
}

async function handleSearch() {
  pager.page = 1;
  await loadPermissions();
}

async function handleReset() {
  searchForm.code = '';
  searchForm.name = '';
  pager.page = 1;
  await loadPermissions();
}

async function handleTableChange(pagination: TablePaginationConfig) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  await loadPermissions();
}

async function handleTreeSelect(keys: (number | string)[]) {
  const key = keys[0];
  selectedGroupId.value =
    key && key !== 'all' ? Number.parseInt(String(key), 10) : undefined;
  pager.page = 1;
  await loadPermissions();
}

async function openCreate() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: PermissionRecord) {
  const permission = toPermission(record);
  if (!permission.id) {
    message.warning('缺少权限点 ID');
    return;
  }

  editingId.value = permission.id;
  Object.assign(formModel, {
    apiIds: permission.apiIds ?? [],
    code: permission.code ?? '',
    description: permission.description ?? '',
    groupId: permission.groupId,
    menuIds: permission.menuIds ?? [],
    name: permission.name ?? '',
    status: permission.status ?? 'ON',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitPermission() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminPermissionApi(editingId.value, formModel);
      message.success('权限点已更新');
    } else {
      await createAdminPermissionApi(formModel);
      message.success('权限点已创建');
    }
    modalOpen.value = false;
    await loadPermissions();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: PermissionRecord) {
  const permission = toPermission(record);
  if (!permission.id) {
    message.warning('缺少权限点 ID');
    return;
  }

  await deleteAdminPermissionApi(permission.id);
  message.success('权限点已删除');
  await loadPermissions();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminPermissionsApi();
    message.success('权限点同步完成');
    await loadPermissions();
  } finally {
    syncing.value = false;
  }
}

async function openCreateGroup() {
  editingGroupId.value = undefined;
  resetGroupFormModel();
  groupModalOpen.value = true;
  await nextTick();
  groupFormRef.value?.clearValidate();
}

async function openEditGroup() {
  if (!selectedGroupId.value) {
    message.warning('请选择权限组');
    return;
  }

  const group = groups.value.find((item) => item.id === selectedGroupId.value);
  if (!group) {
    message.warning('权限组不存在');
    return;
  }

  editingGroupId.value = group.id;
  Object.assign(groupFormModel, {
    description: group.description ?? '',
    module: group.module ?? '',
    name: group.name ?? '',
    parentId: group.parentId,
    sortOrder: group.sortOrder ?? 0,
    status: group.status ?? 'ON',
  });
  groupModalOpen.value = true;
  await nextTick();
  groupFormRef.value?.clearValidate();
}

async function submitGroup() {
  await groupFormRef.value?.validate();

  groupSubmitting.value = true;
  try {
    if (editingGroupId.value) {
      await updateAdminPermissionGroupApi(editingGroupId.value, groupFormModel);
      message.success('权限组已更新');
    } else {
      await createAdminPermissionGroupApi(groupFormModel);
      message.success('权限组已创建');
    }
    groupModalOpen.value = false;
    await loadGroups();
  } finally {
    groupSubmitting.value = false;
  }
}

async function handleDeleteGroup() {
  if (!selectedGroupId.value) {
    message.warning('请选择权限组');
    return;
  }

  await deleteAdminPermissionGroupApi(selectedGroupId.value);
  message.success('权限组已删除');
  selectedGroupId.value = undefined;
  pager.page = 1;
  await refreshAll();
}

onMounted(() => {
  refreshAll();
});
</script>

<template>
  <Page auto-content-height title="权限点管理">
    <div class="admin-permission-layout">
      <aside class="admin-permission-groups">
        <div class="group-header">
          <span class="group-title">权限组</span>
          <Space>
            <Button size="small" type="text" @click="openCreateGroup">
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
            </Button>
            <Button
              size="small"
              type="text"
              :disabled="!selectedGroupId"
              @click="openEditGroup"
            >
              <template #icon>
                <IconifyIcon icon="lucide:pencil" />
              </template>
            </Button>
            <Popconfirm title="确认删除该权限组？" @confirm="handleDeleteGroup">
              <Button
                danger
                size="small"
                type="text"
                :disabled="!selectedGroupId"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:trash-2" />
                </template>
              </Button>
            </Popconfirm>
          </Space>
        </div>
        <Tree
          :default-expanded-keys="['all']"
          :loading="groupLoading"
          :selected-keys="selectedTreeKeys"
          :tree-data="treeData"
          @select="handleTreeSelect"
        />
      </aside>

      <section ref="tableSurfaceRef" class="admin-permission-surface">
        <div class="admin-permission-toolbar">
          <Form :model="searchForm" layout="inline" @finish="handleSearch">
            <Form.Item label="权限名称" name="name">
              <Input
                v-model:value="searchForm.name"
                allow-clear
                placeholder="输入权限名称"
              />
            </Form.Item>
            <Form.Item label="权限编码" name="code">
              <Input
                v-model:value="searchForm.code"
                allow-clear
                placeholder="输入权限编码"
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
              :data-source="permissions"
              file-name="permission-list"
              :fullscreen-target="tableSurfaceRef"
              :refresh="refreshAll"
              storage-key="permission-list"
            />
            <Button :loading="syncing" @click="handleSync">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" />
              </template>
              同步权限
            </Button>
            <Button type="primary" @click="openCreate">
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              新增权限点
            </Button>
          </Space>
        </div>

        <div class="permission-context">
          <span>{{ selectedGroupName }}</span>
        </div>

        <Table
          class="admin-permission-table"
          :columns="displayColumns"
          :data-source="permissions"
          :loading="loading"
          :pagination="tablePagination"
          row-key="id"
          size="middle"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'permission'">
              <div class="permission-cell">
                <span class="permission-main">{{ record.name || '-' }}</span>
                <span class="permission-sub">{{ record.code || '-' }}</span>
              </div>
            </template>

            <template v-else-if="column.key === 'group'">
              {{ record.groupName || '-' }}
            </template>

            <template v-else-if="column.key === 'status'">
              <Tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </Tag>
            </template>

            <template v-else-if="column.key === 'resource'">
              <Space :size="4">
                <Tag>菜单 {{ record.menuIds?.length ?? 0 }}</Tag>
                <Tag>API {{ record.apiIds?.length ?? 0 }}</Tag>
              </Space>
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
                  title="确认删除该权限点？"
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
      </section>
    </div>

    <Modal
      v-model:open="modalOpen"
      destroy-on-close
      :confirm-loading="submitting"
      :title="modalTitle"
      @ok="submitPermission"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item label="权限名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入权限名称" />
        </Form.Item>
        <Form.Item label="权限编码" name="code">
          <Input
            v-model:value="formModel.code"
            placeholder="例如 sys:user:create"
          />
        </Form.Item>
        <Form.Item label="权限组" name="groupId">
          <Select
            v-model:value="formModel.groupId"
            allow-clear
            :options="groupOptions"
            placeholder="请选择权限组"
          />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
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

    <Modal
      v-model:open="groupModalOpen"
      destroy-on-close
      :confirm-loading="groupSubmitting"
      :title="groupModalTitle"
      @ok="submitGroup"
    >
      <Form
        ref="groupFormRef"
        :model="groupFormModel"
        :rules="groupFormRules"
        layout="vertical"
      >
        <Form.Item label="上级权限组" name="parentId">
          <Select
            v-model:value="groupFormModel.parentId"
            allow-clear
            :options="parentGroupOptions"
            placeholder="根级权限组"
          />
        </Form.Item>
        <Form.Item label="权限组名称" name="name">
          <Input
            v-model:value="groupFormModel.name"
            placeholder="请输入权限组名称"
          />
        </Form.Item>
        <Form.Item label="模块标识" name="module">
          <Input v-model:value="groupFormModel.module" placeholder="例如 sys" />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select
            v-model:value="groupFormModel.status"
            :options="statusOptions"
          />
        </Form.Item>
        <Form.Item label="排序" name="sortOrder">
          <InputNumber
            v-model:value="groupFormModel.sortOrder"
            class="full-width-control"
            :min="0"
          />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea
            v-model:value="groupFormModel.description"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            placeholder="请输入描述"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-permission-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.admin-permission-groups,
.admin-permission-surface {
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-permission-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.group-title {
  font-weight: 600;
}

.admin-permission-surface {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-permission-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.permission-context {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.admin-permission-table {
  flex: 1;
  min-height: 0;
}

.permission-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
  text-align: left;
}

.permission-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.permission-sub {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.full-width-control {
  width: 100%;
}

@media (max-width: 900px) {
  .admin-permission-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .admin-permission-groups,
  .admin-permission-surface {
    padding: 12px;
  }

  .admin-permission-toolbar {
    align-items: stretch;
  }
}
</style>
