<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
  TreeProps,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminDictCategory,
  AdminDictCategoryLevel,
  AdminDictCategorySaveInput,
  AdminDictCategoryScene,
  AdminDictLabel,
  AdminDictLabelKind,
  AdminDictLabelSaveInput,
  AdminDictLabelStatus,
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
  Empty,
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
  Tree,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAdminDictCategoryApi,
  createAdminDictLabelApi,
  deleteAdminDictCategoryApi,
  deleteAdminDictLabelApi,
  listAdminDictCategoriesApi,
  listAdminDictLabelsApi,
  updateAdminDictCategoryApi,
  updateAdminDictLabelApi,
} from '#/api/admin/dicts';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminDictCategoryFormModel extends AdminDictCategorySaveInput {
  categoryKey: string;
  categoryLevel: AdminDictCategoryLevel;
  categoryName: string;
  description: string;
  isBuiltin: boolean;
  isEnabled: boolean;
  parentId?: number;
  scene: AdminDictCategoryScene;
  sortOrder: number;
}

interface AdminDictLabelFormModel extends AdminDictLabelSaveInput {
  categoryId?: number;
  defaultText: string;
  description: string;
  isBuiltin: boolean;
  isEnabled: boolean;
  labelCode: string;
  labelKey: string;
  labelKind: AdminDictLabelKind;
  payloadJson: string;
  shortTextEn: string;
  shortTextZh: string;
  sortOrder: number;
  status: AdminDictLabelStatus;
  textEn: string;
  textZh: string;
}

type AdminDictLabelTableRecord = AdminDictLabel | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];
type DictTreeNode = NonNullable<TreeProps['treeData']>[number];

const DICT_CATEGORY_ACCESS = {
  create: ['dict:categories:create'],
  delete: ['dict:categories:delete'],
  edit: ['dict:categories:edit'],
  export: ['dict:categories:export'],
  view: ['dict:categories:view'],
} as const;

const DICT_LABEL_ACCESS = {
  create: ['dict:labels:create'],
  delete: ['dict:labels:delete'],
  edit: ['dict:labels:edit'],
  export: ['dict:labels:export'],
  view: ['dict:labels:view'],
} as const;

const userStore = useUserStore();
const isTenantSession = computed(
  () => userStore.userInfo?.sessionScope === 'tenant',
);
const sessionTenantLabel = computed(
  () => userStore.userInfo?.tenantName || 'XAdmin Platform',
);

const defaultLabelSorting: AdminTableSorting[] = [
  { direction: 'ASC', field: 'sort_order' },
];

const enabledOptions = computed(() => [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
]);

const categoryLevelOptions = computed(() => [
  {
    label: $t('page.dict.categoryLevelRoot'),
    value: 'ROOT' satisfies AdminDictCategoryLevel,
  },
  {
    label: $t('page.dict.categoryLevelChild'),
    value: 'CHILD' satisfies AdminDictCategoryLevel,
  },
]);

const categorySceneOptions = computed(() => [
  {
    label: $t('page.dict.scenePage'),
    value: 'PAGE' satisfies AdminDictCategoryScene,
  },
  {
    label: $t('page.dict.sceneMenu'),
    value: 'MENU' satisfies AdminDictCategoryScene,
  },
  {
    label: $t('page.dict.scenePrompt'),
    value: 'PROMPT' satisfies AdminDictCategoryScene,
  },
  {
    label: $t('page.dict.sceneDevice'),
    value: 'DEVICE' satisfies AdminDictCategoryScene,
  },
  {
    label: $t('page.dict.sceneOther'),
    value: 'OTHER' satisfies AdminDictCategoryScene,
  },
]);

const labelKindOptions = computed(() => [
  {
    label: $t('page.dict.labelKindText'),
    value: 'TEXT' satisfies AdminDictLabelKind,
  },
  {
    label: $t('page.dict.labelKindMenu'),
    value: 'MENU' satisfies AdminDictLabelKind,
  },
  {
    label: $t('page.dict.labelKindMessage'),
    value: 'MESSAGE' satisfies AdminDictLabelKind,
  },
  {
    label: $t('page.dict.labelKindEnum'),
    value: 'ENUM' satisfies AdminDictLabelKind,
  },
  {
    label: $t('page.dict.labelKindHint'),
    value: 'HINT' satisfies AdminDictLabelKind,
  },
  {
    label: $t('page.dict.labelKindBadge'),
    value: 'BADGE' satisfies AdminDictLabelKind,
  },
]);

const labelStatusOptions = computed(() => [
  {
    label: $t('page.dict.labelStatusOn'),
    value: 'ON' satisfies AdminDictLabelStatus,
  },
  {
    label: $t('page.dict.labelStatusOff'),
    value: 'OFF' satisfies AdminDictLabelStatus,
  },
]);

