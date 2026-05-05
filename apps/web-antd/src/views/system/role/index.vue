<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type { AdminApi } from '#/api/admin/apis';
import type { AdminMenu } from '#/api/admin/menus';
import type {
  AdminPermission,
  AdminPermissionGroup,
} from '#/api/admin/permissions';
import type {
  AdminRole,
  AdminRoleSaveInput,
  AdminRoleStatus,
  AdminRoleType,
} from '#/api/admin/roles';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { listAdminApisApi } from '#/api/admin/apis';
import { listAdminMenusApi } from '#/api/admin/menus';
import {
  listAdminPermissionGroupsApi,
  listAdminPermissionsApi,
} from '#/api/admin/permissions';
import {
  createAdminRoleApi,
  deleteAdminRoleApi,
  getAdminRoleApi,
  listAdminRolesApi,
  updateAdminRoleApi,
} from '#/api/admin/roles';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

interface AdminRoleFormModel extends AdminRoleSaveInput {
  code: string;
  name: string;
  sortOrder: number;
  status: AdminRoleStatus;
  type: AdminRoleType;
}

type AdminRoleTableRecord = AdminRole | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const ROLE_ACCESS = {
  authorize: ['roles:edit'],
  create: ['roles:create'],
  delete: ['roles:delete'],
  edit: ['roles:edit'],
  export: ['roles:export'],
} as const;

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
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: 'ID',
    width: 80,
  },
  {
    key: 'role',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: '角色',
    width: 260,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: '类型',
    width: 120,
  },
  {
    dataIndex: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: '排序',
    width: 90,
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
    width: 220,
  },
];

const loading = ref(false);
const modalOpen = ref(false);
const authorizeModalOpen = ref(false);
const submitting = ref(false);
const authorizeLoading = ref(false);
const authorizeSubmitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const roles = ref<AdminRole[]>([]);
const permissionGroups = ref<AdminPermissionGroup[]>([]);
const permissions = ref<AdminPermission[]>([]);
const menuOptions = ref<AdminMenu[]>([]);
const apiOptions = ref<AdminApi[]>([]);
const authorizeRole = ref<AdminRole>();
const authorizePermissionIds = ref<number[]>([]);
const permissionOptionLoading = ref(false);
const resourceOptionLoading = ref(false);
const authorizeResourcesLoaded = ref(false);
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
const authorizeModalTitle = computed(() =>
  authorizeRole.value?.name
    ? `角色授权 · ${authorizeRole.value.name}`
    : '角色授权',
);

const displayColumns = computed<TableColumnsType<AdminRole>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

const permissionTreeData = computed(() =>
  buildPermissionTree(permissionGroups.value, permissions.value),
);

const permissionMap = computed(() => {
  const map = new Map<number, AdminPermission>();
  for (const item of permissions.value) {
    if (item.id !== undefined) {
      map.set(item.id, item);
    }
  }
  return map;
});

const menuMap = computed(() => {
  const map = new Map<number, AdminMenu>();
  for (const item of menuOptions.value) {
    if (item.id !== undefined) {
      map.set(item.id, item);
    }
  }
  return map;
});

const apiMap = computed(() => {
  const map = new Map<number, AdminApi>();
  for (const item of apiOptions.value) {
    if (item.id !== undefined) {
      map.set(item.id, item);
    }
  }
  return map;
});

const selectedAuthorizePermissions = computed(() =>
  authorizePermissionIds.value
    .map((id) => permissionMap.value.get(id))
    .filter(isDefined),
);

const selectedAuthorizeMenuIds = computed(() =>
  uniqueNumbers(
    selectedAuthorizePermissions.value.flatMap((item) => item.menuIds ?? []),
  ),
);

const selectedAuthorizeApiIds = computed(() =>
  uniqueNumbers(
    selectedAuthorizePermissions.value.flatMap((item) => item.apiIds ?? []),
  ),
);

const selectedAuthorizeMenus = computed(() =>
  selectedAuthorizeMenuIds.value
    .map((id) => menuMap.value.get(id))
    .filter(isDefined),
);

