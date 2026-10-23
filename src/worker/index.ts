import { Hono } from "hono";
import { createConnection } from "mysql2/promise";

interface Env {
  HYPERDRIVE: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  CRUD_API_TOKEN?: string;
}

type RecordRow = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

const app = new Hono<{ Bindings: Env }>();

async function getConnection(env: Env) {
  const db = env.HYPERDRIVE;
  if (!db?.host || !db.user || !db.password || !db.database || !db.port) {
    throw new Error("Hyperdrive binding HYPERDRIVE is missing host/user/password/database/port.");
  }
  return createConnection({
    host: db.host,
    user: db.user,
    password: db.password,
    database: db.database,
    port: Number(db.port),
    disableEval: true,
  });
}

async function ensureSchema(pool: Awaited<ReturnType<typeof getConnection>>) {
  await pool.query("CREATE DATABASE IF NOT EXISTS hlsxcs_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await pool.query(`CREATE TABLE IF NOT EXISTS hlsxcs_test.test_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_test_records_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});

app.use("/api/records", async (c, next) => {
  const expected = c.env.CRUD_API_TOKEN;
  if (!expected) return c.json({ ok: false, message: "CRUD_API_TOKEN secret is not configured." }, 503);
  const supplied = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== expected) return c.json({ ok: false, message: "未授权：请填写正确的 API 访问令牌。" }, 401);
  await next();
});

app.use("/api/records/*", async (c, next) => {
  const expected = c.env.CRUD_API_TOKEN;
  if (!expected) return c.json({ ok: false, message: "CRUD_API_TOKEN secret is not configured." }, 503);
  const supplied = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== expected) return c.json({ ok: false, message: "未授权：请填写正确的 API 访问令牌。" }, 401);
  await next();
});

app.get("/api/health", async (c) => {
  let pool: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    pool = await getConnection(c.env);
    await ensureSchema(pool);
    await pool.query("SELECT 1 AS ok");
    return c.json({ ok: true, message: "MySQL 连接成功" });
  } catch (error) {
    return c.json({
      ok: false,
      message: error instanceof Error ? error.message : "MySQL connection failed",
    }, 503);
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
});

app.get("/api/records", async (c) => {
  let pool: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    pool = await getConnection(c.env);
    await ensureSchema(pool);
    const q = (c.req.query("q") ?? "").trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100) || 100, 1), 200);
    const [rows] = q
      ? await pool.execute(
          "SELECT id, title, content, created_at, updated_at FROM hlsxcs_test.test_records WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC LIMIT ?",
          [`%${q}%`, `%${q}%`, limit],
        )
      : await pool.execute(
          "SELECT id, title, content, created_at, updated_at FROM hlsxcs_test.test_records ORDER BY id DESC LIMIT ?",
          [limit],
        );
    return c.json({ ok: true, records: rows as RecordRow[] });
  } catch (error) {
    return c.json({
      ok: false,
      message: error instanceof Error ? error.message : "读取记录失败",
      hint: "请确认已创建 hlsxcs_test.test_records 数据表，并配置 Hyperdrive 绑定。",
    }, 500);
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
});

app.get("/api/records/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ ok: false, message: "无效的记录 ID" }, 400);
  let pool: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    pool = await getConnection(c.env);
    await ensureSchema(pool);
    const [rows] = await pool.execute(
      "SELECT id, title, content, created_at, updated_at FROM hlsxcs_test.test_records WHERE id = ? LIMIT 1",
      [id],
    );
    const record = (rows as RecordRow[])[0];
    if (!record) return c.json({ ok: false, message: "记录不存在" }, 404);
    return c.json({ ok: true, record });
  } catch (error) {
    return c.json({ ok: false, message: error instanceof Error ? error.message : "读取记录失败" }, 500);
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
});

app.post("/api/records", async (c) => {
  let body: { title?: unknown; content?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, message: "请求体必须是 JSON" }, 400);
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title) return c.json({ ok: false, message: "标题不能为空" }, 400);
  if (title.length > 200) return c.json({ ok: false, message: "标题不能超过 200 个字符" }, 400);
  if (content.length > 20000) return c.json({ ok: false, message: "内容不能超过 20000 个字符" }, 400);

  let pool: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    pool = await getConnection(c.env);
    await ensureSchema(pool);
    const [result] = await pool.execute(
      "INSERT INTO hlsxcs_test.test_records (title, content) VALUES (?, ?)",
      [title, content],
    );
    const insertId = (result as { insertId: number }).insertId;
    const [rows] = await pool.execute(
      "SELECT id, title, content, created_at, updated_at FROM hlsxcs_test.test_records WHERE id = ?",
      [insertId],
    );
    return c.json({ ok: true, record: (rows as RecordRow[])[0] }, 201);
  } catch (error) {
    return c.json({ ok: false, message: error instanceof Error ? error.message : "新增记录失败" }, 500);
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
});

app.put("/api/records/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ ok: false, message: "无效的记录 ID" }, 400);
  let body: { title?: unknown; content?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, message: "请求体必须是 JSON" }, 400);
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title) return c.json({ ok: false, message: "标题不能为空" }, 400);
  if (title.length > 200) return c.json({ ok: false, message: "标题不能超过 200 个字符" }, 400);
  if (content.length > 20000) return c.json({ ok: false, message: "内容不能超过 20000 个字符" }, 400);

  let pool: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    pool = await getConnection(c.env);
    await ensureSchema(pool);
    const [result] = await pool.execute(
      "UPDATE hlsxcs_test.test_records SET title = ?, content = ? WHERE id = ?",
      [title, content, id],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      const [rows] = await pool.execute("SELECT id FROM hlsxcs_test.test_records WHERE id = ?", [id]);
      if ((rows as unknown[]).length === 0) return c.json({ ok: false, message: "记录不存在" }, 404);
    }
    const [rows] = await pool.execute(
      "SELECT id, title, content, created_at, updated_at FROM hlsxcs_test.test_records WHERE id = ?",
      [id],
    );
    return c.json({ ok: true, record: (rows as RecordRow[])[0] });
  } catch (error) {
    return c.json({ ok: false, message: error instanceof Error ? error.message : "更新记录失败" }, 500);
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
});

app.delete("/api/records/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ ok: false, message: "无效的记录 ID" }, 400);
  let pool: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    pool = await getConnection(c.env);
    await ensureSchema(pool);
    const [result] = await pool.execute("DELETE FROM hlsxcs_test.test_records WHERE id = ?", [id]);
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return c.json({ ok: false, message: "记录不存在" }, 404);
    }
    return c.json({ ok: true, deletedId: id });
  } catch (error) {
    return c.json({ ok: false, message: error instanceof Error ? error.message : "删除记录失败" }, 500);
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
});

app.notFound((c) => c.json({ ok: false, message: "API 路径不存在" }, 404));

export default app;
