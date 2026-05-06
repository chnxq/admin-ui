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
  { label: $t('enum.status.ON'), value: 'ON' },
  { label: $t('enum.status.OFF'), value: 'OFF' },
];

const typeOptions = [
  { label: $t('enum.menu.type.CATALOG'), value: 'CATALOG' },
  { label: $t('enum.menu.type.MENU'), value: 'MENU' },
  { label: $t('enum.menu.type.BUTTON'), value: 'BUTTON' },
  { label: $t('enum.menu.type.EMBEDDED'), value: 'EMBEDDED' },
  { label: $t('enum.menu.type.LINK'), value: 'LINK' },
];

const statusTextMap: Record<AdminMenuStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

const typeTextMap: Record<AdminMenuType, string> = {
  BUTTON: $t('enum.menu.type.BUTTON'),
  CATALOG: $t('enum.menu.type.CATALOG'),
  EMBEDDED: $t('enum.menu.type.EMBEDDED'),
  LINK: $t('enum.menu.type.LINK'),
  MENU: $t('enum.menu.type.MENU'),
};

const columns: AdminTableColumn<AdminMenu>[] = [
  {
    key: 'menu',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: $t('page.menu.menu'),
    width: 260,
  },
  {
    dataIndex: 'path',
    sortable: true,
    sorter: true,
    title: $t('page.menu.path'),
    width: 180,
  },
  {
    dataIndex: 'component',
    title: $t('page.menu.component'),
    width: 240,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: $t('page.menu.type'),
    width: 100,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.menu.status'),
    width: 100,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.menu.createdAt'),
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

const modalTitle = computed(() =>
  editingId.value ? $t('page.menu.editTitle') : $t('page.menu.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminMenu>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  name: [
    {
      message: $t('ui.formRules.required', [$t('page.menu.name')]),
      required: true,
    },
  ],
  path: [
    {
      message: $t('ui.formRules.required', [$t('page.menu.path')]),
      required: true,
    },
  ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.menu.status')]),
      required: true,
    },
  ],
  title: [
    {
      message: $t('ui.formRules.required', [$t('page.menu.title')]),
      required: true,
    },
  ],
  type: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.menu.type')]),
      required: true,
    },
  ],
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
    message.error((error as Error).message || $t('page.menu.loadFailed'));
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
    message.warning($t('page.menu.missingId'));
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
      message.success($t('page.menu.updateSuccess'));
    } else {
      await createAdminMenuApi(payload);
      message.success($t('page.menu.createSuccess'));
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
    message.warning($t('page.menu.missingId'));
    return;
  }

  await deleteAdminMenuApi(menu.id);
  message.success($t('page.menu.deleteSuccess'));
  await loadMenus();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminMenusApi();
    message.success($t('page.menu.syncSuccess'));
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
  <Page auto-content-height :title="$t('menu.system.menu')">
    <div ref="tableSurfaceRef" class="admin-menu-surface">
      <div class="admin-menu-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item :label="$t('page.menu.name')" name="name">
            <Input
              v-model:value="searchForm.name"
              allow-clear
              :placeholder="$t('page.menu.placeholderSearchName')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.menu.path')" name="path">
            <Input
              v-model:value="searchForm.path"
              allow-clear
              :placeholder="$t('page.menu.placeholderSearchPath')"
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
            :export-access-codes="MENU_ACCESS.export"
            :data-source="menuTree"
            file-name="system-menus"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadMenus"
            storage-key="system-menu-list"
          />
          <Popconfirm
            :title="$t('page.menu.syncConfirm')"
            @confirm="handleSync"
          >
            <Button v-access:code="MENU_ACCESS.sync" :loading="syncing">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" />
              </template>
              {{ $t('page.menu.syncButton') }}
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
            {{ $t('page.menu.createTitle') }}
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
                {{ $t('page.menu.childMenu') }}
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
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                :title="
                  $t('ui.actionMessage.deleteConfirm', [
                    $t('page.menu.moduleName'),
                  ])
                "
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
      @ok="submitMenu"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.menu.parent')" name="parentId">
          <Select
            v-model:value="formModel.parentId"
            allow-clear
            :options="parentOptions"
            :placeholder="$t('page.menu.placeholderRootParent')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.title')" name="title">
          <Input
            v-model:value="formModel.title"
            :placeholder="$t('page.menu.placeholderTitle')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.name')" name="name">
          <Input
            v-model:value="formModel.name"
            :placeholder="$t('page.menu.placeholderName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.path')" name="path">
          <Input
            v-model:value="formModel.path"
            :placeholder="$t('page.menu.placeholderPath')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.component')" name="component">
          <Input
            v-model:value="formModel.component"
            :placeholder="$t('page.menu.placeholderComponent')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.redirect')" name="redirect">
          <Input
            v-model:value="formModel.redirect"
            :placeholder="$t('page.menu.placeholderRedirect')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.icon')" name="icon">
          <Input
            v-model:value="formModel.icon"
            :placeholder="$t('page.menu.placeholderIcon')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.authority')" name="authority">
          <Input
            v-model:value="formModel.authority"
            :placeholder="$t('page.menu.placeholderAuthority')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.type')" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.menu.ignoreAccess')" name="ignoreAccess">
          <Select
            v-model:value="formModel.ignoreAccess"
            :options="[
              { label: $t('page.menu.no'), value: 'false' },
              { label: $t('page.menu.yes'), value: 'true' },
            ]"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.menu.menuVisibleWithForbidden')"
          name="menuVisibleWithForbidden"
        >
          <Select
            v-model:value="formModel.menuVisibleWithForbidden"
            :options="[
              { label: $t('page.menu.no'), value: 'false' },
              { label: $t('page.menu.yes'), value: 'true' },
            ]"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.status')" name="status">
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
