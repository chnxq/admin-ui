<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminTenant,
  AdminTenantAuditStatus,
  AdminTenantSaveInput,
  AdminTenantStatus,
  AdminTenantType,
} from '#/api/admin/tenants';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
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
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAdminTenantApi,
  deleteAdminTenantApi,
  listAdminTenantsApi,
  updateAdminTenantApi,
} from '#/api/admin/tenants';
import { $t } from '#/locales';

interface AdminTenantFormModel extends AdminTenantSaveInput {
  auditStatus: AdminTenantAuditStatus;
  code: string;
  name: string;
  status: AdminTenantStatus;
  type: AdminTenantType;
}

const TENANT_ACCESS = {
  create: ['tenants:create'],
  delete: ['tenants:delete'],
  edit: ['tenants:edit'],
  export: ['tenants:export'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || '-',
);

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
  TENANT_AUDIT_STATUS_UNSPECIFIED: $t(
    'enum.tenant.auditStatus.TENANT_AUDIT_STATUS_UNSPECIFIED',
  ),
};

const typeTextMap: Record<AdminTenantType, string> = {
  CUSTOM: $t('enum.tenant.type.CUSTOM'),
  INTERNAL: $t('enum.tenant.type.INTERNAL'),
  PAID: $t('enum.tenant.type.PAID'),
  PARTNER: $t('enum.tenant.type.PARTNER'),
  TENANT_TYPE_UNSPECIFIED: $t('enum.tenant.type.TENANT_TYPE_UNSPECIFIED'),
  TRIAL: $t('enum.tenant.type.TRIAL'),
};

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref();

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

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.tenant.searchName'),
      },
      fieldName: 'name',
      formItemClass: 'md:col-span-1',
      label: $t('page.tenant.name'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.tenant.searchCode'),
      },
      fieldName: 'code',
      formItemClass: 'md:col-span-1',
      label: $t('page.tenant.code'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4',
};

