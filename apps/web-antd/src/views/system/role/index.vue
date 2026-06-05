<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
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

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

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
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  Tree,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
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
import { $t } from '#/locales';

interface AdminRoleFormModel extends AdminRoleSaveInput {
  code: string;
  name: string;
  sortOrder: number;
  status: AdminRoleStatus;
  type: AdminRoleType;
}

type PermissionTreeNode = {
  children?: PermissionTreeNode[];
  key: number | string;
  meta?: string;
  selectable?: boolean;
  title: string;
  value: number | string;
};

const ROLE_ACCESS = {
  authorize: ['roles:edit'],
  create: ['roles:create'],
  delete: ['roles:delete'],
  edit: ['roles:edit'],
  export: ['roles:export'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || '-',
);

const statusOptions = [
  { label: $t('enum.role.status.ON'), value: 'ON' },
  { label: $t('enum.role.status.OFF'), value: 'OFF' },
];

const typeOptions = [
  { label: $t('enum.role.type.SYSTEM'), value: 'SYSTEM' },
  { label: $t('enum.role.type.TEMPLATE'), value: 'TEMPLATE' },
  { label: $t('enum.role.type.TENANT'), value: 'TENANT' },
];

const statusTextMap: Record<AdminRoleStatus, string> = {
  OFF: $t('enum.role.status.OFF'),
  ON: $t('enum.role.status.ON'),
};

const typeTextMap: Record<AdminRoleType, string> = {
  SYSTEM: $t('enum.role.type.SYSTEM'),
  TEMPLATE: $t('enum.role.type.TEMPLATE'),
  TENANT: $t('enum.role.type.TENANT'),
};

const modalOpen = ref(false);
const authorizeModalOpen = ref(false);
const submitting = ref(false);
const authorizeLoading = ref(false);
const authorizeSubmitting = ref(false);
const editingId = ref<number>();
const formRef = ref();
const permissionGroups = ref<AdminPermissionGroup[]>([]);
const permissions = ref<AdminPermission[]>([]);
const menuOptions = ref<AdminMenu[]>([]);
const apiOptions = ref<AdminApi[]>([]);
const authorizeRole = ref<AdminRole>();
const authorizePermissionIds = ref<number[]>([]);
const permissionOptionLoading = ref(false);
const resourceOptionLoading = ref(false);
const authorizeResourcesLoaded = ref(false);

const treeSearchValue = ref('');
const treeCheckedKeys = ref<Array<number | string>>([]);
const expandedKeys = ref<Array<number | string>>([]);
const autoExpandParent = ref(true);
const activeTabKey = ref('permissions');

const editTreeSearchValue = ref('');
const editTreeCheckedKeys = ref<Array<number | string>>([]);
const editExpandedKeys = ref<Array<number | string>>([]);
const editAutoExpandParent = ref(true);

const formModel = reactive<AdminRoleFormModel>({
  code: '',
  description: '',
  name: '',
  permissions: [],
  sortOrder: 0,
  status: 'ON',
  type: 'SYSTEM',
});

const modalTitle = computed(() =>
  editingId.value ? $t('page.role.editTitle') : $t('page.role.createTitle'),
);

const authorizeModalTitle = computed(() =>
  authorizeRole.value?.name
    ? `${$t('page.role.authorizeTitle')} ${authorizeRole.value.name}`
    : $t('page.role.authorizeTitle'),
);

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
    .filter((value): value is AdminPermission => value !== undefined),
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
    .filter((value): value is AdminMenu => value !== undefined),
);

const selectedAuthorizeApis = computed(() =>
  selectedAuthorizeApiIds.value
    .map((id) => apiMap.value.get(id))
    .filter((value): value is AdminApi => value !== undefined),
);

