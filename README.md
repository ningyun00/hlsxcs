# HLSXCS · MySQL CRUD 测试台

本项目提供 React 网页和 Cloudflare Worker API，通过 **Cloudflare Hyperdrive + mysql2** 连接 MySQL。请只连接专用测试数据库，不要配置生产数据库。

## 1. 创建测试表

在 MySQL 客户端执行 [sql/schema.sql](./sql/schema.sql)。它会创建数据库 `hlsxcs_test` 和表 `test_records`。

表字段：
- `id`：自增主键
- `title`：必填标题，最多 200 字符
- `content`：文本内容
- `created_at` / `updated_at`：创建和更新时间

建议创建一个仅对 `hlsxcs_test.*` 有权限的独立 MySQL 用户。不要把数据库密码写进 Git。

## 2. 创建 Cloudflare Hyperdrive

在 Cloudflare Dashboard 的 **Workers & Pages → Hyperdrive** 新建配置，数据库类型选择 MySQL，连接到 `hlsxcs_test`。

也可以在本地使用 Wrangler（替换示例中的用户名、密码和数据库主机）：

```bash
npx wrangler hyperdrive create hlsxcs-test-db --connection-string="mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/hlsxcs_test"
```

数据库主机必须能从 Cloudflare Hyperdrive 所在网络访问；仅在个人电脑/内网、没有可路由网络入口的 MySQL，不能直接被 Cloudflare 连接。应使用可安全访问的数据库主机，并按数据库供应商建议限制来源 IP、启用 TLS 和最小权限账号。

复制 Hyperdrive 配置 ID，替换根目录 `wrangler.json` 中 `hyperdrive[0].id` 的 `REPLACE_WITH_HYPERDRIVE_ID`。

## 3. 配置 API 访问令牌

从项目根目录执行：

```bash
npx wrangler secret put CRUD_API_TOKEN
```

输入一个足够长的随机令牌。打开网页后，将同一个令牌填入“API 访问令牌”框。令牌仅保存在当前浏览器会话的 sessionStorage 中；不要把令牌提交到仓库。没有令牌的 CRUD 请求会返回 401；未设置 Worker Secret 会返回 503。

## 4. 安装、检查和部署

修改完 Hyperdrive ID 后执行：

```bash
npm install
npm run check
npm run deploy
```

首次添加 `mysql2` 依赖后，`npm install` 会同步更新 `package-lock.json`。若由 GitHub 集成自动构建，请确保构建流程执行 `npm install`（而不是未更新锁文件的 `npm ci`），提交安装后更新的锁文件，再部署。

## 5. API

所有 `/api/records` 端点均需要请求头 `Authorization: Bearer <CRUD_API_TOKEN>`。响应为 JSON。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 检查 Worker 到 MySQL 的连接（不需要令牌） |
| GET | `/api/records?q=关键词&limit=100` | 列表/搜索，最多返回 200 条 |
| GET | `/api/records/:id` | 查询单条 |
| POST | `/api/records` | 新增，JSON：`{"title":"标题","content":"内容"}` |
| PUT | `/api/records/:id` | 修改，JSON：`{"title":"新标题","content":"新内容"}` |
| DELETE | `/api/records/:id` | 删除单条 |

网页支持新增、列表、搜索、编辑和删除。删除前会要求确认。

## 当前验证状态

代码已提交到 `main`。本仓库修改本身不能证明已连通实际数据库：部署前仍需填入真实 Hyperdrive ID、配置 `CRUD_API_TOKEN`、创建测试表并部署。完成后访问 `/api/health`，返回 `{"ok":true,"message":"MySQL 连接成功"}` 才代表真实连接验证通过。
