<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminApi,
  AdminApiSaveInput,
  AdminApiScope,
  AdminApiStatus,
} from '#/api/admin/apis';
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
  createAdminApiApi,
  deleteAdminApiApi,
  listAdminApisApi,
  syncAdminApisApi,
  updateAdminApiApi,
} from '#/api/admin/apis';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminApiFormModel extends AdminApiSaveInput {
  method: string;
  path: string;
  scope: AdminApiScope;
  status: AdminApiStatus;
}

type AdminApiTableRecord = AdminApi | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const API_ACCESS = {
  create: ['apis:create'],
  delete: ['apis:delete'],
  edit: ['apis:edit'],
  export: ['apis:export'],
  sync: ['apis:sync:create'],
} as const;

const defaultSorting: AdminTableSorting[] = [{ direction: 'ASC', field: 'id' }];

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
  (value) => ({
    label: value,
    value,
  }),
);

const scopeOptions = [
  { label: $t('enum.api.scope.ADMIN'), value: 'ADMIN' },
  { label: $t('enum.api.scope.APP'), value: 'APP' },
];

const statusOptions = [
  { label: $t('enum.status.ON'), value: 'ON' },
  { label: $t('enum.status.OFF'), value: 'OFF' },
];

const statusTextMap: Record<AdminApiStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

const scopeTextMap: Record<AdminApiScope, string> = {
  ADMIN: $t('enum.api.scope.ADMIN'),
  APP: $t('enum.api.scope.APP'),
  API_SCOPE_INVALID: $t('enum.api.scope.API_SCOPE_INVALID'),
};

const columns: AdminTableColumn<AdminApi>[] = [
  {
    dataIndex: 'description',
    sortable: true,
    sorter: true,
    title: $t('page.api.description'),
    width: 220,
  },
  {
    dataIndex: 'path',
    sortable: true,
    sorter: true,
    title: $t('page.api.path'),
    width: 260,
  },
  {
    dataIndex: 'method',
    key: 'method',
    sortable: true,
    sorter: true,
    title: $t('page.api.method'),
    width: 90,
  },
  {
    dataIndex: 'module',
    sortable: true,
    sorter: true,
    title: $t('page.api.module'),
    width: 150,
  },
  {
    dataIndex: 'moduleDescription',
    title: $t('page.api.moduleDescription'),
    width: 180,
  },
  {
    dataIndex: 'operation',
    sortable: true,
    sorter: true,
    title: $t('page.api.operation'),
    width: 220,
  },
  {
    dataIndex: 'scope',
    key: 'scope',
    sortable: true,
    sorter: true,
    title: $t('page.api.scope'),
    width: 110,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.api.status'),
    width: 90,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.api.createdAt'),
    width: 170,
  },
  {
    fixed: 'right',
    key: 'action',
    title: $t('ui.table.action'),
    width: 130,
  },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const syncing = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const apis = ref<AdminApi[]>([]);
const sorting = ref<AdminTableSorting[]>([...defaultSorting]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  method: undefined as string | undefined,
  module: '',
  path: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const formModel = reactive<AdminApiFormModel>({
  description: '',
  method: 'GET',
  module: '',
  moduleDescription: '',
  operation: '',
  path: '',
  scope: 'ADMIN',
  status: 'ON',
});

const modalTitle = computed(() =>
  editingId.value ? $t('page.api.editTitle') : $t('page.api.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminApi>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  method: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.api.method')]),
      required: true,
    },
  ],
  path: [
    {
      message: $t('ui.formRules.required', [$t('page.api.path')]),
      required: true,
    },
  ],
  scope: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.api.scope')]),
      required: true,
    },
  ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.api.status')]),
      required: true,
    },
  ],
}));

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.api.total')} ${total}`,
  total: pager.total,
}));

function resetFormModel() {
  Object.assign(formModel, {
    description: '',
    method: 'GET',
    module: '',
    moduleDescription: '',
    operation: '',
    path: '',
    scope: 'ADMIN',
    status: 'ON',
  });
}