const gridOptions: VxeTableGridOptions<AdminTenant> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'name',
      slots: { default: 'tenant' },
      sortable: true,
      title: $t('page.tenant.tenant'),
      width: 260,
    },
    {
      field: 'domain',
      sortable: true,
      title: $t('page.tenant.domain'),
      width: 180,
    },
    {
      field: 'type',
      slots: { default: 'type' },
      sortable: true,
      title: $t('page.tenant.type'),
      width: 120,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.tenant.status'),
      width: 100,
    },
    {
      field: 'auditStatus',
      slots: { default: 'auditStatus' },
      sortable: true,
      title: $t('page.tenant.auditStatus'),
      width: 120,
    },
    {
      field: 'memberCount',
      sortable: true,
      title: $t('page.tenant.memberCount'),
      width: 100,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.tenant.createdAt'),
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
    filename: 'system-tenants',
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

        return await listAdminTenantsApi({
          code: formValues.code,
          name: formValues.name,
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: toTenantSortField(sortField),
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

function toTenantSortField(sortField: string) {
  switch (sortField) {
    case 'auditStatus': {
      return 'audit_status';
    }
    case 'createdAt': {
      return 'created_at';
    }
    default: {
      return sortField;
    }
  }
}

function getTenantTooltip(record: AdminTenant) {
  return [
    `${$t('page.tenant.code')}：${record.code || '-'}`,
    `${$t('page.tenant.tenant')}：${record.name || '-'}`,
  ].join('\n');
}

async function openCreateModal() {
  if (isTenantSession.value) {
    message.warning('租户会话下不可创建租户');
    return;
  }
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminTenant) {
  if (isTenantSession.value) {
    message.warning('租户会话下不可编辑租户');
    return;
  }
  editingId.value = record.id;
  Object.assign(formModel, {
    auditStatus: record.auditStatus ?? 'APPROVED',
    code: record.code ?? '',
    domain: record.domain ?? '',
    industry: record.industry ?? '',
    logoUrl: record.logoUrl ?? '',
    name: record.name ?? '',
    remark: record.remark ?? '',
    status: record.status ?? 'ON',
    subscriptionPlan: record.subscriptionPlan ?? '',
    type: record.type ?? 'TRIAL',
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
    await gridApi.reload();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminTenant) {
  if (isTenantSession.value) {
    message.warning('租户会话下不可删除租户');
    return;
  }
  if (!record.id) {
    return;
  }
  await deleteAdminTenantApi(record.id);
  message.success($t('page.tenant.deleteSuccess'));
  await gridApi.reload();
}

const [Grid, gridApi] = useVbenVxeGrid<AdminTenant>({
  gridClass: 'admin-tenant-grid',
  gridOptions,
  formOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.tenant')">
    <div v-if="isTenantSession" class="tenant-session-banner">
      <Tag color="blue">绉熸埛浼氳瘽</Tag>
      <span class="tenant-session-banner__text">
        褰撳墠涓嶅彲缁存姢绉熸埛涓绘暟鎹€傛墍灞炵鎴凤細{{
          sessionTenantLabel
        }}
      </span>
    </div>

    <Grid :table-title="$t('menu.system.tenant')">
      <template #toolPrefix>
        <div class="admin-tenant-tool-prefix">
          <div class="admin-tenant-tool-prefix__item">
            <Button
              v-access:code="TENANT_ACCESS.create"
              :disabled="isTenantSession"
              type="primary"
              @click="openCreateModal"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.tenant.createTitle') }}
            </Button>
          </div>
        </div>
      </template>

      <template #tenant="{ row }">
        <Tooltip :title="getTenantTooltip(row)">
          <span class="admin-primary-main">{{ row.name || '-' }}</span>
        </Tooltip>
      </template>

      <template #type="{ row }">
        {{ typeTextMap[row.type ?? 'TENANT_TYPE_UNSPECIFIED'] }}
      </template>

      <template #status="{ row }">
        <Tag :color="statusColor(row.status)">
          {{ statusTextMap[row.status ?? 'OFF'] }}
        </Tag>
      </template>

      <template #auditStatus="{ row }">
        {{
          auditStatusTextMap[
            row.auditStatus ?? 'TENANT_AUDIT_STATUS_UNSPECIFIED'
          ]
        }}
      </template>

      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>

      <template #action="{ row }">
        <Space>
          <Button
            v-access:code="TENANT_ACCESS.edit"
            :disabled="isTenantSession"
            size="small"
            type="link"
            @click="openEditModal(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-access:code="TENANT_ACCESS.delete"
            :title="
              $t('ui.actionMessage.deleteConfirm', [
                $t('page.tenant.moduleName'),
              ])
            "
            @confirm="handleDelete(row)"
          >
            <Button danger :disabled="isTenantSession" size="small" type="link">
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>

    <Modal
      v-model:open="modalOpen"
      :confirm-loading="submitting"
      :title="modalTitle"
      destroy-on-close
      width="720px"
      @ok="handleSubmit"
    >
      <Form ref="formRef" :model="formModel" :label-col="{ span: 5 }">
        <Form.Item
          :label="$t('page.tenant.name')"
          name="name"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.tenant.name')]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="formModel.name"
            :placeholder="$t('page.tenant.placeholderName')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.tenant.code')"
          name="code"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.tenant.code')]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="formModel.code"
            :placeholder="$t('page.tenant.placeholderCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.domain')" name="domain">
          <Input
            v-model:value="formModel.domain"
            :placeholder="$t('page.tenant.placeholderDomain')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.logoUrl')" name="logoUrl">
          <Input
            v-model:value="formModel.logoUrl"
            :placeholder="$t('page.tenant.placeholderLogoUrl')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.industry')" name="industry">
          <Input
            v-model:value="formModel.industry"
            :placeholder="$t('page.tenant.placeholderIndustry')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.tenant.type')"
          name="type"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.tenant.type'),
              ]),
              required: true,
            },
          ]"
        >
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item
          :label="$t('page.tenant.status')"
          name="status"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.tenant.status'),
              ]),
              required: true,
            },
          ]"
        >
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.tenant.auditStatus')" name="auditStatus">
          <Select
            v-model:value="formModel.auditStatus"
            :options="auditStatusOptions"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.tenant.subscriptionPlan')"
          name="subscriptionPlan"
        >
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

.admin-tenant-tool-prefix {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}

.admin-tenant-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-tenant-tool-prefix :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
}

.admin-primary-main {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  white-space: nowrap;
}
</style>
