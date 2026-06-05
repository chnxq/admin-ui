<script lang="ts" setup>
import type {
  UploadChangeParam,
  UploadFile,
  UploadProps,
} from 'ant-design-vue';

import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AdminFile, AdminFileBrowserInfo } from '#/api/admin/files';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Tag,
  TypographyParagraph,
  Upload,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAdminFileBinaryApi,
  fetchAdminFileContentApi,
  fetchAdminFilePreviewTextApi,
  getAdminFileBrowserInfoApi,
  listAdminFilesApi,
  uploadAdminFileApi,
} from '#/api/admin/files';
import { $t } from '#/locales';

const FILE_ACCESS = {
  delete: ['files:delete'],
  export: ['files:export'],
  upload: ['files:create'],
  view: ['files:view'],
} as const;

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

const drawerOpen = ref(false);
const uploadModalOpen = ref(false);
const uploadSubmitting = ref(false);
const currentPreview = ref<AdminFileBrowserInfo>();
const currentPreviewObjectUrl = ref('');
const previewText = ref('');
const uploadFormRef = ref();

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

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.file.placeholderFileName'),
      },
      fieldName: 'fileName',
      label: $t('page.file.fileName'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.file.placeholderDirectory'),
      },
      fieldName: 'fileDirectory',
      label: $t('page.file.directory'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.file.placeholderBucket'),
      },
      fieldName: 'bucketName',
      label: $t('page.file.bucketName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: extensionOptions,
        placeholder: $t('page.file.placeholderExtension'),
      },
      fieldName: 'extension',
      label: $t('page.file.extension'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<AdminFile> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'fileName',
      sortable: true,
      title: $t('page.file.fileName'),
      width: 240,
    },
    {
      field: 'extension',
      slots: { default: 'extension' },
      sortable: true,
      title: $t('page.file.extension'),
      width: 100,
    },
    {
      field: 'bucketName',
      sortable: true,
      title: $t('page.file.bucketName'),
      width: 130,
    },
    {
      field: 'fileDirectory',
      sortable: true,
      title: $t('page.file.directory'),
      width: 220,
    },
    {
      field: 'sizeFormat',
      sortable: true,
      title: $t('page.file.size'),
      width: 120,
    },
    {
      field: 'tenantName',
      slots: { default: 'tenantName' },
      title: $t('page.file.owner'),
      width: 140,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.file.createdAt'),
      width: 180,
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 190,
    },
  ],
  emptyRender: {
    name: 'NotData',
  },
  exportConfig: {
    filename: 'system-files',
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
        const sortField = String(sort.field || 'createdAt');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        return await listAdminFilesApi({
          bucketName: formValues.bucketName,
          extension: formValues.extension,
          fileDirectory: formValues.fileDirectory,
          fileName: formValues.fileName,
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: toFileSortField(sortField),
            },
            {
              direction: 'DESC',
              field: 'id',
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

function toFileSortField(sortField: string) {
  switch (sortField) {
    case 'bucketName': {
      return 'bucket_name';
    }
    case 'createdAt': {
      return 'created_at';
    }
    case 'fileDirectory': {
      return 'file_directory';
    }
    case 'fileName': {
      return 'file_name';
    }
    default: {
      return sortField;
    }
  }
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
    await gridApi.query({ page: 1 });
  } catch (error) {
    message.error((error as Error).message || $t('page.file.uploadFailed'));
  } finally {
    uploadSubmitting.value = false;
  }
}

async function openPreview(record: AdminFile) {
  if (!record.id) {
    return;
  }
  currentPreview.value = await getAdminFileBrowserInfoApi(record.id);
  revokeCurrentPreviewObjectUrl();
  previewText.value = '';
  if (
    currentPreview.value.previewType === 'markdown' ||
    currentPreview.value.previewType === 'drawio' ||
    currentPreview.value.previewType === 'text'
  ) {
    previewText.value = await fetchAdminFilePreviewTextApi(record.id);
  } else if (
    currentPreview.value.previewType === 'image' ||
    currentPreview.value.previewType === 'pdf'
  ) {
    const result = await fetchAdminFileContentApi(record.id, 'preview');
    currentPreviewObjectUrl.value = URL.createObjectURL(result.blob);
  }
  drawerOpen.value = true;
}

async function handleDownload(record: AdminFile) {
  if (!record.id) {
    return;
  }
  const result = await fetchAdminFileContentApi(record.id, 'download');
  const objectUrl = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = result.fileName || record.fileName || `file-${record.id}`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

async function handleDelete(record: AdminFile) {
  if (!record.id) {
    return;
  }
  await deleteAdminFileBinaryApi(record.id);
  message.success($t('page.file.deleteSuccess'));
  await gridApi.reload();
}

function handlePreviewDrawerClose(open: boolean) {
  drawerOpen.value = open;
  if (!open) {
    revokeCurrentPreviewObjectUrl();
  }
}

const [Grid, gridApi] = useVbenVxeGrid<AdminFile>({
  gridClass: 'admin-file-grid',
  gridOptions,
  formOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.file')">
    <div class="file-page">
      <div class="file-page__hero">
        <div>
          <div class="file-page__hero-title">
            {{ $t('page.file.heroTitle') }}
          </div>
          <div class="file-page__hero-desc">{{ $t('page.file.heroDesc') }}</div>
        </div>
      </div>

      <Grid :table-title="$t('menu.system.file')">
        <template #toolPrefix>
          <div class="file-page__tool-prefix">
            <div class="file-page__tool-prefix-item">
              <Button
                v-access:code="FILE_ACCESS.upload"
                type="primary"
                @click="openUploadModal"
              >
                <template #icon><IconifyIcon icon="lucide:upload" /></template>
                {{ $t('page.file.uploadButton') }}
              </Button>
            </div>
          </div>
        </template>

        <template #extension="{ row }">
          <Tag>{{ (row.extension || '-').toUpperCase() }}</Tag>
        </template>

        <template #tenantName="{ row }">
          <Tag :color="row.tenantId ? 'blue' : 'gold'">
            {{ row.tenantName || $t('page.file.platformOwner') }}
          </Tag>
        </template>

        <template #createdAt="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>

        <template #action="{ row }">
          <Space>
            <Button
              v-access:code="FILE_ACCESS.view"
              size="small"
              type="link"
              @click="openPreview(row)"
            >
              {{ $t('page.file.previewButton') }}
            </Button>
            <Button
              v-access:code="FILE_ACCESS.view"
              size="small"
              type="link"
              @click="handleDownload(row)"
            >
              {{ $t('page.file.downloadButton') }}
            </Button>
            <Popconfirm
              v-access:code="FILE_ACCESS.delete"
              :title="$t('page.file.deleteConfirm')"
              @confirm="handleDelete(row)"
            >
              <Button danger size="small" type="link">
                {{ $t('common.delete') }}
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </Grid>
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
            {{ $t('page.file.bucketHelp') }}
          </div>
        </Form.Item>
        <Form.Item :label="$t('page.file.directory')" name="folder">
          <Input
            v-model:value="uploadForm.folder"
            :placeholder="$t('page.file.placeholderFolderHint')"
          />
          <div class="file-form-help">
            {{ $t('page.file.directoryHelp') }}
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
  min-height: 100%;
  padding: 16px;
  overflow-y: auto;
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

.file-page__tool-prefix {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}

.file-page__tool-prefix-item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.file-page__tool-prefix :deep(.ant-btn) {
  display: inline-flex;
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
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.file-preview__image {
  display: block;
  max-width: 100%;
  margin: 0 auto;
}

.file-preview__iframe {
  width: 100%;
  min-height: 72vh;
  background: transparent;
  border: none;
}

.file-preview__text {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.file-preview__text pre {
  color: hsl(var(--foreground));
  word-break: normal;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
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

  .file-page__hero {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