const formRules = computed<Record<string, Rule[]>>(() => ({
  code: [
    {
      message: $t('ui.formRules.required', [$t('page.role.code')]),
      required: true,
    },
  ],
  name: [
    {
      message: $t('ui.formRules.required', [$t('page.role.name')]),
      required: true,
    },
  ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.role.status')]),
      required: true,
    },
  ],
  type: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.role.type')]),
      required: true,
    },
  ],
}));

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.role.searchName'),
      },
      fieldName: 'name',
      formItemClass: 'md:col-span-1',
      label: $t('page.role.name'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.role.searchCode'),
      },
      fieldName: 'code',
      formItemClass: 'md:col-span-1',
      label: $t('page.role.code'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4',
};

const gridOptions: VxeTableGridOptions<AdminRole> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'name',
      slots: { default: 'role' },
      sortable: true,
      title: $t('page.role.role'),
      width: 260,
    },
    {
      field: 'type',
      slots: { default: 'type' },
      sortable: true,
      title: $t('page.role.type'),
      width: 120,
    },
    {
      field: 'scope',
      slots: { default: 'scope' },
      sortable: true,
      title: $t('page.tenant.resourceOwnership'),
      width: 180,
    },
    {
      field: 'sortOrder',
      sortable: true,
      title: $t('ui.table.sortOrder'),
      width: 90,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.role.status'),
      width: 100,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.role.createdAt'),
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
    filename: 'system-roles',
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
        const sortField = String(sort.field || 'sortOrder');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        return await listAdminRolesApi({
          code: formValues.code,
          name: formValues.name,
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: toRoleSortField(sortField),
            },
          ],
        });
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

function toRoleSortField(sortField: string) {
  switch (sortField) {
    case 'createdAt': {
      return 'created_at';
    }
    case 'scope': {
      return 'tenant_id';
    }
    case 'sortOrder': {
      return 'sort_order';
    }
    default: {
      return sortField;
    }
  }
}

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
  treeCheckedKeys.value = [];
  treeSearchValue.value = '';
  expandedKeys.value = [];
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

function canMutateRole(role: AdminRole) {
  return !isTenantSession.value || Boolean(role.tenantId);
}

function getRoleScopeText(role: AdminRole) {
  return role.tenantName || '-';
}

function getRoleTooltip(role: AdminRole) {
  return [
    `${$t('page.role.code')}: ${role.code || '-'}`,
    `${$t('page.role.role')}: ${role.name || '-'}`,
  ].join('\n');
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
  const groupNodeMap = new Map<number, PermissionTreeNode>();
  const roots: PermissionTreeNode[] = [];

  for (const group of groupItems) {
    if (group.id === undefined) {
      continue;
    }
    groupNodeMap.set(group.id, {
      meta: group.module?.trim() || '-',
      title: group.name ?? `#${group.id}`,
      value: `group-${group.id}`,
      key: `group-${group.id}`,
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
      const parentNode = groupNodeMap.get(group.parentId);
      parentNode?.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const permission of permissionItems) {
    if (permission.id === undefined) {
      continue;
    }
    const node = {
      meta: permission.code ?? '-',
      title: permission.name ?? permission.code ?? `#${permission.id}`,
      value: permission.id,
      key: permission.id,
    } satisfies PermissionTreeNode;
    if (
      permission.groupId !== undefined &&
      groupNodeMap.has(permission.groupId)
    ) {
      const groupNode = groupNodeMap.get(permission.groupId);
      groupNode?.children?.push(node);
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
      listAdminPermissionsApi({
        pageSize: 1000,
        sorting: [{ direction: 'ASC', field: 'id' }],
      }),
    ]);
    permissionGroups.value = groupResponse.items;
    permissions.value = permissionResponse.items;
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.role.loadPermissionOptionsFailed'),
    );
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
    authorizeResourcesLoaded.value = true;
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.role.loadAuthorizeResourcesFailed'),
    );
    throw error;
  } finally {
    resourceOptionLoading.value = false;
  }
}

