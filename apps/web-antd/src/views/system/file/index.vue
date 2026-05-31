<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
  UploadChangeParam,
  UploadFile,
  UploadProps,
} from 'ant-design-vue';

import type { AdminFile, AdminFileBrowserInfo } from '#/api/admin/files';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Drawer,
  Empty,
  Form,
  Alert,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  TypographyParagraph,
  Upload,
  message,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  deleteAdminFileBinaryApi,
  fetchAdminFileContentApi,
  fetchAdminFilePreviewTextApi,
  getAdminFileBrowserInfoApi,
  listAdminFilesApi,
  uploadAdminFileApi,
} from '#/api/admin/files';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

type AdminFileTableRecord = AdminFile | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const FILE_ACCESS = {
  delete: ['files:delete'],
  export: ['files:export'],
  upload: ['files:create'],
  view: ['files:view'],
} as const;

const defaultSorting: AdminTableSorting[] = [
  { direction: 'DESC', field: 'created_at' },
  { direction: 'DESC', field: 'id' },
];

const extensionOptions = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'md',
  'drawio',
  'xml',
  'json',
].map((value) => ({
  label: value.toUpperCase(),
  value,
}));

const columns: AdminTableColumn<AdminFile>[] = [
  {
    dataIndex: 'fileName',
    key: 'fileName',
    sortField: 'file_name',
    sortable: true,
    sorter: true,
    title: $t('page.file.fileName'),
    width: 240,
  },
  {
    dataIndex: 'extension',
    key: 'extension',
    sortField: 'extension',
    sortable: true,
    sorter: true,
    title: $t('page.file.extension'),
    width: 100,
  },
  {
    dataIndex: 'bucketName',
    key: 'bucketName',
    sortField: 'bucket_name',
    sortable: true,
    sorter: true,
    title: $t('page.file.bucketName'),
    width: 130,
  },
  {
    dataIndex: 'fileDirectory',
    key: 'fileDirectory',
    sortField: 'file_directory',
    sortable: true,
    sorter: true,
    title: $t('page.file.directory'),
    width: 220,
  },
  {
    dataIndex: 'sizeFormat',
    key: 'sizeFormat',
    sortField: 'size',
    sortable: true,
    sorter: true,
    title: $t('page.file.size'),
    width: 120,
  },
  {
    dataIndex: 'tenantName',
    key: 'tenantName',
    title: $t('page.file.owner'),
    width: 140,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.file.createdAt'),
    width: 180,
  },
  {
    fixed: 'right',
    key: 'action',
    title: $t('ui.table.action'),
    width: 190,
  },
];

const loading = ref(false);
const drawerOpen = ref(false);
const uploadModalOpen = ref(false);
const uploadSubmitting = ref(false);
const fileList = ref<AdminFile[]>([]);
const currentPreview = ref<AdminFileBrowserInfo>();
const currentPreviewObjectUrl = ref('');
const previewText = ref('');
const sorting = ref<AdminTableSorting[]>([...defaultSorting]);
const visibleColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(columns).filter((key): key is string =>
    Boolean(key),
  ),
);
const uploadFormRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();

const searchForm = reactive({
  bucketName: '',
  extension: undefined as string | undefined,
  fileDirectory: '',
  fileName: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const uploadForm = reactive({
  bucketName: '',
  fileList: [] as UploadFile[],
  folder: '',
});

const uploadRules = {
  fileList: [
    {
      required: true,
      validator: async () => {
        if (uploadForm.fileList.length === 0) {
          throw new Error($t('page.file.uploadFileRequired'));
        }
      },
    },
  ],
};

const displayColumns = computed<TableColumnsType<AdminFile>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.file.total')} ${total}`,
  total: pager.total,
}));

const uploadProps = computed<UploadProps>(() => ({
  beforeUpload: (file) => {
    uploadForm.fileList = [
      {
        name: file.name,
        originFileObj: file,
        status: 'done',
        uid: file.uid,
      },
    ];
    return false;
  },
  fileList: uploadForm.fileList,
  maxCount: 1,
}));

const previewTitle = computed(
  () => currentPreview.value?.fileName || $t('page.file.previewTitle'),
);

