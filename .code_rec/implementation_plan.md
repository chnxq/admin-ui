# 角色授权界面交互体验优化设计与实现计划

本计划旨在将现有的“角色授权”模态框从单一的 `<TreeSelect>` 下拉框交互，重构为一个高度直观、操作流畅、响应实时的**双栏分治布局**，提供极佳的管理体验。

## User Review Required

> [!NOTE]
>
> 1. 本重构仅修改前端组件的交互表现形式，底层调用的 API（`updateAdminRoleApi`, `listAdminMenusApi` 等）及数据结构均保持不变，对后端没有任何影响。
> 2. 权限数据在前端被抽象为“已选权限”、“关联页面（菜单）”、“关联接口（API）”，并能在左侧树状结构勾选时**实时动态计算并在右侧展示**，操作手感更加平滑。

## Open Questions

无。

## Proposed Changes

### apps/web-antd

#### [MODIFY] [index.vue](file:///d:/GoProjects/XAdmin/admin-ui/apps/web-antd/src/views/system/role/index.vue)

我们将对 `role/index.vue` 进行如下修改：

1. **组件引入与依赖**：
   - 导入 Ant Design Vue 的 `<Tree>`, `<Tabs>`, `<TabPane>` 等组件。
   - 在 `buildPermissionTree` 返回的节点数据中同时附加 `key` 属性（目前仅有 `value`），以便适配 `<Tree>` 组件。

2. **逻辑状态管理**：
   - 引入 `treeSearchValue`，实现对权限树的实时过滤。
   - 引入 `filteredPermissionTreeData` 计算属性，动态过滤权限树数据，并在搜索时自动展开匹配节点。
   - 引入 `treeCheckedKeys`，绑定树勾选状态；监听勾选变化并自动同步到 `authorizePermissionIds`（自动过滤掉 Group 的 String 键，仅保存 Permission ID 的 Number 键）。
   - 增加辅助操作方法：`expandAll`、`collapseAll`、`selectAll`、`clearAll`。
   - 增加 API 方法颜色的计算逻辑 `getApiMethodColor`。

3. **模态框布局升级**：
   - 废弃原有的单表单 `<TreeSelect>` 下拉框和底部三栏静态预览。
   - 实现一个 960px 宽度的双栏结构 `.authorize-container`：
     - **左侧面板（权限勾选树）**：
       - 顶部配有搜索框及“展开/折叠/全选/清空”快捷栏。
       - 中部为支持虚拟滚动、带复选框的 `<Tree>` 视图，展示权限分组与具体权限的层级关系。
     - **右侧面板（关联影响预览）**：
       - 使用 `<Tabs>` 拆分为三个标签页：
         1. **已选权限**：列出已勾选的权限项，并支持一键移除（点击删除按钮同步取消左侧树勾选）。
         2. **关联页面**：实时计算并展示这组权限所包含的菜单页面（只读预览）。
         3. **关联接口**：实时计算并展示这组权限能调用的后台 API 接口（按 HTTP Method 渲染彩色 Tag）。

4. **样式重构**：
   - 采用现代玻璃感与微渐变的 HSL 调色系统，为面板容器、勾选项、预览列表卡片提供精美的悬浮与交互微动效。
   - 优化响应式表现，在中小屏设备下自动降级为单列布局。

---

## Verification Plan

### Manual Verification

1. 点击系统管理中任意角色的“授权”按钮，弹出全新双栏模态框。
2. 在左侧搜索框输入关键词（如 `user` 或 `用户`），验证权限树能否实时收缩并自动展开匹配的节点。
3. 勾选/取消勾选左侧权限节点，验证右侧“已选权限”、“关联页面”及“关联接口”的计数和列表是否即时联动更新。
4. 在右侧“已选权限”列表中点击删除图标，验证左侧树状结构中对应的复选框能否同步被取消勾选。
5. 点击“全选”与“清空”，验证状态是否正确。
6. 点击“确认”提交保存，验证接口调用成功，且角色列表中的权限数据正确刷新。