async function openCreate() {
  editingId.value = undefined;
  resetFormModel();
  if (isTenantSession.value) {
    formModel.type = 'TENANT';
  }
  editTreeCheckedKeys.value = [];
  editTreeSearchValue.value = '';
  editExpandedKeys.value = [];
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminRole) {
  if (!canMutateRole(record)) {
    message.warning($t('page.commonSession.globalRoleEditBlocked'));
    return;
  }
  if (!record.id) {
    message.warning($t('page.role.missingId'));
    return;
  }

  editingId.value = record.id;
  Object.assign(formModel, toRoleSaveInput(record));
  editTreeCheckedKeys.value = [...(formModel.permissions ?? [])];
  editTreeSearchValue.value = '';
  editExpandedKeys.value = [];
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openAuthorize(record: AdminRole) {
  if (!canMutateRole(record)) {
    message.warning($t('page.commonSession.globalRoleAuthorizeBlocked'));
    return;
  }
  if (!record.id) {
    message.warning($t('page.role.missingId'));
    return;
  }

  authorizeModalOpen.value = true;
  authorizeLoading.value = true;
  try {
    const [roleDetail] = await Promise.all([
      getAdminRoleApi(record.id),
      permissions.value.length > 0
        ? Promise.resolve()
        : loadPermissionOptions(),
      loadAuthorizeResources(),
    ]);
    authorizeRole.value = roleDetail;
    authorizePermissionIds.value = normalizePermissionIds(
      roleDetail.permissions ?? [],
    );
    treeCheckedKeys.value = [...authorizePermissionIds.value];
    treeSearchValue.value = '';
    expandedKeys.value = [];
    activeTabKey.value = 'permissions';
  } catch (error) {
    authorizeModalOpen.value = false;
    resetAuthorizeState();
    message.error(
      (error as Error).message || $t('page.role.loadAuthorizeFailed'),
    );
  } finally {
    authorizeLoading.value = false;
  }
}

watch(treeCheckedKeys, (newCheckedKeys) => {
  authorizePermissionIds.value = normalizePermissionIds(newCheckedKeys);
});

function removePermission(id: number) {
  treeCheckedKeys.value = treeCheckedKeys.value.filter((item) => item !== id);
}

function getApiMethodColor(method?: string) {
  const m = method?.toUpperCase();
  if (m === 'GET') return 'processing';
  if (m === 'POST') return 'success';
  if (m === 'PUT' || m === 'PATCH') return 'warning';
  if (m === 'DELETE') return 'error';
  return 'default';
}

function getAllGroupKeys(nodes: PermissionTreeNode[]): Array<number | string> {
  let keys: Array<number | string> = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      keys.push(node.key);
      keys = [...keys, ...getAllGroupKeys(node.children)];
    }
  }
  return keys;
}

const filteredPermissionTreeData = computed(() => {
  const query = treeSearchValue.value.trim().toLowerCase();
  if (!query) {
    return permissionTreeData.value;
  }

  function filterNode(node: PermissionTreeNode): null | PermissionTreeNode {
    const titleMatches = node.title.toLowerCase().includes(query);
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map((n) => filterNode(n))
        .filter((child): child is PermissionTreeNode => child !== null);

      if (filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
    }

    if (titleMatches) {
      return {
        ...node,
        children: node.children ? [...node.children] : undefined,
      };
    }

    return null;
  }

  return permissionTreeData.value
    .map((n) => filterNode(n))
    .filter((node): node is PermissionTreeNode => node !== null);
});

watch(treeSearchValue, (val) => {
  if (val) {
    expandedKeys.value = getAllGroupKeys(filteredPermissionTreeData.value);
    autoExpandParent.value = true;
  } else {
    expandedKeys.value = [];
  }
});

function expandAll() {
  expandedKeys.value = getAllGroupKeys(permissionTreeData.value);
}

function collapseAll() {
  expandedKeys.value = [];
}

function selectAll() {
  treeCheckedKeys.value = permissions.value
    .map((p) => p.id)
    .filter((id): id is number => typeof id === 'number');
}

function clearAll() {
  treeCheckedKeys.value = [];
}

watch(editTreeCheckedKeys, (newCheckedKeys) => {
  formModel.permissions = normalizePermissionIds(newCheckedKeys);
});