const labelColumns = computed<AdminTableColumn<AdminDictLabel>[]>(() => [
  {
    dataIndex: 'labelKey',
    key: 'labelKey',
    sortField: 'label_key',
    sortable: true,
    sorter: true,
    title: $t('page.dict.labelKey'),
    width: 220,
  },
  {
    dataIndex: 'labelCode',
    key: 'labelCode',
    sortField: 'label_code',
    sortable: true,
    sorter: true,
    title: $t('page.dict.labelCode'),
    width: 160,
  },
  {
    key: 'textValue',
    title: $t('page.dict.currentText'),
    width: 180,
  },
  {
    dataIndex: 'labelKind',
    key: 'labelKind',
    sortField: 'label_kind',
    sortable: true,
    sorter: true,
    title: $t('page.dict.labelKind'),
    width: 110,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortField: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.dict.labelStatus'),
    width: 100,
  },
  {
    dataIndex: 'isEnabled',
    key: 'isEnabled',
    sortField: 'is_enabled',
    sortable: true,
    sorter: true,
    title: $t('page.dict.enabled'),
    width: 100,
  },
  {
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: $t('page.dict.sortOrder'),
    width: 90,
  },
  {
    key: 'scope',
    title: $t('page.tenant.resourceOwnership'),
    width: 120,
  },
  {
    fixed: 'right',
    key: 'action',
    title: $t('ui.table.action'),
    width: 150,
  },
]);

const categoryLoading = ref(false);
const labelLoading = ref(false);
const categoryModalOpen = ref(false);
const labelModalOpen = ref(false);
const categorySubmitting = ref(false);
const labelSubmitting = ref(false);
const editingCategoryId = ref<number>();
const editingLabelId = ref<number>();
const selectedCategoryId = ref<number>();
const expandedCategoryKeys = ref<Array<number | string>>([]);
const categoryFormRef = ref<FormInstance>();
const labelFormRef = ref<FormInstance>();
const labelSurfaceRef = ref<HTMLElement>();
const categoryItems = ref<AdminDictCategory[]>([]);
const labelItems = ref<AdminDictLabel[]>([]);
const labelSorting = ref<AdminTableSorting[]>([...defaultLabelSorting]);
const labelVisibleColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(labelColumns.value).filter((key): key is string =>
    Boolean(key),
  ),
);

const categorySearchForm = reactive({
  categoryKey: '',
  categoryName: '',
  isEnabled: undefined as number | undefined,
  scene: undefined as AdminDictCategoryScene | undefined,
});

const labelSearchForm = reactive({
  isEnabled: undefined as number | undefined,
  labelCode: '',
  labelKey: '',
});

const labelPager = reactive({ page: 1, pageSize: 10, total: 0 });

const categoryFormModel = reactive<AdminDictCategoryFormModel>({
  categoryKey: '',
  categoryLevel: 'CHILD',
  categoryName: '',
  description: '',
  isBuiltin: true,
  isEnabled: true,
  parentId: undefined,
  scene: 'OTHER',
  sortOrder: 0,
});

const labelFormModel = reactive<AdminDictLabelFormModel>({
  categoryId: undefined,
  defaultText: '',
  description: '',
  isBuiltin: true,
  isEnabled: true,
  labelCode: '',
  labelKey: '',
  labelKind: 'TEXT',
  payloadJson: '',
  shortTextEn: '',
  shortTextZh: '',
  sortOrder: 0,
  status: 'ON',
  textEn: '',
  textZh: '',
});

const selectedCategory = computed(() =>
  categoryItems.value.find((item) => item.id === selectedCategoryId.value),
);

const categoryModalTitle = computed(() =>
  editingCategoryId.value
    ? $t('page.dict.editCategoryTitle')
    : $t('page.dict.createCategoryTitle'),
);
const labelModalTitle = computed(() =>
  editingLabelId.value
    ? $t('page.dict.editLabelTitle')
    : $t('page.dict.createLabelTitle'),
);

const displayLabelColumns = computed<TableColumnsType<AdminDictLabel>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(labelColumns.value, labelSorting.value),
    labelVisibleColumnKeys.value,
  ),
);

const categoryRules = computed<Record<string, Rule[]>>(() => ({
  categoryKey: [
    {
      message: $t('ui.formRules.required', [$t('page.dict.categoryKey')]),
      required: true,
    },
  ],
  categoryName: [
    {
      message: $t('ui.formRules.required', [$t('page.dict.categoryName')]),
      required: true,
    },
  ],
  scene: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.dict.scene')]),
      required: true,
    },
  ],
}));

const labelRules = computed<Record<string, Rule[]>>(() => ({
  categoryId: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.dict.category')]),
      required: true,
    },
  ],
  labelKey: [
    {
      message: $t('ui.formRules.required', [$t('page.dict.labelKey')]),
      required: true,
    },
  ],
  labelKind: [
    {
      message: $t('ui.formRules.selectRequired', [$t('page.dict.labelKind')]),
      required: true,
    },
  ],
  textZh: [
    {
      message: $t('ui.formRules.required', [$t('page.dict.textZh')]),
      required: true,
    },
  ],
}));

const labelPagination = computed<TablePaginationConfig>(() => ({
  current: labelPager.page,
  pageSize: labelPager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.dict.total')} ${total}`,
  total: labelPager.total,
}));

const parentCategoryOptions = computed(() =>
  categoryItems.value
    .filter((item) => item.id !== editingCategoryId.value)
    .map((item) => ({
      label: `${item.categoryName || item.categoryKey || item.id}`,
      value: item.id,
    })),
);

