<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
  TreeProps,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type { AdminApi } from '#/api/admin/apis';
import type { AdminMenu } from '#/api/admin/menus';
import type {
  AdminPermission,
  AdminPermissionGroup,
  AdminPermissionGroupSaveInput,
  AdminPermissionGroupStatus,
  AdminPermissionSaveInput,
  AdminPermissionStatus,
} from '#/api/admin/permissions';
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
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tree,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { listAdminApisApi } from '#/api/admin/apis';
import { listAdminMenusApi } from '#/api/admin/menus';
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
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

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
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const PERMISSION_ACCESS = {
  create: ['permissions:create'],
  delete: ['permissions:delete'],
  edit: ['permissions:edit'],
  export: ['permissions:export'],
  groupCreate: ['permission:groups:create'],
  groupDelete: ['permission:groups:delete'],
  groupEdit: ['permission:groups:edit'],
  sync: ['permissions:sync:perms:create'],
} as const;

const statusOptions = [
  { label: $t('enum.status.ON'), value: 'ON' },
  { label: $t('enum.status.OFF'), value: 'OFF' },
];

const statusTextMap: Record<AdminPermissionStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

const columns: AdminTableColumn<AdminPermission>[] = [
  {
    key: 'permission',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: $t('page.permission.permission'),
    width: 280,
  },
  {
    dataIndex: 'groupName',
    key: 'group',
    sortField: 'group_id',
    sortable: true,
    sorter: true,
    title: $t('page.permission.groupName'),
    width: 150,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.permission.status'),
    width: 100,
  },
  {
    key: 'resource',
    title: $t('page.permission.resource'),
    width: 160,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.permission.createdAt'),
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
const menuOptions = ref<AdminMenu[]>([]);
const apiOptions = ref<AdminApi[]>([]);
const resourceOptionLoading = ref(false);
const sorting = ref<AdminTableSorting[]>([]);
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
    return $t('page.permission.allGroups');
  }
  return (
    groups.value.find((item) => item.id === selectedGroupId.value)?.name ??
    $t('page.permission.currentGroup')
  );
});

const modalTitle = computed(() =>
  editingId.value ? $t('page.permission.editTitle') : $t('page.permission.createTitle'),
);
const groupModalTitle = computed(() =>
  editingGroupId.value ? $t('page.permission.groupEditTitle') : $t('page.permission.groupCreateTitle'),
);

const displayColumns = computed<TableColumnsType<AdminPermission>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  code: [{ message: $t('ui.formRules.required', [$t('page.permission.code')]), required: true }],
  name: [{ message: $t('ui.formRules.required', [$t('page.permission.name')]), required: true }],
  status: [{ message: $t('ui.formRules.selectRequired', [$t('page.permission.status')]), required: true }],
}));

const groupFormRules = computed<Record<string, Rule[]>>(() => ({
  module: [{ message: $t('ui.formRules.required', [$t('page.permission.groupModule')]), required: true }],
  name: [{ message: $t('ui.formRules.required', [$t('page.permission.groupName')]), required: true }],
  status: [{ message: $t('ui.formRules.selectRequired', [$t('page.permission.status')]), required: true }],
}));

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.loginAuditLog.total')} ${total}`,
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
    title: $t('page.permission.allGroups'),
    children: groupTree.value.map((group) => toTreeNode(group)),
  },
]);

const selectedTreeKeys = computed(() => [
  selectedGroupId.value ? String(selectedGroupId.value) : 'all',
]);

const menuTreeSelectData = computed(() =>
  buildMenuTreeSelectData(menuOptions.value),
);

const apiTreeSelectData = computed(() =>
  buildApiTreeSelectData(apiOptions.value),
);

function toTreeNode(
  group: AdminPermissionGroup,
): NonNullable<TreeProps['treeData']>[number] {
  return {
    key: String(group.id),
    title: group.name ?? `#${group.id}`,
    children: group.children?.map((child) => toTreeNode(child)) ?? [],
  };
}

