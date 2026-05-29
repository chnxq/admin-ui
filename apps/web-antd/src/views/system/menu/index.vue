<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import type { SelectValue } from 'ant-design-vue/es/select';

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

import { IconPicker, Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t, $te } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import {
  AutoComplete,
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
  TreeSelect,
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
type ComponentOption = {
  label: string;
  meta: string;
  value: string;
};
type MenuTreeOption = {
  children?: MenuTreeOption[];
  label: string;
  subtitle: string;
  value: number;
};
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

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || '租户',
);

const defaultSorting: AdminTableSorting[] = [{ direction: 'ASC', field: 'id' }];

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

const pageComponentMap = import.meta.glob('../../**/*.vue');

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
    key: 'scope',
    title: '资源归属',
    width: 120,
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
const sorting = ref<AdminTableSorting[]>([...defaultSorting]);
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

const parentTreeOptions = computed<MenuTreeOption[]>(() =>
  buildParentTreeOptions(menuTree.value, editingId.value),
);
const componentOptions = computed<ComponentOption[]>(() => {
  const existingComponents = menuItems.value
    .map((item) => item.component?.trim())
    .filter((item): item is string => Boolean(item));
  const fileComponents = Object.keys(pageComponentMap)
    .map((filePath) => normalizeComponentPathFromFile(filePath))
    .filter((item): item is string => Boolean(item));
  const merged = [...new Set([...existingComponents, ...fileComponents])];

  return merged
    .toSorted((left, right) => left.localeCompare(right))
    .map((value) => ({
      label: value,
      meta: buildComponentOptionMeta(value),
      value,
    }));
});
const componentAutoCompleteOptions = computed(() =>
  componentOptions.value.map((item) => ({
    label: item.label,
    value: item.value,
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

function ensurePlatformWritable() {
  if (!isTenantSession.value) {
    return true;
  }
  message.warning(`租户会话 ${sessionTenantLabel.value} 仅可查看平台菜单`);
  return false;
}

function getDisplayTitle(title?: string) {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) {
    return '-';
  }
  return $te(normalizedTitle) ? $t(normalizedTitle) : normalizedTitle;
}

function buildParentTreeOptions(
  items: AdminMenu[],
  excludedId?: number,
): MenuTreeOption[] {
  return items
    .filter((item) => item.id && item.id !== excludedId)
    .map((item) => ({
      children: buildParentTreeOptions(item.children ?? [], excludedId),
      label: getDisplayTitle(item.meta?.title),
      subtitle: item.path ?? item.name ?? String(item.id),
      value: item.id as number,
    }));
}

function normalizeAuthorityInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

function syncFormByType(type: AdminMenuType) {
  if (type === 'BUTTON') {
    formModel.component = '';
    formModel.redirect = '';
    formModel.icon = '';
    return;
  }
  if (type === 'CATALOG') {
    formModel.component = '';
    formModel.redirect = '';
    return;
  }
  if (type === 'LINK') {
    formModel.component = '';
  }
}

function handleTypeChange(value: SelectValue) {
  if (!value || typeof value !== 'string') {
    return;
  }
  syncFormByType(value as AdminMenuType);
}

function getTypeHint(type: AdminMenuType) {
  switch (type) {
    case 'BUTTON': {
      return $t('page.menu.typeHintButton');
    }
    case 'CATALOG': {
      return $t('page.menu.typeHintCatalog');
    }
    case 'EMBEDDED': {
      return $t('page.menu.typeHintEmbedded');
    }
    case 'LINK': {
      return $t('page.menu.typeHintLink');
    }
    case 'MENU': {
      return $t('page.menu.typeHintMenu');
    }
    default: {
      return '';
    }
  }
}

function normalizeComponentPathFromFile(filePath: string) {
  const normalized = filePath
    .replaceAll('\\', '/')
    .replace(/^\.\.\/\.\.\//, '/')
    .replace(/\.vue$/, '');

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function buildComponentOptionMeta(componentPath: string) {
  if (componentPath.startsWith('/_core/')) {
    return $t('page.menu.componentOptionMetaFallback');
  }
  if (componentPath.startsWith('/dashboard/')) {
    return $t('page.menu.componentOptionMetaDashboard');
  }
  if (componentPath.startsWith('/system/')) {
    return $t('page.menu.componentOptionMetaSystem');
  }
  return $t('page.menu.componentOptionMetaView');
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
  sorting.value = [...defaultSorting];
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
  if (!ensurePlatformWritable()) {
    return;
  }
  editingId.value = undefined;
  resetFormModel();
  const menu = parent ? toAdminMenu(parent) : undefined;
  if (menu?.id) {
    formModel.parentId = menu.id;
  }
  syncFormByType(formModel.type);
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminMenuTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
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
  formModel.authority = normalizeAuthorityInput(formModel.authority);
  syncFormByType(formModel.type);
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitMenu() {
  if (!ensurePlatformWritable()) {
    return;
  }
  await formRef.value?.validate();

  submitting.value = true;
  try {
    const payload: AdminMenuSaveInput = {
      ...formModel,
      authority: normalizeAuthorityInput(formModel.authority)
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
  if (!ensurePlatformWritable()) {
    return;
  }
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
  if (!ensurePlatformWritable()) {
    return;
  }
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
      <div v-if="isTenantSession" class="tenant-session-banner">
        <IconifyIcon icon="lucide:building-2" />
        <span class="tenant-session-banner__text">
          当前为租户会话 {{ sessionTenantLabel }}，菜单属于平台租户，仅支持查看。
        </span>
      </div>

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
            :disabled="isTenantSession"
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

          <template v-else-if="column.key === 'scope'">
            <Tag color="gold">平台</Tag>
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
                :disabled="isTenantSession"
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
                :disabled="isTenantSession"
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
                :disabled="isTenantSession"
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
                  :disabled="isTenantSession"
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
          <TreeSelect
            v-model:value="formModel.parentId"
            allow-clear
            class="full-width-control"
            :field-names="{
              label: 'label',
              value: 'value',
              children: 'children',
            }"
            :placeholder="$t('page.menu.placeholderRootParent')"
            show-search
            :tree-data="parentTreeOptions"
            tree-default-expand-all
            tree-node-filter-prop="label"
          >
            <template #title="{ label, subtitle }">
              <div class="menu-option">
                <span class="menu-option-main">{{ label }}</span>
                <span class="menu-option-meta">{{ subtitle }}</span>
              </div>
            </template>
          </TreeSelect>
          <div class="menu-form-hint">
            {{ $t('page.menu.parentHint') }}
          </div>
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
          <AutoComplete
            v-model:value="formModel.component"
            allow-clear
            :disabled="
              formModel.type === 'BUTTON' ||
              formModel.type === 'CATALOG' ||
              formModel.type === 'LINK'
            "
            :options="componentAutoCompleteOptions"
            :placeholder="$t('page.menu.placeholderComponent')"
          >
            <template #option="{ value }">
              <div class="menu-option">
                <span class="menu-option-main">{{ value }}</span>
                <span class="menu-option-meta">{{
                  componentOptions.find((item) => item.value === value)?.meta
                }}</span>
              </div>
            </template>
          </AutoComplete>
          <div class="menu-form-hint">
            {{ $t('page.menu.componentHint') }}
          </div>
        </Form.Item>
        <Form.Item :label="$t('page.menu.redirect')" name="redirect">
          <Input
            v-model:value="formModel.redirect"
            :disabled="
              formModel.type === 'BUTTON' || formModel.type === 'CATALOG'
            "
            :placeholder="$t('page.menu.placeholderRedirect')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.menu.icon')" name="icon">
          <IconPicker
            v-model="formModel.icon"
            :disabled="formModel.type === 'BUTTON'"
            prefix="lucide"
            :placeholder="$t('page.menu.placeholderIcon')"
          />
          <div class="menu-form-hint">
            {{ $t('page.menu.iconHint') }}
          </div>
        </Form.Item>
        <Form.Item :label="$t('page.menu.authority')" name="authority">
          <Input
            v-model:value="formModel.authority"
            :disabled="formModel.type === 'CATALOG'"
            :placeholder="$t('page.menu.placeholderAuthority')"
          />
          <div class="menu-form-hint">
            {{ $t('page.menu.authorityHint') }}
          </div>
        </Form.Item>
        <Form.Item :label="$t('page.menu.type')" name="type">
          <Select
            v-model:value="formModel.type"
            :options="typeOptions"
            @change="handleTypeChange"
          />
          <div class="menu-form-hint">
            {{ getTypeHint(formModel.type) }}
          </div>
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

.tenant-session-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  background: linear-gradient(
    135deg,
    hsl(var(--primary) / 0.08),
    hsl(var(--accent) / 0.28)
  );
  border: 1px solid hsl(var(--primary) / 0.16);
  border-radius: 10px;
}

.tenant-session-banner__text {
  font-size: 13px;
  color: hsl(var(--foreground) / 0.82);
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

.menu-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.menu-option-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.menu-option-meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.menu-form-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
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