const categoryOptions = computed(() =>
  categoryItems.value.map((item) => ({
    label: `${item.categoryName || item.categoryKey || item.id} (${item.categoryKey || '-'})`,
    value: item.id,
  })),
);

const categoryTreeData = computed<TreeProps['treeData']>(() => {
  const nodeMap = new Map<number, DictTreeNode>();
  const roots: DictTreeNode[] = [];

  for (const item of categoryItems.value) {
    if (!item.id) {
      continue;
    }
    nodeMap.set(item.id, {
      children: [],
      key: item.id,
      title: `${item.categoryName || item.categoryKey || item.id}`,
    });
  }

  for (const item of categoryItems.value) {
    if (!item.id) {
      continue;
    }
    const current = nodeMap.get(item.id);
    if (!current) {
      continue;
    }
    const parentId = item.parentId;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)?.children?.push(current);
      continue;
    }
    roots.push(current);
  }

  return roots;
});

const selectedCategorySummary = computed(() => {
  const item = selectedCategory.value;
  if (!item) {
    return {
      description: $t('page.dict.summaryEmptyDescription'),
      level: '-',
      scene: '-',
      sortOrder: '-',
    };
  }
  return {
    description: item.description || $t('page.dict.noDescription'),
    level: getCategoryLevelText(item.categoryLevel),
    scene: getCategorySceneText(item.scene),
    sortOrder: item.sortOrder ?? '-',
  };
});

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(enabled?: boolean) {
  return enabled ? 'success' : 'default';
}

function statusText(enabled?: boolean) {
  return enabled ? $t('common.enabled') : $t('common.disabled');
}

function resolveOwnershipTag(tenantId?: number, tenantName?: string) {
  if (!tenantId) {
    return { color: 'gold', text: tenantName || 'XAdmin Platform' };
  }
  return {
    color: 'blue',
    text: tenantName || `${$t('page.dict.tenantPrefix')} #${tenantId}`,
  };
}

function resolveLabelText(record: AdminDictLabel) {
  return (
    record.currentI18n?.textValue ||
    record.itemsI18n?.find((item) => item.languageCode === 'zh-CN')
      ?.textValue ||
    record.defaultText ||
    '-'
  );
}

function getCategoryLevelText(level?: AdminDictCategoryLevel) {
  switch (level) {
    case 'ROOT': {
      return $t('page.dict.categoryLevelRoot');
    }
    case 'CHILD': {
      return $t('page.dict.categoryLevelChild');
    }
    default: {
      return '-';
    }
  }
}

function getCategorySceneText(scene?: AdminDictCategoryScene) {
  switch (scene) {
    case 'PAGE': {
      return $t('page.dict.scenePage');
    }
    case 'MENU': {
      return $t('page.dict.sceneMenu');
    }
    case 'PROMPT': {
      return $t('page.dict.scenePrompt');
    }
    case 'DEVICE': {
      return $t('page.dict.sceneDevice');
    }
    case 'OTHER': {
      return $t('page.dict.sceneOther');
    }
    default: {
      return '-';
    }
  }
}

function getLabelKindText(kind?: AdminDictLabelKind) {
  switch (kind) {
    case 'TEXT': {
      return $t('page.dict.labelKindText');
    }
    case 'MENU': {
      return $t('page.dict.labelKindMenu');
    }
    case 'MESSAGE': {
      return $t('page.dict.labelKindMessage');
    }
    case 'ENUM': {
      return $t('page.dict.labelKindEnum');
    }
    case 'HINT': {
      return $t('page.dict.labelKindHint');
    }
    case 'BADGE': {
      return $t('page.dict.labelKindBadge');
    }
    default: {
      return '-';
    }
  }
}

function getLabelStatusText(status?: AdminDictLabelStatus) {
  switch (status) {
    case 'ON': {
      return $t('page.dict.labelStatusOn');
    }
    case 'OFF': {
      return $t('page.dict.labelStatusOff');
    }
    default: {
      return '-';
    }
  }
}

function ensurePlatformWritable() {
  if (!isTenantSession.value) {
    return true;
  }
  message.warning(
    $t('page.dict.tenantReadonlyWarning', [sessionTenantLabel.value]),
  );
  return false;
}

function resetCategoryFormModel() {
  Object.assign(categoryFormModel, {
    categoryKey: '',
    categoryLevel: 'CHILD',
    categoryName: '',
    description: '',
    isBuiltin: true,
    isEnabled: true,
    parentId: undefined,
    scene: 'OTHER',
    sortOrder: 0,
  });
}

function resetLabelFormModel() {
  Object.assign(labelFormModel, {
    categoryId: selectedCategoryId.value,
    defaultText: '',
    description: '',
    isBuiltin: true,
    isEnabled: true,
    labelCode: '',
    labelKey: '',
    labelKind: 'TEXT',
    payloadJson: '',
    shortTextEn: '',
    shortTextZh: '',
    sortOrder: 0,
    status: 'ON',
    textEn: '',
    textZh: '',
  });
}

function toAdminDictLabel(record: AdminDictLabelTableRecord) {
  return record as AdminDictLabel;
}

