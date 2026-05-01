<script lang="ts" setup>
import type { FormInstance, TableColumnsType } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminMenu,
  AdminMenuSaveInput,
  AdminMenuStatus,
  AdminMenuType,
} from '#/api/admin/menus';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t, $te } from '@vben/locales';

import {
  Button,
  Form,
  Input,
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
  createAdminMenuApi,
  deleteAdminMenuApi,
  listAdminMenusApi,
  updateAdminMenuApi,
} from '#/api/admin/menus';

interface AdminMenuFormModel extends AdminMenuSaveInput {
  component: string;
  icon: string;
  name: string;
  path: string;
  redirect: string;
  status: AdminMenuStatus;
  title: string;
  type: AdminMenuType;
}

type AdminMenuTableRecord = AdminMenu | Record<string, any>;

const statusOptions = [
  { label: '启用', value: 'ON' },
  { label: '禁用', value: 'OFF' },
];

const typeOptions = [
  { label: '目录', value: 'CATALOG' },
  { label: '菜单', value: 'MENU' },
  { label: '按钮', value: 'BUTTON' },
  { label: '内嵌页', value: 'EMBEDDED' },
  { label: '外链', value: 'LINK' },
];

const statusTextMap: Record<AdminMenuStatus, string> = {
  OFF: '禁用',
  ON: '启用',
};

const typeTextMap: Record<AdminMenuType, string> = {
  BUTTON: '按钮',
  CATALOG: '目录',
  EMBEDDED: '内嵌页',
  LINK: '外链',
  MENU: '菜单',
};

