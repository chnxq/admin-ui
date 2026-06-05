<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminMenu,
  AdminMenuSaveInput,
  AdminMenuStatus,
  AdminMenuType,
} from '#/api/admin/menus';

import { computed, nextTick, reactive, ref } from 'vue';

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
  Tag,
  Tooltip,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAdminMenuApi,
  deleteAdminMenuApi,
  listAdminMenusApi,
  syncAdminMenusApi,
  updateAdminMenuApi,
} from '#/api/admin/menus';

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
  () => userStore.userInfo?.tenantName || 'XAdmin平台',
);

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

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const syncing = ref(false);
const editingId = ref<number>();
const formRef = ref();
const menuItems = ref<AdminMenu[]>([]);
const menuTree = ref<AdminMenu[]>([]);

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

const parentTreeOptions = computed<MenuTreeOption[]>(() =>
  buildParentTreeOptions(menuTree.value, editingId.value),
);

const componentOptions = computed<ComponentOption[]>(() => {
  const existingComponents = menuItems.value
    .map((item) => item.component?.trim())
    .filter((value): value is string => value !== undefined && value !== '');
  const fileComponents = Object.keys(pageComponentMap)
    .map((filePath) => normalizeComponentPathFromFile(filePath))
    .filter((value): value is string => value !== undefined && value !== '');
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

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.menu.placeholderSearchName'),
      },
      fieldName: 'name',
      formItemClass: 'md:col-span-1',
      label: $t('page.menu.name'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.menu.placeholderSearchPath'),
      },
      fieldName: 'path',
      formItemClass: 'md:col-span-1',
      label: $t('page.menu.path'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4',
};

const gridOptions: VxeTableGridOptions<AdminMenu> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'name',
      treeNode: true,
      slots: { default: 'menu' },
      sortable: true,
      title: $t('page.menu.menu'),
      width: 260,
    },
    {
      field: 'path',
      sortable: true,
      title: $t('page.menu.path'),
      width: 180,
    },
    {
      field: 'component',
      title: $t('page.menu.component'),
      width: 240,
    },
    {
      field: 'type',
      slots: { default: 'type' },
      sortable: true,
      title: $t('page.menu.type'),
      width: 100,
    },
    {
      field: 'scope',
      slots: { default: 'scope' },
      title: $t('page.tenant.resourceOwnership'),
      width: 120,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.menu.status'),
      width: 100,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.menu.createdAt'),
      width: 170,
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 220,
    },
  ],
  exportConfig: {
    filename: 'system-menus',
    type: 'csv',
  },
  height: 'auto',
  keepSource: true,
  pagerConfig: {
    enabled: false,
  },
  proxyConfig: {
    ajax: {
      query: async (
        _params: { page: any; sort: any },
        formValues: Record<string, any>,
      ) => {
        loading.value = true;
        try {
          const response = await listAdminMenusApi({
            name: formValues.name,
            path: formValues.path,
            pageSize: 200,
            sorting: [{ direction: 'ASC', field: 'id' }],
          });
          menuItems.value = response.items;
          menuTree.value = response.tree;
          return {
            items: response.tree,
            total: response.tree.length,
          };
        } finally {
          loading.value = false;
        }
      },
    },
    sort: false,
  },
  rowConfig: {
    isHover: true,
  },
  stripe: true,
  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    slots: {
      toolPrefix: 'toolPrefix',
    },
    zoom: true,
  },
  treeConfig: {
    line: true,
    rowField: 'id',
    transform: false,
  },
};

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

