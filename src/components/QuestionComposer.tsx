"use client";
import { useState } from "react";

type Suggestion = { title: string; body: string; missingDetails: string[] };
type Match = { id: number; title: string; channel: string; score: number };
export default function QuestionComposer({ channelId }: { channelId: number }) {
  const [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function assist(action: "review" | "similar") {
    setBusy(true); setError(""); setSuggestion(null); setMatches(null);
    try {
      const response = await fetch("/api/ai/question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, title, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      if (action === "review") setSuggestion(data.suggestion); else setMatches(data.results);
    } catch (error) { setError(error instanceof Error ? error.message : "AI assistance unavailable."); }
    finally { setBusy(false); }
  }
  function clearAdvice() { setSuggestion(null); setMatches(null); }
  return <form action="/api/posts" method="POST" className="space-y-4">
    <label className="block">Post title
      <input name="title" readOnly={busy} value={title} onChange={e => { setTitle(e.target.value); clearAdvice(); }} required minLength={3} maxLength={180} placeholder="What are you trying to solve?" className="mt-2 w-full rounded-lg bg-slate-800 p-3" />
    </label>
    <label className="block">Post body
      <textarea name="body" readOnly={busy} value={body} onChange={e => { setBody(e.target.value); clearAdvice(); }} required minLength={5} maxLength={10000} rows={6} placeholder="Include expected behavior, what happened, and steps to reproduce." className="mt-2 w-full rounded-lg bg-slate-800 p-3" />
    </label>
    <input type="hidden" name="channelId" value={channelId} />
    <div className="rounded-lg border border-indigo-800 bg-indigo-950/30 p-4">
      <p className="font-medium">A clearer question gets a better discussion</p>
      <p className="mt-1 text-sm text-slate-400">Optional AI tools send this draft to the configured AI provider. Remove secrets first. Suggestions never publish automatically.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" disabled={busy || title.length < 3 || body.length < 5} onClick={() => assist("review")} className="rounded bg-indigo-600 px-3 py-2 disabled:opacity-50">Review question</button>
        <button type="button" disabled={busy || title.length < 3 || body.length < 5} onClick={() => assist("similar")} className="rounded border border-indigo-600 px-3 py-2 disabled:opacity-50">Find similar questions</button>
      </div>
      <div role="status" aria-live="polite" className="mt-3 text-sm">{busy && "Checking your draft…"}{error && <p className="text-amber-300">{error}</p>}</div>
      {suggestion && <div className="mt-3 space-y-3">
        <p className="font-semibold">Suggested title: {suggestion.title}</p>
        <p className="whitespace-pre-wrap text-slate-300">{suggestion.body}</p>
        {suggestion.missingDetails.length > 0 && <><p>Details to add:</p><ul className="list-disc pl-5">{suggestion.missingDetails.map((detail, i) => <li key={i}>{detail}</li>)}</ul></>}
        <button type="button" onClick={() => { setTitle(suggestion.title); setBody(suggestion.body); setSuggestion(null); }} className="rounded bg-indigo-600 px-3 py-2">Use suggestion in draft</button>
        <button type="button" onClick={() => setSuggestion(null)} className="ml-3 underline">Keep original</button>
      </div>}
      {matches && <div className="mt-3"><p>{matches.length ? "Potentially related discussions — similarity does not prove duplication:" : "No related indexed questions found."}</p><ul className="mt-2 space-y-2">{matches.map(match => <li key={match.id}><a href={`/posts/${match.id}`} target="_blank" rel="noreferrer" className="text-blue-300 underline">{match.title}</a> <span className="text-slate-400">#{match.channel}</span></li>)}</ul></div>}
    </div>
    <button type="submit" disabled={busy} className="rounded-lg bg-green-600 px-5 py-3 disabled:opacity-50">Create Post</button>
  </form>;
}
