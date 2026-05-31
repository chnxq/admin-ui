# XAdmin Admin UI

`admin-ui` 是 XAdmin 的前端工作区。它沿用了 VBen 5 的 monorepo 结构，但当前分支已经面向 XAdmin 后端做了实际改造，包含租户/平台权限模型、字典管理、站内消息、文件管理等集成。

这份 README 不再沿用上游 VBen 主分支的通用宣传文案，而是说明当前 XAdmin 分支的真实用途和使用方式。

## 仓库定位

- 主应用：`apps/web-antd`
- 当前在用分支：`xadmin-api-integration`
- 对接后端：XAdmin `admin`
- 前端技术栈：Vue 3 + Vite + TypeScript + Ant Design Vue
- 工作区模式：`pnpm` + `turbo` monorepo

## 当前已集成能力

当前分支已经完成或正在持续演进的方向包括：

- 对接 XAdmin 登录与 token 刷新接口
- 动态菜单加载与权限过滤
- 平台/租户视角的字典管理
- 站内消息收件箱集成
- 文件管理：上传、预览、下载、删除

## 环境要求

- Node.js `^22.18.0 || ^24.0.0`
- `pnpm >= 11`

## 安装依赖

```bash
pnpm install
```

## 启动开发

启动 XAdmin 当前主前端：

```bash
pnpm dev:antd
```

或直接执行：

```bash
pnpm -F @vben/web-antd run dev
```

## 构建

```bash
pnpm build:antd
```

## 检查命令

前端主应用类型检查：

```bash
pnpm -F @vben/web-antd run typecheck
```

整个工作区类型检查：

```bash
pnpm exec turbo run typecheck
```

Lint 与格式化：

```bash
pnpm lint
pnpm format
```

字符编码检查：

```bash
pnpm check:encoding
```

## 关键目录

- 主应用：`apps/web-antd`
- 管理端 API 封装：`apps/web-antd/src/api/admin`
- 布局集成：`apps/web-antd/src/layouts`
- 系统管理页面：`apps/web-antd/src/views/system`
- 权限管理页面：`apps/web-antd/src/views/app/permission`
- 个人中心页面：`apps/web-antd/src/views/_core/profile`

## 后端配合方式

该前端默认与同级目录下的 XAdmin 后端仓库配合使用：

- 后端仓库：`../admin`

典型本地联调关系：

- 前端：`http://localhost:5666` 或当前 Vite 实际端口
- 后端 REST：`http://localhost:7788`

实际端口以本地 Vite 配置和后端配置为准。

## 当前分支说明

- 上游 VBen 的部分演示内容已经被删除或替换。
- 菜单、权限、页面行为以 XAdmin 后端资源为准，不再按上游 demo 假设运行。
- 不应再把当前分支视为“原版 VBen 模板”。

## 相关仓库

- XAdmin 后端：`../admin`
- XAdmin 代码生成/工具：`../xkit`
- XAdmin 模板仓库：`../xkit-template`

## 许可证

如无额外项目策略，当前仓库继续沿用上游许可基础。详见 [LICENSE](./LICENSE)。
