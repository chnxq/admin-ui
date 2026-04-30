<script lang="ts" setup>
import type { FormInstance, TableColumnsType } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminOrgUnit,
  AdminOrgUnitSaveInput,
  AdminOrgUnitStatus,
  AdminOrgUnitType,
} from '#/api/admin/org-units';

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

interface AdminOrgUnitFormModel extends AdminOrgUnitSaveInput {
  code: string;
  name: string;
  sortOrder: number;
  status: AdminOrgUnitStatus;
  type: AdminOrgUnitType;
}

type AdminOrgUnitTableRecord = AdminOrgUnit | Record<string, any>;

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
];

const typeOptions = [
  { label: '公司', value: 'COMPANY' },
  { label: '事业部', value: 'DIVISION' },
  { label: '部门', value: 'DEPARTMENT' },
  { label: '团队', value: 'TEAM' },
  { label: '项目组', value: 'PROJECT' },
  { label: '委员会', value: 'COMMITTEE' },
  { label: '区域', value: 'REGION' },
  { label: '子公司', value: 'SUBSIDIARY' },
  { label: '分支机构', value: 'BRANCH' },
  { label: '其他', value: 'OTHER' },
];

const statusTextMap: Record<AdminOrgUnitStatus, string> = {
  OFF: '禁用',
  ON: '启用',
};

const typeTextMap: Record<AdminOrgUnitType, string> = {
  BRANCH: '分支机构',
  COMMITTEE: '委员会',
  COMPANY: '公司',
  DEPARTMENT: '部门',
  DIVISION: '事业部',
  OTHER: '其他',
  PROJECT: '项目组',
  REGION: '区域',
  SUBSIDIARY: '子公司',
  TEAM: '团队',
};

const columns: TableColumnsType<AdminOrgUnit> = [
  { key: 'orgUnit', title: '组织', width: 260 },
  { dataIndex: 'code', title: '编码', width: 160 },
  { dataIndex: 'type', key: 'type', title: '类型', width: 120 },
  { dataIndex: 'sortOrder', title: '排序', width: 90 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'leaderName', title: '负责人', width: 140 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 170 },
  { fixed: 'right', key: 'action', title: '操作', width: 150 },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const orgUnits = ref<AdminOrgUnit[]>([]);
const orgUnitTree = ref<AdminOrgUnit[]>([]);

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
  editingId.value ? '编辑组织单元' : '新增组织单元',
);
const formRules: Record<string, Rule[]> = {
  code: [{ message: '请输入组织编码', required: true }],
  name: [{ message: '请输入组织名称', required: true }],
  status: [{ message: '请选择状态', required: true }],
  type: [{ message: '请选择类型', required: true }],
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
      message.success('组织单元已更新');
    } else {
      await createAdminOrgUnitApi(formModel);
      message.success('组织单元已创建');
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
  message.success('组织单元已删除');
  await loadOrgUnits();
}

onMounted(() => {
  void loadOrgUnits();
});
</script>

<template>
  <Page auto-content-height>
    <div class="admin-org-unit-surface">
      <div class="admin-org-unit-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.name"
            allow-clear
            placeholder="组织名称"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.code"
            allow-clear
            placeholder="组织编码"
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
          新增组织
        </Button>
      </div>

      <Table
        class="admin-org-unit-table"
        :columns="columns"
        :data-source="orgUnitTree"
        :loading="loading"
        :pagination="false"
        :row-key="(record) => record.id ?? record.code ?? record.name"
        size="middle"
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
              <Button size="small" type="link" @click="openEditModal(record)">
                编辑
              </Button>
              <Popconfirm
                title="确认删除该组织单元？"
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
        <Form.Item label="组织名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入组织名称" />
        </Form.Item>
        <Form.Item label="组织编码" name="code">
          <Input v-model:value="formModel.code" placeholder="请输入组织编码" />
        </Form.Item>
        <Form.Item label="上级组织" name="parentId">
          <Select
            v-model:value="formModel.parentId"
            allow-clear
            :options="parentOptions"
            placeholder="请选择上级组织"
          />
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
        <Form.Item label="电话" name="phone">
          <Input v-model:value="formModel.phone" placeholder="请输入电话" />
        </Form.Item>
        <Form.Item label="邮箱" name="email">
          <Input v-model:value="formModel.email" placeholder="请输入邮箱" />
        </Form.Item>
        <Form.Item label="地址" name="address">
          <Input v-model:value="formModel.address" placeholder="请输入地址" />
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