const editFilteredPermissionTreeData = computed(() => {
  const query = editTreeSearchValue.value.trim().toLowerCase();
  if (!query) {
    return permissionTreeData.value;
  }

  function filterNode(node: PermissionTreeNode): null | PermissionTreeNode {
    const titleMatches = node.title.toLowerCase().includes(query);
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map((n) => filterNode(n))
        .filter((child): child is PermissionTreeNode => child !== null);

      if (filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
    }

    if (titleMatches) {
      return {
        ...node,
        children: node.children ? [...node.children] : undefined,
      };
    }

    return null;
  }

  return permissionTreeData.value
    .map((n) => filterNode(n))
    .filter((node): node is PermissionTreeNode => node !== null);
});

watch(editTreeSearchValue, (val) => {
  if (val) {
    editExpandedKeys.value = getAllGroupKeys(
      editFilteredPermissionTreeData.value,
    );
    editAutoExpandParent.value = true;
  } else {
    editExpandedKeys.value = [];
  }
});

function editExpandAll() {
  editExpandedKeys.value = getAllGroupKeys(permissionTreeData.value);
}

function editCollapseAll() {
  editExpandedKeys.value = [];
}

function editSelectAll() {
  editTreeCheckedKeys.value = permissions.value
    .map((p) => p.id)
    .filter((id): id is number => typeof id === 'number');
}

function editClearAll() {
  editTreeCheckedKeys.value = [];
}

async function submitRole() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminRoleApi(editingId.value, formModel);
      message.success($t('page.role.updateSuccess'));
    } else {
      await createAdminRoleApi(formModel);
      message.success($t('page.role.createSuccess'));
    }
    modalOpen.value = false;
    await gridApi.reload();
  } finally {
    submitting.value = false;
  }
}

async function submitAuthorize() {
  if (!authorizeRole.value?.id) {
    message.warning($t('page.role.missingId'));
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
    message.success($t('page.role.authorizeSuccess'));
    await gridApi.reload();
  } finally {
    authorizeSubmitting.value = false;
  }
}

async function handleDelete(record: AdminRole) {
  if (record.isProtected) {
    message.warning($t('page.role.protectedDeleteBlocked'));
    return;
  }
  if (!record.id) {
    message.warning($t('page.role.missingId'));
    return;
  }

  await deleteAdminRoleApi(record.id);
  message.success($t('page.role.deleteSuccess'));
  await gridApi.reload();
}

const [Grid, gridApi] = useVbenVxeGrid<AdminRole>({
  gridClass: 'admin-role-grid',
  gridOptions,
  formOptions,
});

