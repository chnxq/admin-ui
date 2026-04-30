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

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

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

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
];

const typeOptions = [
  { label: '普通岗位', value: 'REGULAR' },
  { label: '领导岗位', value: 'LEADER' },
  { label: '管理岗位', value: 'MANAGER' },
  { label: '实习岗位', value: 'INTERN' },
  { label: '合同岗位', value: 'CONTRACT' },
  { label: '其他', value: 'OTHER' },
];

const statusTextMap: Record<AdminPositionStatus, string> = {
  OFF: '禁用',
  ON: '启用',
};

const typeTextMap: Record<AdminPositionType, string> = {
  CONTRACT: '合同岗位',
  INTERN: '实习岗位',
  LEADER: '领导岗位',
  MANAGER: '管理岗位',
  OTHER: '其他',
  REGULAR: '普通岗位',
};

const columns: TableColumnsType<AdminPosition> = [
  { dataIndex: 'id', title: 'ID', width: 80 },
  { key: 'position', title: '职位', width: 260 },
  { dataIndex: 'orgUnitName', title: '组织', width: 180 },
  { dataIndex: 'type', key: 'type', title: '类型', width: 120 },
  { dataIndex: 'level', title: '职级', width: 90 },
  { dataIndex: 'headcount', title: '编制', width: 90 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 170 },
  { fixed: 'right', key: 'action', title: '操作', width: 150 },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const positions = ref<AdminPosition[]>([]);

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

const modalTitle = computed(() => (editingId.value ? '编辑职位' : '新增职位'));
const formRules: Record<string, Rule[]> = {
  code: [{ message: '请输入职位编码', required: true }],
  name: [{ message: '请输入职位名称', required: true }],
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

async function loadPositions() {
  loading.value = true;
  try {
    const result = await listAdminPositionsApi({
      code: searchForm.code,
      name: searchForm.name,
      page: pager.page,
      pageSize: pager.pageSize,
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
  void loadPositions();
}

function handleTableChange(pagination: TablePaginationConfig) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
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
      message.success('职位已更新');
    } else {
      await createAdminPositionApi(formModel);
      message.success('职位已创建');
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
  message.success('职位已删除');
  await loadPositions();
}

onMounted(() => {
  void loadPositions();
});
</script>

<template>
  <Page auto-content-height>
    <div class="admin-position-surface">
      <div class="admin-position-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.name"
            allow-clear
            placeholder="职位名称"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.code"
            allow-clear
            placeholder="职位编码"
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
        <Button type="primary" @click="openCreateModal">
          <template #icon>
            <IconifyIcon icon="lucide:plus" />
          </template>
          新增职位
        </Button>
      </div>

      <Table
        class="admin-position-table"
        :columns="columns"
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
              <Button size="small" type="link" @click="openEditModal(record)">
                编辑
              </Button>
              <Popconfirm
                title="确认删除该职位？"
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
        <Form.Item label="职位名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入职位名称" />
        </Form.Item>
        <Form.Item label="职位编码" name="code">
          <Input v-model:value="formModel.code" placeholder="请输入职位编码" />
        </Form.Item>
        <Form.Item label="类型" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
        <Form.Item label="排序" name="sortOrder">
          <InputNumber v-model:value="formModel.sortOrder" class="full-input" />
        </Form.Item>
        <Form.Item label="职级" name="level">
          <InputNumber v-model:value="formModel.level" class="full-input" />
        </Form.Item>
        <Form.Item label="编制" name="headcount">
          <InputNumber v-model:value="formModel.headcount" class="full-input" />
        </Form.Item>
        <Form.Item label="岗位族" name="jobFamily">
          <Input
            v-model:value="formModel.jobFamily"
            placeholder="请输入岗位族"
          />
        </Form.Item>
        <Form.Item label="岗位等级" name="jobGrade">
          <Input
            v-model:value="formModel.jobGrade"
            placeholder="请输入岗位等级"
          />
        </Form.Item>
        <Form.Item label="关键岗位" name="isKeyPosition">
          <Checkbox v-model:checked="formModel.isKeyPosition" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea
            v-model:value="formModel.description"
            :rows="3"
            placeholder="请输入描述"
          />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea
            v-model:value="formModel.remark"
            :rows="2"
            placeholder="请输入备注"
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
