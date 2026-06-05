<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminOrgUnit,
  AdminOrgUnitSaveInput,
  AdminOrgUnitStatus,
  AdminOrgUnitType,
} from '#/api/admin/org-units';

import { computed, nextTick, reactive, ref } from 'vue';

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
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAdminOrgUnitApi,
  deleteAdminOrgUnitApi,
  listAdminOrgUnitsApi,
  updateAdminOrgUnitApi,
} from '#/api/admin/org-units';
import { $t } from '#/locales';

interface AdminOrgUnitFormModel extends AdminOrgUnitSaveInput {
  code: string;
  name: string;
  sortOrder: number;
  status: AdminOrgUnitStatus;
  type: AdminOrgUnitType;
}

type OrgUnitTreeOption = {
  children?: OrgUnitTreeOption[];
  key: number;
  label: string;
  subtitle?: string;
  value: number;
};

const ORG_UNIT_ACCESS = {
  create: ['org:units:create'],
  delete: ['org:units:delete'],
  edit: ['org:units:edit'],
  export: ['org:units:export'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || '-',
);

const statusOptions = [
  { label: $t('enum.status.ON'), value: 'ON' },
  { label: $t('enum.status.OFF'), value: 'OFF' },
];

const typeOptions = [
  { label: $t('enum.orgUnit.type.COMPANY'), value: 'COMPANY' },
  { label: $t('enum.orgUnit.type.DIVISION'), value: 'DIVISION' },
  { label: $t('enum.orgUnit.type.DEPARTMENT'), value: 'DEPARTMENT' },
  { label: $t('enum.orgUnit.type.TEAM'), value: 'TEAM' },
  { label: $t('enum.orgUnit.type.PROJECT'), value: 'PROJECT' },
  { label: $t('enum.orgUnit.type.COMMITTEE'), value: 'COMMITTEE' },
  { label: $t('enum.orgUnit.type.REGION'), value: 'REGION' },
  { label: $t('enum.orgUnit.type.SUBSIDIARY'), value: 'SUBSIDIARY' },
  { label: $t('enum.orgUnit.type.BRANCH'), value: 'BRANCH' },
  { label: $t('enum.orgUnit.type.OTHER'), value: 'OTHER' },
];

const statusTextMap: Record<AdminOrgUnitStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

const typeTextMap: Record<AdminOrgUnitType, string> = {
  BRANCH: $t('enum.orgUnit.type.BRANCH'),
  COMMITTEE: $t('enum.orgUnit.type.COMMITTEE'),
  COMPANY: $t('enum.orgUnit.type.COMPANY'),
  DEPARTMENT: $t('enum.orgUnit.type.DEPARTMENT'),
  DIVISION: $t('enum.orgUnit.type.DIVISION'),
  OTHER: $t('enum.orgUnit.type.OTHER'),
  PROJECT: $t('enum.orgUnit.type.PROJECT'),
  REGION: $t('enum.orgUnit.type.REGION'),
  SUBSIDIARY: $t('enum.orgUnit.type.SUBSIDIARY'),
  TEAM: $t('enum.orgUnit.type.TEAM'),
};

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref();
const orgUnitTree = ref<AdminOrgUnit[]>([]);

const formModel = reactive<AdminOrgUnitFormModel>({
  address: '',
  code: '',
  description: '',
  email: '',
  name: '',
  parentId: undefined,
  phone: '',
  remark: '',
  sortOrder: 0,
  status: 'ON',
  type: 'DEPARTMENT',
});

const modalTitle = computed(() =>
  editingId.value
    ? $t('page.orgUnit.editTitle')
    : $t('page.orgUnit.createTitle'),
);

const parentOptions = computed<OrgUnitTreeOption[]>(() =>
  buildParentTreeOptions(orgUnitTree.value, editingId.value),
);

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.orgUnit.searchName'),
      },
      fieldName: 'name',
      formItemClass: 'md:col-span-1',
      label: $t('page.orgUnit.name'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.orgUnit.searchCode'),
      },
      fieldName: 'code',
      formItemClass: 'md:col-span-1',
      label: $t('page.orgUnit.code'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4',
};