async function loadCategoryData() {
  categoryLoading.value = true;
  try {
    const result = await listAdminDictCategoriesApi({
      categoryKey: categorySearchForm.categoryKey,
      categoryName: categorySearchForm.categoryName,
      isEnabled:
        categorySearchForm.isEnabled === undefined
          ? undefined
          : categorySearchForm.isEnabled === 1,
      page: 1,
      pageSize: 500,
      scene: categorySearchForm.scene,
      sorting: [
        { direction: 'ASC', field: 'sort_order' },
        { direction: 'ASC', field: 'id' },
      ],
    });

    categoryItems.value = result.items;
    expandedCategoryKeys.value = result.items
      .map((item) => item.id)
      .filter((id): id is number => Boolean(id));

    if (!selectedCategoryId.value && result.items.length > 0) {
      selectedCategoryId.value = result.items[0]?.id;
    }
    if (
      selectedCategoryId.value &&
      !result.items.some((item) => item.id === selectedCategoryId.value)
    ) {
      selectedCategoryId.value = result.items[0]?.id;
    }
  } finally {
    categoryLoading.value = false;
  }
}

async function loadLabelData() {
  if (!selectedCategoryId.value) {
    labelItems.value = [];
    labelPager.total = 0;
    return;
  }
  labelLoading.value = true;
  try {
    const result = await listAdminDictLabelsApi({
      categoryId: selectedCategoryId.value,
      isEnabled:
        labelSearchForm.isEnabled === undefined
          ? undefined
          : labelSearchForm.isEnabled === 1,
      labelCode: labelSearchForm.labelCode,
      labelKey: labelSearchForm.labelKey,
      page: labelPager.page,
      pageSize: labelPager.pageSize,
      sorting: labelSorting.value,
    });
    labelItems.value = result.items;
    labelPager.total = result.total;
  } finally {
    labelLoading.value = false;
  }
}

function handleCategorySearch() {
  void loadCategoryData();
}

function handleCategoryReset() {
  categorySearchForm.categoryKey = '';
  categorySearchForm.categoryName = '';
  categorySearchForm.isEnabled = undefined;
  categorySearchForm.scene = undefined;
  void loadCategoryData();
}

function handleLabelSearch() {
  labelPager.page = 1;
  void loadLabelData();
}

function handleLabelReset() {
  labelSearchForm.isEnabled = undefined;
  labelSearchForm.labelCode = '';
  labelSearchForm.labelKey = '';
  labelSorting.value = [...defaultLabelSorting];
  labelPager.page = 1;
  void loadLabelData();
}

function handleLabelTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  labelPager.page = pagination.current ?? 1;
  labelPager.pageSize = pagination.pageSize ?? 10;
  labelSorting.value = toAdminTableSorting(sorter as any);
  void loadLabelData();
}

function handleTreeSelect(keys: Array<number | string>) {
  const nextKey = keys[0];
  if (typeof nextKey === 'number') {
    selectedCategoryId.value = nextKey;
  }
}

function handleExpandTree(keys: Array<number | string>) {
  expandedCategoryKeys.value = keys;
}

async function openCategoryCreateModal(parentId?: number) {
  if (!ensurePlatformWritable()) {
    return;
  }
  editingCategoryId.value = undefined;
  resetCategoryFormModel();
  categoryFormModel.parentId = parentId;
  categoryFormModel.categoryLevel = parentId ? 'CHILD' : 'ROOT';
  categoryModalOpen.value = true;
  await nextTick();
  categoryFormRef.value?.clearValidate();
}

async function openCategoryEditModal(record?: AdminDictCategory) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = record || selectedCategory.value;
  if (!item) {
    return;
  }
  editingCategoryId.value = item.id;
  Object.assign(categoryFormModel, {
    categoryKey: item.categoryKey ?? '',
    categoryLevel: item.categoryLevel ?? 'CHILD',
    categoryName: item.categoryName ?? '',
    description: item.description ?? '',
    isBuiltin: item.isBuiltin ?? true,
    isEnabled: item.isEnabled ?? true,
    parentId: item.parentId,
    scene: item.scene ?? 'OTHER',
    sortOrder: item.sortOrder ?? 0,
  });
  categoryModalOpen.value = true;
  await nextTick();
  categoryFormRef.value?.clearValidate();
}

async function openLabelCreateModal() {
  if (!ensurePlatformWritable()) {
    return;
  }
  if (!selectedCategoryId.value) {
    message.warning($t('page.dict.selectCategoryFirst'));
    return;
  }
  editingLabelId.value = undefined;
  resetLabelFormModel();
  labelModalOpen.value = true;
  await nextTick();
  labelFormRef.value?.clearValidate();
}