function toAdminFile(record: AdminFileTableRecord) {
  return record as AdminFile;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function resetUploadForm() {
  uploadForm.bucketName = '';
  uploadForm.folder = '';
  uploadForm.fileList = [];
}

function revokeCurrentPreviewObjectUrl() {
  if (currentPreviewObjectUrl.value) {
    URL.revokeObjectURL(currentPreviewObjectUrl.value);
    currentPreviewObjectUrl.value = '';
  }
}

function handleUploadChange(info: UploadChangeParam) {
  uploadForm.fileList = info.fileList.slice(-1);
}

async function loadFiles() {
  loading.value = true;
  try {
    const result = await listAdminFilesApi({
      bucketName: searchForm.bucketName,
      extension: searchForm.extension,
      fileDirectory: searchForm.fileDirectory,
      fileName: searchForm.fileName,
      page: pager.page,
      pageSize: pager.pageSize,
      sorting: sorting.value,
    });
    fileList.value = result.items;
    pager.total = result.total;
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pager.page = 1;
  await loadFiles();
}

async function handleReset() {
  searchForm.bucketName = '';
  searchForm.extension = undefined;
  searchForm.fileDirectory = '';
  searchForm.fileName = '';
  sorting.value = [...defaultSorting];
  pager.page = 1;
  await loadFiles();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorterArg: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorterArg as any);
  await loadFiles();
}

async function openUploadModal() {
  resetUploadForm();
  uploadModalOpen.value = true;
  await nextTick();
  uploadFormRef.value?.clearValidate();
}

async function submitUpload() {
  try {
    await uploadFormRef.value?.validate();
    const targetFile = uploadForm.fileList[0];
    const originFile = targetFile?.originFileObj;
    if (!originFile) {
      message.warning($t('page.file.uploadFileRequired'));
      return;
    }
    uploadSubmitting.value = true;
    await uploadAdminFileApi({
      bucketName: uploadForm.bucketName,
      file: originFile as File,
      folder: uploadForm.folder,
    });
    message.success($t('page.file.uploadSuccess'));
    uploadModalOpen.value = false;
    pager.page = 1;
    await loadFiles();
  } catch (error) {
    message.error((error as Error).message || $t('page.file.uploadFailed'));
  } finally {
    uploadSubmitting.value = false;
  }
}

async function openPreview(record: AdminFileTableRecord) {
  const file = toAdminFile(record);
  if (!file.id) {
    return;
  }
  currentPreview.value = await getAdminFileBrowserInfoApi(file.id);
  revokeCurrentPreviewObjectUrl();
  previewText.value = '';
  if (
    currentPreview.value.previewType === 'markdown' ||
    currentPreview.value.previewType === 'drawio' ||
    currentPreview.value.previewType === 'text'
  ) {
    previewText.value = await fetchAdminFilePreviewTextApi(file.id);
  } else if (
    currentPreview.value.previewType === 'image' ||
    currentPreview.value.previewType === 'pdf'
  ) {
    const result = await fetchAdminFileContentApi(file.id, 'preview');
    currentPreviewObjectUrl.value = URL.createObjectURL(result.blob);
  }
  drawerOpen.value = true;
}

async function handleDownload(record: AdminFileTableRecord) {
  const file = toAdminFile(record);
  if (!file.id) {
    return;
  }
  const result = await fetchAdminFileContentApi(file.id, 'download');
  const objectUrl = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = result.fileName || file.fileName || `file-${file.id}`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

async function handleDelete(record: AdminFileTableRecord) {
  const file = toAdminFile(record);
  if (!file.id) {
    return;
  }
  await deleteAdminFileBinaryApi(file.id);
  message.success($t('page.file.deleteSuccess'));
  await loadFiles();
}

onMounted(() => {
  loadFiles();
});

function handlePreviewDrawerClose(open: boolean) {
  drawerOpen.value = open;
  if (!open) {
    revokeCurrentPreviewObjectUrl();
  }
}
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.file')">
    <div ref="tableSurfaceRef" class="file-page">
      <div class="file-page__hero">
        <div>
          <div class="file-page__hero-title">
            {{ $t('page.file.heroTitle') }}
          </div>
          <div class="file-page__hero-desc">{{ $t('page.file.heroDesc') }}</div>
        </div>
      </div>

      <div class="file-page__toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item :label="$t('page.file.fileName')" name="fileName">
            <Input
              v-model:value="searchForm.fileName"
              allow-clear
              :placeholder="$t('page.file.placeholderFileName')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.file.directory')" name="fileDirectory">
            <Input
              v-model:value="searchForm.fileDirectory"
              allow-clear
              :placeholder="$t('page.file.placeholderDirectory')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.file.bucketName')" name="bucketName">
            <Input
              v-model:value="searchForm.bucketName"
              allow-clear
              :placeholder="$t('page.file.placeholderBucket')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.file.extension')" name="extension">
            <Select
              v-model:value="searchForm.extension"
              allow-clear
              :options="extensionOptions"
              :placeholder="$t('page.file.placeholderExtension')"
              style="width: 120px"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button html-type="submit" type="primary">{{
                $t('common.query')
              }}</Button>
              <Button @click="handleReset">{{ $t('common.reset') }}</Button>
            </Space>
          </Form.Item>
        </Form>

        <Space class="file-page__toolbar-actions">
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :data-source="fileList"
            :export-access-codes="FILE_ACCESS.export"
            file-name="system-files"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadFiles"
            storage-key="system-file-list"
          />
          <Button
            v-access:code="FILE_ACCESS.upload"
            type="primary"
            @click="openUploadModal"
          >
            <template #icon><IconifyIcon icon="lucide:upload" /></template>
            {{ $t('page.file.uploadButton') }}
          </Button>
        </Space>
      </div>

      <Table
        :columns="displayColumns"
        :data-source="fileList"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #emptyText>
          {{ $t('page.file.empty') }}
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'extension'">
            <Tag>{{ (record.extension || '-').toUpperCase() }}</Tag>
          </template>
          <template v-else-if="column.key === 'tenantName'">
            <Tag :color="record.tenantId ? 'blue' : 'gold'">
              {{ record.tenantName || $t('page.file.platformOwner') }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="FILE_ACCESS.view"
                size="small"
                type="link"
                @click="openPreview(record)"
              >
                {{ $t('page.file.previewButton') }}
              </Button>
              <Button
                v-access:code="FILE_ACCESS.view"
                size="small"
                type="link"
                @click="handleDownload(record)"
              >
                {{ $t('page.file.downloadButton') }}
              </Button>
              <Popconfirm
                v-access:code="FILE_ACCESS.delete"
                :title="$t('page.file.deleteConfirm')"
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
      v-model:open="uploadModalOpen"
      :confirm-loading="uploadSubmitting"
      :title="$t('page.file.uploadTitle')"
      destroy-on-close
      @ok="submitUpload"
    >
      <Form
        ref="uploadFormRef"
        :model="uploadForm"
        :rules="uploadRules"
        layout="vertical"
      >
        <Alert
          :description="$t('page.file.uploadTips')"
          :message="$t('page.file.uploadTipsTitle')"
          show-icon
          style="margin-bottom: 16px"
          type="info"
        />
        <Form.Item :label="$t('page.file.uploadFile')" name="fileList">
          <Upload v-bind="uploadProps" @change="handleUploadChange">
            <Button>
              <template #icon><IconifyIcon icon="lucide:file-up" /></template>
              {{ $t('page.file.selectFile') }}
            </Button>
          </Upload>
        </Form.Item>
        <Form.Item :label="$t('page.file.bucketName')" name="bucketName">
          <Input
            v-model:value="uploadForm.bucketName"
            :placeholder="$t('page.file.placeholderBucket')"
          />
          <div class="file-form-help">
            Bucket 可留空。留空后系统会按文件类型自动选择，如图片进
            `images`，文档进 `docs`，其它文件进 `files`。
          </div>
        </Form.Item>
        <Form.Item :label="$t('page.file.directory')" name="folder">
          <Input
            v-model:value="uploadForm.folder"
            :placeholder="$t('page.file.placeholderFolderHint')"
          />
          <div class="file-form-help">
            目录可留空。留空后会自动使用当前平台或租户的默认目录；如需自定义，可输入
            `project/contracts` 这类相对目录。
          </div>
        </Form.Item>
      </Form>
    </Modal>

    <Drawer
      :open="drawerOpen"
      :title="previewTitle"
      destroy-on-close
      width="72%"
      @update:open="handlePreviewDrawerClose"
    >
      <template v-if="currentPreview">
        <div class="file-preview__meta">
          <Tag>{{ currentPreview.previewType }}</Tag>
          <span>{{ currentPreview.bucketName }}</span>
          <span>{{ currentPreview.sizeFormat }}</span>
          <span>{{ currentPreview.objectName }}</span>
        </div>

        <div
          v-if="currentPreview.previewType === 'image'"
          class="file-preview__frame"
        >
          <img
            :src="currentPreviewObjectUrl"
            :alt="currentPreview.fileName"
            class="file-preview__image"
          />
        </div>
        <div
          v-else-if="currentPreview.previewType === 'pdf'"
          class="file-preview__frame"
        >
          <iframe
            :src="currentPreviewObjectUrl"
            class="file-preview__iframe"
          ></iframe>
        </div>
        <div
          v-else-if="
            currentPreview.previewType === 'markdown' ||
            currentPreview.previewType === 'drawio' ||
            currentPreview.previewType === 'text'
          "
          class="file-preview__text"
        >
          <TypographyParagraph>
            <pre>{{ previewText }}</pre>
          </TypographyParagraph>
        </div>
        <Empty v-else :description="$t('page.file.previewFallback')" />
      </template>
    </Drawer>
  </Page>
</template>

<style scoped>
.file-page {
  display: grid;
  gap: 16px;
  padding: 16px;
  background:
    radial-gradient(
      circle at top left,
      hsl(var(--primary) / 10%),
      transparent 30%
    ),
    hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.file-page__hero {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  background: linear-gradient(
    135deg,
    hsl(var(--accent) / 40%),
    hsl(var(--primary) / 10%)
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.file-page__hero-title {
  font-size: 18px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.file-page__hero-desc {
  margin-top: 6px;
  color: hsl(var(--muted-foreground));
}

.file-page__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.file-page__toolbar-actions {
  align-items: center;
}

.file-preview__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 16px;
  color: hsl(var(--muted-foreground));
}

.file-preview__frame {
  min-height: 72vh;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  overflow: hidden;
}

.file-preview__image {
  display: block;
  max-width: 100%;
  margin: 0 auto;
}

.file-preview__iframe {
  width: 100%;
  min-height: 72vh;
  border: none;
  background: transparent;
}

.file-preview__text {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.file-preview__text pre {
  white-space: pre-wrap;
  word-break: break-word;
  color: hsl(var(--foreground));
}

.file-form-help {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 768px) {
  .file-page {
    padding: 12px;
  }

  .file-page__hero,
  .file-page__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .file-page__toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