const selectedAuthorizeApis = computed(() =>
  selectedAuthorizeApiIds.value
    .map((id) => apiMap.value.get(id))
    .filter(isDefined),
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

function resetAuthorizeState() {
  authorizeRole.value = undefined;
  authorizePermissionIds.value = [];
}

function toAdminRole(record: AdminRoleTableRecord) {
  return record as AdminRole;
}

function toRoleSaveInput(
  role: AdminRole,
  overrides: Partial<AdminRoleSaveInput> = {},
): AdminRoleSaveInput {
  return {
    code: role.code ?? '',
    description: role.description ?? '',
    name: role.name ?? '',
    permissions: role.permissions ?? [],
    sortOrder: role.sortOrder ?? 0,
    status: role.status ?? 'ON',
    type: role.type ?? 'SYSTEM',
    ...overrides,
  };
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

function uniqueNumbers(values: Array<null | number | undefined>) {
  return [
    ...new Set(
      values.filter((item): item is number => typeof item === 'number'),
    ),
  ];
}

function normalizePermissionIds(values: Array<number | string>) {
  return uniqueNumbers(
    values.filter((item): item is number => typeof item === 'number'),
  );
}

function getPermissionLabel(permission: AdminPermission) {
  return permission.name ?? permission.code ?? `#${permission.id}`;
}

function getPermissionMeta(permission: AdminPermission) {
  return permission.code ?? '-';
}

function getMenuLabel(menu: AdminMenu) {
  return (
    menu.meta?.title?.trim() ||
    menu.name?.trim() ||
    menu.path?.trim() ||
    `#${menu.id}`
  );
}

function getMenuMeta(menu: AdminMenu) {
  return menu.path?.trim() || menu.name?.trim() || '-';
}

function getApiLabel(api: AdminApi) {
  return `${api.method ?? 'API'} ${api.path ?? ''}`.trim();
}

function getApiMeta(api: AdminApi) {
  return (
    api.operation?.trim() ||
    api.moduleDescription?.trim() ||
    api.module?.trim() ||
    '-'
  );
}

function buildPermissionTree(
  groupItems: AdminPermissionGroup[],
  permissionItems: AdminPermission[],
) {
  const groupNodeMap = new Map<number, any>();
  const roots: any[] = [];

  for (const group of groupItems) {
    if (group.id === undefined) {
      continue;
    }
    groupNodeMap.set(group.id, {
      title: group.name ?? `#${group.id}`,
      value: `group-${group.id}`,
      selectable: false,
      children: [],
    });
  }

  for (const group of groupItems) {
    if (group.id === undefined) {
      continue;
    }
    const node = groupNodeMap.get(group.id);
    if (!node) {
      continue;
    }
    if (group.parentId !== undefined && groupNodeMap.has(group.parentId)) {
      groupNodeMap.get(group.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const permission of permissionItems) {
    if (permission.id === undefined) {
      continue;
    }
    const node = {
      title: `${permission.name ?? permission.code ?? `#${permission.id}`} (${permission.code ?? '-'})`,
      value: permission.id,
    };
    if (
      permission.groupId !== undefined &&
      groupNodeMap.has(permission.groupId)
    ) {
      groupNodeMap.get(permission.groupId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function loadPermissionOptions() {
  permissionOptionLoading.value = true;
  try {
    const [groupResponse, permissionResponse] = await Promise.all([
      listAdminPermissionGroupsApi({ pageSize: 500 }),
      listAdminPermissionsApi({ pageSize: 1000 }),
    ]);
    permissionGroups.value = groupResponse.items;
    permissions.value = permissionResponse.items;
  } catch (error) {
    message.error((error as Error).message || '加载权限点选项失败');
    throw error;
  } finally {
    permissionOptionLoading.value = false;
  }
}

async function loadAuthorizeResources() {
  if (authorizeResourcesLoaded.value) {
    return;
  }

  resourceOptionLoading.value = true;
  try {
    const [menuResponse, apiResponse] = await Promise.all([
      listAdminMenusApi({ pageSize: 500 }),
      listAdminApisApi({ pageSize: 1000 }),
    ]);
    menuOptions.value = menuResponse.items;
    apiOptions.value = apiResponse.items;
    authorizeResourcesLoaded.value = true;
  } catch (error) {
    message.error((error as Error).message || '加载授权资源失败');
    throw error;
  } finally {
    resourceOptionLoading.value = false;
  }
}

async function loadRoles() {
  loading.value = true;
  try {
    const response = await listAdminRolesApi({
      code: searchForm.code,
      name: searchForm.name,
      page: pager.page,
      pageSize: pager.pageSize,
      sorting: sorting.value,
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
  sorting.value = [];
  await loadRoles();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
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
  Object.assign(formModel, toRoleSaveInput(role));
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openAuthorize(record: AdminRoleTableRecord) {
  const role = toAdminRole(record);
  if (!role.id) {
    message.warning('缺少角色 ID');
    return;
  }

  authorizeModalOpen.value = true;
  authorizeLoading.value = true;
  try {
    const [roleDetail] = await Promise.all([
      getAdminRoleApi(role.id),
      permissions.value.length > 0
        ? Promise.resolve()
        : loadPermissionOptions(),
      loadAuthorizeResources(),
    ]);
    authorizeRole.value = roleDetail;
    authorizePermissionIds.value = normalizePermissionIds(
      roleDetail.permissions ?? [],
    );
  } catch (error) {
    authorizeModalOpen.value = false;
    resetAuthorizeState();
    message.error((error as Error).message || '加载角色授权数据失败');
  } finally {
    authorizeLoading.value = false;
  }
}

function handleAuthorizePermissionChange(
  values?: Array<number | string> | number | string,
) {
  const nextValues = Array.isArray(values)
    ? values
    : (values === undefined
      ? []
      : [values]);
  authorizePermissionIds.value = normalizePermissionIds(nextValues);
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

async function submitAuthorize() {
  if (!authorizeRole.value?.id) {
    message.warning('缺少角色 ID');
    return;
  }

  authorizeSubmitting.value = true;
  try {
    await updateAdminRoleApi(
      authorizeRole.value.id,
      toRoleSaveInput(authorizeRole.value, {
        permissions: [...authorizePermissionIds.value],
      }),
    );
    authorizeRole.value = {
      ...authorizeRole.value,
      permissions: [...authorizePermissionIds.value],
    };
    authorizeModalOpen.value = false;
    message.success('角色授权已更新');
    await loadRoles();
  } finally {
    authorizeSubmitting.value = false;
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

onMounted(async () => {
  await Promise.all([loadPermissionOptions(), loadRoles()]);
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
            :export-access-codes="ROLE_ACCESS.export"
            :data-source="roles"
            file-name="system-roles"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadRoles"
            storage-key="system-role-list"
          />
          <Button
            v-access:code="ROLE_ACCESS.create"
            type="primary"
            @click="openCreate"
          >
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
              <Button
                v-access:code="ROLE_ACCESS.authorize"
                size="small"
                type="link"
                @click="openAuthorize(record)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:shield-check" />
                </template>
                授权
              </Button>
              <Button
                v-access:code="ROLE_ACCESS.edit"
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
                title="确认删除该角色？"
                @confirm="handleDelete(record)"
              >
                <Button
                  v-access:code="ROLE_ACCESS.delete"
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
        <Form.Item label="权限点" name="permissions">
          <TreeSelect
            v-model:value="formModel.permissions"
            allow-clear
            class="full-width-control"
            :field-names="{
              label: 'title',
              value: 'value',
              children: 'children',
            }"
            :loading="permissionOptionLoading"
            multiple
            placeholder="选择权限点"
            show-search
            :tree-checkable="true"
            :tree-data="permissionTreeData"
            tree-default-expand-all
            tree-node-filter-prop="title"
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

    <Modal
      v-model:open="authorizeModalOpen"
      destroy-on-close
      :confirm-loading="authorizeSubmitting"
      :title="authorizeModalTitle"
      :width="960"
      @cancel="resetAuthorizeState"
      @ok="submitAuthorize"
    >
      <Spin
        :spinning="
          authorizeLoading || permissionOptionLoading || resourceOptionLoading
        "
      >
        <div class="authorize-role-summary">
          <div class="authorize-role-main">
            <div class="authorize-role-name">
              {{ authorizeRole?.name || '-' }}
            </div>
            <div class="authorize-role-code">
              {{ authorizeRole?.code || '-' }}
            </div>
          </div>
          <Space wrap>
            <Tag :color="getStatusColor(authorizeRole?.status)">
              {{ getStatusText(authorizeRole?.status) }}
            </Tag>
            <Tag>{{ getTypeText(authorizeRole?.type) }}</Tag>
            <Tag>权限 {{ selectedAuthorizePermissions.length }}</Tag>
            <Tag>菜单 {{ selectedAuthorizeMenus.length }}</Tag>
            <Tag>API {{ selectedAuthorizeApis.length }}</Tag>
          </Space>
        </div>

        <Form layout="vertical">
          <Form.Item label="权限点">
            <TreeSelect
              :value="authorizePermissionIds"
              allow-clear
              class="full-width-control"
              :field-names="{
                label: 'title',
                value: 'value',
                children: 'children',
              }"
              :loading="permissionOptionLoading"
              multiple
              placeholder="选择权限点"
              show-search
              :tree-checkable="true"
              :tree-data="permissionTreeData"
              tree-default-expand-all
              tree-node-filter-prop="title"
              @change="handleAuthorizePermissionChange"
            />
          </Form.Item>
        </Form>

        <div class="authorize-preview-grid">
          <section class="authorize-preview-panel">
            <div class="authorize-preview-header">
              <span class="authorize-preview-title">已选权限点</span>
              <Tag>{{ selectedAuthorizePermissions.length }}</Tag>
            </div>
            <div
              v-if="selectedAuthorizePermissions.length > 0"
              class="authorize-item-list"
            >
              <div
                v-for="item in selectedAuthorizePermissions"
                :key="item.id"
                class="authorize-item"
              >
                <span class="authorize-item-main">
                  {{ getPermissionLabel(item) }}
                </span>
                <span class="authorize-item-sub">
                  {{ getPermissionMeta(item) }}
                </span>
              </div>
            </div>
            <Empty v-else description="未选择权限点" />
          </section>

          <section class="authorize-preview-panel">
            <div class="authorize-preview-header">
              <span class="authorize-preview-title">关联菜单</span>
              <Tag>{{ selectedAuthorizeMenus.length }}</Tag>
            </div>
            <div
              v-if="selectedAuthorizeMenus.length > 0"
              class="authorize-item-list"
            >
              <div
                v-for="item in selectedAuthorizeMenus"
                :key="item.id"
                class="authorize-item"
              >
                <span class="authorize-item-main">
                  {{ getMenuLabel(item) }}
                </span>
                <span class="authorize-item-sub">
                  {{ getMenuMeta(item) }}
                </span>
              </div>
            </div>
            <Empty v-else description="未关联菜单" />
          </section>

          <section class="authorize-preview-panel">
            <div class="authorize-preview-header">
              <span class="authorize-preview-title">关联 API</span>
              <Tag>{{ selectedAuthorizeApis.length }}</Tag>
            </div>
            <div
              v-if="selectedAuthorizeApis.length > 0"
              class="authorize-item-list"
            >
              <div
                v-for="item in selectedAuthorizeApis"
                :key="item.id"
                class="authorize-item"
              >
                <span class="authorize-item-main">
                  {{ getApiLabel(item) }}
                </span>
                <span class="authorize-item-sub">
                  {{ getApiMeta(item) }}
                </span>
              </div>
            </div>
            <Empty v-else description="未关联 API" />
          </section>
        </div>
      </Spin>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-role-surface {
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

.authorize-role-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.authorize-role-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.authorize-role-name {
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.authorize-role-code {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.authorize-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.authorize-preview-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 280px;
  padding: 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.authorize-preview-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.authorize-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.authorize-item-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.authorize-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: hsl(var(--muted) / 30%);
  border-radius: 6px;
}

.authorize-item-main {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: hsl(var(--foreground));
}

.authorize-item-sub {
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

@media (max-width: 960px) {
  .authorize-preview-grid {
    grid-template-columns: 1fr;
  }
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