async function openLabelEditModal(record: AdminDictLabelTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = toAdminDictLabel(record);
  editingLabelId.value = item.id;
  Object.assign(labelFormModel, {
    categoryId: item.categoryId ?? selectedCategoryId.value,
    defaultText: item.defaultText ?? '',
    description: item.description ?? '',
    isBuiltin: item.isBuiltin ?? true,
    isEnabled: item.isEnabled ?? true,
    labelCode: item.labelCode ?? '',
    labelKey: item.labelKey ?? '',
    labelKind: item.labelKind ?? 'TEXT',
    payloadJson: item.payloadJson ?? '',
    shortTextEn:
      item.itemsI18n?.find((entry) => entry.languageCode === 'en-US')
        ?.shortText ?? '',
    shortTextZh:
      item.itemsI18n?.find((entry) => entry.languageCode === 'zh-CN')
        ?.shortText ?? '',
    sortOrder: item.sortOrder ?? 0,
    status: item.status ?? 'ON',
    textEn:
      item.itemsI18n?.find((entry) => entry.languageCode === 'en-US')
        ?.textValue ?? '',
    textZh:
      item.itemsI18n?.find((entry) => entry.languageCode === 'zh-CN')
        ?.textValue ??
      item.currentI18n?.textValue ??
      '',
  });
  labelModalOpen.value = true;
  await nextTick();
  labelFormRef.value?.clearValidate();
}

async function handleCategorySubmit() {
  if (!ensurePlatformWritable()) {
    return;
  }
  await categoryFormRef.value?.validate();
  categorySubmitting.value = true;
  try {
    if (editingCategoryId.value) {
      await updateAdminDictCategoryApi(
        editingCategoryId.value,
        categoryFormModel,
      );
      message.success($t('page.dict.categoryUpdateSuccess'));
    } else {
      await createAdminDictCategoryApi(categoryFormModel);
      message.success($t('page.dict.categoryCreateSuccess'));
    }
    categoryModalOpen.value = false;
    await loadCategoryData();
  } finally {
    categorySubmitting.value = false;
  }
}

async function handleLabelSubmit() {
  if (!ensurePlatformWritable()) {
    return;
  }
  await labelFormRef.value?.validate();
  labelSubmitting.value = true;
  try {
    const payload: AdminDictLabelSaveInput = {
      categoryId: labelFormModel.categoryId,
      defaultText: labelFormModel.defaultText,
      description: labelFormModel.description,
      isBuiltin: labelFormModel.isBuiltin,
      isEnabled: labelFormModel.isEnabled,
      labelCode: labelFormModel.labelCode,
      labelKey: labelFormModel.labelKey,
      labelKind: labelFormModel.labelKind,
      payloadJson: labelFormModel.payloadJson,
      shortTextEn: labelFormModel.shortTextEn,
      shortTextZh: labelFormModel.shortTextZh,
      sortOrder: labelFormModel.sortOrder,
      status: labelFormModel.status,
      textEn: labelFormModel.textEn,
      textZh: labelFormModel.textZh,
    };
    if (editingLabelId.value) {
      await updateAdminDictLabelApi(editingLabelId.value, payload);
      message.success($t('page.dict.labelUpdateSuccess'));
    } else {
      await createAdminDictLabelApi(payload);
      message.success($t('page.dict.labelCreateSuccess'));
    }
    labelModalOpen.value = false;
    await loadLabelData();
  } finally {
    labelSubmitting.value = false;
  }
}

async function handleCategoryDelete(record?: AdminDictCategory) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = record || selectedCategory.value;
  if (!item?.id) {
    return;
  }
  await deleteAdminDictCategoryApi(item.id);
  message.success($t('page.dict.categoryDeleteSuccess'));
  if (selectedCategoryId.value === item.id) {
    selectedCategoryId.value = undefined;
  }
  await loadCategoryData();
}

async function handleLabelDelete(record: AdminDictLabelTableRecord) {
  if (!ensurePlatformWritable()) {
    return;
  }
  const item = toAdminDictLabel(record);
  if (!item.id) {
    return;
  }
  await deleteAdminDictLabelApi(item.id);
  message.success($t('page.dict.labelDeleteSuccess'));
  await loadLabelData();
}

function handleImportSeed() {
  message.info($t('page.dict.importSeedComingSoon'));
}

function handleRunSql() {
  message.info($t('page.dict.runSqlComingSoon'));
}

watch(selectedCategoryId, () => {
  labelPager.page = 1;
  void loadLabelData();
});

