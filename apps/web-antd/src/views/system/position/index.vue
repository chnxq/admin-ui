<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminPosition,
  AdminPositionSaveInput,
  AdminPositionStatus,
  AdminPositionType,
} from '#/api/admin/positions';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Checkbox,
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
  createAdminPositionApi,
  deleteAdminPositionApi,
  listAdminPositionsApi,
  updateAdminPositionApi,
} from '#/api/admin/positions';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminPositionFormModel extends AdminPositionSaveInput {
  code: string;
  headcount: number;
  isKeyPosition: boolean;
  level: number;
  name: string;
  sortOrder: number;
  status: AdminPositionStatus;
  type: AdminPositionType;
}

type AdminPositionTableRecord = AdminPosition | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const POSITION_ACCESS = {
  create: ['positions:create'],
  delete: ['positions:delete'],
  edit: ['positions:edit'],
  export: ['positions:export'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || '-',
);

const defaultSorting: AdminTableSorting[] = [
  { direction: 'ASC', field: 'sort_order' },
];

const statusOptions = [
  { label: $t('enum.status.ON'), value: 'ON' },
  { label: $t('enum.status.OFF'), value: 'OFF' },
];

const typeOptions = [
  { label: $t('enum.position.type.REGULAR'), value: 'REGULAR' },
  { label: $t('enum.position.type.LEADER'), value: 'LEADER' },
  { label: $t('enum.position.type.MANAGER'), value: 'MANAGER' },
  { label: $t('enum.position.type.INTERN'), value: 'INTERN' },
  { label: $t('enum.position.type.CONTRACT'), value: 'CONTRACT' },
  { label: $t('enum.position.type.OTHER'), value: 'OTHER' },
];

const statusTextMap: Record<AdminPositionStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

const typeTextMap: Record<AdminPositionType, string> = {
  CONTRACT: $t('enum.position.type.CONTRACT'),
  INTERN: $t('enum.position.type.INTERN'),
  LEADER: $t('enum.position.type.LEADER'),
  MANAGER: $t('enum.position.type.MANAGER'),
  OTHER: $t('enum.position.type.OTHER'),
  REGULAR: $t('enum.position.type.REGULAR'),
};

const columns: AdminTableColumn<AdminPosition>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: $t('page.user.id'),
    width: 80,
  },
  {
    key: 'position',
    sortField: 'name',
    sortable: true,
    sorter: true,
    title: $t('page.position.position'),
    width: 260,
  },
  {
    dataIndex: 'orgUnitName',
    sortField: 'org_unit_id',
    sortable: true,
    sorter: true,
    title: $t('page.position.orgUnitName'),
    width: 180,
  },
  {
    dataIndex: 'tenantName',
    key: 'tenant',
    sortField: 'tenant_id',
    sortable: true,
    sorter: true,
    title: $t('page.tenant.resourceOwnership'),
    width: 180,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: $t('page.position.type'),
    width: 120,
  },
  {
    dataIndex: 'level',
    sortable: true,
    sorter: true,
    title: $t('page.position.level'),
    width: 90,
  },
  {
    dataIndex: 'headcount',
    sortable: true,
    sorter: true,
    title: $t('page.position.headcount'),
    width: 90,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.position.status'),
    width: 100,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.position.createdAt'),
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
const positions = ref<AdminPosition[]>([]);
const sorting = ref<AdminTableSorting[]>([...defaultSorting]);
const visibleColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(columns).filter(
    (key): key is string => key !== undefined,
  ),
);

const searchForm = reactive({
  code: '',
  name: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const formModel = reactive<AdminPositionFormModel>({
  code: '',
  description: '',
  headcount: 0,
  isKeyPosition: false,
  jobFamily: '',
  jobGrade: '',
  level: 0,
  name: '',
  orgUnitId: undefined,
  remark: '',
  reportsToPositionId: undefined,
  sortOrder: 0,
  status: 'ON',
  type: 'REGULAR',
});

const modalTitle = computed(() =>
  editingId.value
    ? $t('page.position.editTitle')
    : $t('page.position.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminPosition>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules: Record<string, Rule[]> = {
  code: [
    {
      message: $t('ui.formRules.required', [$t('page.position.code')]),
      required: true,
    },
  ],
  name: [
    {
      message: $t('ui.formRules.required', [$t('page.position.name')]),
      required: true,
    },
  ],
  status: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.position.status')]),
      required: true,
    },
  ],
  type: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.position.type')]),
      required: true,
    },
  ],
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
    code: '',
    description: '',
    headcount: 0,
    isKeyPosition: false,
    jobFamily: '',
    jobGrade: '',
    level: 0,
    name: '',
    orgUnitId: undefined,
    remark: '',
    reportsToPositionId: undefined,
    sortOrder: 0,
    status: 'ON',
    type: 'REGULAR',
  });
}

