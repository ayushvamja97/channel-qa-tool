import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";

type Channel = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  creator: {
    id: number;
    displayName: string;
  };
  _count: {
    posts: number;
  };
};

async function getChannels(): Promise<Channel[]> {
  const res = await fetch("http://localhost:3000/api/channels", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch channels");
  }

  return res.json();
}

export default async function ChannelsPage() {
  const channels = await getChannels();

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Ã¢â€ Â Back to home
        </Link>

        <h1 className="mt-4 mb-2 text-3xl font-bold">Channels</h1>
        <p className="mb-6 text-slate-400">
          Create a new discussion channel or open an existing one.
        </p>

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">Create Channel</h2>

          {user ? (
            <form action="/api/channels" method="POST" className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Channel Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. python"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Write a short description for this channel"
                  rows={4}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <input type="hidden" name="createdBy" value={user.userId} />

              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500"
              >
                Create Channel
              </button>
            </form>
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-slate-300">
              You must be logged in to create a channel.{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300">
                Login here
              </Link>
              .
            </div>
          )}
        </div>

        {channels.length === 0 ? (
          <div className="rounded-lg bg-slate-800 p-6">
            No channels found.
          </div>
        ) : (
          <div className="grid gap-4">
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/channels/${channel.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800"
              >
                <h2 className="text-xl font-semibold">#{channel.name}</h2>

                <p className="mt-2 text-slate-400">
                  {channel.description || "No description"}
                </p>

                <div className="mt-4 text-sm text-slate-500">
                  {channel._count.posts} posts Ã¢â‚¬Â¢ by {channel.creator.displayName}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}