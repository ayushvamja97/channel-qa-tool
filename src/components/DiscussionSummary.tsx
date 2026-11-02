"use client";
import { useState } from "react";
type Summary = { overview: string; points: { text: string; replyIds: number[] }[]; unresolved: string[] };
export default function DiscussionSummary({ postId }: { postId: number }) {
  const [summary, setSummary] = useState<Summary | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function summarize() {
    setBusy(true); setError(""); setSummary(null);
    try {
      const response = await fetch("/api/ai/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSummary(data.summary);
    } catch (error) { setError(error instanceof Error ? error.message : "Summary unavailable."); }
    finally { setBusy(false); }
  }
  return <section className="my-6 rounded-xl border border-indigo-800 bg-indigo-950/30 p-5">
    <h2 className="text-lg font-semibold">Catch up on this discussion</h2>
    <p className="mt-1 text-sm text-slate-400">AI sends this question and up to 40 replies to the configured provider. The summary may be wrong; check its sources.</p>
    <button disabled={busy} onClick={summarize} className="mt-3 rounded bg-indigo-600 px-3 py-2 disabled:opacity-50">{busy ? "Summarizing…" : "Summarize discussion"}</button>
    <p role="status" className="mt-2 text-sm text-amber-300">{error}</p>
    {summary && <div className="mt-4 space-y-3"><p>{summary.overview}</p><ul className="list-disc space-y-2 pl-5">{summary.points.map((point, i) => <li key={i}>{point.text} {point.replyIds.map(id => <a className="ml-2 text-blue-300 underline" key={id} href={`#reply-${id}`}>Reply #{id}</a>)}</li>)}</ul>{summary.unresolved.length > 0 && <><h3 className="font-medium">Still unresolved</h3><ul className="list-disc pl-5">{summary.unresolved.map((text, i) => <li key={i}>{text}</li>)}</ul></>}</div>}
  </section>;
}
