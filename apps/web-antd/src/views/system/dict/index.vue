<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminDictEntry,
  AdminDictEntryI18n,
  AdminDictEntrySaveInput,
  AdminDictType,
  AdminDictTypeSaveInput,
} from '#/api/admin/dicts';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

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
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAdminDictEntryApi,
  createAdminDictTypeApi,
  deleteAdminDictEntryApi,
  deleteAdminDictTypeApi,
  listAdminDictEntriesApi,
  listAdminDictTypesApi,
  updateAdminDictEntryApi,
  updateAdminDictTypeApi,
} from '#/api/admin/dicts';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminDictTypeFormModel extends AdminDictTypeSaveInput {
  isEnabled: boolean;
  sortOrder: number;
  typeCode: string;
  typeName: string;
}

interface AdminDictEntryFormModel extends AdminDictEntrySaveInput {
  entryLabelEn?: string;
  entryLabelZh?: string;
  isEnabled: boolean;
  numericValue: number;
  sortOrder: number;
  typeId?: number;
}

type AdminDictTypeTableRecord = AdminDictType | Record<string, any>;
type AdminDictEntryTableRecord = AdminDictEntry | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const DICT_TYPE_ACCESS = {
  create: ['dict:types:create'],
  delete: ['dict:types:delete'],
  edit: ['dict:types:edit'],
  export: ['dict:types:export'],
  view: ['dict:types:view'],
} as const;

const DICT_ENTRY_ACCESS = {
  create: ['dict:entries:create'],
  delete: ['dict:entries:delete'],
  edit: ['dict:entries:edit'],
  export: ['dict:entries:export'],
  view: ['dict:entries:view'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(() => {
  return userStore.userInfo?.tenantName || 'XAdmin平台';
});

const defaultTypeSorting: AdminTableSorting[] = [
  { direction: 'ASC', field: 'sort_order' },
];
const defaultEntrySorting: AdminTableSorting[] = [
  { direction: 'ASC', field: 'sort_order' },
];

const enabledOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

const typeColumns: AdminTableColumn<AdminDictType>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: 'ID',
    width: 80,
  },
  {
    dataIndex: 'typeCode',
    key: 'typeCode',
    sortField: 'type_code',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.typeCode'),
    width: 180,
  },
  {
    dataIndex: 'typeName',
    key: 'typeName',
    sortField: 'type_name',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.typeName'),
    width: 180,
  },
  {
    dataIndex: 'isEnabled',
    key: 'isEnabled',
    sortField: 'is_enabled',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.isEnabled'),
    width: 100,
  },
  {
    dataIndex: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.sortOrder'),
    width: 100,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.createdAt'),
    width: 160,
  },
  { key: 'scope', title: $t('page.tenant.resourceOwnership'), width: 120 },
  { fixed: 'right', key: 'action', title: $t('ui.table.action'), width: 140 },
];

const entryColumns: AdminTableColumn<AdminDictEntry>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: 'ID',
    width: 80,
  },
  {
    dataIndex: 'entryValue',
    key: 'entryValue',
    sortField: 'entry_value',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.entryValue'),
    width: 160,
  },
  { key: 'entryLabel', title: $t('page.dictEntry.entryLabel'), width: 180 },
  {
    dataIndex: 'numericValue',
    sortField: 'numeric_value',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.numericValue'),
    width: 110,
  },
  {
    dataIndex: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.sortOrder'),
    width: 100,
  },
  {
    dataIndex: 'isEnabled',
    key: 'isEnabled',
    sortField: 'is_enabled',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.isEnabled'),
    width: 100,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.createdAt'),
    width: 160,
  },
  { key: 'scope', title: $t('page.tenant.resourceOwnership'), width: 120 },
  { fixed: 'right', key: 'action', title: $t('ui.table.action'), width: 140 },
];

