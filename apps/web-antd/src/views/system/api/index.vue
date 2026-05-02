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
  sync: ['apis:sync:create'],
} as const;

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
  (value) => ({
    label: value,
    value,
  }),
);

const scopeOptions = [
  { label: '管理后台', value: 'ADMIN' },
  { label: '前台应用', value: 'APP' },
];

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
];

const statusTextMap: Record<AdminApiStatus, string> = {
  OFF: '禁用',
  ON: '启用',
};

const scopeTextMap: Record<AdminApiScope, string> = {
  ADMIN: '管理后台',
  APP: '前台应用',
  API_SCOPE_INVALID: '未设置',
};

const columns: AdminTableColumn<AdminApi>[] = [
  {
    dataIndex: 'description',
    sortable: true,
    sorter: true,
    title: '描述',
    width: 220,
  },
  {
    dataIndex: 'path',
    sortable: true,
    sorter: true,
    title: '路径',
    width: 260,
  },
  {
    dataIndex: 'method',
    key: 'method',
    sortable: true,
    sorter: true,
    title: '方法',
    width: 90,
  },
  {
    dataIndex: 'module',
    sortable: true,
    sorter: true,
    title: '模块',
    width: 150,
  },
  {
    dataIndex: 'moduleDescription',
    title: '模块描述',
    width: 180,
  },
  {
    dataIndex: 'operation',
    sortable: true,
    sorter: true,
    title: '操作',
    width: 220,
  },
  {
    dataIndex: 'scope',
    key: 'scope',
    sortable: true,
    sorter: true,
    title: '范围',
    width: 110,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: '状态',
    width: 90,
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
const sorting = ref<AdminTableSorting[]>([]);
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

const modalTitle = computed(() => (editingId.value ? '编辑API' : '新增API'));
const displayColumns = computed<TableColumnsType<AdminApi>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules = computed<Record<string, Rule[]>>(() => ({
  method: [{ message: '请选择请求方法', required: true }],
  path: [{ message: '请输入接口路径', required: true }],
  scope: [{ message: '请选择作用范围', required: true }],
  status: [{ message: '请选择状态', required: true }],
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
    message.error((error as Error).message || '加载API列表失败');
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
  sorting.value = [];
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
    message.warning('缺少API ID');
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
      message.success('API已更新');
    } else {
      await createAdminApiApi(formModel);
      message.success('API已创建');
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
    message.warning('缺少API ID');
    return;
  }

  await deleteAdminApiApi(api.id);
  message.success('API已删除');
  await loadApis();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminApisApi();
    message.success('API同步完成');
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
  <Page auto-content-height title="API管理">
    <div ref="tableSurfaceRef" class="admin-api-surface">
      <div class="admin-api-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item label="方法" name="method">
            <Select
              v-model:value="searchForm.method"
              allow-clear
              :options="methodOptions"
              placeholder="选择方法"
              style="width: 120px"
            />
          </Form.Item>
          <Form.Item label="模块" name="module">
            <Input
              v-model:value="searchForm.module"
              allow-clear
              placeholder="输入模块"
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
            :data-source="apis"
            file-name="system-apis"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadApis"
            storage-key="system-api-list"
          />
          <Popconfirm
            title="确认从OpenAPI文档同步API资源？"
            @confirm="handleSync"
          >
            <Button v-access:code="API_ACCESS.sync" :loading="syncing">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" />
              </template>
              同步API
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
            新增API
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
                编辑
              </Button>
              <Popconfirm
                title="确认删除该API？"
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
      @ok="submitApi"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item label="路径" name="path">
          <Input v-model:value="formModel.path" placeholder="/admin/v1/apis" />
        </Form.Item>
        <Form.Item label="方法" name="method">
          <Select v-model:value="formModel.method" :options="methodOptions" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input v-model:value="formModel.description" placeholder="接口描述" />
        </Form.Item>
        <Form.Item label="模块" name="module">
          <Input v-model:value="formModel.module" placeholder="模块标识" />
        </Form.Item>
        <Form.Item label="模块描述" name="moduleDescription">
          <Input
            v-model:value="formModel.moduleDescription"
            placeholder="模块描述"
          />
        </Form.Item>
        <Form.Item label="操作" name="operation">
          <Input
            v-model:value="formModel.operation"
            placeholder="Operation ID"
          />
        </Form.Item>
        <Form.Item label="范围" name="scope">
          <Select v-model:value="formModel.scope" :options="scopeOptions" />
        </Form.Item>
        <Form.Item label="状态" name="status">
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
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
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