function buildMenuTreeSelectData(items: AdminMenu[]) {
  const nodeMap = new Map<number, any>();
  const roots: any[] = [];

  for (const item of items) {
    if (item.id === undefined) {
      continue;
    }
    nodeMap.set(item.id, {
      title: item.meta?.title ?? item.name ?? item.path ?? `#${item.id}`,
      value: item.id,
      children: [],
    });
  }

  for (const item of items) {
    if (item.id === undefined) {
      continue;
    }
    const node = nodeMap.get(item.id);
    if (!node) {
      continue;
    }
    if (item.parentId !== undefined && nodeMap.has(item.parentId)) {
      nodeMap.get(item.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function buildApiTreeSelectData(items: AdminApi[]) {
  const groupMap = new Map<string, any>();

  for (const item of items) {
    const moduleName = item.module?.trim() || 'default';
    if (!groupMap.has(moduleName)) {
      groupMap.set(moduleName, {
        title: item.moduleDescription?.trim() || moduleName,
        value: `module-${moduleName}`,
        selectable: false,
        children: [],
      });
    }
    groupMap.get(moduleName).children.push({
      title: `${item.method ?? 'API'} ${item.path ?? ''}`,
      value: item.id,
    });
  }

  return [...groupMap.values()];
}

async function loadResourceOptions() {
  resourceOptionLoading.value = true;
  try {
    const [menuResponse, apiResponse] = await Promise.all([
      listAdminMenusApi({ pageSize: 500 }),
      listAdminApisApi({ pageSize: 1000 }),
    ]);
    menuOptions.value = menuResponse.items;
    apiOptions.value = apiResponse.items;
  } catch (error) {
    message.error((error as Error).message || $t('page.permission.loadResourceOptionsFailed'));
  } finally {
    resourceOptionLoading.value = false;
  }
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
    message.error((error as Error).message || $t('page.permission.loadGroupsFailed'));
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
      sorting: sorting.value,
    });
    permissions.value = response.items;
    pager.total = response.total;
  } catch (error) {
    message.error((error as Error).message || $t('page.permission.loadPermissionsFailed'));
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadGroups(), loadPermissions(), loadResourceOptions()]);
}

async function handleSearch() {
  pager.page = 1;
  await loadPermissions();
}

async function handleReset() {
  searchForm.code = '';
  searchForm.name = '';
  pager.page = 1;
  sorting.value = [];
  await loadPermissions();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
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
    message.warning($t('page.permission.missingId'));
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
      message.success($t('page.permission.updateSuccess'));
    } else {
      await createAdminPermissionApi(formModel);
      message.success($t('page.permission.createSuccess'));
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
    message.warning($t('page.permission.missingId'));
    return;
  }

  await deleteAdminPermissionApi(permission.id);
  message.success($t('page.permission.deleteSuccess'));
  await loadPermissions();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminPermissionsApi();
    message.success($t('page.permission.syncSuccess'));
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
    message.warning($t('page.permission.selectGroupRequired'));
    return;
  }

  const group = groups.value.find((item) => item.id === selectedGroupId.value);
  if (!group) {
    message.warning($t('page.permission.groupNotFound'));
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
      message.success($t('page.permission.groupUpdateSuccess'));
    } else {
      await createAdminPermissionGroupApi(groupFormModel);
      message.success($t('page.permission.groupCreateSuccess'));
    }
    groupModalOpen.value = false;
    await loadGroups();
  } finally {
    groupSubmitting.value = false;
  }
}

async function handleDeleteGroup() {
  if (!selectedGroupId.value) {
    message.warning($t('page.permission.selectGroupRequired'));
    return;
  }

  await deleteAdminPermissionGroupApi(selectedGroupId.value);
  message.success($t('page.permission.groupDeleteSuccess'));
  selectedGroupId.value = undefined;
  pager.page = 1;
  await refreshAll();
}

