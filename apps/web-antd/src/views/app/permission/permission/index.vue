<script lang="ts" setup>
import type { FormInstance, TreeProps } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
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

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

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
  Tag,
  Tooltip,
  Tree,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
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
type GroupSelectOption = {
  label: string;
  meta: string;
  value: number;
};
type TreeSelectOption = {
  children?: TreeSelectOption[];
  disabled?: boolean;
  selectable?: boolean;
  subtitle?: string;
  title: string;
  value: number | string;
};

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

const statusTextMap: Record<AdminPermissionStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

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
const groups = ref<AdminPermissionGroup[]>([]);
const groupTree = ref<AdminPermissionGroup[]>([]);
const menuOptions = ref<AdminMenu[]>([]);
const apiOptions = ref<AdminApi[]>([]);
const resourceOptionLoading = ref(false);

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
  editingId.value
    ? $t('page.permission.editTitle')
    : $t('page.permission.createTitle'),
);
const groupModalTitle = computed(() =>
  editingGroupId.value
    ? $t('page.permission.groupEditTitle')
    : $t('page.permission.groupCreateTitle'),
);

const formRules = computed<Record<string, Rule[]>>(() => ({
  code: [
    {
      message: $t('ui.formRules.required', [$t('page.permission.code')]),
      required: true,
    },
  ],
  name: [
    {
      message: $t('ui.formRules.required', [$t('page.permission.name')]),
      required: true,
    },
  ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [
        $t('page.permission.status'),
      ]),
      required: true,
    },
  ],
}));

const groupFormRules = computed<Record<string, Rule[]>>(() => ({
  module: [
    {
      message: $t('ui.formRules.required', [$t('page.permission.groupModule')]),
      required: true,
    },
  ],
  name: [
    {
      message: $t('ui.formRules.required', [$t('page.permission.groupName')]),
      required: true,
    },
  ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [
        $t('page.permission.status'),
      ]),
      required: true,
    },
  ],
}));

const permissionFormOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.permission.searchName'),
      },
      fieldName: 'name',
      formItemClass: 'md:col-span-1',
      label: $t('page.permission.name'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.permission.searchCode'),
      },
      fieldName: 'code',
      formItemClass: 'md:col-span-1',
      label: $t('page.permission.code'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4',
};

const permissionGridOptions: VxeTableGridOptions<AdminPermission> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'name',
      slots: { default: 'permission' },
      sortable: true,
      title: $t('page.permission.permission'),
      width: 280,
    },
    {
      field: 'groupName',
      slots: { default: 'group' },
      sortable: true,
      title: $t('page.permission.groupName'),
      width: 150,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.permission.status'),
      width: 100,
    },
    {
      field: 'scope',
      slots: { default: 'scope' },
      title: $t('page.tenant.resourceOwnership'),
      width: 100,
    },
    {
      field: 'resource',
      slots: { default: 'resource' },
      title: $t('page.permission.resource'),
      width: 160,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.permission.createdAt'),
      width: 170,
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 150,
    },
  ],
  exportConfig: {
    filename: 'permission-list',
    type: 'csv',
  },
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async (
        { page, sort }: { page: any; sort: any },
        formValues: Record<string, any>,
      ) => {
        const sortField = String(sort.field || 'id');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        loading.value = true;
        try {
          return await listAdminPermissionsApi({
            code: formValues.code,
            groupId: selectedGroupId.value,
            name: formValues.name,
            page: page.currentPage,
            pageSize: page.pageSize,
            sorting: [
              {
                direction,
                field: toPermissionSortField(sortField),
              },
            ],
          });
        } catch (error) {
          message.error(
            (error as Error).message ||
              $t('page.permission.loadPermissionsFailed'),
          );
          throw error;
        } finally {
          loading.value = false;
        }
      },
    },
    sort: true,
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
};

const groupOptions = computed(
  () =>
    groups.value.map((group) => ({
      label: group.name ?? `#${group.id}`,
      meta: group.module?.trim() || '-',
      value: group.id as number,
    })) satisfies GroupSelectOption[],
);

