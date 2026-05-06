<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminOrgUnit,
  AdminOrgUnitSaveInput,
  AdminOrgUnitStatus,
  AdminOrgUnitType,
} from '#/api/admin/org-units';
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
  InputNumber,
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
  createAdminOrgUnitApi,
  deleteAdminOrgUnitApi,
  listAdminOrgUnitsApi,
  updateAdminOrgUnitApi,
} from '#/api/admin/org-units';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminOrgUnitFormModel extends AdminOrgUnitSaveInput {
  code: string;
  name: string;
  sortOrder: number;
  status: AdminOrgUnitStatus;
  type: AdminOrgUnitType;
}

type AdminOrgUnitTableRecord = AdminOrgUnit | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const ORG_UNIT_ACCESS = {
  create: ['org:units:create'],
  delete: ['org:units:delete'],
  edit: ['org:units:edit'],
  export: ['org:units:export'],
} as const;

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

const columns: AdminTableColumn<AdminOrgUnit>[] = [
  {
    key: 'orgUnit',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: $t('page.orgUnit.orgUnit'),
    width: 260,
  },
  {
    dataIndex: 'code',
    sortable: true,
    sorter: true,
    title: $t('page.orgUnit.code'),
    width: 160,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: $t('page.orgUnit.type'),
    width: 120,
  },
  {
    dataIndex: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: $t('page.orgUnit.sortOrder'),
    width: 90,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.orgUnit.status'),
    width: 100,
  },
  { dataIndex: 'leaderName', title: $t('page.orgUnit.leaderName'), width: 140 },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.orgUnit.createdAt'),
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
const orgUnits = ref<AdminOrgUnit[]>([]);
const orgUnitTree = ref<AdminOrgUnit[]>([]);
const sorting = ref<AdminTableSorting[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  code: '',
  name: '',
});

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
  editingId.value ? $t('page.orgUnit.editTitle') : $t('page.orgUnit.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminOrgUnit>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules: Record<string, Rule[]> = {
  code: [{ message: $t('ui.formRules.required', [$t('page.orgUnit.code')]), required: true }],
  name: [{ message: $t('ui.formRules.required', [$t('page.orgUnit.name')]), required: true }],
  status: [{ message: $t('ui.formRules.selectRequired', [$t('page.orgUnit.status')]), required: true }],
  type: [{ message: $t('ui.formRules.selectRequired', [$t('page.orgUnit.type')]), required: true }],
};

const parentOptions = computed(() =>
  orgUnits.value
    .filter((item) => item.id !== editingId.value)
    .map((item) => ({
      label: item.name ?? `#${item.id}`,
      value: item.id,
    })),
);

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

function toAdminOrgUnit(record: AdminOrgUnitTableRecord) {
  return record as AdminOrgUnit;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(status?: AdminOrgUnitStatus) {
  return status === 'ON' ? 'success' : 'default';
}

async function loadOrgUnits() {
  loading.value = true;
  try {
    const result = await listAdminOrgUnitsApi({
      code: searchForm.code,
      name: searchForm.name,
      page: 1,
      pageSize: 200,
      sorting: sorting.value,
    });
    orgUnits.value = result.items;
    orgUnitTree.value = result.tree;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  void loadOrgUnits();
}

function handleReset() {
  searchForm.code = '';
  searchForm.name = '';
  sorting.value = [];
  void loadOrgUnits();
}

function handleTableChange(
  _pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  sorting.value = toAdminTableSorting(sorter as any);
  void loadOrgUnits();
}

async function openCreateModal() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminOrgUnitTableRecord) {
  const orgUnit = toAdminOrgUnit(record);
  editingId.value = orgUnit.id;
  Object.assign(formModel, {
    address: orgUnit.address ?? '',
    code: orgUnit.code ?? '',
    description: orgUnit.description ?? '',
    email: orgUnit.email ?? '',
    name: orgUnit.name ?? '',
    parentId: orgUnit.parentId,
    phone: orgUnit.phone ?? '',
    remark: orgUnit.remark ?? '',
    sortOrder: orgUnit.sortOrder ?? 0,
    status: orgUnit.status ?? 'ON',
    type: orgUnit.type ?? 'DEPARTMENT',
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
    await loadOrgUnits();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminOrgUnitTableRecord) {
  const orgUnit = toAdminOrgUnit(record);
  if (!orgUnit.id) {
    return;
  }
  await deleteAdminOrgUnitApi(orgUnit.id);
  message.success($t('page.orgUnit.deleteSuccess'));
  await loadOrgUnits();
}

onMounted(() => {
  void loadOrgUnits();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.orgUnit')">
    <div ref="tableSurfaceRef" class="admin-org-unit-surface">
      <div class="admin-org-unit-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.name"
            allow-clear
            :placeholder="$t('page.orgUnit.searchName')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.code"
            allow-clear
            :placeholder="$t('page.orgUnit.searchCode')"
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
            :export-access-codes="ORG_UNIT_ACCESS.export"
            :data-source="orgUnitTree"
            file-name="system-org-units"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadOrgUnits"
            storage-key="system-org-unit-list"
          />
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
        </Space>
      </div>

      <Table
        class="admin-org-unit-table"
        :columns="displayColumns"
        :data-source="orgUnitTree"
        :loading="loading"
        :pagination="false"
        :row-key="(record) => record.id ?? record.code ?? record.name"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'orgUnit'">
            <div class="admin-primary-cell">
              <span>{{ toAdminOrgUnit(record).name || '-' }}</span>
              <small>{{ toAdminOrgUnit(record).description || '' }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'type'">
            {{ typeTextMap[toAdminOrgUnit(record).type ?? 'OTHER'] }}
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="statusColor(toAdminOrgUnit(record).status)">
              {{ statusTextMap[toAdminOrgUnit(record).status ?? 'OFF'] }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(toAdminOrgUnit(record).createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="ORG_UNIT_ACCESS.edit"
                size="small"
                type="link"
                @click="openEditModal(record)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-access:code="ORG_UNIT_ACCESS.delete"
                :title="$t('ui.actionMessage.deleteConfirm', [$t('page.orgUnit.moduleName')])"
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
        autocomplete="off"
      >
        <Form.Item :label="$t('page.orgUnit.name')" name="name">
          <Input
            v-model:value="formModel.name"
            autocomplete="off"
            name="admin-org-unit-name"
            :placeholder="$t('page.orgUnit.placeholderName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.code')" name="code">
          <Input
            v-model:value="formModel.code"
            autocomplete="off"
            name="admin-org-unit-code"
            :placeholder="$t('page.orgUnit.placeholderCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.parentId')" name="parentId">
          <Select
            v-model:value="formModel.parentId"
            allow-clear
            :options="parentOptions"
            :placeholder="$t('page.orgUnit.placeholderParent')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.type')" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.orgUnit.status')" name="status">
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
.admin-org-unit-surface {
  min-height: 100%;
  padding: 16px;
  background: hsl(var(--background));
}

.admin-org-unit-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.admin-org-unit-table {
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

.full-input {
  width: 100%;
}

@media (max-width: 768px) {
  .admin-org-unit-surface {
    padding: 12px;
  }

  .admin-org-unit-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