const typeLoading = ref(false);
const entryLoading = ref(false);
const typeModalOpen = ref(false);
const entryModalOpen = ref(false);
const typeSubmitting = ref(false);
const entrySubmitting = ref(false);
const editingTypeId = ref<number>();
const editingEntryId = ref<number>();
const selectedTypeId = ref<number>();
const typeFormRef = ref<FormInstance>();
const entryFormRef = ref<FormInstance>();
const typeSurfaceRef = ref<HTMLElement>();
const entrySurfaceRef = ref<HTMLElement>();
const typeItems = ref<AdminDictType[]>([]);
const entryItems = ref<AdminDictEntry[]>([]);
const typeSorting = ref<AdminTableSorting[]>([...defaultTypeSorting]);
const entrySorting = ref<AdminTableSorting[]>([...defaultEntrySorting]);
const typeVisibleColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(typeColumns),
);
const entryVisibleColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(entryColumns),
);

const typeSearchForm = reactive({
  isEnabled: undefined as number | undefined,
  typeCode: '',
  typeName: '',
});

const entrySearchForm = reactive({
  entryValue: '',
  isEnabled: undefined as number | undefined,
});

const typePager = reactive({ page: 1, pageSize: 10, total: 0 });
const entryPager = reactive({ page: 1, pageSize: 10, total: 0 });

const typeFormModel = reactive<AdminDictTypeFormModel>({
  isEnabled: true,
  sortOrder: 0,
  typeCode: '',
  typeName: '',
});

const entryFormModel = reactive<AdminDictEntryFormModel>({
  entryLabelEn: '',
  entryLabelZh: '',
  entryValue: '',
  isEnabled: true,
  numericValue: 0,
  sortOrder: 0,
  typeId: undefined,
});

const selectedType = computed(() =>
  typeItems.value.find((item) => item.id === selectedTypeId.value),
);

const typeModalTitle = computed(() =>
  editingTypeId.value
    ? $t('page.dictType.editTitle')
    : $t('page.dictType.createTitle'),
);
const entryModalTitle = computed(() =>
  editingEntryId.value
    ? $t('page.dictEntry.editTitle')
    : $t('page.dictEntry.createTitle'),
);

const displayTypeColumns = computed<TableColumnsType<AdminDictType>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(typeColumns, typeSorting.value),
    typeVisibleColumnKeys.value,
  ),
);

const displayEntryColumns = computed<TableColumnsType<AdminDictEntry>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(entryColumns, entrySorting.value),
    entryVisibleColumnKeys.value,
  ),
);

const typeRules: Record<string, Rule[]> = {
  typeCode: [
    {
      message: $t('ui.formRules.required', [$t('page.dictType.typeCode')]),
      required: true,
    },
  ],
  typeName: [
    {
      message: $t('ui.formRules.required', [$t('page.dictType.typeName')]),
      required: true,
    },
  ],
};

const entryRules: Record<string, Rule[]> = {
  entryValue: [
    {
      message: $t('ui.formRules.required', [$t('page.dictEntry.entryValue')]),
      required: true,
    },
  ],
  entryLabelZh: [
    {
      message: $t('ui.formRules.required', [$t('page.dictEntry.entryLabelZh')]),
      required: true,
    },
  ],
  typeId: [
    {
      message: $t('ui.formRules.selectRequired', [
        $t('page.dictEntry.typeName'),
      ]),
      required: true,
    },
  ],
};

const typePagination = computed<TablePaginationConfig>(() => ({
  current: typePager.page,
  pageSize: typePager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.dictType.total')} ${total}`,
  total: typePager.total,
}));

const entryPagination = computed<TablePaginationConfig>(() => ({
  current: entryPager.page,
  pageSize: entryPager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.dictEntry.total')} ${total}`,
  total: entryPager.total,
}));

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(enabled?: boolean) {
  return enabled ? 'success' : 'default';
}