onMounted(async () => {
  await loadCategoryData();
  await loadLabelData();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.dict')">
    <div class="dict-page">
      <div v-if="isTenantSession" class="tenant-session-banner">
        <IconifyIcon icon="lucide:building-2" />
        <span class="tenant-session-banner__text">
          {{ $t('page.dict.tenantReadonlyBanner', [sessionTenantLabel]) }}
        </span>
      </div>

      <div class="dict-workspace">
        <section class="dict-tree-panel">
          <div class="dict-panel-head">
            <div>
              <div class="dict-panel-title">
                {{ $t('page.dict.categoryTreeTitle') }}
              </div>
              <div class="dict-panel-desc">
                {{ $t('page.dict.categoryTreeDesc') }}
              </div>
            </div>
            <Space>
              <Button
                v-access:code="DICT_CATEGORY_ACCESS.create"
                :disabled="isTenantSession"
                type="primary"
                @click="openCategoryCreateModal()"
              >
                <template #icon
                  ><IconifyIcon icon="lucide:folder-plus"
                /></template>
                {{ $t('page.dict.createRootCategory') }}
              </Button>
            </Space>
          </div>

          <div class="dict-filter-strip">
            <Input
              v-model:value="categorySearchForm.categoryName"
              allow-clear
              :placeholder="$t('page.dict.placeholderCategoryNameSearch')"
              @press-enter="handleCategorySearch"
            />
            <Input
              v-model:value="categorySearchForm.categoryKey"
              allow-clear
              :placeholder="$t('page.dict.placeholderCategoryKeySearch')"
              @press-enter="handleCategorySearch"
            />
            <Select
              v-model:value="categorySearchForm.scene"
              allow-clear
              :options="categorySceneOptions"
              :placeholder="$t('page.dict.placeholderScene')"
            />
            <Button type="primary" @click="handleCategorySearch">
              {{ $t('common.query') }}
            </Button>
            <Button @click="handleCategoryReset">
              {{ $t('common.reset') }}
            </Button>
          </div>

          <div class="dict-tree-wrap">
            <Tree
              v-if="categoryTreeData && categoryTreeData.length > 0"
              block-node
              :expanded-keys="expandedCategoryKeys"
              :selected-keys="selectedCategoryId ? [selectedCategoryId] : []"
              :tree-data="categoryTreeData"
              @update:expanded-keys="handleExpandTree"
              @select="handleTreeSelect"
            >
              <template #title="{ key, title }">
                <div class="dict-tree-node">
                  <span>{{ title }}</span>
                  <span
                    v-if="selectedCategoryId === key"
                    class="dict-tree-node__actions"
                  >
                    <Button
                      v-access:code="DICT_CATEGORY_ACCESS.create"
                      :disabled="isTenantSession"
                      size="small"
                      type="link"
                      @click.stop="openCategoryCreateModal(Number(key))"
                    >
                      {{ $t('page.dict.childCategory') }}
                    </Button>
                    <Button
                      v-access:code="DICT_CATEGORY_ACCESS.edit"
                      :disabled="isTenantSession"
                      size="small"
                      type="link"
                      @click.stop="openCategoryEditModal(selectedCategory)"
                    >
                      {{ $t('common.edit') }}
                    </Button>
                  </span>
                </div>
              </template>
            </Tree>
            <Empty v-else :description="$t('page.dict.emptyCategoryData')" />
          </div>
        </section>

        <section class="dict-main-panel">
          <div class="dict-summary-card">
            <div class="dict-summary-card__head">
              <div>
                <div class="dict-panel-title">
                  {{ $t('page.dict.summaryTitle') }}
                </div>
                <div class="dict-panel-desc">
                  {{
                    selectedCategory
                      ? `${selectedCategory.categoryName || '-'} / ${selectedCategory.categoryKey || '-'}`
                      : $t('page.dict.summaryHeadEmpty')
                  }}
                </div>
              </div>
              <Space>
                <Button
                  v-access:code="DICT_CATEGORY_ACCESS.edit"
                  :disabled="!selectedCategory || isTenantSession"
                  @click="openCategoryEditModal(selectedCategory)"
                >
                  {{ $t('page.dict.editCategoryButton') }}
                </Button>
                <Popconfirm
                  v-access:code="DICT_CATEGORY_ACCESS.delete"
                  :disabled="!selectedCategory || isTenantSession"
                  :title="$t('page.dict.deleteCategoryConfirm')"
                  @confirm="handleCategoryDelete(selectedCategory)"
                >
                  <Button
                    danger
                    v-access:code="DICT_CATEGORY_ACCESS.delete"
                    :disabled="!selectedCategory || isTenantSession"
                  >
                    {{ $t('page.dict.deleteCategoryButton') }}
                  </Button>
                </Popconfirm>
              </Space>
            </div>

            <div class="dict-summary-grid">
              <div class="dict-summary-item">
                <span class="dict-summary-item__label">{{
                  $t('page.dict.scene')
                }}</span>
                <span>{{ selectedCategorySummary.scene }}</span>
              </div>
              <div class="dict-summary-item">
                <span class="dict-summary-item__label">{{
                  $t('page.dict.categoryLevel')
                }}</span>
                <span>{{ selectedCategorySummary.level }}</span>
              </div>
              <div class="dict-summary-item">
                <span class="dict-summary-item__label">{{
                  $t('page.dict.sortOrder')
                }}</span>
                <span>{{ selectedCategorySummary.sortOrder }}</span>
              </div>
              <div class="dict-summary-item">
                <span class="dict-summary-item__label">{{
                  $t('page.dict.createdAt')
                }}</span>
                <span>{{ formatTime(selectedCategory?.createdAt) }}</span>
              </div>
            </div>

            <div class="dict-summary-card__desc">
              {{ selectedCategorySummary.description }}
            </div>
          </div>

          <div class="dict-import-panel">
            <div>
              <div class="dict-panel-title">
                {{ $t('page.dict.importTitle') }}
              </div>
              <div class="dict-panel-desc">
                {{ $t('page.dict.importDesc') }}
              </div>
            </div>
            <Space wrap>
              <Button @click="handleImportSeed">
                <template #icon
                  ><IconifyIcon icon="lucide:database-zap"
                /></template>
                {{ $t('page.dict.importSeedButton') }}
              </Button>
              <Button @click="handleRunSql">
                <template #icon
                  ><IconifyIcon icon="lucide:terminal-square"
                /></template>
                {{ $t('page.dict.runSqlButton') }}
              </Button>
            </Space>
          </div>

          <div ref="labelSurfaceRef" class="dict-label-panel">
            <div class="dict-panel-head">
              <div>
                <div class="dict-panel-title">
                  {{ $t('page.dict.labelListTitle') }}
                </div>
                <div class="dict-panel-desc">
                  {{ $t('page.dict.labelListDesc') }}
                </div>
              </div>
              <Space>
                <AdminTableToolbar
                  v-model:column-keys="labelVisibleColumnKeys"
                  :columns="labelColumns"
                  :data-source="labelItems"
                  :export-access-codes="DICT_LABEL_ACCESS.export"
                  file-name="system-dict-labels"
                  :fullscreen-target="labelSurfaceRef"
                  :refresh="loadLabelData"
                  storage-key="system-dict-label-list"
                />
                <Button
                  v-access:code="DICT_LABEL_ACCESS.create"
                  :disabled="!selectedCategoryId || isTenantSession"
                  type="primary"
                  @click="openLabelCreateModal"
                >
                  <template #icon><IconifyIcon icon="lucide:plus" /></template>
                  {{ $t('page.dict.createLabelButton') }}
                </Button>
              </Space>
            </div>

            <div class="dict-filter-strip">
              <Input
                v-model:value="labelSearchForm.labelKey"
                allow-clear
                :placeholder="$t('page.dict.placeholderLabelKeySearch')"
                @press-enter="handleLabelSearch"
              />
              <Input
                v-model:value="labelSearchForm.labelCode"
                allow-clear
                :placeholder="$t('page.dict.placeholderLabelCodeSearch')"
                @press-enter="handleLabelSearch"
              />
              <Select
                v-model:value="labelSearchForm.isEnabled"
                allow-clear
                :options="enabledOptions"
                :placeholder="$t('page.dict.placeholderEnabled')"
              />
              <Button type="primary" @click="handleLabelSearch">
                {{ $t('common.query') }}
              </Button>
              <Button @click="handleLabelReset">
                {{ $t('common.reset') }}
              </Button>
            </div>

            <Table
              :columns="displayLabelColumns"
              :data-source="labelItems"
              :loading="labelLoading"
              :pagination="labelPagination"
              :row-key="(record) => record.id ?? record.labelKey"
              size="middle"
              @change="handleLabelTableChange"
            >
              <template #emptyText>
                {{
                  selectedCategoryId
                    ? $t('page.dict.emptyLabelData')
                    : $t('page.dict.emptyLabelNeedCategory')
                }}
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'textValue'">
                  {{ resolveLabelText(toAdminDictLabel(record)) }}
                </template>
                <template v-else-if="column.key === 'labelKind'">
                  {{ getLabelKindText(toAdminDictLabel(record).labelKind) }}
                </template>
                <template v-else-if="column.key === 'status'">
                  <Tag
                    :color="
                      toAdminDictLabel(record).status === 'ON'
                        ? 'green'
                        : 'default'
                    "
                  >
                    {{ getLabelStatusText(toAdminDictLabel(record).status) }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'isEnabled'">
                  <Tag :color="statusColor(toAdminDictLabel(record).isEnabled)">
                    {{ statusText(toAdminDictLabel(record).isEnabled) }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'scope'">
                  <Tag
                    :color="
                      resolveOwnershipTag(
                        toAdminDictLabel(record).tenantId,
                        toAdminDictLabel(record).tenantName,
                      ).color
                    "
                  >
                    {{
                      resolveOwnershipTag(
                        toAdminDictLabel(record).tenantId,
                        toAdminDictLabel(record).tenantName,
                      ).text
                    }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space>
                    <Button
                      v-access:code="DICT_LABEL_ACCESS.edit"
                      :disabled="isTenantSession"
                      size="small"
                      type="link"
                      @click="openLabelEditModal(record)"
                    >
                      {{ $t('common.edit') }}
                    </Button>
                    <Popconfirm
                      v-access:code="DICT_LABEL_ACCESS.delete"
                      :disabled="isTenantSession"
                      :title="$t('page.dict.deleteLabelConfirm')"
                      @confirm="handleLabelDelete(record)"
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
        </section>
      </div>
    </div>

    <Modal
      v-model:open="categoryModalOpen"
      :confirm-loading="categorySubmitting"
      :title="categoryModalTitle"
      destroy-on-close
      @ok="handleCategorySubmit"
    >
      <Form
        ref="categoryFormRef"
        :model="categoryFormModel"
        :rules="categoryRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.dict.categoryName')" name="categoryName">
          <Input
            v-model:value="categoryFormModel.categoryName"
            :placeholder="$t('page.dict.placeholderCategoryName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.categoryKey')" name="categoryKey">
          <Input
            v-model:value="categoryFormModel.categoryKey"
            :placeholder="$t('page.dict.placeholderCategoryKey')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.scene')" name="scene">
          <Select
            v-model:value="categoryFormModel.scene"
            :options="categorySceneOptions"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.categoryLevel')" name="categoryLevel">
          <Select
            v-model:value="categoryFormModel.categoryLevel"
            :options="categoryLevelOptions"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.parentCategory')" name="parentId">
          <Select
            v-model:value="categoryFormModel.parentId"
            allow-clear
            :options="parentCategoryOptions"
            :placeholder="$t('page.dict.placeholderParentCategory')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.sortOrder')" name="sortOrder">
          <InputNumber
            v-model:value="categoryFormModel.sortOrder"
            class="full-input"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.description')" name="description">
          <Input
            v-model:value="categoryFormModel.description"
            :placeholder="$t('page.dict.placeholderDescription')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.enabled')" name="isEnabled">
          <Switch v-model:checked="categoryFormModel.isEnabled" />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="labelModalOpen"
      :confirm-loading="labelSubmitting"
      :title="labelModalTitle"
      destroy-on-close
      width="760px"
      @ok="handleLabelSubmit"
    >
      <Form
        ref="labelFormRef"
        :model="labelFormModel"
        :rules="labelRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.dict.category')" name="categoryId">
          <Select
            v-model:value="labelFormModel.categoryId"
            :options="categoryOptions"
            :placeholder="$t('page.dict.placeholderCategory')"
          />
        </Form.Item>
        <div class="dict-form-grid">
          <Form.Item :label="$t('page.dict.labelKey')" name="labelKey">
            <Input
              v-model:value="labelFormModel.labelKey"
              :placeholder="$t('page.dict.placeholderLabelKey')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.dict.labelCode')" name="labelCode">
            <Input
              v-model:value="labelFormModel.labelCode"
              :placeholder="$t('page.dict.placeholderLabelCode')"
            />
          </Form.Item>
        </div>
        <div class="dict-form-grid">
          <Form.Item :label="$t('page.dict.labelKind')" name="labelKind">
            <Select
              v-model:value="labelFormModel.labelKind"
              :options="labelKindOptions"
            />
          </Form.Item>
          <Form.Item :label="$t('page.dict.labelStatus')" name="status">
            <Select
              v-model:value="labelFormModel.status"
              :options="labelStatusOptions"
            />
          </Form.Item>
        </div>
        <div class="dict-form-grid">
          <Form.Item :label="$t('page.dict.textZh')" name="textZh">
            <Input
              v-model:value="labelFormModel.textZh"
              :placeholder="$t('page.dict.placeholderTextZh')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.dict.textEn')" name="textEn">
            <Input
              v-model:value="labelFormModel.textEn"
              :placeholder="$t('page.dict.placeholderTextEn')"
            />
          </Form.Item>
        </div>
        <div class="dict-form-grid">
          <Form.Item :label="$t('page.dict.shortTextZh')" name="shortTextZh">
            <Input
              v-model:value="labelFormModel.shortTextZh"
              :placeholder="$t('page.dict.placeholderShortTextZh')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.dict.shortTextEn')" name="shortTextEn">
            <Input
              v-model:value="labelFormModel.shortTextEn"
              :placeholder="$t('page.dict.placeholderShortTextEn')"
            />
          </Form.Item>
        </div>
        <Form.Item :label="$t('page.dict.defaultText')" name="defaultText">
          <Input
            v-model:value="labelFormModel.defaultText"
            :placeholder="$t('page.dict.placeholderDefaultText')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.payloadJson')" name="payloadJson">
          <Input
            v-model:value="labelFormModel.payloadJson"
            :placeholder="$t('page.dict.placeholderPayloadJson')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dict.description')" name="description">
          <Input
            v-model:value="labelFormModel.description"
            :placeholder="$t('page.dict.placeholderDescription')"
          />
        </Form.Item>
        <div class="dict-form-grid">
          <Form.Item :label="$t('page.dict.sortOrder')" name="sortOrder">
            <InputNumber
              v-model:value="labelFormModel.sortOrder"
              class="full-input"
            />
          </Form.Item>
          <Form.Item :label="$t('page.dict.enabled')" name="isEnabled">
            <Switch v-model:checked="labelFormModel.isEnabled" />
          </Form.Item>
        </div>
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

.dict-workspace {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.dict-tree-panel,
.dict-summary-card,
.dict-import-panel,
.dict-label-panel {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.dict-tree-panel,
.dict-label-panel {
  padding: 18px;
}

.dict-summary-card,
.dict-import-panel {
  padding: 18px 20px;
}

.dict-main-panel {
  display: grid;
  gap: 16px;
}

.dict-panel-head,
.dict-summary-card__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.dict-panel-title {
  font-size: 16px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.dict-panel-desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.dict-filter-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto auto;
  gap: 10px;
  margin-top: 16px;
  margin-bottom: 16px;
}

.dict-tree-wrap {
  min-height: 420px;
  padding: 10px;
  background: hsl(var(--background));
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
}

.dict-tree-node {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.dict-tree-node__actions {
  flex-shrink: 0;
}

.dict-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.dict-summary-item {
  padding: 12px 14px;
  background: hsl(var(--accent) / 25%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  color: hsl(var(--foreground));
}

.dict-summary-item__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.dict-summary-card__desc {
  margin-top: 14px;
  line-height: 1.7;
  color: hsl(var(--foreground) / 88%);
}

.dict-import-panel {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.dict-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-input {
  width: 100%;
}

@media (max-width: 1100px) {
  .dict-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dict-filter-strip,
  .dict-summary-grid,
  .dict-form-grid {
    grid-template-columns: 1fr;
  }

  .dict-import-panel,
  .dict-panel-head,
  .dict-summary-card__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