function toAdminApi(record: AdminApiTableRecord) {
  return record as AdminApi;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getMethodColor(method?: string) {
  switch (method) {
    case 'DELETE': {
      return 'error';
    }
    case 'GET': {
      return 'processing';
    }
    case 'PATCH':
    case 'PUT': {
      return 'warning';
    }
    case 'POST': {
      return 'success';
    }
    default: {
      return 'default';
    }
  }
}

function getStatusText(status?: AdminApiStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminApiStatus) {
  return status === 'ON' ? 'success' : 'error';
}

function getScopeText(scope?: AdminApiScope) {
  return scope ? scopeTextMap[scope] : '-';
}

async function loadApis() {
  loading.value = true;
  try {
    const response = await listAdminApisApi({
      method: searchForm.method,
      module: searchForm.module,
      page: pager.page,
      pageSize: pager.pageSize,
      path: searchForm.path,
      sorting: sorting.value,
    });
    apis.value = response.items;
    pager.total = response.total;
  } catch (error) {
    message.error((error as Error).message || $t('page.api.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pager.page = 1;
  await loadApis();
}

async function handleReset() {
  searchForm.method = undefined;
  searchForm.module = '';
  searchForm.path = '';
  pager.page = 1;
  sorting.value = [...defaultSorting];
  await loadApis();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
  await loadApis();
}

async function openCreate() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminApiTableRecord) {
  const api = toAdminApi(record);
  if (!api.id) {
    message.warning($t('page.api.missingId'));
    return;
  }

  editingId.value = api.id;
  Object.assign(formModel, {
    description: api.description ?? '',
    method: api.method ?? 'GET',
    module: api.module ?? '',
    moduleDescription: api.moduleDescription ?? '',
    operation: api.operation ?? '',
    path: api.path ?? '',
    scope: api.scope ?? 'ADMIN',
    status: api.status ?? 'ON',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitApi() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminApiApi(editingId.value, formModel);
      message.success($t('page.api.updateSuccess'));
    } else {
      await createAdminApiApi(formModel);
      message.success($t('page.api.createSuccess'));
    }
    modalOpen.value = false;
    await loadApis();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminApiTableRecord) {
  const api = toAdminApi(record);
  if (!api.id) {
    message.warning($t('page.api.missingId'));
    return;
  }

  await deleteAdminApiApi(api.id);
  message.success($t('page.api.deleteSuccess'));
  await loadApis();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminApisApi();
    message.success($t('page.api.syncSuccess'));
    pager.page = 1;
    await loadApis();
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  loadApis();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.api')">
    <div ref="tableSurfaceRef" class="admin-api-surface">
      <div class="admin-api-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item :label="$t('page.api.method')" name="method">
            <Select
              v-model:value="searchForm.method"
              allow-clear
              :options="methodOptions"
              :placeholder="$t('page.api.selectMethod')"
              style="width: 120px"
            />
          </Form.Item>
          <Form.Item :label="$t('page.api.module')" name="module">
            <Input
              v-model:value="searchForm.module"
              allow-clear
              :placeholder="$t('page.api.searchModule')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.api.path')" name="path">
            <Input
              v-model:value="searchForm.path"
              allow-clear
              :placeholder="$t('page.api.searchPath')"
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
            :export-access-codes="API_ACCESS.export"
            :data-source="apis"
            file-name="system-apis"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadApis"
            storage-key="system-api-list"
          />
          <Popconfirm :title="$t('page.api.syncConfirm')" @confirm="handleSync">
            <Button v-access:code="API_ACCESS.sync" :loading="syncing">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" />
              </template>
              {{ $t('page.api.syncButton') }}
            </Button>
          </Popconfirm>
          <Button
            v-access:code="API_ACCESS.create"
            type="primary"
            @click="openCreate"
          >
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
            {{ $t('page.api.createTitle') }}
          </Button>
        </Space>
      </div>

      <Table
        class="admin-api-table"
        :columns="displayColumns"
        :data-source="apis"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'method'">
            <Tag :color="getMethodColor(record.method)">
              {{ record.method || '-' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'scope'">
            <Tag>{{ getScopeText(record.scope) }}</Tag>
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
                v-access:code="API_ACCESS.edit"
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
                    $t('page.api.moduleName'),
                  ])
                "
                @confirm="handleDelete(record)"
              >
                <Button
                  v-access:code="API_ACCESS.delete"
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
      @ok="submitApi"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.api.path')" name="path">
          <Input
            v-model:value="formModel.path"
            :placeholder="$t('page.api.placeholderPath')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.api.method')" name="method">
          <Select v-model:value="formModel.method" :options="methodOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.api.description')" name="description">
          <Input
            v-model:value="formModel.description"
            :placeholder="$t('page.api.placeholderDescription')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.api.module')" name="module">
          <Input
            v-model:value="formModel.module"
            :placeholder="$t('page.api.placeholderModule')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.api.moduleDescription')"
          name="moduleDescription"
        >
          <Input
            v-model:value="formModel.moduleDescription"
            :placeholder="$t('page.api.placeholderModuleDescription')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.api.operation')" name="operation">
          <Input
            v-model:value="formModel.operation"
            :placeholder="$t('page.api.placeholderOperation')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.api.scope')" name="scope">
          <Select v-model:value="formModel.scope" :options="scopeOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.api.status')" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-api-surface {
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

.admin-api-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.admin-api-table {
  flex: 1;
  min-height: 0;
}

@media (max-width: 640px) {
  .admin-api-surface {
    padding: 12px;
  }

  .admin-api-toolbar {
    align-items: stretch;
  }
}
</style>
