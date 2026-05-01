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
import type { AdminTableColumn } from '#/components/admin-table-toolbar/shared';

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
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
} from '#/components/admin-table-toolbar/shared';

interface AdminTenantFormModel extends AdminTenantSaveInput {
  auditStatus: AdminTenantAuditStatus;
  code: string;
  name: string;
  status: AdminTenantStatus;
  type: AdminTenantType;
}

type AdminTenantTableRecord = AdminTenant | Record<string, any>;

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
  { label: '过期', value: 'EXPIRED' },
  { label: '冻结', value: 'FREEZE' },
];

const auditStatusOptions = [
  { label: '待审核', value: 'PENDING' },
  { label: '通过', value: 'APPROVED' },
  { label: '拒绝', value: 'REJECTED' },
];

const typeOptions = [
  { label: '试用', value: 'TRIAL' },
  { label: '付费', value: 'PAID' },
  { label: '内部', value: 'INTERNAL' },
  { label: '伙伴', value: 'PARTNER' },
  { label: '自定义', value: 'CUSTOM' },
];

const statusTextMap: Record<AdminTenantStatus, string> = {
  EXPIRED: '过期',
  FREEZE: '冻结',
  OFF: '禁用',
  ON: '启用',
};

const auditStatusTextMap: Record<AdminTenantAuditStatus, string> = {
  APPROVED: '通过',
  PENDING: '待审核',
  REJECTED: '拒绝',
  TENANT_AUDIT_STATUS_UNSPECIFIED: '未指定',
};

const typeTextMap: Record<AdminTenantType, string> = {
  CUSTOM: '自定义',
  INTERNAL: '内部',
  PAID: '付费',
  PARTNER: '伙伴',
  TENANT_TYPE_UNSPECIFIED: '未指定',
  TRIAL: '试用',
};

const columns: AdminTableColumn<AdminTenant>[] = [
  { dataIndex: 'id', title: 'ID', width: 80 },
  { key: 'tenant', title: '租户', width: 260 },
  { dataIndex: 'domain', title: '域名', width: 180 },
  { dataIndex: 'type', key: 'type', title: '类型', width: 120 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'auditStatus', key: 'auditStatus', title: '审核', width: 100 },
  { dataIndex: 'memberCount', title: '成员数', width: 100 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 170 },
  { fixed: 'right', key: 'action', title: '操作', width: 150 },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const tenants = ref<AdminTenant[]>([]);
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

const modalTitle = computed(() => (editingId.value ? '编辑租户' : '新增租户'));
const displayColumns = computed<TableColumnsType<AdminTenant>>(() =>
  filterVisibleAdminTableColumns(columns, visibleColumnKeys.value),
);
const formRules: Record<string, Rule[]> = {
  code: [{ message: '请输入租户编码', required: true }],
  name: [{ message: '请输入租户名称', required: true }],
  status: [{ message: '请选择状态', required: true }],
  type: [{ message: '请选择类型', required: true }],
};

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
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
  void loadTenants();
}

function handleTableChange(pagination: TablePaginationConfig) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
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
      message.success('租户已更新');
    } else {
      await createAdminTenantApi(formModel);
      message.success('租户已创建');
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
  message.success('租户已删除');
  await loadTenants();
}

onMounted(() => {
  void loadTenants();
});
</script>

<template>
  <Page auto-content-height>
    <div ref="tableSurfaceRef" class="admin-tenant-surface">
      <div class="admin-tenant-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.name"
            allow-clear
            placeholder="租户名称"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.code"
            allow-clear
            placeholder="租户编码"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Button type="primary" @click="handleSearch">
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
        <Space>
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :data-source="tenants"
            file-name="system-tenants"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadTenants"
            storage-key="system-tenant-list"
          />
          <Button type="primary" @click="openCreateModal">
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
          新增租户
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
              <Button size="small" type="link" @click="openEditModal(record)">
                编辑
              </Button>
              <Popconfirm
                title="确认删除该租户？"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">删除</Button>
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
        <Form.Item label="租户名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入租户名称" />
        </Form.Item>
        <Form.Item label="租户编码" name="code">
          <Input v-model:value="formModel.code" placeholder="请输入租户编码" />
        </Form.Item>
        <Form.Item label="域名" name="domain">
          <Input v-model:value="formModel.domain" placeholder="请输入域名" />
        </Form.Item>
        <Form.Item label="Logo URL" name="logoUrl">
          <Input
            v-model:value="formModel.logoUrl"
            placeholder="请输入 Logo URL"
          />
        </Form.Item>
        <Form.Item label="行业" name="industry">
          <Input v-model:value="formModel.industry" placeholder="请输入行业" />
        </Form.Item>
        <Form.Item label="类型" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item label="审核状态" name="auditStatus">
          <Select
            v-model:value="formModel.auditStatus"
            :options="auditStatusOptions"
          />
        </Form.Item>
        <Form.Item label="订阅计划" name="subscriptionPlan">
          <Input
            v-model:value="formModel.subscriptionPlan"
            placeholder="请输入订阅计划"
          />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea
            v-model:value="formModel.remark"
            :rows="3"
            placeholder="请输入备注"
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
