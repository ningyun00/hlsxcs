# HLSXCS

基于 React、Vite、Hono 和 Cloudflare Workers 的服务测试项目。

## 当前结构

- `src/react-app/`：前端服务检测页面
- `src/worker/index.ts`：Worker API 入口
- `wrangler.json`：Cloudflare Worker 部署配置

## 本地检查

```bash
npm install
npm run build
npm run lint
```

## API

当前提供 `GET /api/` 示例接口，用于验证前端是否能访问 Worker。

**注意：数据库绑定和增删改查 API 尚未配置。** 在 Cloudflare 中配置实际数据库及绑定后，才能进行真实数据库 CRUD 测试。