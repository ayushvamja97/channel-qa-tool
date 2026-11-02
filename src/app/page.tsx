import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <h1 className="text-4xl font-bold tracking-tight">
            Channel-Based Programming Q&amp;A Tool
          </h1>

          <p className="mt-4 max-w-3xl text-slate-300">
            A discussion platform for programming questions, threaded replies,
            screenshot attachments, voting, search, and moderation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/channels"
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500"
            >
              Browse Channels
            </Link>

            <Link
              href="/channels"
              className="rounded-lg border border-slate-700 px-5 py-3 font-medium hover:bg-slate-800"
            >
              Create Channel
            </Link>

            <Link
              href="/search"
              className="rounded-lg border border-slate-700 px-5 py-3 font-medium hover:bg-slate-800"
            >
              Search Content
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold">Channels</h2>
              <p className="mt-2 text-sm text-slate-400">
                Create and browse topic-based programming discussion spaces.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold">Threaded Replies</h2>
              <p className="mt-2 text-sm text-slate-400">
                Follow nested conversations under each programming question.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold">Uploads and Voting</h2>
              <p className="mt-2 text-sm text-slate-400">
                Share screenshots and vote on useful answers and posts.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-lg font-semibold">Getting Started</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
              <li>Create a channel for your topic</li>
              <li>Post a programming question</li>
              <li>Reply and discuss with others</li>
              <li>Vote on helpful answers</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}