<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminTenant,
  AdminTenantAuditStatus,
  AdminTenantSaveInput,
  AdminTenantStatus,
  AdminTenantType,
} from '#/api/admin/tenants';
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
  createAdminTenantApi,
  deleteAdminTenantApi,
  listAdminTenantsApi,
  updateAdminTenantApi,
} from '#/api/admin/tenants';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminTenantFormModel extends AdminTenantSaveInput {
  auditStatus: AdminTenantAuditStatus;
  code: string;
  name: string;
  status: AdminTenantStatus;
  type: AdminTenantType;
}

type AdminTenantTableRecord = AdminTenant | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const TENANT_ACCESS = {
  create: ['tenants:create'],
  delete: ['tenants:delete'],
  edit: ['tenants:edit'],
  export: ['tenants:export'],
} as const;

const statusOptions = [
  { label: $t('enum.tenant.status.ON'), value: 'ON' },
  { label: $t('enum.tenant.status.OFF'), value: 'OFF' },
  { label: $t('enum.tenant.status.EXPIRED'), value: 'EXPIRED' },
  { label: $t('enum.tenant.status.FREEZE'), value: 'FREEZE' },
];

const auditStatusOptions = [
  { label: $t('enum.tenant.auditStatus.PENDING'), value: 'PENDING' },
  { label: $t('enum.tenant.auditStatus.APPROVED'), value: 'APPROVED' },
  { label: $t('enum.tenant.auditStatus.REJECTED'), value: 'REJECTED' },
];

const typeOptions = [
  { label: $t('enum.tenant.type.TRIAL'), value: 'TRIAL' },
  { label: $t('enum.tenant.type.PAID'), value: 'PAID' },
  { label: $t('enum.tenant.type.INTERNAL'), value: 'INTERNAL' },
  { label: $t('enum.tenant.type.PARTNER'), value: 'PARTNER' },
  { label: $t('enum.tenant.type.CUSTOM'), value: 'CUSTOM' },
];

const statusTextMap: Record<AdminTenantStatus, string> = {
  EXPIRED: $t('enum.tenant.status.EXPIRED'),
  FREEZE: $t('enum.tenant.status.FREEZE'),
  OFF: $t('enum.tenant.status.OFF'),
  ON: $t('enum.tenant.status.ON'),
};

const auditStatusTextMap: Record<AdminTenantAuditStatus, string> = {
  APPROVED: $t('enum.tenant.auditStatus.APPROVED'),
  PENDING: $t('enum.tenant.auditStatus.PENDING'),
  REJECTED: $t('enum.tenant.auditStatus.REJECTED'),
  TENANT_AUDIT_STATUS_UNSPECIFIED: $t('enum.tenant.auditStatus.TENANT_AUDIT_STATUS_UNSPECIFIED'),
};

const typeTextMap: Record<AdminTenantType, string> = {
  CUSTOM: $t('enum.tenant.type.CUSTOM'),
  INTERNAL: $t('enum.tenant.type.INTERNAL'),
  PAID: $t('enum.tenant.type.PAID'),
  PARTNER: $t('enum.tenant.type.PARTNER'),
  TENANT_TYPE_UNSPECIFIED: $t('enum.tenant.type.TENANT_TYPE_UNSPECIFIED'),
  TRIAL: $t('enum.tenant.type.TRIAL'),
};

const columns: AdminTableColumn<AdminTenant>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.id'),
    width: 80,
  },
  {
    key: 'tenant',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.tenant'),
    width: 260,
  },
  {
    dataIndex: 'domain',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.domain'),
    width: 180,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.type'),
    width: 120,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.status'),
    width: 100,
  },
  {
    dataIndex: 'auditStatus',
    key: 'auditStatus',
    sortField: 'audit_status',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.auditStatus'),
    width: 100,
  },
  { dataIndex: 'memberCount', title: $t('page.tenant.memberCount'), width: 100 },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.createdAt'),
    width: 170,
  },
  { fixed: 'right', key: 'action', title: $t('ui.table.action'), width: 150 },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const tenants = ref<AdminTenant[]>([]);
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

const formModel = reactive<AdminTenantFormModel>({
  auditStatus: 'APPROVED',
  code: '',
  domain: '',
  industry: '',
  logoUrl: '',
  name: '',
  remark: '',
  status: 'ON',
  subscriptionPlan: '',
  type: 'TRIAL',
});

const modalTitle = computed(() =>
  editingId.value ? $t('page.tenant.editTitle') : $t('page.tenant.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminTenant>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules: Record<string, Rule[]> = {
  code: [{ message: $t('ui.formRules.required', [$t('page.tenant.code')]), required: true }],
  name: [{ message: $t('ui.formRules.required', [$t('page.tenant.name')]), required: true }],
  status: [{ message: $t('ui.formRules.selectRequired', [$t('page.tenant.status')]), required: true }],
  type: [{ message: $t('ui.formRules.selectRequired', [$t('page.tenant.type')]), required: true }],
};

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.loginAuditLog.total')} ${total}`,
  total: pager.total,
}));

function resetFormModel() {
  Object.assign(formModel, {
    auditStatus: 'APPROVED',
    code: '',
    domain: '',
    industry: '',
    logoUrl: '',
    name: '',
    remark: '',
    status: 'ON',
    subscriptionPlan: '',
    type: 'TRIAL',
  });
}

