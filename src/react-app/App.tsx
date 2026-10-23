import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type RecordItem = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};
type ApiResult = { ok: boolean; message?: string; records?: RecordItem[]; record?: RecordItem; database?: string | null };

const styles = `
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f3f6fb;font-synthesis:none;text-rendering:optimizeLegibility}
*{box-sizing:border-box}body{margin:0;min-width:320px;min-height:100vh}
button,input,textarea{font:inherit}button{cursor:pointer}
.shell{max-width:1180px;margin:0 auto;padding:28px 20px 56px}
.header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:13px}.logo{width:46px;height:46px;border-radius:14px;background:#2563eb;color:white;display:grid;place-items:center;font-weight:800;font-size:20px}
h1{font-size:25px;margin:0 0 5px;letter-spacing:-.5px}.sub{color:#718096;font-size:13px}
.status{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;background:#fff;border:1px solid #e1e8f2;font-size:13px;color:#64748b}.dot{width:8px;height:8px;border-radius:50%;background:#f59e0b}.dot.ok{background:#16a34a}.dot.bad{background:#dc2626}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}.stat{background:white;border:1px solid #e7edf5;border-radius:16px;padding:18px}.stat-label{font-size:12px;color:#7a8799}.stat-value{font-size:23px;font-weight:750;margin-top:8px}
.layout{display:grid;grid-template-columns:minmax(300px, .85fr) minmax(0,1.5fr);gap:18px;align-items:start}
.panel{background:#fff;border:1px solid #e3eaf3;border-radius:18px;overflow:hidden;box-shadow:0 5px 18px #17203308}.panel-head{padding:19px 20px 14px;border-bottom:1px solid #edf1f6}.panel-head h2{font-size:16px;margin:0 0 5px}.panel-head p{font-size:12px;color:#8490a2;margin:0}.panel-body{padding:20px}
label{display:block;font-size:13px;font-weight:650;color:#334155;margin-bottom:8px}.field{width:100%;border:1px solid #dce4ef;background:#fbfcfe;border-radius:10px;padding:11px 12px;outline:none;color:#172033}.field:focus{border-color:#6c9af7;box-shadow:0 0 0 3px #2563eb15}.field::placeholder{color:#a3adba}textarea.field{resize:vertical;min-height:150px;line-height:1.55}.group{margin-bottom:17px}
.btn{border:0;border-radius:10px;padding:10px 14px;font-weight:650;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:transform .12s,opacity .12s}.btn:disabled{opacity:.55;cursor:not-allowed}.btn:active{transform:scale(.98)}.primary{background:#2563eb;color:white}.secondary{background:#eef3fa;color:#334155}.danger{background:#fff0f0;color:#c24141}.full{width:100%}.actions{display:flex;gap:9px;flex-wrap:wrap}
.notice{margin-top:14px;border-radius:10px;padding:11px 12px;font-size:13px;line-height:1.5;background:#f0fdf4;color:#166534}.notice.error{background:#fff1f2;color:#be123c}.notice.info{background:#eff6ff;color:#1d4ed8}
.toolbar{padding:15px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #edf1f6}.search{flex:1;min-width:100px}.count{font-size:12px;color:#718096;white-space:nowrap}
.records{padding:6px 14px 14px}.record{display:flex;gap:12px;padding:15px 5px;border-bottom:1px solid #edf1f6}.record:last-child{border-bottom:0}.record-main{min-width:0;flex:1}.record-title{font-weight:700;font-size:14px;overflow-wrap:anywhere;margin-bottom:6px}.record-content{font-size:13px;color:#64748b;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;max-height:75px;overflow:hidden}.record-meta{font-size:11px;color:#9aa4b2;margin-top:9px}.record-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0}.mini{font-size:12px;padding:7px 9px;border-radius:8px}.empty{padding:42px 20px;text-align:center;color:#8995a6;font-size:13px}.empty strong{display:block;color:#475569;font-size:15px;margin-bottom:7px}.footer{color:#94a3b8;font-size:11px;text-align:center;margin-top:20px}
@media(max-width:760px){.shell{padding:18px 12px 32px}.header{align-items:flex-start}.header h1{font-size:20px}.status{font-size:11px;padding:8px}.stats{gap:8px}.stat{padding:13px 12px;border-radius:13px}.stat-value{font-size:19px}.stat-label{font-size:11px}.layout{grid-template-columns:1fr}.panel-body{padding:16px}.toolbar{padding:12px}.records{padding:5px 12px 12px}.record-actions{flex-direction:column}.btn{padding:10px 12px}}
`;

async function request(path: string, init?: RequestInit, token = ""): Promise<ApiResult> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
  });
  const data = await response.json() as ApiResult;
  if (!response.ok || !data.ok) throw new Error(data.message || `请求失败（${response.status}）`);
  return data;
}

