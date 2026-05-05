<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminMenu,
  AdminMenuSaveInput,
  AdminMenuStatus,
  AdminMenuType,
} from '#/api/admin/menus';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t, $te } from '@vben/locales';

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
  createAdminMenuApi,
  deleteAdminMenuApi,
  listAdminMenusApi,
  syncAdminMenusApi,
  updateAdminMenuApi,
} from '#/api/admin/menus';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

interface AdminMenuFormModel extends Omit<
  AdminMenuSaveInput,
  'authority' | 'ignoreAccess' | 'menuVisibleWithForbidden'
> {
  authority: string;
  component: string;
  icon: string;
  ignoreAccess: 'false' | 'true';
  menuVisibleWithForbidden: 'false' | 'true';
  name: string;
  path: string;
  redirect: string;
  status: AdminMenuStatus;
  title: string;
  type: AdminMenuType;
}

type AdminMenuTableRecord = AdminMenu | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const MENU_ACCESS = {
  create: ['menus:create'],
  delete: ['menus:delete'],
  edit: ['menus:edit'],
  export: ['menus:export'],
  sync: ['menus:sync:create', 'menus:create'],
} as const;

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
];

const typeOptions = [
  { label: '目录', value: 'CATALOG' },
  { label: '菜单', value: 'MENU' },
  { label: '按钮', value: 'BUTTON' },
  { label: '内嵌页', value: 'EMBEDDED' },
  { label: '外链', value: 'LINK' },
];

const statusTextMap: Record<AdminMenuStatus, string> = {
  OFF: '禁用',
  ON: '启用',
};

const typeTextMap: Record<AdminMenuType, string> = {
  BUTTON: '按钮',
  CATALOG: '目录',
  EMBEDDED: '内嵌页',
  LINK: '外链',
  MENU: '菜单',
};

const columns: AdminTableColumn<AdminMenu>[] = [
  {
    key: 'menu',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: '菜单',
    width: 260,
  },
  {
    dataIndex: 'path',
    sortable: true,
    sorter: true,
    title: '路径',
    width: 180,
  },
  {
    dataIndex: 'component',
    title: '组件',
    width: 240,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: '类型',
    width: 100,
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
    width: 150,
  },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const syncing = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const menuItems = ref<AdminMenu[]>([]);
const menuTree = ref<AdminMenu[]>([]);
const sorting = ref<AdminTableSorting[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  name: '',
  path: '',
});

const formModel = reactive<AdminMenuFormModel>({
  authority: '',
  component: '',
  icon: '',
  ignoreAccess: 'false',
  menuVisibleWithForbidden: 'false',
  name: '',
  parentId: undefined,
  path: '',
  redirect: '',
  status: 'ON',
  title: '',
  type: 'MENU',
});

const modalTitle = computed(() => (editingId.value ? '编辑菜单' : '新增菜单'));
const displayColumns = computed<TableColumnsType<AdminMenu>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  name: [{ message: '请输入菜单名称', required: true }],
  path: [{ message: '请输入路径', required: true }],
  status: [{ message: '请选择状态', required: true }],
  title: [{ message: '请输入菜单标题', required: true }],
  type: [{ message: '请选择类型', required: true }],
}));

const parentOptions = computed(() =>
  menuItems.value
    .filter((item) => item.id !== editingId.value)
    .map((item) => ({
      label: `${getDisplayTitle(item.meta?.title)} (${item.name ?? item.path ?? item.id})`,
      value: item.id,
    })),
);

function resetFormModel() {
  Object.assign(formModel, {
    authority: '',
    component: '',
    icon: '',
    ignoreAccess: 'false',
    menuVisibleWithForbidden: 'false',
    name: '',
    parentId: undefined,
    path: '',
    redirect: '',
    status: 'ON',
    title: '',
    type: 'MENU',
  });
}

function toAdminMenu(record: AdminMenuTableRecord) {
  return record as AdminMenu;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getStatusText(status?: AdminMenuStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminMenuStatus) {
  return status === 'ON' ? 'success' : 'error';
}

function getTypeText(type?: AdminMenuType) {
  return type ? typeTextMap[type] : '-';
}

function getDisplayTitle(title?: string) {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) {
    return '-';
  }
  return $te(normalizedTitle) ? $t(normalizedTitle) : normalizedTitle;
}

