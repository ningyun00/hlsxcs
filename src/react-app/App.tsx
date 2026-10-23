import { useState } from "react";
import "./App.css";

type ApiResult = { name?: string; error?: string };

function App() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkWorker() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/");
      const data = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <section className="panel">
        <p className="eyebrow">HLSXCS · WORKER</p>
        <h1>服务测试</h1>
        <p className="description">用于检查前端与 Cloudflare Worker API 是否连通。</p>
        <button type="button" onClick={checkWorker} disabled={loading}>
          {loading ? "检测中…" : "检测 API"}
        </button>
        {result && (
          <pre className={result.error ? "result error" : "result"}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

export default App;