function App() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [token, setToken] = useState(() => window.sessionStorage.getItem("hlsxcs-crud-token") ?? "");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "bad">("checking");


  const load = useCallback(async (query = search) => {
    try {
      const data = await request(`/api/records?q=${encodeURIComponent(query)}&limit=200`, undefined, token);
      setRecords(data.records ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取数据失败");
    }
  }, [search, token]);

  const checkDb = useCallback(async () => {
    try {
      await request("/api/health");
      setDbStatus("ok");

    } catch {
      setDbStatus("bad");

    }
  }, []);

  useEffect(() => {
    void checkDb();
    void load("");
  }, [checkDb, load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  const resetForm = () => { setTitle(""); setContent(""); setEditingId(null); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const path = editingId === null ? "/api/records" : `/api/records/${editingId}`;
      await request(path, { method: editingId === null ? "POST" : "PUT", body: JSON.stringify({ title, content }) }, token);
      setMessage(editingId === null ? "新增成功，数据已写入 MySQL。" : "修改成功，数据已更新。");
      resetForm();
      await load(search);
      await checkDb();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally { setBusy(false); }
  };

  const edit = (item: RecordItem) => {
    setEditingId(item.id); setTitle(item.title); setContent(item.content);
    setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (item: RecordItem) => {
    if (!window.confirm(`确定删除记录 #${item.id}「${item.title}」吗？此操作无法撤销。`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/api/records/${item.id}`, { method: "DELETE" }, token);
      setMessage(`记录 #${item.id} 已删除。`);
      if (editingId === item.id) resetForm();
      await load(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally { setBusy(false); }
  };

  const latestTime = useMemo(() => records[0]?.updated_at ? new Date(records[0].updated_at).toLocaleString() : "暂无记录", [records]);
  const dbLabel = dbStatus === "checking" ? "正在检查数据库" : dbStatus === "ok" ? "MySQL 已连接" : "数据库连接失败";
  return <>
    <style>{styles}</style>
    <main className="shell">
      <header className="header">
        <div className="brand"><div className="logo">DB</div><div><h1>MySQL 数据管理台</h1><div className="sub">Cloudflare Workers + Hyperdrive · 测试数据库 CRUD</div></div></div>
        <div className="status"><span className={`dot ${dbStatus === "ok" ? "ok" : dbStatus === "bad" ? "bad" : ""}`}/>{dbLabel}</div>
      </header>
      <section className="stats">
        <div className="stat"><div className="stat-label">当前列表记录</div><div className="stat-value">{records.length}</div></div>
        <div className="stat"><div className="stat-label">数据操作</div><div className="stat-value">CRUD</div></div>
        <div className="stat"><div className="stat-label">最近更新</div><div className="stat-value" style={{fontSize:14,marginTop:12}}>{latestTime}</div></div>
      </section>
      <section className="layout">
        <div className="panel">
          <div className="panel-head"><h2>{editingId === null ? "新增测试记录" : `编辑记录 #${editingId}`}</h2><p>填写标题与内容，提交后将直接写入 MySQL。</p></div>
          <form className="panel-body" onSubmit={save}>
            <div className="group"><label htmlFor="api-token">API 访问令牌</label><input id="api-token" className="field" type="password" autoComplete="off" value={token} onChange={e=>{setToken(e.target.value);window.sessionStorage.setItem("hlsxcs-crud-token",e.target.value);}} placeholder="填写 Cloudflare CRUD_API_TOKEN" /><div className="sub" style={{marginTop:7}}>令牌只保存在当前浏览器会话中；刷新页面仍可使用，关闭标签页后清除。</div></div>
            <div className="group"><label htmlFor="title">标题 <span style={{color:"#dc2626"}}>*</span></label><input id="title" className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} placeholder="例如：测试第一条记录" required /></div>
            <div className="group"><label htmlFor="content">内容</label><textarea id="content" className="field" value={content} onChange={e=>setContent(e.target.value)} maxLength={20000} placeholder="输入测试数据、备注或 JSON 文本…" /></div>
            <div className="actions"><button className="btn primary" type="submit" disabled={busy}>{busy ? "处理中…" : editingId === null ? "＋ 新增记录" : "保存修改"}</button>{editingId !== null && <button className="btn secondary" type="button" onClick={resetForm}>取消编辑</button>}<button className="btn secondary" type="button" onClick={()=>{void checkDb();void load(search)}} disabled={busy}>刷新数据</button></div>
            {message && <div className="notice">{message}</div>}
            {error && <div className="notice error">{error}</div>}
            {dbStatus === "bad" && !error && <div className="notice info">数据库尚未连通。请先在 Cloudflare 配置 Hyperdrive，并创建测试表。</div>}
          </form>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>数据记录</h2><p>查询、编辑、删除数据库中的测试数据。</p></div>
          <div className="toolbar"><input className="field search" aria-label="搜索记录" placeholder="搜索标题或内容…" value={search} onChange={e=>setSearch(e.target.value)}/><span className="count">{records.length} 条</span></div>
          <div className="records">
            {records.length === 0 ? <div className="empty"><strong>{error ? "暂时无法加载数据" : "还没有记录"}</strong>{error ? "请检查数据库连接与测试表配置。" : "在左侧新增一条记录，验证新增和查询功能。"}</div> : records.map(item=><article className="record" key={item.id}>
              <div className="record-main"><div className="record-title">#{item.id} · {item.title}</div><div className="record-content">{item.content || "（无内容）"}</div><div className="record-meta">创建：{new Date(item.created_at).toLocaleString()} · 更新：{new Date(item.updated_at).toLocaleString()}</div></div>
              <div className="record-actions"><button className="btn secondary mini" onClick={()=>edit(item)} disabled={busy}>编辑</button><button className="btn danger mini" onClick={()=>void remove(item)} disabled={busy}>删除</button></div>
            </article>)}
          </div>
        </div>
      </section>
      <div className="footer">测试用途 · 请勿在此页面录入敏感信息 · 删除操作会直接影响测试数据库</div>
    </main>
  </>;
}

export default App;