const columns: TableColumnsType<AdminMenu> = [
  {
    key: 'menu',
    title: '菜单',
    width: 260,
  },
  {
    dataIndex: 'path',
    title: '路径',
    width: 180,
  },
  {
    dataIndex: 'component',
    title: '组件',
    width: 240,
  },
  {
    dataIndex: 'type',
    key: 'type',
    title: '类型',
    width: 100,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    title: '创建时间',
    width: 170,
  },
  {
    fixed: 'right',
    key: 'action',
    title: '操作',
    width: 150,
  },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const menuItems = ref<AdminMenu[]>([]);
const menuTree = ref<AdminMenu[]>([]);

const searchForm = reactive({
  name: '',
  path: '',
});

const formModel = reactive<AdminMenuFormModel>({
  component: '',
  icon: '',
  name: '',
  parentId: undefined,
  path: '',
  redirect: '',
  status: 'ON',
  title: '',
  type: 'MENU',
});

const modalTitle = computed(() => (editingId.value ? '编辑菜单' : '新增菜单'));
const formRules = computed<Record<string, Rule[]>>(() => ({
  name: [{ message: '请输入路由名称', required: true }],
  path: [{ message: '请输入路径', required: true }],
  status: [{ message: '请选择状态', required: true }],
  title: [{ message: '请输入菜单标题', required: true }],
  type: [{ message: '请选择类型', required: true }],
}));

const parentOptions = computed(() =>
  menuItems.value
    .filter((item) => item.id !== editingId.value)
    .map((item) => ({
      label: `${getDisplayTitle(item.meta?.title)} (${item.name ?? item.path ?? item.id})`,
      value: item.id,
    })),
);

function resetFormModel() {
  Object.assign(formModel, {
    component: '',
    icon: '',
    name: '',
    parentId: undefined,
    path: '',
    redirect: '',
    status: 'ON',
    title: '',
    type: 'MENU',
  });
}

function toAdminMenu(record: AdminMenuTableRecord) {
  return record as AdminMenu;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getStatusText(status?: AdminMenuStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminMenuStatus) {
  return status === 'ON' ? 'success' : 'error';
}

function getTypeText(type?: AdminMenuType) {
  return type ? typeTextMap[type] : '-';
}

function getDisplayTitle(title?: string) {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) {
    return '-';
  }
  return $te(normalizedTitle) ? $t(normalizedTitle) : normalizedTitle;
}

async function loadMenus() {
  loading.value = true;
  try {
    const response = await listAdminMenusApi({
      name: searchForm.name,
      path: searchForm.path,
      pageSize: 200,
    });
    menuItems.value = response.items;
    menuTree.value = response.tree;
  } catch (error) {
    message.error((error as Error).message || '加载菜单列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  await loadMenus();
}

async function handleReset() {
  searchForm.name = '';
  searchForm.path = '';
  await loadMenus();
}

async function openCreate(parent?: AdminMenuTableRecord) {
  editingId.value = undefined;
  resetFormModel();
  const menu = parent ? toAdminMenu(parent) : undefined;
  if (menu?.id) {
    formModel.parentId = menu.id;
  }
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminMenuTableRecord) {
  const menu = toAdminMenu(record);
  if (!menu.id) {
    message.warning('缺少菜单 ID');
    return;
  }

  editingId.value = menu.id;
  Object.assign(formModel, {
    component: menu.component ?? '',
    icon: menu.meta?.icon ?? '',
    name: menu.name ?? '',
    parentId: menu.parentId,
    path: menu.path ?? '',
    redirect: menu.redirect ?? '',
    status: menu.status ?? 'ON',
    title: menu.meta?.title ?? '',
    type: menu.type ?? 'MENU',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitMenu() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminMenuApi(editingId.value, formModel);
      message.success('菜单已更新');
    } else {
      await createAdminMenuApi(formModel);
      message.success('菜单已创建');
    }
    modalOpen.value = false;
    await loadMenus();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminMenuTableRecord) {
  const menu = toAdminMenu(record);
  if (!menu.id) {
    message.warning('缺少菜单 ID');
    return;
  }

  await deleteAdminMenuApi(menu.id);
  message.success('菜单已删除');
  await loadMenus();
}

onMounted(() => {
  loadMenus();
});
</script>

<template>
  <Page auto-content-height title="菜单管理">
    <div class="admin-menu-surface">
      <div class="admin-menu-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item label="路由名称" name="name">
            <Input
              v-model:value="searchForm.name"
              allow-clear
              placeholder="输入路由名称"
            />
          </Form.Item>
          <Form.Item label="路径" name="path">
            <Input
              v-model:value="searchForm.path"
              allow-clear
              placeholder="输入路径"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button html-type="submit" type="primary">
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
          </Form.Item>
        </Form>

        <Button type="primary" @click="openCreate()">
          <template #icon>
            <IconifyIcon icon="lucide:plus" />
          </template>
          新增菜单
        </Button>
      </div>

      <Table
        class="admin-menu-table"
        :columns="columns"
        :data-source="menuTree"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'menu'">
            <div class="menu-cell">
              <span class="menu-main">
                {{ getDisplayTitle(record.meta?.title) }}
              </span>
              <span class="menu-sub">{{
                record.name || record.path || '-'
              }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'type'">
            <Tag>{{ getTypeText(record.type) }}</Tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <Space>
              <Button size="small" type="link" @click="openCreate(record)">
                <template #icon>
                  <IconifyIcon icon="lucide:plus" />
                </template>
                子菜单
              </Button>
              <Button size="small" type="link" @click="openEdit(record)">
                <template #icon>
                  <IconifyIcon icon="lucide:pencil" />
                </template>
                编辑
              </Button>
              <Popconfirm
                title="确认删除该菜单？"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">
                  <template #icon>
                    <IconifyIcon icon="lucide:trash-2" />
                  </template>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </div>

    <Modal
      v-model:open="modalOpen"
      destroy-on-close
      :confirm-loading="submitting"
      :title="modalTitle"
      @ok="submitMenu"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item label="上级菜单" name="parentId">
          <Select
            v-model:value="formModel.parentId"
            allow-clear
            :options="parentOptions"
            placeholder="根级菜单"
          />
        </Form.Item>
        <Form.Item label="菜单标题" name="title">
          <Input v-model:value="formModel.title" placeholder="请输入菜单标题" />
        </Form.Item>
        <Form.Item label="路由名称" name="name">
          <Input v-model:value="formModel.name" placeholder="请输入路由名称" />
        </Form.Item>
        <Form.Item label="路径" name="path">
          <Input v-model:value="formModel.path" placeholder="请输入路径" />
        </Form.Item>
        <Form.Item label="组件" name="component">
          <Input
            v-model:value="formModel.component"
            placeholder="例如 /system/user/index"
          />
        </Form.Item>
        <Form.Item label="重定向" name="redirect">
          <Input
            v-model:value="formModel.redirect"
            placeholder="请输入重定向路径"
          />
        </Form.Item>
        <Form.Item label="图标" name="icon">
          <Input
            v-model:value="formModel.icon"
            placeholder="例如 lucide:settings"
          />
        </Form.Item>
        <Form.Item label="类型" name="type">
          <Select v-model:value="formModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select v-model:value="formModel.status" :options="statusOptions" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-menu-surface {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-menu-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.admin-menu-table {
  flex: 1;
  min-height: 0;
}

.menu-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
  text-align: left;
}

.menu-main {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.menu-sub {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .admin-menu-surface {
    padding: 12px;
  }

  .admin-menu-toolbar {
    align-items: stretch;
  }
}
</style>
