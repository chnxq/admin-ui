<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminPosition,
  AdminPositionSaveInput,
  AdminPositionStatus,
  AdminPositionType,
} from '#/api/admin/positions';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Form,
  message,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAdminPositionApi,
  deleteAdminPositionApi,
  listAdminPositionsApi,
  updateAdminPositionApi,
} from '#/api/admin/positions';
import AdminGeneratedForm from '#/components/admin-generated-form/index.vue';
import { $t } from '#/locales';
import {
  buildFormOptions as buildGeneratedDialogFormOptions,
  buildListGridColumns as buildGeneratedListGridColumns,
  buildSearchFormOptions as buildGeneratedSearchFormOptions,
} from '#/views/generated/admin/system/position.meta';

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

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref();

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

const generatedFormOptions = buildGeneratedSearchFormOptions($t);
const generatedDialogFormOptions = buildGeneratedDialogFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => ({
    ...item,
    formItemClass: 'md:col-span-1',
  })),
  wrapperClass: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4',
};

const dialogFormSchema = computed(() =>
  (generatedDialogFormOptions.schema || []).map((item) => {
    const fieldName = item.fieldName;
    const placeholderMap: Record<string, string> = {
      code: $t('page.position.placeholderCode'),
      description: $t('page.position.placeholderDescription'),
      jobFamily: $t('page.position.placeholderJobFamily'),
      jobGrade: $t('page.position.placeholderJobGrade'),
      name: $t('page.position.placeholderName'),
      remark: $t('page.position.placeholderRemark'),
    };
    if (fieldName === 'type') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: typeOptions,
        },
        rules: [
          {
            message: $t('ui.formRules.selectRequired', [
              $t('page.position.type'),
            ]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'status') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: statusOptions,
        },
        rules: [
          {
            message: $t('ui.formRules.selectRequired', [
              $t('page.position.status'),
            ]),
            required: true,
          },
        ],
      };
    }
    if (
      fieldName === 'sortOrder' ||
      fieldName === 'level' ||
      fieldName === 'headcount'
    ) {
      return {
        ...item,
        component: 'InputNumber',
        componentProps: {
          ...item.componentProps,
          class: 'full-input',
        },
      };
    }
    if (fieldName === 'isKeyPosition') {
      return {
        ...item,
        component: 'Checkbox',
      };
    }
    const requiredFields = new Set(['code', 'name']);
    return {
      ...item,
      componentProps: {
        ...item.componentProps,
        placeholder: fieldName ? placeholderMap[fieldName] : undefined,
      },
      rules:
        fieldName && requiredFields.has(fieldName)
          ? [
              {
                message: $t('ui.formRules.required', [item.label || '']),
                required: true,
              },
            ]
          : item.rules,
    };
  }),
);

const generatedColumns = buildGeneratedListGridColumns($t) ?? [];

const gridOptions: VxeTableGridOptions<AdminPosition> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    ...generatedColumns,
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 150,
    },
  ],
  exportConfig: {
    filename: 'system-positions',
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

        return await listAdminPositionsApi({
          code: formValues.code,
          name: formValues.name,
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: toPositionSortField(sortField),
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

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(status?: AdminPositionStatus) {
  return status === 'ON' ? 'success' : 'default';
}

function getPositionScopeText(record: AdminPosition) {
  return record.tenantName || '-';
}

function getPositionTooltipLines(record: AdminPosition) {
  return [
    `${$t('page.position.code')}: ${record.code || '-'}`,
    `${$t('page.position.position')}: ${record.name || '-'}`,
  ];
}

function toPositionSortField(sortField: string) {
  switch (sortField) {
    case 'createdAt': {
      return 'created_at';
    }
    case 'orgUnitName': {
      return 'org_unit_id';
    }
    case 'sortOrder': {
      return 'sort_order';
    }
    case 'tenantName': {
      return 'tenant_id';
    }
    default: {
      return sortField;
    }
  }
}

async function openCreateModal() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminPosition) {
  editingId.value = record.id;
  Object.assign(formModel, {
    code: record.code ?? '',
    description: record.description ?? '',
    headcount: record.headcount ?? 0,
    isKeyPosition: record.isKeyPosition ?? false,
    jobFamily: record.jobFamily ?? '',
    jobGrade: record.jobGrade ?? '',
    level: record.level ?? 0,
    name: record.name ?? '',
    orgUnitId: record.orgUnitId,
    remark: record.remark ?? '',
    reportsToPositionId: record.reportsToPositionId,
    sortOrder: record.sortOrder ?? 0,
    status: record.status ?? 'ON',
    type: record.type ?? 'REGULAR',
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
    await gridApi.reload();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminPosition) {
  if (!record.id) {
    return;
  }
  await deleteAdminPositionApi(record.id);
  message.success($t('page.position.deleteSuccess'));
  await gridApi.reload();
}

const [Grid, gridApi] = useVbenVxeGrid<AdminPosition>({
  gridClass: 'admin-position-grid',
  gridOptions,
  formOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.position')">
    <div v-if="isTenantSession" class="tenant-session-banner">
      <Tag color="blue">{{ $t('page.commonSession.tenantSession') }}</Tag>
      <span class="tenant-session-banner__text">
        {{
          $t('page.commonSession.positionReadonlyBanner', [sessionTenantLabel])
        }}
      </span>
    </div>

    <Grid :table-title="$t('menu.system.position')">
      <template #toolPrefix>
        <div class="admin-position-tool-prefix">
          <div class="admin-position-tool-prefix__item">
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
          </div>
        </div>
      </template>

      <template #position="{ row }">
        <Tooltip>
          <template #title>
            <div class="admin-tooltip-lines">
              <div v-for="line in getPositionTooltipLines(row)" :key="line">
                {{ line }}
              </div>
            </div>
          </template>
          <span class="admin-primary-main">{{ row.name || '-' }}</span>
        </Tooltip>
      </template>

      <template #type="{ row }">
        {{ typeTextMap[row.type ?? 'OTHER'] }}
      </template>

      <template #tenant="{ row }">
        <Tag :color="row.tenantId ? 'blue' : 'default'">
          {{ getPositionScopeText(row) }}
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
            v-access:code="POSITION_ACCESS.edit"
            size="small"
            type="link"
            @click="openEditModal(row)"
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
      <Form ref="formRef" :model="formModel" :label-col="{ span: 5 }">
        <AdminGeneratedForm :model="formModel" :schema="dialogFormSchema" />
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

.admin-position-tool-prefix {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}

.admin-position-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-position-tool-prefix :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
}

.admin-tooltip-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
</style>