function getMenuTooltip(menu: AdminMenu) {
  return [
    `${$t('page.menu.name')}：${menu.name || '-'}`,
    `${$t('page.menu.path')}：${menu.path || '-'}`,
  ].join('\n');
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

async function openCreate(parent?: AdminMenu) {
  if (!ensurePlatformWritable()) {
    return;
  }
  editingId.value = undefined;
  resetFormModel();
  if (parent?.id) {
    formModel.parentId = parent.id;
  }
  syncFormByType(formModel.type);
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminMenu) {
  if (!ensurePlatformWritable()) {
    return;
  }
  if (!record.id) {
    message.warning($t('page.menu.missingId'));
    return;
  }

  editingId.value = record.id;
  Object.assign(formModel, {
    authority: (record.meta?.authority ?? []).join(','),
    component: record.component ?? '',
    icon: record.meta?.icon ?? '',
    ignoreAccess: record.meta?.ignoreAccess ? 'true' : 'false',
    menuVisibleWithForbidden: record.meta?.menuVisibleWithForbidden
      ? 'true'
      : 'false',
    name: record.name ?? '',
    parentId: record.parentId,
    path: record.path ?? '',
    redirect: record.redirect ?? '',
    status: record.status ?? 'ON',
    title: record.meta?.title ?? '',
    type: record.type ?? 'MENU',
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
    await gridApi.reload();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminMenu) {
  if (!ensurePlatformWritable()) {
    return;
  }
  if (!record.id) {
    message.warning($t('page.menu.missingId'));
    return;
  }

  await deleteAdminMenuApi(record.id);
  message.success($t('page.menu.deleteSuccess'));
  await gridApi.reload();
}

async function handleSync() {
  if (!ensurePlatformWritable()) {
    return;
  }
  syncing.value = true;
  try {
    await syncAdminMenusApi();
    message.success($t('page.menu.syncSuccess'));
    await gridApi.reload();
  } finally {
    syncing.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid<AdminMenu>({
  gridClass: 'admin-menu-grid',
  gridOptions,
  formOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.menu')">
    <div v-if="isTenantSession" class="tenant-session-banner">
      <IconifyIcon icon="lucide:building-2" />
      <span class="tenant-session-banner__text">
        当前为租户会话
        {{ sessionTenantLabel }}，菜单属于平台租户，仅支持查看。
      </span>
    </div>

    <Grid :table-title="$t('menu.system.menu')">
      <template #toolPrefix>
        <div class="admin-menu-tool-prefix">
          <div class="admin-menu-tool-prefix__item">
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
          </div>
          <div class="admin-menu-tool-prefix__item">
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
          </div>
        </div>
      </template>

      <template #menu="{ row }">
        <Tooltip :title="getMenuTooltip(row)">
          <span class="menu-main">
            {{ getDisplayTitle(row.meta?.title) }}
          </span>
        </Tooltip>
      </template>

      <template #type="{ row }">
        <Tag>{{ getTypeText(row.type) }}</Tag>
      </template>

      <template #scope>
        <Tag color="gold">XAdmin平台</Tag>
      </template>

      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusText(row.status) }}
        </Tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>

      <template #action="{ row }">
        <Space>
          <Button
            v-access:code="MENU_ACCESS.create"
            :disabled="isTenantSession"
            size="small"
            type="link"
            @click="openCreate(row)"
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
            @click="openEdit(row)"
          >
            <template #icon>
              <IconifyIcon icon="lucide:pencil" />
            </template>
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            :disabled="isTenantSession"
            :title="
              $t('ui.actionMessage.deleteConfirm', [$t('page.menu.moduleName')])
            "
            @confirm="handleDelete(row)"
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
    </Grid>

    <Modal
      v-model:open="modalOpen"
      destroy-on-close
      :confirm-loading="submitting"
      :title="modalTitle"
      @ok="submitMenu"
    >
      <Form ref="formRef" :model="formModel" layout="vertical">
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
        <Form.Item
          :label="$t('page.menu.title')"
          name="title"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.menu.title')]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="formModel.title"
            :placeholder="$t('page.menu.placeholderTitle')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.menu.name')"
          name="name"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.menu.name')]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="formModel.name"
            :placeholder="$t('page.menu.placeholderName')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.menu.path')"
          name="path"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.menu.path')]),
              required: true,
            },
          ]"
        >
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
        <Form.Item
          :label="$t('page.menu.type')"
          name="type"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.menu.type'),
              ]),
              required: true,
            },
          ]"
        >
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
        <Form.Item
          :label="$t('page.menu.status')"
          name="status"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.menu.status'),
              ]),
              required: true,
            },
          ]"
        >
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.tenant-session-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 16px;
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

.admin-menu-tool-prefix {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-right: 8px;
}

.admin-menu-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-menu-tool-prefix :deep(.ant-btn),
.admin-menu-tool-prefix :deep(.ant-popover-open) {
  display: inline-flex;
  align-items: center;
}

.menu-main {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
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
</style>