function toAdminTenant(record: AdminTenantTableRecord) {
  return record as AdminTenant;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(status?: AdminTenantStatus) {
  if (status === 'ON') {
    return 'success';
  }
  if (status === 'FREEZE' || status === 'EXPIRED') {
    return 'warning';
  }
  return 'default';
}

async function loadTenants() {
  loading.value = true;
  try {
    const result = await listAdminTenantsApi({
      code: searchForm.code,
      name: searchForm.name,
      page: pager.page,
      pageSize: pager.pageSize,
      sorting: sorting.value,
    });
    tenants.value = result.items;
    pager.total = result.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pager.page = 1;
  void loadTenants();
}

function handleReset() {
  searchForm.code = '';
  searchForm.name = '';
  pager.page = 1;
  sorting.value = [];
  void loadTenants();
}

function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
  void loadTenants();
}

async function openCreateModal() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminTenantTableRecord) {
  const tenant = toAdminTenant(record);
  editingId.value = tenant.id;
  Object.assign(formModel, {
    auditStatus: tenant.auditStatus ?? 'APPROVED',
    code: tenant.code ?? '',
    domain: tenant.domain ?? '',
    industry: tenant.industry ?? '',
    logoUrl: tenant.logoUrl ?? '',
    name: tenant.name ?? '',
    remark: tenant.remark ?? '',
    status: tenant.status ?? 'ON',
    subscriptionPlan: tenant.subscriptionPlan ?? '',
    type: tenant.type ?? 'TRIAL',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminTenantApi(editingId.value, formModel);
      message.success($t('page.tenant.updateSuccess'));
    } else {
      await createAdminTenantApi(formModel);
      message.success($t('page.tenant.createSuccess'));
    }
    modalOpen.value = false;
    await loadTenants();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminTenantTableRecord) {
  const tenant = toAdminTenant(record);
  if (!tenant.id) {
    return;
  }
  await deleteAdminTenantApi(tenant.id);
  message.success($t('page.tenant.deleteSuccess'));
  await loadTenants();
}

onMounted(() => {
  void loadTenants();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.tenant')">
    <div ref="tableSurfaceRef" class="admin-tenant-surface">
      <div class="admin-tenant-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.name"
            allow-clear
            :placeholder="$t('page.tenant.searchName')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.code"
            allow-clear
            :placeholder="$t('page.tenant.searchCode')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Button type="primary" @click="handleSearch">
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
        <Space>
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :export-access-codes="TENANT_ACCESS.export"
            :data-source="tenants"
            file-name="system-tenants"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadTenants"
            storage-key="system-tenant-list"
          />
          <Button
            v-access:code="TENANT_ACCESS.create"
            type="primary"
            @click="openCreateModal"
          >
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
            {{ $t('page.tenant.createTitle') }}
          </Button>
        </Space>
      </div>

      <Table
        class="admin-tenant-table"
        :columns="displayColumns"
        :data-source="tenants"
        :loading="loading"
        :pagination="tablePagination"
        :row-key="(record) => record.id ?? record.code ?? record.name"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tenant'">
            <div class="admin-primary-cell">
              <span>{{ toAdminTenant(record).name || '-' }}</span>
              <small>{{ toAdminTenant(record).code || '' }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'type'">
            {{
              typeTextMap[
                toAdminTenant(record).type ?? 'TENANT_TYPE_UNSPECIFIED'
              ]
            }}
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="statusColor(toAdminTenant(record).status)">
              {{ statusTextMap[toAdminTenant(record).status ?? 'OFF'] }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'auditStatus'">
            {{
              auditStatusTextMap[
                toAdminTenant(record).auditStatus ??
                  'TENANT_AUDIT_STATUS_UNSPECIFIED'
              ]
            }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(toAdminTenant(record).createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="TENANT_ACCESS.edit"
                size="small"
                type="link"
                @click="openEditModal(record)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-access:code="TENANT_ACCESS.delete"
                :title="$t('ui.actionMessage.deleteConfirm', [$t('page.tenant.moduleName')])"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">{{ $t('common.delete') }}</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </div>

    <Modal
      v-model:open="modalOpen"
      :confirm-loading="submitting"
      :title="modalTitle"
      destroy-on-close
      width="720px"
      @ok="handleSubmit"
    >
      <Form
        ref="formRef"
        :label-col="{ span: 5 }"
        :model="formModel"
        :rules="formRules"
      >
        <Form.Item :label="$t('page.tenant.name')" name="name">
          <Input v-model:value="formModel.name" :placeholder="$t('page.tenant.placeholderName')" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.code')" name="code">
          <Input v-model:value="formModel.code" :placeholder="$t('page.tenant.placeholderCode')" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.domain')" name="domain">
          <Input v-model:value="formModel.domain" :placeholder="$t('page.tenant.placeholderDomain')" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.logoUrl')" name="logoUrl">
          <Input
            v-model:value="formModel.logoUrl"
            :placeholder="$t('page.tenant.placeholderLogoUrl')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.industry')" name="industry">
          <Input v-model:value="formModel.industry" :placeholder="$t('page.tenant.placeholderIndustry')" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.type')" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.status')" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.auditStatus')" name="auditStatus">
          <Select
            v-model:value="formModel.auditStatus"
            :options="auditStatusOptions"
          />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.subscriptionPlan')" name="subscriptionPlan">
          <Input
            v-model:value="formModel.subscriptionPlan"
            :placeholder="$t('page.tenant.placeholderSubscriptionPlan')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.remark')" name="remark">
          <Input.TextArea
            v-model:value="formModel.remark"
            :rows="3"
            :placeholder="$t('page.tenant.placeholderRemark')"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-tenant-surface {
  min-height: 100%;
  padding: 16px;
  background: hsl(var(--background));
}

.admin-tenant-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.admin-tenant-table {
  width: 100%;
}

.admin-primary-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-primary-cell small {
  color: hsl(var(--muted-foreground));
}

@media (max-width: 768px) {
  .admin-tenant-surface {
    padding: 12px;
  }

  .admin-tenant-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