onMounted(() => {
  refreshAll();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.permission.permission')">
    <div class="admin-permission-layout">
      <aside class="admin-permission-groups">
        <div class="group-header">
          <span class="group-title">{{ $t('page.permission.groupPanelTitle') }}</span>
          <Space>
            <Button
              v-access:code="PERMISSION_ACCESS.groupCreate"
              size="small"
              type="text"
              @click="openCreateGroup"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
            </Button>
            <Button
              v-access:code="PERMISSION_ACCESS.groupEdit"
              size="small"
              type="text"
              :disabled="!selectedGroupId"
              @click="openEditGroup"
            >
              <template #icon>
                <IconifyIcon icon="lucide:pencil" />
              </template>
            </Button>
            <Popconfirm
              :title="$t('ui.actionMessage.deleteConfirm', [$t('page.permission.groupName')])"
              @confirm="handleDeleteGroup"
            >
              <Button
                v-access:code="PERMISSION_ACCESS.groupDelete"
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
            <Form.Item :label="$t('page.permission.name')" name="name">
              <Input
                v-model:value="searchForm.name"
                allow-clear
                :placeholder="$t('page.permission.searchName')"
              />
            </Form.Item>
            <Form.Item :label="$t('page.permission.code')" name="code">
              <Input
                v-model:value="searchForm.code"
                allow-clear
                :placeholder="$t('page.permission.searchCode')"
              />
            </Form.Item>
            <Form.Item>
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

          <Space>
            <AdminTableToolbar
              v-model:column-keys="visibleColumnKeys"
              :columns="columns"
              :export-access-codes="PERMISSION_ACCESS.export"
              :data-source="permissions"
              file-name="permission-list"
              :fullscreen-target="tableSurfaceRef"
              :refresh="refreshAll"
              storage-key="permission-list"
            />
            <Button
              v-access:code="PERMISSION_ACCESS.sync"
              :loading="syncing"
              @click="handleSync"
            >
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" />
              </template>
              {{ $t('page.permission.moduleName') }}
            </Button>
            <Button
              v-access:code="PERMISSION_ACCESS.create"
              type="primary"
              @click="openCreate"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.permission.createTitle') }}
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
                <Tag>{{ $t('page.permission.menuResourceCount', { count: record.menuIds?.length ?? 0 }) }}</Tag>
                <Tag>{{ $t('page.permission.apiResourceCount', { count: record.apiIds?.length ?? 0 }) }}</Tag>
              </Space>
            </template>

            <template v-else-if="column.key === 'createdAt'">
              {{ formatTime(record.createdAt) }}
            </template>

            <template v-else-if="column.key === 'action'">
              <Space>
                <Button
                  v-access:code="PERMISSION_ACCESS.edit"
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
                  :title="$t('ui.actionMessage.deleteConfirm', [$t('page.permission.moduleName')])"
                  @confirm="handleDelete(record)"
                >
                  <Button
                    v-access:code="PERMISSION_ACCESS.delete"
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
        <Form.Item :label="$t('page.permission.name')" name="name">
          <Input v-model:value="formModel.name" :placeholder="$t('page.permission.placeholderName')" />
        </Form.Item>
        <Form.Item :label="$t('page.permission.code')" name="code">
          <Input
            v-model:value="formModel.code"
            :placeholder="$t('page.permission.placeholderCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.groupId')" name="groupId">
          <Select
            v-model:value="formModel.groupId"
            allow-clear
            :options="groupOptions"
            :placeholder="$t('page.permission.placeholderGroup')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.status')" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.permission.menuIds')" name="menuIds">
          <TreeSelect
            v-model:value="formModel.menuIds"
            allow-clear
            class="full-width-control"
            :field-names="{
              label: 'title',
              value: 'value',
              children: 'children',
            }"
            :loading="resourceOptionLoading"
            multiple
            :placeholder="$t('page.permission.placeholderMenu')"
            show-search
            :tree-checkable="true"
            :tree-data="menuTreeSelectData"
            tree-default-expand-all
            tree-node-filter-prop="title"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.apiIds')" name="apiIds">
          <TreeSelect
            v-model:value="formModel.apiIds"
            allow-clear
            class="full-width-control"
            :field-names="{
              label: 'title',
              value: 'value',
              children: 'children',
            }"
            :loading="resourceOptionLoading"
            multiple
            :placeholder="$t('page.permission.placeholderApi')"
            show-search
            :tree-checkable="true"
            :tree-data="apiTreeSelectData"
            tree-default-expand-all
            tree-node-filter-prop="title"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.description')" name="description">
          <Input.TextArea
            v-model:value="formModel.description"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            :placeholder="$t('page.permission.placeholderDescription')"
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
        <Form.Item :label="$t('page.permission.groupParentId')" name="parentId">
          <Select
            v-model:value="groupFormModel.parentId"
            allow-clear
            :options="parentGroupOptions"
            :placeholder="$t('page.permission.placeholderGroupParent')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.groupName')" name="name">
          <Input
            v-model:value="groupFormModel.name"
            :placeholder="$t('page.permission.placeholderGroupName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.groupModule')" name="module">
          <Input v-model:value="groupFormModel.module" :placeholder="$t('page.permission.placeholderGroupModule')" />
        </Form.Item>
        <Form.Item :label="$t('page.permission.status')" name="status">
          <Select
            v-model:value="groupFormModel.status"
            :options="statusOptions"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.groupSortOrder')" name="sortOrder">
          <InputNumber
            v-model:value="groupFormModel.sortOrder"
            class="full-width-control"
            :min="0"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.description')" name="description">
          <Input.TextArea
            v-model:value="groupFormModel.description"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            :placeholder="$t('page.permission.placeholderDescription')"
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
  align-items: start;
  min-height: 100%;
}

.admin-permission-groups,
.admin-permission-surface {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-permission-groups {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
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
  overflow-y: auto;
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

  .admin-permission-groups {
    position: static;
    top: auto;
    max-height: none;
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