function toAdminPosition(record: AdminPositionTableRecord) {
  return record as AdminPosition;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(status?: AdminPositionStatus) {
  return status === 'ON' ? 'success' : 'default';
}

function getPositionScopeText(record: AdminPositionTableRecord) {
  const position = toAdminPosition(record);
  return position.tenantName || '-';
}

async function loadPositions() {
  loading.value = true;
  try {
    const result = await listAdminPositionsApi({
      code: searchForm.code,
      name: searchForm.name,
      page: pager.page,
      pageSize: pager.pageSize,
      sorting: sorting.value,
    });
    positions.value = result.items;
    pager.total = result.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pager.page = 1;
  void loadPositions();
}

function handleReset() {
  searchForm.code = '';
  searchForm.name = '';
  pager.page = 1;
  sorting.value = [...defaultSorting];
  void loadPositions();
}

function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
  void loadPositions();
}

async function openCreateModal() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminPositionTableRecord) {
  const position = toAdminPosition(record);
  editingId.value = position.id;
  Object.assign(formModel, {
    code: position.code ?? '',
    description: position.description ?? '',
    headcount: position.headcount ?? 0,
    isKeyPosition: position.isKeyPosition ?? false,
    jobFamily: position.jobFamily ?? '',
    jobGrade: position.jobGrade ?? '',
    level: position.level ?? 0,
    name: position.name ?? '',
    orgUnitId: position.orgUnitId,
    remark: position.remark ?? '',
    reportsToPositionId: position.reportsToPositionId,
    sortOrder: position.sortOrder ?? 0,
    status: position.status ?? 'ON',
    type: position.type ?? 'REGULAR',
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
      await updateAdminPositionApi(editingId.value, formModel);
      message.success($t('page.position.updateSuccess'));
    } else {
      await createAdminPositionApi(formModel);
      message.success($t('page.position.createSuccess'));
    }
    modalOpen.value = false;
    await loadPositions();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminPositionTableRecord) {
  const position = toAdminPosition(record);
  if (!position.id) {
    return;
  }
  await deleteAdminPositionApi(position.id);
  message.success($t('page.position.deleteSuccess'));
  await loadPositions();
}

onMounted(() => {
  void loadPositions();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.position')">
    <div ref="tableSurfaceRef" class="admin-position-surface">
      <div v-if="isTenantSession" class="tenant-session-banner">
        <Tag color="blue">租户会话</Tag>
        <span class="tenant-session-banner__text">
          当前职位数据已按租户隔离。所属租户：{{ sessionTenantLabel }}
        </span>
      </div>
      <div class="admin-position-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.name"
            allow-clear
            :placeholder="$t('page.position.searchName')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.code"
            allow-clear
            :placeholder="$t('page.position.searchCode')"
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
            :export-access-codes="POSITION_ACCESS.export"
            :data-source="positions"
            file-name="system-positions"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadPositions"
            storage-key="system-position-list"
          />
          <Button
            v-access:code="POSITION_ACCESS.create"
            type="primary"
            @click="openCreateModal"
          >
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
            {{ $t('page.position.createTitle') }}
          </Button>
        </Space>
      </div>

      <Table
        class="admin-position-table"
        :columns="displayColumns"
        :data-source="positions"
        :loading="loading"
        :pagination="tablePagination"
        :row-key="(record) => record.id ?? record.code ?? record.name"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'position'">
            <div class="admin-primary-cell">
              <span>{{ toAdminPosition(record).name || '-' }}</span>
              <small>{{ toAdminPosition(record).code || '' }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'type'">
            {{ typeTextMap[toAdminPosition(record).type ?? 'OTHER'] }}
          </template>
          <template v-else-if="column.key === 'tenant'">
            <Tag :color="toAdminPosition(record).tenantId ? 'blue' : 'default'">
              {{ getPositionScopeText(record) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="statusColor(toAdminPosition(record).status)">
              {{ statusTextMap[toAdminPosition(record).status ?? 'OFF'] }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(toAdminPosition(record).createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="POSITION_ACCESS.edit"
                size="small"
                type="link"
                @click="openEditModal(record)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-access:code="POSITION_ACCESS.delete"
                :title="
                  $t('ui.actionMessage.deleteConfirm', [
                    $t('page.position.moduleName'),
                  ])
                "
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">
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
        <Form.Item :label="$t('page.position.name')" name="name">
          <Input
            v-model:value="formModel.name"
            :placeholder="$t('page.position.placeholderName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.position.code')" name="code">
          <Input
            v-model:value="formModel.code"
            :placeholder="$t('page.position.placeholderCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.position.type')" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.position.status')" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.position.sortOrder')" name="sortOrder">
          <InputNumber v-model:value="formModel.sortOrder" class="full-input" />
        </Form.Item>
        <Form.Item :label="$t('page.position.level')" name="level">
          <InputNumber v-model:value="formModel.level" class="full-input" />
        </Form.Item>
        <Form.Item :label="$t('page.position.headcount')" name="headcount">
          <InputNumber v-model:value="formModel.headcount" class="full-input" />
        </Form.Item>
        <Form.Item :label="$t('page.position.jobFamily')" name="jobFamily">
          <Input
            v-model:value="formModel.jobFamily"
            :placeholder="$t('page.position.placeholderJobFamily')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.position.jobGrade')" name="jobGrade">
          <Input
            v-model:value="formModel.jobGrade"
            :placeholder="$t('page.position.placeholderJobGrade')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.position.isKeyPosition')"
          name="isKeyPosition"
        >
          <Checkbox v-model:checked="formModel.isKeyPosition" />
        </Form.Item>
        <Form.Item :label="$t('page.position.description')" name="description">
          <Input.TextArea
            v-model:value="formModel.description"
            :rows="3"
            :placeholder="$t('page.position.placeholderDescription')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.position.remark')" name="remark">
          <Input.TextArea
            v-model:value="formModel.remark"
            :rows="2"
            :placeholder="$t('page.position.placeholderRemark')"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-position-surface {
  min-height: 100%;
  padding: 16px;
  background: hsl(var(--background));
}

.admin-position-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

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

.admin-position-table {
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
  .admin-position-surface {
    padding: 12px;
  }

  .admin-position-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