const parentGroupTreeOptions = computed(() =>
  buildParentGroupTreeOptions(groupTree.value, editingGroupId.value),
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
  const nodeMap = new Map<number, TreeSelectOption>();
  const roots: TreeSelectOption[] = [];

  for (const item of items) {
    if (item.id === undefined) {
      continue;
    }
    nodeMap.set(item.id, {
      subtitle: item.path ?? item.name ?? `#${item.id}`,
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
      const parentNode = nodeMap.get(item.parentId);
      parentNode?.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function buildApiTreeSelectData(items: AdminApi[]) {
  const groupMap = new Map<string, TreeSelectOption>();

  for (const item of items) {
    const moduleName = item.module?.trim() || 'default';
    if (!groupMap.has(moduleName)) {
      groupMap.set(moduleName, {
        subtitle: moduleName,
        title: item.moduleDescription?.trim() || moduleName,
        value: `module-${moduleName}`,
        selectable: false,
        children: [],
      });
    }
    const moduleNode = groupMap.get(moduleName);
    moduleNode?.children?.push({
      subtitle: item.operation?.trim() || (item.path ?? ''),
      title: `${item.method ?? 'API'} ${item.path ?? ''}`,
      value: item.id ?? `${moduleName}-${item.path ?? 'api'}`,
    });
  }

  return [...groupMap.values()];
}

function buildParentGroupTreeOptions(
  items: AdminPermissionGroup[],
  excludedId?: number,
): TreeSelectOption[] {
  return items
    .filter((item) => item.id && item.id !== excludedId)
    .map((item) => ({
      children: buildParentGroupTreeOptions(item.children ?? [], excludedId),
      subtitle: item.module?.trim() || '-',
      title: item.name ?? `#${item.id}`,
      value: item.id as number,
    }));
}

async function loadResourceOptions() {
  resourceOptionLoading.value = true;
  try {
    const [menuResponse, apiResponse] = await Promise.all([
      listAdminMenusApi({
        pageSize: 500,
        sorting: [{ direction: 'ASC', field: 'id' }],
      }),
      listAdminApisApi({
        pageSize: 1000,
        sorting: [{ direction: 'ASC', field: 'id' }],
      }),
    ]);
    menuOptions.value = menuResponse.items;
    apiOptions.value = apiResponse.items;
  } catch (error) {
    message.error(
      (error as Error).message ||
        $t('page.permission.loadResourceOptionsFailed'),
    );
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

function toPermissionSortField(sortField: string) {
  switch (sortField) {
    case 'createdAt': {
      return 'created_at';
    }
    case 'groupName': {
      return 'group_id';
    }
    default: {
      return sortField;
    }
  }
}

function getStatusText(status?: AdminPermissionStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminPermissionStatus) {
  return status === 'ON' ? 'success' : 'error';
}

function getPermissionScopeText() {
  return 'XAdmin平台';
}

function getPermissionTooltip(record: AdminPermission) {
  return [
    `${$t('page.permission.code')}：${record.code || '-'}`,
    `${$t('page.permission.permission')}：${record.name || '-'}`,
  ].join('\n');
}

async function loadGroups() {
  groupLoading.value = true;
  try {
    const response = await listAdminPermissionGroupsApi({ pageSize: 200 });
    groups.value = response.items;
    groupTree.value = response.tree;
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.permission.loadGroupsFailed'),
    );
  } finally {
    groupLoading.value = false;
  }
}

async function loadPermissions() {
  return await permissionGridApi.reload();
}

async function refreshAll() {
  await Promise.all([loadGroups(), loadPermissions(), loadResourceOptions()]);
}

async function handleTreeSelect(keys: (number | string)[]) {
  const key = keys[0];
  selectedGroupId.value =
    key && key !== 'all' ? Number.parseInt(String(key), 10) : undefined;
  await permissionGridApi.reload();
}

async function openCreate() {
  if (isTenantSession.value) {
    message.warning('租户会话下权限定义只读');
    return;
  }
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: PermissionRecord) {
  if (isTenantSession.value) {
    message.warning('租户会话下权限定义只读');
    return;
  }
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
  if (isTenantSession.value) {
    message.warning('租户会话下权限定义只读');
    return;
  }
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
  if (isTenantSession.value) {
    message.warning('租户会话下不可同步权限点');
    return;
  }
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
  await refreshAll();
}

onMounted(() => {
  refreshAll();
});

const [PermissionGrid, permissionGridApi] = useVbenVxeGrid<AdminPermission>({
  gridClass: 'admin-permission-grid',
  gridOptions: permissionGridOptions,
  formOptions: permissionFormOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.permission.permission')">
    <div class="admin-permission-layout">
      <aside class="admin-permission-groups">
        <div class="group-header">
          <span class="group-title">{{
            $t('page.permission.groupPanelTitle')
          }}</span>
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
              :title="
                $t('ui.actionMessage.deleteConfirm', [
                  $t('page.permission.groupName'),
                ])
              "
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

      <section class="admin-permission-surface">
        <div v-if="isTenantSession" class="tenant-session-banner">
          <Tag color="blue">租户会话</Tag>
          <span class="tenant-session-banner__text">
            当前权限定义仅可查看，不可编辑。所属租户：{{ sessionTenantLabel }}
          </span>
        </div>
        <div class="permission-context">
          <span>{{ selectedGroupName }}</span>
        </div>

        <PermissionGrid
          class="admin-permission-grid-shell"
          :table-title="$t('menu.permission.permission')"
        >
          <template #toolPrefix>
            <Space class="permission-grid-tools" :size="8">
              <Button
                v-access:code="PERMISSION_ACCESS.sync"
                :disabled="isTenantSession"
                :loading="syncing"
                @click="handleSync"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:refresh-cw" />
                </template>
                {{ $t('page.permission.syncButton') }}
              </Button>
              <Button
                v-access:code="PERMISSION_ACCESS.create"
                :disabled="isTenantSession"
                type="primary"
                @click="openCreate"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:plus" />
                </template>
                {{ $t('page.permission.createTitle') }}
              </Button>
            </Space>
          </template>

          <template #permission="{ row }">
            <Tooltip :title="getPermissionTooltip(row)">
              <span class="permission-main">{{ row.name || '-' }}</span>
            </Tooltip>
          </template>

          <template #group="{ row }">
            {{ row.groupName || '-' }}
          </template>

          <template #status="{ row }">
            <Tag :color="getStatusColor(row.status)">
              {{ getStatusText(row.status) }}
            </Tag>
          </template>

          <template #scope>
            <Tag color="gold">{{ getPermissionScopeText() }}</Tag>
          </template>

          <template #resource="{ row }">
            <Space :size="4">
              <Tag>
                {{
                  $t('page.permission.menuResourceCount', {
                    count: row.menuIds?.length ?? 0,
                  })
                }}
              </Tag>
              <Tag>
                {{
                  $t('page.permission.apiResourceCount', {
                    count: row.apiIds?.length ?? 0,
                  })
                }}
              </Tag>
            </Space>
          </template>

          <template #createdAt="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>

          <template #action="{ row }">
            <Space>
              <Button
                v-access:code="PERMISSION_ACCESS.edit"
                :disabled="isTenantSession"
                size="small"
                type="link"
                @click="openEdit(row)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                :disabled="isTenantSession"
                :title="
                  $t('ui.actionMessage.deleteConfirm', [
                    $t('page.permission.moduleName'),
                  ])
                "
                @confirm="handleDelete(row)"
              >
                <Button
                  v-access:code="PERMISSION_ACCESS.delete"
                  danger
                  :disabled="isTenantSession"
                  size="small"
                  type="link"
                >
                  {{ $t('common.delete') }}
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </PermissionGrid>
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
          <Input
            v-model:value="formModel.name"
            :placeholder="$t('page.permission.placeholderName')"
          />
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
          >
            <template #option="{ label, meta }">
              <div class="permission-option">
                <span class="permission-option-main">{{ label }}</span>
                <span class="permission-option-meta">{{ meta }}</span>
              </div>
            </template>
          </Select>
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
          >
            <template #title="{ title, subtitle }">
              <div class="permission-option">
                <span class="permission-option-main">{{ title }}</span>
                <span v-if="subtitle" class="permission-option-meta">{{
                  subtitle
                }}</span>
              </div>
            </template>
          </TreeSelect>
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
          >
            <template #title="{ title, subtitle }">
              <div class="permission-option">
                <span class="permission-option-main">{{ title }}</span>
                <span v-if="subtitle" class="permission-option-meta">{{
                  subtitle
                }}</span>
              </div>
            </template>
          </TreeSelect>
        </Form.Item>
        <Form.Item
          :label="$t('page.permission.description')"
          name="description"
        >
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
          <TreeSelect
            v-model:value="groupFormModel.parentId"
            allow-clear
            class="full-width-control"
            :field-names="{
              label: 'title',
              value: 'value',
              children: 'children',
            }"
            :placeholder="$t('page.permission.placeholderGroupParent')"
            show-search
            :tree-data="parentGroupTreeOptions"
            tree-default-expand-all
            tree-node-filter-prop="title"
          >
            <template #title="{ title, subtitle }">
              <div class="permission-option">
                <span class="permission-option-main">{{ title }}</span>
                <span class="permission-option-meta">{{ subtitle }}</span>
              </div>
            </template>
          </TreeSelect>
        </Form.Item>
        <Form.Item :label="$t('page.permission.groupName')" name="name">
          <Input
            v-model:value="groupFormModel.name"
            :placeholder="$t('page.permission.placeholderGroupName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.groupModule')" name="module">
          <Input
            v-model:value="groupFormModel.module"
            :placeholder="$t('page.permission.placeholderGroupModule')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.permission.status')" name="status">
          <Select
            v-model:value="groupFormModel.status"
            :options="statusOptions"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.permission.groupSortOrder')"
          name="sortOrder"
        >
          <InputNumber
            v-model:value="groupFormModel.sortOrder"
            class="full-width-control"
            :min="0"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.permission.description')"
          name="description"
        >
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
  min-width: 0;
  min-height: calc(100vh - 160px);
  overflow-y: auto;
}

.admin-permission-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.tenant-session-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
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

.permission-context {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 14px;
  margin-bottom: 12px;
  background: hsl(var(--muted) / 18%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.permission-context__value {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--foreground));
}

.permission-grid-tools {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
}

.admin-permission-grid-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.admin-permission-grid-shell :deep(.vxe-grid) {
  min-height: 0;
}

.admin-permission-grid-shell :deep(.vxe-grid--body-wrapper),
.admin-permission-grid-shell :deep(.vxe-grid--table-wrapper) {
  min-height: 0;
}

:deep(.admin-permission-grid) {
  flex: 1;
  min-height: 0;
}

.permission-main {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.permission-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.permission-option-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.permission-option-meta {
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