const gridOptions: VxeTableGridOptions<AdminOrgUnit> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'name',
      treeNode: true,
      slots: { default: 'orgUnit' },
      sortable: true,
      title: $t('page.orgUnit.orgUnit'),
      width: 280,
    },
    {
      field: 'code',
      sortable: true,
      title: $t('page.orgUnit.code'),
      width: 160,
    },
    {
      field: 'type',
      slots: { default: 'type' },
      sortable: true,
      title: $t('page.orgUnit.type'),
      width: 120,
    },
    {
      field: 'sortOrder',
      sortable: true,
      title: $t('page.orgUnit.sortOrder'),
      width: 90,
    },
    {
      field: 'tenantName',
      slots: { default: 'tenant' },
      sortable: true,
      title: $t('page.tenant.resourceOwnership'),
      width: 180,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.orgUnit.status'),
      width: 100,
    },
    {
      field: 'leaderName',
      title: $t('page.orgUnit.leaderName'),
      width: 140,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.orgUnit.createdAt'),
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
    filename: 'system-org-units',
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
        const result = await listAdminOrgUnitsApi({
          code: formValues.code,
          name: formValues.name,
          page: 1,
          pageSize: 200,
          sorting: [{ direction: 'ASC', field: 'sort_order' }],
        });
        orgUnitTree.value = result.tree;
        return {
          items: result.tree,
          total: result.tree.length,
        };
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

function buildParentTreeOptions(
  items: AdminOrgUnit[],
  excludeId?: number,
): OrgUnitTreeOption[] {
  return items.flatMap((item) => {
    if (item.id === undefined) {
      return [];
    }
    if (excludeId !== undefined && item.id === excludeId) {
      return [];
    }
    const children = buildParentTreeOptions(item.children ?? [], excludeId);
    return [
      {
        children: children.length > 0 ? children : undefined,
        key: item.id,
        label: item.name ?? `#${item.id}`,
        subtitle: item.code ?? item.type ?? '-',
        value: item.id,
      },
    ];
  });
}

function resetFormModel() {
  Object.assign(formModel, {
    address: '',
    code: '',
    description: '',
    email: '',
    name: '',
    parentId: undefined,
    phone: '',
    remark: '',
    sortOrder: 0,
    status: 'ON',
    type: 'DEPARTMENT',
  });
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(status?: AdminOrgUnitStatus) {
  return status === 'ON' ? 'success' : 'default';
}

function getOrgUnitScopeText(record: AdminOrgUnit) {
  return record.tenantName || '-';
}

function getOrgUnitTooltip(record: AdminOrgUnit) {
  return [
    `${$t('page.orgUnit.code')}：${record.code || '-'}`,
    `${$t('page.orgUnit.name')}：${record.name || '-'}`,
    `${$t('page.orgUnit.description')}：${record.description || '-'}`,
  ].join('\n');
}

async function openCreateModal() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminOrgUnit) {
  editingId.value = record.id;
  Object.assign(formModel, {
    address: record.address ?? '',
    code: record.code ?? '',
    description: record.description ?? '',
    email: record.email ?? '',
    name: record.name ?? '',
    parentId: record.parentId,
    phone: record.phone ?? '',
    remark: record.remark ?? '',
    sortOrder: record.sortOrder ?? 0,
    status: record.status ?? 'ON',
    type: record.type ?? 'DEPARTMENT',
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
      await updateAdminOrgUnitApi(editingId.value, formModel);
      message.success($t('page.orgUnit.updateSuccess'));
    } else {
      await createAdminOrgUnitApi(formModel);
      message.success($t('page.orgUnit.createSuccess'));
    }
    modalOpen.value = false;
    await gridApi.reload();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminOrgUnit) {
  if (!record.id) {
    return;
  }
  await deleteAdminOrgUnitApi(record.id);
  message.success($t('page.orgUnit.deleteSuccess'));
  await gridApi.reload();
}

const [Grid, gridApi] = useVbenVxeGrid<AdminOrgUnit>({
  gridClass: 'admin-org-unit-grid',
  gridOptions,
  formOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.orgUnit')">
    <div v-if="isTenantSession" class="tenant-session-banner">
      <Tag color="blue">{{ $t('page.commonSession.tenantSession') }}</Tag>
      <span class="tenant-session-banner__text">
        {{
          $t('page.commonSession.orgUnitReadonlyBanner', [sessionTenantLabel])
        }}
      </span>
    </div>

    <Grid :table-title="$t('menu.system.orgUnit')">
      <template #toolPrefix>
        <div class="admin-org-unit-tool-prefix">
          <div class="admin-org-unit-tool-prefix__item">
            <Button
              v-access:code="ORG_UNIT_ACCESS.create"
              type="primary"
              @click="openCreateModal"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.orgUnit.createButton') }}
            </Button>
          </div>
        </div>
      </template>

      <template #orgUnit="{ row }">
        <Tooltip :title="getOrgUnitTooltip(row)">
          <span class="admin-primary-main">{{ row.name || '-' }}</span>
        </Tooltip>
      </template>

      <template #type="{ row }">
        {{ typeTextMap[row.type ?? 'OTHER'] }}
      </template>

      <template #tenant="{ row }">
        <Tag :color="row.tenantId ? 'blue' : 'default'">
          {{ getOrgUnitScopeText(row) }}
        </Tag>
      </template>

      <template #status="{ row }">
        <Tag :color="statusColor(row.status)">
          {{ statusTextMap[row.status ?? 'OFF'] }}
        </Tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>

      <template #action="{ row }">
        <Space>
          <Button
            v-access:code="ORG_UNIT_ACCESS.edit"
            size="small"
            type="link"
            @click="openEditModal(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-access:code="ORG_UNIT_ACCESS.delete"
            :title="
              $t('ui.actionMessage.deleteConfirm', [
                $t('page.orgUnit.moduleName'),
              ])
            "
            @confirm="handleDelete(row)"
          >
            <Button danger size="small" type="link">
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
      <Form
        ref="formRef"
        :label-col="{ span: 5 }"
        :model="formModel"
        autocomplete="off"
      >
        <Form.Item
          :label="$t('page.orgUnit.name')"
          name="name"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.orgUnit.name')]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="formModel.name"
            autocomplete="off"
            name="admin-org-unit-name"
            :placeholder="$t('page.orgUnit.placeholderName')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.orgUnit.code')"
          name="code"
          :rules="[
            {
              message: $t('ui.formRules.required', [$t('page.orgUnit.code')]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="formModel.code"
            autocomplete="off"
            name="admin-org-unit-code"
            :placeholder="$t('page.orgUnit.placeholderCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.parentId')" name="parentId">
          <TreeSelect
            v-model:value="formModel.parentId"
            allow-clear
            :placeholder="$t('page.orgUnit.placeholderParent')"
            show-search
            :tree-data="parentOptions"
            tree-default-expand-all
            tree-node-filter-prop="label"
          >
            <template #title="{ label, subtitle }">
              <div class="org-unit-parent-option">
                <span class="org-unit-parent-option__main">{{ label }}</span>
                <span v-if="subtitle" class="org-unit-parent-option__meta">
                  {{ subtitle }}
                </span>
              </div>
            </template>
          </TreeSelect>
        </Form.Item>
        <Form.Item
          :label="$t('page.orgUnit.type')"
          name="type"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.orgUnit.type'),
              ]),
              required: true,
            },
          ]"
        >
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item
          :label="$t('page.orgUnit.status')"
          name="status"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.orgUnit.status'),
              ]),
              required: true,
            },
          ]"
        >
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.sortOrder')" name="sortOrder">
          <InputNumber v-model:value="formModel.sortOrder" class="full-input" />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.phone')" name="phone">
          <Input
            v-model:value="formModel.phone"
            autocomplete="off"
            name="admin-org-unit-phone"
            :placeholder="$t('page.orgUnit.placeholderPhone')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.email')" name="email">
          <Input
            v-model:value="formModel.email"
            autocomplete="off"
            name="admin-org-unit-email"
            :placeholder="$t('page.orgUnit.placeholderEmail')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.address')" name="address">
          <Input
            v-model:value="formModel.address"
            autocomplete="off"
            name="admin-org-unit-address"
            :placeholder="$t('page.orgUnit.placeholderAddress')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.description')" name="description">
          <Input.TextArea
            v-model:value="formModel.description"
            :rows="3"
            :placeholder="$t('page.orgUnit.placeholderDescription')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.remark')" name="remark">
          <Input.TextArea
            v-model:value="formModel.remark"
            :rows="2"
            :placeholder="$t('page.orgUnit.placeholderRemark')"
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

.admin-org-unit-tool-prefix {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}

.admin-org-unit-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-org-unit-tool-prefix :deep(.ant-btn) {
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

.full-input {
  width: 100%;
}

.org-unit-parent-option {
  display: flex;
  gap: 8px;
  align-items: center;
}

.org-unit-parent-option__main {
  color: hsl(var(--foreground));
}

.org-unit-parent-option__meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