function statusText(enabled?: boolean) {
  return enabled ? $t('common.enabled') : $t('common.disabled');
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function buildI18nMap(): Record<string, AdminDictEntryI18n> | undefined {
  const zhLabel = cleanText(entryFormModel.entryLabelZh);
  const enLabel = cleanText(entryFormModel.entryLabelEn);
  const result: Record<string, AdminDictEntryI18n> = {};

  if (zhLabel) {
    result['zh-CN'] = {
      entryLabel: zhLabel,
      languageCode: 'zh-CN',
      languageName: '简体中文',
    };
  }
  if (enLabel) {
    result['en-US'] = {
      entryLabel: enLabel,
      languageCode: 'en-US',
      languageName: 'English',
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function resetTypeFormModel() {
  Object.assign(typeFormModel, {
    isEnabled: true,
    sortOrder: 0,
    typeCode: '',
    typeName: '',
  });
}

function resetEntryFormModel() {
  Object.assign(entryFormModel, {
    entryLabelEn: '',
    entryLabelZh: '',
    entryValue: '',
    isEnabled: true,
    numericValue: 0,
    sortOrder: 0,
    typeId: selectedTypeId.value,
  });
}

function toAdminDictType(record: AdminDictTypeTableRecord) {
  return record as AdminDictType;
}

function toAdminDictEntry(record: AdminDictEntryTableRecord) {
  return record as AdminDictEntry;
}

function resolveEntryLabel(record: AdminDictEntry) {
  return (
    record.currentI18n?.entryLabel ||
    record.i18n?.['zh-CN']?.entryLabel ||
    record.i18n?.['en-US']?.entryLabel ||
    '-'
  );
}

function ensurePlatformWritable() {
  if (!isTenantSession.value) {
    return true;
  }
  message.warning(`租户会话 ${sessionTenantLabel.value} 仅可查看平台字典`);
  return false;
}

async function loadTypeData() {
  typeLoading.value = true;
  try {
    const result = await listAdminDictTypesApi({
      isEnabled:
        typeSearchForm.isEnabled === undefined
          ? undefined
          : typeSearchForm.isEnabled === 1,
      page: typePager.page,
      pageSize: typePager.pageSize,
      sorting: typeSorting.value,
      typeCode: typeSearchForm.typeCode,
      typeName: typeSearchForm.typeName,
    });
    typeItems.value = result.items;
    typePager.total = result.total;
    if (!selectedTypeId.value && result.items.length > 0) {
      selectedTypeId.value = result.items[0]?.id;
    }
    if (
      selectedTypeId.value &&
      !result.items.some((item) => item.id === selectedTypeId.value)
    ) {
      selectedTypeId.value = result.items[0]?.id;
    }
  } finally {
    typeLoading.value = false;
  }
}

async function loadEntryData() {
  if (!selectedTypeId.value) {
    entryItems.value = [];
    entryPager.total = 0;
    return;
  }
  entryLoading.value = true;
  try {
    const result = await listAdminDictEntriesApi({
      entryValue: entrySearchForm.entryValue,
      isEnabled:
        entrySearchForm.isEnabled === undefined
          ? undefined
          : entrySearchForm.isEnabled === 1,
      page: entryPager.page,
      pageSize: entryPager.pageSize,
      sorting: entrySorting.value,
      typeId: selectedTypeId.value,
    });
    entryItems.value = result.items;
    entryPager.total = result.total;
  } finally {
    entryLoading.value = false;
  }
}

function handleTypeSearch() {
  typePager.page = 1;
  void loadTypeData();
}

function handleTypeReset() {
  typeSearchForm.isEnabled = undefined;
  typeSearchForm.typeCode = '';
  typeSearchForm.typeName = '';
  typeSorting.value = [...defaultTypeSorting];
  typePager.page = 1;
  void loadTypeData();
}

function handleEntrySearch() {
  entryPager.page = 1;
  void loadEntryData();
}

function handleEntryReset() {
  entrySearchForm.entryValue = '';
  entrySearchForm.isEnabled = undefined;
  entrySorting.value = [...defaultEntrySorting];
  entryPager.page = 1;
  void loadEntryData();
}

function handleTypeTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  typePager.page = pagination.current ?? 1;
  typePager.pageSize = pagination.pageSize ?? 10;
  typeSorting.value = toAdminTableSorting(sorter as any);
  void loadTypeData();
}

function handleEntryTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  entryPager.page = pagination.current ?? 1;
  entryPager.pageSize = pagination.pageSize ?? 10;
  entrySorting.value = toAdminTableSorting(sorter as any);
  void loadEntryData();
}

function handleSelectType(record: AdminDictTypeTableRecord) {
  const item = toAdminDictType(record);
  selectedTypeId.value = item.id;
}

async function openTypeCreateModal() {
  if (!ensurePlatformWritable()) {
    return;
  }
  editingTypeId.value = undefined;
  resetTypeFormModel();
  typeModalOpen.value = true;
  await nextTick();
  typeFormRef.value?.clearValidate();
}

async function openTypeEditModal(record: AdminDictTypeTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = toAdminDictType(record);
  editingTypeId.value = item.id;
  Object.assign(typeFormModel, {
    isEnabled: item.isEnabled ?? true,
    sortOrder: item.sortOrder ?? 0,
    typeCode: item.typeCode ?? '',
    typeName: item.typeName ?? '',
  });
  typeModalOpen.value = true;
  await nextTick();
  typeFormRef.value?.clearValidate();
}

async function openEntryCreateModal() {
  if (!ensurePlatformWritable()) {
    return;
  }
  editingEntryId.value = undefined;
  resetEntryFormModel();
  entryModalOpen.value = true;
  await nextTick();
  entryFormRef.value?.clearValidate();
}

async function openEntryEditModal(record: AdminDictEntryTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = toAdminDictEntry(record);
  editingEntryId.value = item.id;
  Object.assign(entryFormModel, {
    entryLabelEn: item.i18n?.['en-US']?.entryLabel ?? '',
    entryLabelZh:
      item.i18n?.['zh-CN']?.entryLabel ?? item.currentI18n?.entryLabel ?? '',
    entryValue: item.entryValue ?? '',
    isEnabled: item.isEnabled ?? true,
    numericValue: item.numericValue ?? 0,
    sortOrder: item.sortOrder ?? 0,
    typeId: item.typeId ?? selectedTypeId.value,
  });
  entryModalOpen.value = true;
  await nextTick();
  entryFormRef.value?.clearValidate();
}

async function handleTypeSubmit() {
  if (!ensurePlatformWritable()) {
    return;
  }
  await typeFormRef.value?.validate();
  typeSubmitting.value = true;
  try {
    if (editingTypeId.value) {
      await updateAdminDictTypeApi(editingTypeId.value, typeFormModel);
      message.success($t('page.dictType.updateSuccess'));
    } else {
      await createAdminDictTypeApi(typeFormModel);
      message.success($t('page.dictType.createSuccess'));
    }
    typeModalOpen.value = false;
    await loadTypeData();
  } finally {
    typeSubmitting.value = false;
  }
}

async function handleEntrySubmit() {
  if (!ensurePlatformWritable()) {
    return;
  }
  await entryFormRef.value?.validate();
  entrySubmitting.value = true;
  try {
    const payload: AdminDictEntrySaveInput = {
      entryValue: entryFormModel.entryValue,
      i18n: buildI18nMap(),
      isEnabled: entryFormModel.isEnabled,
      numericValue: entryFormModel.numericValue,
      sortOrder: entryFormModel.sortOrder,
      typeId: entryFormModel.typeId,
    };
    if (editingEntryId.value) {
      await updateAdminDictEntryApi(editingEntryId.value, payload);
      message.success($t('page.dictEntry.updateSuccess'));
    } else {
      await createAdminDictEntryApi(payload);
      message.success($t('page.dictEntry.createSuccess'));
    }
    entryModalOpen.value = false;
    await loadEntryData();
  } finally {
    entrySubmitting.value = false;
  }
}

async function handleTypeDelete(record: AdminDictTypeTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = toAdminDictType(record);
  if (!item.id) {
    return;
  }
  await deleteAdminDictTypeApi(item.id);
  message.success($t('page.dictType.deleteSuccess'));
  await loadTypeData();
  await loadEntryData();
}

async function handleEntryDelete(record: AdminDictEntryTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = toAdminDictEntry(record);
  if (!item.id) {
    return;
  }
  await deleteAdminDictEntryApi(item.id);
  message.success($t('page.dictEntry.deleteSuccess'));
  await loadEntryData();
}

watch(selectedTypeId, () => {
  entryPager.page = 1;
  void loadEntryData();
});

onMounted(async () => {
  await loadTypeData();
  await loadEntryData();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.dict')">
    <div class="dict-page">
      <div v-if="isTenantSession" class="tenant-session-banner">
        <IconifyIcon icon="lucide:building-2" />
        <span class="tenant-session-banner__text">
          当前仅可查看平台字典。所属租户：{{ sessionTenantLabel }}
        </span>
      </div>

      <div ref="typeSurfaceRef" class="dict-panel">
        <div class="dict-panel-header">
          <div>
            <div class="dict-panel-title">{{ $t('menu.system.dictType') }}</div>
            <div class="dict-panel-desc">
              {{ selectedType?.typeName || $t('page.dictType.moduleName') }}
            </div>
          </div>
          <Space>
            <AdminTableToolbar
              v-model:column-keys="typeVisibleColumnKeys"
              :columns="typeColumns"
              :export-access-codes="DICT_TYPE_ACCESS.export"
              :data-source="typeItems"
              file-name="system-dict-types"
              :fullscreen-target="typeSurfaceRef"
              :refresh="loadTypeData"
              storage-key="system-dict-type-list"
            />
            <Button
              v-access:code="DICT_TYPE_ACCESS.create"
              :disabled="isTenantSession"
              type="primary"
              @click="openTypeCreateModal"
            >
              <template #icon><IconifyIcon icon="lucide:plus" /></template>
              {{ $t('page.dictType.createTitle') }}
            </Button>
          </Space>
        </div>

        <div class="dict-toolbar">
          <Space wrap>
            <Input
              v-model:value="typeSearchForm.typeName"
              allow-clear
              :placeholder="$t('page.dictType.searchTypeName')"
              style="width: 180px"
              @press-enter="handleTypeSearch"
            />
            <Input
              v-model:value="typeSearchForm.typeCode"
              allow-clear
              :placeholder="$t('page.dictType.searchTypeCode')"
              style="width: 180px"
              @press-enter="handleTypeSearch"
            />
            <Select
              v-model:value="typeSearchForm.isEnabled"
              allow-clear
              :options="enabledOptions"
              :placeholder="$t('page.dictType.selectEnabled')"
              style="width: 160px"
            />
            <Button type="primary" @click="handleTypeSearch">
              <template #icon><IconifyIcon icon="lucide:search" /></template>
              {{ $t('common.query') }}
            </Button>
            <Button @click="handleTypeReset">
              <template #icon>
                <IconifyIcon icon="lucide:rotate-ccw" />
              </template>
              {{ $t('common.reset') }}
            </Button>
          </Space>
        </div>

        <Table
          :columns="displayTypeColumns"
          :data-source="typeItems"
          :loading="typeLoading"
          :pagination="typePagination"
          :row-class-name="
            (record) =>
              toAdminDictType(record).id === selectedTypeId
                ? 'dict-row-active'
                : ''
          "
          :row-key="(record) => record.id ?? record.typeCode ?? record.typeName"
          size="middle"
          @change="handleTypeTableChange"
          :custom-row="
            (record) => ({
              onClick: () => handleSelectType(record),
            })
          "
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'isEnabled'">
              <Tag :color="statusColor(toAdminDictType(record).isEnabled)">
                {{ statusText(toAdminDictType(record).isEnabled) }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatTime(toAdminDictType(record).createdAt) }}
            </template>
            <template v-else-if="column.key === 'scope'">
              <Tag color="gold">XAdmin平台</Tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <Space>
                <Button
                  v-access:code="DICT_TYPE_ACCESS.edit"
                  :disabled="isTenantSession"
                  size="small"
                  type="link"
                  @click.stop="openTypeEditModal(record)"
                >
                  {{ $t('common.edit') }}
                </Button>
                <Popconfirm
                  v-access:code="DICT_TYPE_ACCESS.delete"
                  :disabled="isTenantSession"
                  :title="
                    $t('ui.actionMessage.deleteConfirm', [
                      $t('page.dictType.moduleName'),
                    ])
                  "
                  @confirm="handleTypeDelete(record)"
                >
                  <Button
                    danger
                    :disabled="isTenantSession"
                    size="small"
                    type="link"
                    @click.stop
                  >
                    {{ $t('common.delete') }}
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </div>

      <div ref="entrySurfaceRef" class="dict-panel">
        <div class="dict-panel-header">
          <div>
            <div class="dict-panel-title">
              {{ $t('menu.system.dictEntry') }}
            </div>
            <div class="dict-panel-desc">
              {{
                selectedType
                  ? `${selectedType.typeName || '-'} / ${selectedType.typeCode || '-'}`
                  : '-'
              }}
            </div>
          </div>
          <Space>
            <AdminTableToolbar
              v-model:column-keys="entryVisibleColumnKeys"
              :columns="entryColumns"
              :export-access-codes="DICT_ENTRY_ACCESS.export"
              :data-source="entryItems"
              file-name="system-dict-entries"
              :fullscreen-target="entrySurfaceRef"
              :refresh="loadEntryData"
              storage-key="system-dict-entry-list"
            />
            <Button
              v-access:code="DICT_ENTRY_ACCESS.create"
              :disabled="!selectedTypeId || isTenantSession"
              type="primary"
              @click="openEntryCreateModal"
            >
              <template #icon><IconifyIcon icon="lucide:plus" /></template>
              {{ $t('page.dictEntry.createTitle') }}
            </Button>
          </Space>
        </div>

        <div class="dict-toolbar">
          <Space wrap>
            <Input
              v-model:value="entrySearchForm.entryValue"
              allow-clear
              :placeholder="$t('page.dictEntry.searchEntryValue')"
              style="width: 220px"
              @press-enter="handleEntrySearch"
            />
            <Select
              v-model:value="entrySearchForm.isEnabled"
              allow-clear
              :options="enabledOptions"
              :placeholder="$t('page.dictEntry.selectEnabled')"
              style="width: 160px"
            />
            <Button type="primary" @click="handleEntrySearch">
              <template #icon><IconifyIcon icon="lucide:search" /></template>
              {{ $t('common.query') }}
            </Button>
            <Button @click="handleEntryReset">
              <template #icon>
                <IconifyIcon icon="lucide:rotate-ccw" />
              </template>
              {{ $t('common.reset') }}
            </Button>
          </Space>
        </div>

        <Table
          :columns="displayEntryColumns"
          :data-source="entryItems"
          :loading="entryLoading"
          :pagination="entryPagination"
          :row-key="(record) => record.id ?? record.entryValue"
          size="middle"
          @change="handleEntryTableChange"
        >
          <template #emptyText>
            {{ selectedTypeId ? undefined : $t('page.dictEntry.selectType') }}
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'entryLabel'">
              {{ resolveEntryLabel(toAdminDictEntry(record)) }}
            </template>
            <template v-else-if="column.key === 'isEnabled'">
              <Tag :color="statusColor(toAdminDictEntry(record).isEnabled)">
                {{ statusText(toAdminDictEntry(record).isEnabled) }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatTime(toAdminDictEntry(record).createdAt) }}
            </template>
            <template v-else-if="column.key === 'scope'">
              <Tag color="gold">XAdmin平台</Tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <Space>
                <Button
                  v-access:code="DICT_ENTRY_ACCESS.edit"
                  :disabled="isTenantSession"
                  size="small"
                  type="link"
                  @click="openEntryEditModal(record)"
                >
                  {{ $t('common.edit') }}
                </Button>
                <Popconfirm
                  v-access:code="DICT_ENTRY_ACCESS.delete"
                  :disabled="isTenantSession"
                  :title="
                    $t('ui.actionMessage.deleteConfirm', [
                      $t('page.dictEntry.moduleName'),
                    ])
                  "
                  @confirm="handleEntryDelete(record)"
                >
                  <Button
                    danger
                    :disabled="isTenantSession"
                    size="small"
                    type="link"
                  >
                    {{ $t('common.delete') }}
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </div>
    </div>

    <Modal
      v-model:open="typeModalOpen"
      :confirm-loading="typeSubmitting"
      :title="typeModalTitle"
      destroy-on-close
      @ok="handleTypeSubmit"
    >
      <Form
        ref="typeFormRef"
        :model="typeFormModel"
        :rules="typeRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.dictType.typeName')" name="typeName">
          <Input
            v-model:value="typeFormModel.typeName"
            :placeholder="$t('page.dictType.placeholderTypeName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictType.typeCode')" name="typeCode">
          <Input
            v-model:value="typeFormModel.typeCode"
            :placeholder="$t('page.dictType.placeholderTypeCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictType.sortOrder')" name="sortOrder">
          <InputNumber
            v-model:value="typeFormModel.sortOrder"
            class="full-input"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictType.isEnabled')" name="isEnabled">
          <Switch v-model:checked="typeFormModel.isEnabled" />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="entryModalOpen"
      :confirm-loading="entrySubmitting"
      :title="entryModalTitle"
      destroy-on-close
      width="720px"
      @ok="handleEntrySubmit"
    >
      <Form
        ref="entryFormRef"
        :model="entryFormModel"
        :rules="entryRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.dictEntry.typeName')" name="typeId">
          <Select
            v-model:value="entryFormModel.typeId"
            :options="
              typeItems.map((item) => ({
                label: `${item.typeName || item.typeCode || item.id} (${item.typeCode || '-'})`,
                value: item.id,
              }))
            "
            :placeholder="$t('page.dictEntry.selectType')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictEntry.entryValue')" name="entryValue">
          <Input
            v-model:value="entryFormModel.entryValue"
            :placeholder="$t('page.dictEntry.placeholderEntryValue')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.dictEntry.entryLabelZh')"
          name="entryLabelZh"
        >
          <Input
            v-model:value="entryFormModel.entryLabelZh"
            :placeholder="$t('page.dictEntry.placeholderEntryLabelZh')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.dictEntry.entryLabelEn')"
          name="entryLabelEn"
        >
          <Input
            v-model:value="entryFormModel.entryLabelEn"
            :placeholder="$t('page.dictEntry.placeholderEntryLabelEn')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.dictEntry.numericValue')"
          name="numericValue"
        >
          <InputNumber
            v-model:value="entryFormModel.numericValue"
            class="full-input"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictEntry.sortOrder')" name="sortOrder">
          <InputNumber
            v-model:value="entryFormModel.sortOrder"
            class="full-input"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictEntry.isEnabled')" name="isEnabled">
          <Switch v-model:checked="entryFormModel.isEnabled" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.dict-page {
  display: grid;
  gap: 16px;
}

.tenant-session-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
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

.dict-panel {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.dict-panel-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dict-panel-title {
  font-size: 16px;
  font-weight: 600;
}

.dict-panel-desc {
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
}

.dict-toolbar {
  margin-bottom: 16px;
}

.dict-row-active :deep(td) {
  background: hsl(var(--accent) / 12%);
}

.full-input {
  width: 100%;
}

@media (max-width: 768px) {
  .dict-panel {
    padding: 12px;
  }

  .dict-panel-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