onMounted(() => {
  void loadPermissionOptions();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.role')">
    <div v-if="isTenantSession" class="tenant-session-banner">
      <Tag color="blue">{{ $t('page.commonSession.tenantSession') }}</Tag>
      <span class="tenant-session-banner__text">
        {{ $t('page.commonSession.roleReadonlyBanner', [sessionTenantLabel]) }}
      </span>
    </div>

    <Grid :table-title="$t('menu.system.role')">
      <template #toolPrefix>
        <div class="admin-role-tool-prefix">
          <div class="admin-role-tool-prefix__item">
            <Button
              v-access:code="ROLE_ACCESS.create"
              type="primary"
              @click="openCreate"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.role.createTitle') }}
            </Button>
          </div>
        </div>
      </template>

      <template #role="{ row }">
        <Tooltip
          overlay-class-name="admin-multiline-tooltip"
          :title="getRoleTooltip(row)"
        >
          <span class="role-main">{{ row.name || '-' }}</span>
        </Tooltip>
      </template>

      <template #type="{ row }">
        <Tag>{{ getTypeText(row.type) }}</Tag>
      </template>

      <template #scope="{ row }">
        <Tag :color="row.tenantId ? 'blue' : 'gold'">
          {{ getRoleScopeText(row) }}
        </Tag>
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
            v-access:code="ROLE_ACCESS.authorize"
            :disabled="!canMutateRole(row)"
            size="small"
            type="link"
            @click="openAuthorize(row)"
          >
            <template #icon>
              <IconifyIcon icon="lucide:shield-check" />
            </template>
            {{ $t('page.role.authorize') }}
          </Button>
          <Button
            v-access:code="ROLE_ACCESS.edit"
            :disabled="!canMutateRole(row)"
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
            :disabled="row.isProtected"
            :title="
              $t('ui.actionMessage.deleteConfirm', [$t('page.role.moduleName')])
            "
            @confirm="handleDelete(row)"
          >
            <Button
              v-access:code="ROLE_ACCESS.delete"
              danger
              :disabled="row.isProtected || !canMutateRole(row)"
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
      :width="960"
      @ok="submitRole"
    >
      <div class="edit-role-container">
        <div class="edit-role-form-panel">
          <Form
            ref="formRef"
            :model="formModel"
            :rules="formRules"
            layout="vertical"
          >
            <Form.Item :label="$t('page.role.name')" name="name">
              <Input
                v-model:value="formModel.name"
                :placeholder="$t('page.role.placeholderName')"
              />
            </Form.Item>
            <Form.Item :label="$t('page.role.code')" name="code">
              <Input
                v-model:value="formModel.code"
                :placeholder="$t('page.role.placeholderCode')"
              />
            </Form.Item>
            <div class="form-row-grid-2">
              <Form.Item :label="$t('page.role.type')" name="type">
                <Select
                  v-model:value="formModel.type"
                  :disabled="isTenantSession"
                  :options="typeOptions"
                />
              </Form.Item>
              <Form.Item :label="$t('page.role.status')" name="status">
                <Select
                  v-model:value="formModel.status"
                  :options="statusOptions"
                />
              </Form.Item>
            </div>
            <Form.Item :label="$t('ui.table.sortOrder')" name="sortOrder">
              <InputNumber
                v-model:value="formModel.sortOrder"
                class="full-width-control"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="$t('page.role.description')" name="description">
              <Input.TextArea
                v-model:value="formModel.description"
                :auto-size="{ minRows: 4, maxRows: 6 }"
                :placeholder="$t('page.user.placeholderDescription')"
              />
            </Form.Item>
          </Form>
        </div>

        <div class="panel-divider"></div>

        <div class="edit-role-tree-panel">
          <div class="panel-header">
            <span class="panel-title-text">
              {{ $t('page.role.permissions') }} ({{
                formModel.permissions?.length ?? 0
              }})
            </span>
            <Input.Search
              v-model:value="editTreeSearchValue"
              :placeholder="$t('page.role.searchPermissionKeyword')"
              allow-clear
              size="middle"
            />
            <div class="panel-actions">
              <Button size="small" type="link" @click="editExpandAll">
                {{ $t('page.role.expandAll') }}
              </Button>
              <Button size="small" type="link" @click="editCollapseAll">
                {{ $t('page.role.collapseAll') }}
              </Button>
              <Button size="small" type="link" @click="editSelectAll">
                {{ $t('page.role.selectAll') }}
              </Button>
              <Button size="small" type="link" danger @click="editClearAll">
                {{ $t('page.role.clearAll') }}
              </Button>
            </div>
          </div>
          <div class="tree-wrapper">
            <Tree
              v-model:checked-keys="editTreeCheckedKeys"
              v-model:expanded-keys="editExpandedKeys"
              :auto-expand-parent="editAutoExpandParent"
              checkable
              :selectable="false"
              :tree-data="editFilteredPermissionTreeData"
            >
              <template #title="{ title, meta }">
                <div class="role-tree-node">
                  <span class="role-tree-node__title">{{ title }}</span>
                  <span v-if="meta" class="role-tree-node__meta">{{
                    meta
                  }}</span>
                </div>
              </template>
            </Tree>
          </div>
        </div>
      </div>
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
            <Tag>
              {{ $t('page.role.permissions') }}
              {{ selectedAuthorizePermissions.length }}
            </Tag>
            <Tag>
              {{ $t('page.role.relatedMenus') }}
              {{ selectedAuthorizeMenus.length }}
            </Tag>
            <Tag>
              {{ $t('page.role.relatedApis') }}
              {{ selectedAuthorizeApis.length }}
            </Tag>
          </Space>
        </div>

        <div class="authorize-container">
          <div class="authorize-tree-panel">
            <div class="panel-header">
              <Input.Search
                v-model:value="treeSearchValue"
                :placeholder="$t('page.role.searchPermissionKeyword')"
                allow-clear
                size="middle"
              />
              <div class="panel-actions">
                <Button size="small" type="link" @click="expandAll">
                  {{ $t('page.role.expandAll') }}
                </Button>
                <Button size="small" type="link" @click="collapseAll">
                  {{ $t('page.role.collapseAll') }}
                </Button>
                <Button size="small" type="link" @click="selectAll">
                  {{ $t('page.role.selectAll') }}
                </Button>
                <Button size="small" type="link" danger @click="clearAll">
                  {{ $t('page.role.clearAll') }}
                </Button>
              </div>
            </div>
            <div class="tree-wrapper">
              <Tree
                v-model:checked-keys="treeCheckedKeys"
                v-model:expanded-keys="expandedKeys"
                :auto-expand-parent="autoExpandParent"
                checkable
                :selectable="false"
                :tree-data="filteredPermissionTreeData"
              >
                <template #title="{ title, meta }">
                  <div class="role-tree-node">
                    <span class="role-tree-node__title">{{ title }}</span>
                    <span v-if="meta" class="role-tree-node__meta">{{
                      meta
                    }}</span>
                  </div>
                </template>
              </Tree>
            </div>
          </div>

          <div class="panel-divider"></div>

          <div class="authorize-preview-panel-new">
            <Tabs v-model:active-key="activeTabKey" size="middle">
              <TabPane
                key="permissions"
                :tab="
                  $t('page.role.selectedPermissionsTab', [
                    selectedAuthorizePermissions.length,
                  ])
                "
              >
                <div class="preview-list">
                  <div
                    v-for="item in selectedAuthorizePermissions"
                    :key="item.id"
                    class="preview-item"
                  >
                    <div class="item-info">
                      <div class="item-name">
                        <IconifyIcon
                          icon="lucide:shield"
                          class="item-icon text-primary"
                        />
                        {{ getPermissionLabel(item) }}
                      </div>
                      <div class="item-code">{{ getPermissionMeta(item) }}</div>
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      class="remove-btn"
                      @click="removePermission(item.id!)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:x" />
                      </template>
                    </Button>
                  </div>
                  <Empty
                    v-if="selectedAuthorizePermissions.length === 0"
                    :description="$t('page.role.emptySelectedPermissions')"
                    class="empty-preview"
                  />
                </div>
              </TabPane>

              <TabPane
                key="menus"
                :tab="
                  $t('page.role.relatedMenusTab', [
                    selectedAuthorizeMenus.length,
                  ])
                "
              >
                <div class="preview-list">
                  <div
                    v-for="item in selectedAuthorizeMenus"
                    :key="item.id"
                    class="preview-item readonly"
                  >
                    <div class="item-info">
                      <div class="item-name">
                        <IconifyIcon
                          icon="lucide:layout"
                          class="item-icon text-success"
                        />
                        {{ getMenuLabel(item) }}
                      </div>
                      <div class="item-code">{{ getMenuMeta(item) }}</div>
                    </div>
                  </div>
                  <Empty
                    v-if="selectedAuthorizeMenus.length === 0"
                    :description="$t('page.role.emptyRelatedMenus')"
                    class="empty-preview"
                  />
                </div>
              </TabPane>

              <TabPane
                key="apis"
                :tab="
                  $t('page.role.relatedApisTab', [selectedAuthorizeApis.length])
                "
              >
                <div class="preview-list">
                  <div
                    v-for="item in selectedAuthorizeApis"
                    :key="item.id"
                    class="preview-item readonly"
                  >
                    <div class="item-info">
                      <div class="item-name">
                        <Tag
                          :color="getApiMethodColor(item.method)"
                          class="method-tag"
                        >
                          {{ item.method }}
                        </Tag>
                        <span class="api-path">{{ item.path }}</span>
                      </div>
                      <div class="item-code">{{ getApiMeta(item) }}</div>
                    </div>
                  </div>
                  <Empty
                    v-if="selectedAuthorizeApis.length === 0"
                    :description="$t('page.role.emptyRelatedApis')"
                    class="empty-preview"
                  />
                </div>
              </TabPane>
            </Tabs>
          </div>
        </div>
      </Spin>
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

.admin-role-tool-prefix {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}

.admin-role-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-role-tool-prefix :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
}

:deep(.admin-multiline-tooltip .ant-tooltip-inner) {
  white-space: pre-line;
}

.role-main {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.full-width-control {
  width: 100%;
}

.authorize-role-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
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

.edit-role-container {
  display: flex;
  gap: 20px;
  min-height: 480px;
  margin-top: 8px;
}

.edit-role-form-panel {
  flex: 45;
  min-width: 0;
}

.edit-role-tree-panel {
  display: flex;
  flex: 55;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.form-row-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.panel-title-text {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.authorize-container {
  display: flex;
  gap: 20px;
  height: 520px;
  margin-top: 8px;
}

.authorize-tree-panel {
  display: flex;
  flex: 55;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.panel-actions :deep(.ant-btn-link) {
  padding: 0 4px;
  font-size: 12px;
}

.tree-wrapper {
  flex: 1;
  padding: 10px;
  overflow: auto;
  background: hsl(var(--muted) / 10%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.tree-wrapper :deep(.ant-tree) {
  background: transparent;
}

.role-tree-node {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.role-tree-node__title {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.role-tree-node__meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.panel-divider {
  width: 1px;
  background: hsl(var(--border));
}

.authorize-preview-panel-new {
  display: flex;
  flex: 45;
  flex-direction: column;
  min-width: 0;
}

.authorize-preview-panel-new :deep(.ant-tabs) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.authorize-preview-panel-new :deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
}

.authorize-preview-panel-new :deep(.ant-tabs-content) {
  height: 100%;
}

.authorize-preview-panel-new :deep(.ant-tabs-tabpane) {
  height: 100%;
  padding-bottom: 0;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding-right: 4px;
  overflow-y: auto;
}

.preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: hsl(var(--muted) / 15%);
  border: 1px solid transparent;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.preview-item:hover {
  background: hsl(var(--muted) / 30%);
  border-color: hsl(var(--border));
}

.preview-item.readonly {
  justify-content: flex-start;
}

.item-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-name {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13.5px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.item-icon {
  font-size: 14px;
}

.text-primary {
  color: hsl(var(--primary));
}

.text-success {
  color: hsl(var(--success));
}

.item-code {
  font-family: monospace;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

.method-tag {
  min-width: 55px;
  font-weight: 600;
  text-align: center;
}

.api-path {
  font-family: monospace;
  font-size: 13px;
  color: hsl(var(--foreground));
  word-break: break-all;
}

.remove-btn {
  color: hsl(var(--muted-foreground));
}

.remove-btn:hover {
  color: hsl(var(--destructive)) !important;
  background: hsl(var(--destructive) / 10%);
}

.empty-preview {
  padding: 40px 0;
  margin: auto 0;
}

@media (max-width: 960px) {
  .authorize-container {
    flex-direction: column;
    height: auto;
  }

  .panel-divider {
    display: none;
  }

  .tree-wrapper,
  .preview-list {
    max-height: 350px;
  }
}

@media (max-width: 640px) {
  .edit-role-container {
    flex-direction: column;
  }

  .panel-divider {
    display: none;
  }
}
</style>
