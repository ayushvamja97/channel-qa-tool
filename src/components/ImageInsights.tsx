"use client";
import { useState } from "react";
type Analysis = { model: string; category: string | null; confidence: number | null; similar: { id: number; url: string; postId: number; score: number }[] };
export default function ImageInsights({ attachmentId }: { attachmentId: number }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function analyze() {
    setBusy(true); setError(""); setAnalysis(null);
    try {
      const response = await fetch("/api/ai/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attachmentId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setAnalysis(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Image analysis unavailable."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 max-w-md text-sm">
    <button onClick={analyze} disabled={busy} className="rounded border border-indigo-600 px-3 py-1 disabled:opacity-50">{busy ? "Analyzing…" : "Find similar screenshots (CNN)"}</button>
    <p role="status" className="mt-1 text-amber-300">{error}</p>
    {analysis && <div className="mt-2 space-y-2 text-slate-300">
      <p>{analysis.category ? `Suggested category: ${analysis.category} (${Math.round((analysis.confidence || 0) * 100)}% model score; not calibrated)` : "Category unclassified. A trained category model is optional."}</p>
      <p>Visual resemblance does not mean the same programming error.</p>
      {analysis.similar.length ? <ul className="space-y-2">{analysis.similar.map(item => <li key={item.id}><a href={`/posts/${item.postId}`} className="text-blue-300 underline">View discussion with similar image #{item.id}</a></li>)}</ul> : <p>No similar analyzed images yet. Analyze another image, then retry.</p>}
      <p className="break-all text-xs text-slate-500">Feature extractor: {analysis.model}</p>
    </div>}
  </div>;
}