async function loadMenus() {
  loading.value = true;
  try {
    const response = await listAdminMenusApi({
      name: searchForm.name,
      path: searchForm.path,
      pageSize: 200,
      sorting: sorting.value,
    });
    menuItems.value = response.items;
    menuTree.value = response.tree;
  } catch (error) {
    message.error((error as Error).message || '加载菜单列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  await loadMenus();
}

async function handleReset() {
  searchForm.name = '';
  searchForm.path = '';
  sorting.value = [];
  await loadMenus();
}

async function handleTableChange(
  _pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  sorting.value = toAdminTableSorting(sorter as any);
  await loadMenus();
}

async function openCreate(parent?: AdminMenuTableRecord) {
  editingId.value = undefined;
  resetFormModel();
  const menu = parent ? toAdminMenu(parent) : undefined;
  if (menu?.id) {
    formModel.parentId = menu.id;
  }
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminMenuTableRecord) {
  const menu = toAdminMenu(record);
  if (!menu.id) {
    message.warning('缺少菜单 ID');
    return;
  }

  editingId.value = menu.id;
  Object.assign(formModel, {
    authority: (menu.meta?.authority ?? []).join(','),
    component: menu.component ?? '',
    icon: menu.meta?.icon ?? '',
    ignoreAccess: menu.meta?.ignoreAccess ? 'true' : 'false',
    menuVisibleWithForbidden: menu.meta?.menuVisibleWithForbidden
      ? 'true'
      : 'false',
    name: menu.name ?? '',
    parentId: menu.parentId,
    path: menu.path ?? '',
    redirect: menu.redirect ?? '',
    status: menu.status ?? 'ON',
    title: menu.meta?.title ?? '',
    type: menu.type ?? 'MENU',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitMenu() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    const payload: AdminMenuSaveInput = {
      ...formModel,
      authority: formModel.authority
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ignoreAccess: formModel.ignoreAccess === 'true',
      menuVisibleWithForbidden: formModel.menuVisibleWithForbidden === 'true',
    };
    if (editingId.value) {
      await updateAdminMenuApi(editingId.value, payload);
      message.success('菜单已更新');
    } else {
      await createAdminMenuApi(payload);
      message.success('菜单已创建');
    }
    modalOpen.value = false;
    await loadMenus();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminMenuTableRecord) {
  const menu = toAdminMenu(record);
  if (!menu.id) {
    message.warning('缺少菜单 ID');
    return;
  }

  await deleteAdminMenuApi(menu.id);
  message.success('菜单已删除');
  await loadMenus();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminMenusApi();
    message.success('菜单同步完成');
    await loadMenus();
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  loadMenus();
});
</script>

<template>
  <Page auto-content-height title="菜单管理">
    <div ref="tableSurfaceRef" class="admin-menu-surface">
      <div class="admin-menu-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item label="菜单名称" name="name">
            <Input
              v-model:value="searchForm.name"
              allow-clear
              placeholder="输入菜单名称"
            />
          </Form.Item>
          <Form.Item label="路径" name="path">
            <Input
              v-model:value="searchForm.path"
              allow-clear
              placeholder="输入路径"
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
            :export-access-codes="MENU_ACCESS.export"
            :data-source="menuTree"
            file-name="system-menus"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadMenus"
            storage-key="system-menu-list"
          />
          <Popconfirm
            title="确认从默认导航定义同步菜单？"
            @confirm="handleSync"
          >
            <Button v-access:code="MENU_ACCESS.sync" :loading="syncing">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" />
              </template>
              同步菜单
            </Button>
          </Popconfirm>
          <Button
            v-access:code="MENU_ACCESS.create"
            type="primary"
            @click="openCreate()"
          >
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
            新增菜单
          </Button>
        </Space>
      </div>

      <Table
        class="admin-menu-table"
        :columns="displayColumns"
        :data-source="menuTree"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'menu'">
            <div class="menu-cell">
              <span class="menu-main">
                {{ getDisplayTitle(record.meta?.title) }}
              </span>
              <span class="menu-sub">{{
                record.name || record.path || '-'
              }}</span>
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
                v-access:code="MENU_ACCESS.create"
                size="small"
                type="link"
                @click="openCreate(record)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:plus" />
                </template>
                子菜单
              </Button>
              <Button
                v-access:code="MENU_ACCESS.edit"
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
                title="确认删除该菜单？"
                @confirm="handleDelete(record)"
              >
                <Button
                  v-access:code="MENU_ACCESS.delete"
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
      @ok="submitMenu"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item label="上级菜单" name="parentId">
          <Select
            v-model:value="formModel.parentId"
            allow-clear
            :options="parentOptions"
            placeholder="根级菜单"
          />
        </Form.Item>
        <Form.Item label="菜单标题" name="title">
          <Input v-model:value="formModel.title" placeholder="请输入菜单标题" />
        </Form.Item>
        <Form.Item label="菜单名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入菜单名称" />
        </Form.Item>
        <Form.Item label="路径" name="path">
          <Input v-model:value="formModel.path" placeholder="请输入路径" />
        </Form.Item>
        <Form.Item label="组件" name="component">
          <Input
            v-model:value="formModel.component"
            placeholder="例如 /system/user/index"
          />
        </Form.Item>
        <Form.Item label="重定向" name="redirect">
          <Input
            v-model:value="formModel.redirect"
            placeholder="请输入重定向路径"
          />
        </Form.Item>
        <Form.Item label="图标" name="icon">
          <Input
            v-model:value="formModel.icon"
            placeholder="例如 lucide:settings"
          />
        </Form.Item>
        <Form.Item label="权限标识" name="authority">
          <Input
            v-model:value="formModel.authority"
            placeholder="多个值用逗号分隔"
          />
        </Form.Item>
        <Form.Item label="类型" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item label="忽略访问控制" name="ignoreAccess">
          <Select
            v-model:value="formModel.ignoreAccess"
            :options="[
              { label: '否', value: 'false' },
              { label: '是', value: 'true' },
            ]"
          />
        </Form.Item>
        <Form.Item label="无权限时仍显示菜单" name="menuVisibleWithForbidden">
          <Select
            v-model:value="formModel.menuVisibleWithForbidden"
            :options="[
              { label: '否', value: 'false' },
              { label: '是', value: 'true' },
            ]"
          />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-menu-surface {
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

.admin-menu-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.admin-menu-table {
  flex: 1;
  min-height: 0;
}

.menu-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
  text-align: left;
}

.menu-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.menu-sub {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .admin-menu-surface {
    padding: 12px;
  }

  .admin-menu-toolbar {
    align-items: stretch;
  }
}
</style>
